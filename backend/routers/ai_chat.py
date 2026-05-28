"""
/api/ai/chat — pluggable LLM proxy.

Provider is selected via the `LLM_PROVIDER` env var:
  - "anthropic" (default)  → Claude API,           needs ANTHROPIC_API_KEY
  - "ollama"               → local Ollama daemon,  needs OLLAMA_BASE_URL + OLLAMA_MODEL

When provider is `ollama` and `mode` is supplied on the request, the system
prompt is enriched with few-shot exemplars distilled from backend/sample_forms/
so that a small local model has the schema patterns to imitate.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from typing import List, Literal, Optional
import httpx, os

from ..services.exemplar_pack import enrich_system_prompt

router = APIRouter(prefix="/api/ai", tags=["ai"])

CLAUDE_API   = "https://api.anthropic.com/v1/messages"
MAX_MSG_LEN  = 8000
MAX_MSGS     = 20

PROVIDER         = os.environ.get("LLM_PROVIDER", "anthropic").lower()
OLLAMA_BASE_URL  = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL     = os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:7b")
ANTHROPIC_MODEL  = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")


ChatMode = Literal["help", "fill", "create"]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

    @field_validator("content")
    @classmethod
    def sanitise_content(cls, v: str) -> str:
        return v.replace("\x00", "")[:MAX_MSG_LEN]


class ChatRequest(BaseModel):
    system: Optional[str] = None
    messages: List[ChatMessage]
    mode: Optional[ChatMode] = None

    @field_validator("messages")
    @classmethod
    def limit_messages(cls, v):
        return v[-MAX_MSGS:]


# ── Provider implementations ──────────────────────────────────────────────────

async def _call_anthropic(system: Optional[str], messages: List[ChatMessage]) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return (
            "The AI assistant is not configured — no ANTHROPIC_API_KEY set. "
            "To enable it, add your key: `export ANTHROPIC_API_KEY=sk-ant-...`  "
            "Or set LLM_PROVIDER=ollama to run a local model."
        )
    payload = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": 1024,
        "messages": [{"role": m.role, "content": m.content} for m in messages],
    }
    if system:
        payload["system"] = system

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            CLAUDE_API,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )
    if res.status_code != 200:
        err = res.json().get("error", {}).get("message", "API error")
        raise HTTPException(status_code=502, detail=err)
    data = res.json()
    return data.get("content", [{}])[0].get("text", "")


async def _call_ollama(system: Optional[str], messages: List[ChatMessage]) -> str:
    """Uses Ollama's OpenAI-compatible /v1/chat/completions endpoint."""
    msgs: list[dict] = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.extend({"role": m.role, "content": m.content} for m in messages)

    payload = {
        "model": OLLAMA_MODEL,
        "messages": msgs,
        "temperature": 0.2,
        "stream": False,
    }
    url = f"{OLLAMA_BASE_URL}/v1/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(url, json=payload)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Could not reach Ollama at {OLLAMA_BASE_URL}. "
                "Start it with `ollama serve` or `docker compose up ollama`."
            ),
        )
    if res.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Ollama error: {res.text[:300]}")
    data = res.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Malformed response from Ollama")


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(body: ChatRequest):
    system = body.system.replace("\x00", "")[:8000] if body.system else None

    # Local models benefit greatly from in-context exemplars; remote frontier
    # models like Claude already know the schema after a paragraph of guidance,
    # so we only enrich when the provider is local.
    if PROVIDER == "ollama" and body.mode:
        system = enrich_system_prompt(system or "", body.mode)

    try:
        if PROVIDER == "ollama":
            text = await _call_ollama(system, body.messages)
        else:
            text = await _call_anthropic(system, body.messages)
        return {"response": text, "provider": PROVIDER}
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"AI request failed: {e}")


@router.get("/config")
async def ai_config():
    """Lightweight introspection — the UI can show which model is wired up."""
    return {
        "provider": PROVIDER,
        "model": OLLAMA_MODEL if PROVIDER == "ollama" else ANTHROPIC_MODEL,
        "configured": (
            bool(os.environ.get("ANTHROPIC_API_KEY"))
            if PROVIDER == "anthropic"
            else True
        ),
    }
