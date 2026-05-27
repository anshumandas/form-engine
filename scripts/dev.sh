#!/usr/bin/env bash
# Start backend (FastAPI, port 8000) and frontend (Next.js, port 3000) locally.
#
#   bash scripts/dev.sh
#
# Both run in the same terminal. Ctrl-C stops both.
# Stale processes holding :3000 / :8000 (or the Next dev lock) are killed first.

set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

free_port() {
    local port="$1"
    # Try lsof (mac/linux) then netstat (git-bash on Windows)
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

echo "-- Clearing stale processes on :8000 and :3000 --"
free_port 8000
free_port 3000
rm -f "$ROOT/frontend/.next/dev/next-dev.lock" 2>/dev/null || true

cleanup() {
    echo
    echo "-- Shutting down --"
    [[ -n "${BACKEND_PID:-}"  ]] && kill "$BACKEND_PID"  2>/dev/null || true
    [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    wait 2>/dev/null || true
    free_port 8000
    free_port 3000
}
trap cleanup EXIT INT TERM

echo "-- Starting backend (uvicorn :8000) --"
python -m uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "-- Starting frontend (next dev :3000) --"
( cd "$ROOT/frontend" && npm run dev ) &
FRONTEND_PID=$!

echo
echo "Backend  -> http://localhost:8000  (docs at /docs)"
echo "Frontend -> http://localhost:3000"
echo "Press Ctrl-C to stop both."
echo

wait -n "$BACKEND_PID" "$FRONTEND_PID"
