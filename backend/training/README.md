# Form Engine — Local LLM & Fine-tuning

This directory contains everything needed to (a) run a local small LLM as the
chat backend instead of Claude, and (b) fine-tune that local model on synthetic
Form-Engine YAML examples so it gets dramatically better at the `create` mode.

## TL;DR — three modes, increasing effort

| Mode | What you get | Setup time | Cost |
|---|---|---|---|
| **A. Claude (default)** | Best quality across all modes | 1 min | per-token |
| **B. Ollama base model + few-shot** | Free, private, decent quality | 10 min | $0 |
| **C. Ollama fine-tuned model** | Free, private, ~Claude quality on `create` mode | ~1 hour + ~$3 | $0 ongoing |

Today the codebase ships with A and B working out of the box. Path C is
scaffolded — you run it when you want the extra quality.

---

## Mode A — Claude (default, no changes needed)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
docker compose up
```

`LLM_PROVIDER` defaults to `anthropic`, the existing chat works.

---

## Mode B — local Ollama + few-shot exemplars

The backend [`exemplar_pack.py`](../services/exemplar_pack.py) automatically
injects a compact schema reference + a real exemplar manifest into the system
prompt **only when the provider is `ollama`**. This is the trick that lets a
7B model produce valid YAML without fine-tuning.

```bash
# Start Ollama alongside the API
LLM_PROVIDER=ollama docker compose --profile local-ai up

# In another shell — pull the base model (one-time, ~5GB)
docker compose exec ollama ollama pull qwen2.5-coder:7b
```

Open the chat at <http://localhost:3000/chat>. Verify the wiring:

```bash
curl http://localhost:8000/api/ai/config
# {"provider":"ollama","model":"qwen2.5-coder:7b","configured":true}
```

GPU acceleration is opt-in — uncomment the `deploy.resources` block in
[`docker-compose.yml`](../../docker-compose.yml) (needs NVIDIA Container Toolkit
on the host).

---

## Mode C — fine-tune Qwen on synthetic Form-Engine data

Three steps: **generate** dataset → **train** LoRA on Colab → **register** the
result with Ollama.

### 1. Generate the dataset

[`generate_dataset.py`](generate_dataset.py) uses Claude to synthesise ~80
(natural-language description → YAML) pairs across 40+ domains and four
complexity tiers. Every generated YAML is parsed and validated against the real
`FormManifest` pydantic model — invalid outputs are retried automatically.

```bash
cd backend
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
python -m training.generate_dataset --count 80
```

Output: [`dataset.jsonl`](.) — one JSON object per line, fields
`{hash, domain, complexity, description, yaml}`. The script is **resumable**
— re-running picks up where it left off.

Cost on `claude-sonnet-4-5` for 80 pairs: **~$3-5 in tokens**.

### 2. Fine-tune on Colab

1. Open [`train_qwen_lora.ipynb`](train_qwen_lora.ipynb) in Google Colab.
2. Runtime → Change runtime type → **T4 GPU** (free) or **A100** (Pro).
3. Upload `dataset.jsonl` to `/content/dataset.jsonl` in the Colab file browser.
4. Run cells top-to-bottom.

Free T4 with 80 samples × 3 epochs takes ~15 min training + ~15 min GGUF export.

The notebook produces:
- `lora-adapter/` — raw LoRA weights (~150MB)
- `form-engine-qwen-unsloth.Q4_K_M.gguf` — quantised merged model (~4.7GB)

### 3. Register the fine-tuned model with Ollama

Download the GGUF file from Colab, then on the machine running Ollama:

```bash
cat > Modelfile <<'EOF'
FROM ./form-engine-qwen-unsloth.Q4_K_M.gguf
TEMPLATE """<|im_start|>system
{{ .System }}<|im_end|>
<|im_start|>user
{{ .Prompt }}<|im_end|>
<|im_start|>assistant
"""
PARAMETER temperature 0.2
PARAMETER stop "<|im_end|>"
EOF

ollama create form-engine-qwen -f Modelfile
```

Point the backend at it:

```bash
export LLM_PROVIDER=ollama
export OLLAMA_MODEL=form-engine-qwen
```

Restart the API. The chat's `create` mode is now running on your fine-tuned
model — no API key required, no per-token cost, fully private.

---

## How the few-shot mechanism works

When the frontend sends a chat request, it includes the `mode` field (`help`,
`fill`, or `create`). On the backend in [`ai_chat.py`](../routers/ai_chat.py),
if `LLM_PROVIDER=ollama` the system prompt is run through
[`enrich_system_prompt()`](../services/exemplar_pack.py), which appends:

1. **Always** — a hand-distilled schema reference (~600 tokens).
2. **For `create`** — a worked NL→YAML transcript + one full real exemplar
   (`auth_forms.yaml`, ~3k tokens).
3. **For `help`** — one full exemplar so the model can quote accurate snippets.
4. **For `fill`** — schema reference only.

This enrichment is skipped for Anthropic because Claude already knows the
schema from a single paragraph of guidance — sending the exemplar pack would
just be token waste.

## Why fine-tuning is worth it (eventually)

The few-shot approach (Mode B) is good enough for most users — Qwen2.5-Coder
is genuinely capable at structured output. But:

- Few-shot pays ~4k extra prompt tokens **on every request**.
- Few-shot can't teach the model conventions that aren't in the exemplar
  (your specific naming style, domain-specific defaults, preferred condition
  patterns).
- A fine-tuned model can run the same prompts in `create` mode with a much
  smaller system block, faster inference, and consistently produce manifests
  in your house style.

Wait to do this until you have either (a) noticeable demand for `create` mode
or (b) a real corpus of hand-curated manifests you want the model to imitate.
