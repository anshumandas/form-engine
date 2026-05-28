#!/usr/bin/env bash
# Start Form Engine in Mode B -- local Ollama LLM + few-shot exemplars.
#
#   bash scripts/dev-local-ai.sh
#
# Hybrid setup (matches scripts/dev.sh patterns):
#   - api + ollama run in Docker (so the api container can talk to ollama by name)
#   - frontend runs bare-metal via 'npm run dev' so the @form-engine/* tsconfig
#     alias to ../lib/src/* resolves on the host filesystem
#     (the web Dockerfile can't see ../lib because its build context is ./frontend)
#
# Override the model:        OLLAMA_MODEL=llama3.1:8b bash scripts/dev-local-ai.sh
# Use a fine-tuned model:    OLLAMA_MODEL=form-engine-qwen bash scripts/dev-local-ai.sh

set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

MODEL="${OLLAMA_MODEL:-qwen2.5-coder:7b}"
export LLM_PROVIDER=ollama
export OLLAMA_MODEL="$MODEL"
# The api container reaches ollama by service name on the compose network.
export OLLAMA_BASE_URL="http://ollama:11434"

echo "-- Mode B: local Ollama LLM --"
echo "   provider = ollama"
echo "   model    = $MODEL"
echo

free_port() {
    local port="$1"
    local pids
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [[ -z "$pids" ]] && command -v netstat >/dev/null 2>&1; then
        pids=$(netstat -ano 2>/dev/null | awk -v p=":$port" '$2 ~ p && $4=="LISTENING" {print $5}' | sort -u)
    fi
    for pid in $pids; do
        echo "  freeing :$port (pid $pid)"
        if command -v taskkill >/dev/null 2>&1; then
            taskkill //PID "$pid" //F //T >/dev/null 2>&1 || true
        else
            kill -9 "$pid" 2>/dev/null || true
        fi
    done
}

# 1. Docker reachable?
if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker is not running. Start it and retry." >&2
    exit 1
fi

# 2. Free host port for the frontend.
echo "-- Clearing stale process on :3000 --"
free_port 3000
rm -f "$ROOT/frontend/.next/dev/next-dev.lock" 2>/dev/null || true

# 3. Bring up only api + ollama (skip the broken web container intentionally).
echo "-- Starting api + ollama containers --"
docker compose --profile local-ai up -d --build api ollama

# 4. Wait for Ollama to be reachable before pulling.
echo "-- Waiting for Ollama daemon on :11434 --"
deadline=$(( $(date +%s) + 60 ))
while (( $(date +%s) < deadline )); do
    curl -sf http://localhost:11434/api/tags >/dev/null 2>&1 && break
    sleep 2
done
if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "ERROR: Ollama did not come up within 60s. Check: docker compose logs ollama" >&2
    exit 1
fi

# 5. Pull the model if it isn't already present.
if docker compose exec -T ollama ollama list 2>/dev/null | grep -qF "$MODEL"; then
    echo "   model '$MODEL' already pulled"
else
    echo "-- Pulling $MODEL (one-time, ~5GB) --"
    docker compose exec -T ollama ollama pull "$MODEL"
fi

# 6. Sanity-check the wiring.
if cfg=$(curl -sf http://localhost:8000/api/ai/config 2>/dev/null); then
    echo
    echo "-- /api/ai/config --"
    echo "   $cfg"
else
    echo "   (api not yet ready -- 'docker compose logs api' if it stays down)"
fi

# 6b. Warm up the model -- first call after pull has to load 5GB into RAM/VRAM
#     and can take 60-90s on CPU. Doing it here means the first user request
#     from the chat UI is fast.
echo
echo "-- Warming up model (first load can take ~60s on CPU) --"
warm_start=$(date +%s)
if curl -sf -m 240 \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"stream\":false}" \
    http://localhost:11434/v1/chat/completions >/dev/null; then
    echo "   model loaded in $(( $(date +%s) - warm_start ))s -- ready for fast responses"
else
    echo "   warmup failed -- the chat will still work, but the first request will be slow"
fi

# 7. Cleanup on exit -- only the frontend process; leave containers running.
cleanup() {
    echo
    echo "-- Stopping frontend --"
    [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    wait 2>/dev/null || true
    free_port 3000
}
trap cleanup EXIT INT TERM

# 8. Start frontend bare-metal so it can resolve @form-engine/* -> ../lib/src/*.
echo
echo "-- Starting frontend (next dev :3000) --"
( cd "$ROOT/frontend" && npm run dev ) &
FRONTEND_PID=$!

echo
echo "Frontend -> http://localhost:3000/chat"
echo "API docs -> http://localhost:8000/docs"
echo
echo "Ctrl-C stops frontend. Containers keep running -- stop them with:"
echo "  docker compose --profile local-ai down"
echo

wait "$FRONTEND_PID"
