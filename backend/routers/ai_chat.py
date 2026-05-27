"""
/api/ai/chat — proxies to Anthropic Claude API.
The API key is read from the ANTHROPIC_API_KEY environment variable.
No key = graceful error (chatbot shows useful message).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from typing import List, Literal, Optional
import httpx, os

router = APIRouter(prefix="/api/ai", tags=["ai"])

CLAUDE_API = "https://api.anthropic.com/v1/messages"
MAX_MSG_LEN = 8000
MAX_MSGS    = 20


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

    @field_validator("content")
    @classmethod
    def sanitise_content(cls, v: str) -> str:
        # Strip null bytes, limit length
        return v.replace("\x00", "")[:MAX_MSG_LEN]


class ChatRequest(BaseModel):
    system: Optional[str] = None
    messages: List[ChatMessage]

    @field_validator("messages")
    @classmethod
    def limit_messages(cls, v):
        return v[-MAX_MSGS:]  # Keep only latest N messages


@router.post("/chat")
async def chat(body: ChatRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return {
            "response": (
                "The AI assistant is not configured — no ANTHROPIC_API_KEY set. "
                "To enable it, add your key: `export ANTHROPIC_API_KEY=sk-ant-...`"
            )
        }

    payload = {
        "model": "claude-sonnet-4-5",
        "max_tokens": 1024,
        "messages": [{"role": m.role, "content": m.content} for m in body.messages],
    }
    if body.system:
        # Sanitise system prompt too
        payload["system"] = body.system.replace("\x00", "")[:8000]

    try:
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
        text = data.get("content", [{}])[0].get("text", "")
        return {"response": text}

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"AI request failed: {e}")
