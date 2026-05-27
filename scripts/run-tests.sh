#!/usr/bin/env bash
# Run the full test suite locally (no cloud).
#
#   ./scripts/run-tests.sh            # native (needs python3 + node)
#   ./scripts/run-tests.sh --docker   # run everything in containers
#
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--docker" ]]; then
  exec docker compose -f docker-compose.test.yml up --build --abort-on-container-exit \
       --exit-code-from backend-tests
fi

echo "── Backend (pytest) ─────────────────────────────────────────────"
python3 -m pip install -q -r backend/requirements-dev.txt
python3 -m pytest

echo
echo "── Lib (vitest) ─────────────────────────────────────────────────"
( cd lib && npm install --legacy-peer-deps --silent && npm test )

echo
echo "── Type checks ──────────────────────────────────────────────────"
( cd lib && npx tsc --noEmit )
( cd frontend && npm install --legacy-peer-deps --silent && npx tsc --noEmit )

echo
echo "✅ All suites passed."
