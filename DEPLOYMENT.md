# Production Deployment Guide

This guide covers deploying the Form Engine stack (FastAPI API + Next.js web)
with Docker. It also lists the production-readiness gaps you must close before a
real launch.

> **Read this first — current persistence model.** The backend stores manifests,
> submissions, users, and sessions in **in-memory Python dicts**. They are seeded
> on startup and **lost on every restart**, and they do **not** work across more
> than one replica. The stack is fully functional for demos, internal tools, and
> single-instance deployments, but for durable multi-instance production you must
> swap the in-memory stores for a database + shared session store (see
> "Hardening checklist").

---

## 1. Prerequisites

- Docker 24+ and Docker Compose v2
- A domain + TLS termination (reverse proxy: Nginx, Caddy, Traefik, or a managed LB)
- (Optional) An Anthropic API key for the AI chat feature

## 2. Configuration

Create a `.env` file in the repo root:

```env
# Backend
ANTHROPIC_API_KEY=sk-ant-...            # optional; AI chat is disabled if unset

# Frontend (baked at build time)
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

| Variable | Where | Purpose |
|----------|-------|---------|
| `ANTHROPIC_API_KEY` | api | Enables `/api/ai/chat`. Omit to disable gracefully. |
| `NEXT_PUBLIC_API_URL` | web (build arg) | Backend base URL the browser/SSR calls. |

## 3. Build & run

```bash
# Build images and start in the background
docker compose up --build -d

# Check health
curl -f http://localhost:8000/health        # {"status":"ok",...}
docker compose ps                            # both services "healthy"/"running"
docker compose logs -f api web
```

- Web → `http://localhost:3000`
- API → `http://localhost:8000` (docs at `/docs`)

The backend now runs as a package (`uvicorn backend.main:app`) and the frontend
builds a standalone server bundle (`output: "standalone"`) — both required for
the images to boot. For production, drop the `--reload` flag (it's only in the
compose `command` for dev convenience): override with

```yaml
# docker-compose.prod.yml (overlay)
services:
  api:
    command: ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

> Use **`--workers 1`** while the stores are in-memory — multiple workers do not
> share state. Scale horizontally only after moving to a shared datastore.

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

## 4. Reverse proxy + TLS (example: Caddy)

```caddyfile
your-domain.com {
    reverse_proxy localhost:3000
}
api.your-domain.com {
    reverse_proxy localhost:8000
}
```

Caddy auto-provisions HTTPS. Set `NEXT_PUBLIC_API_URL=https://api.your-domain.com`
and add that origin to the backend CORS allow-list in `backend/main.py`
(`allow_origins`) and to the frontend CSP `connect-src` in
`frontend/next.config.mjs`.

## 5. Pre-launch verification

```bash
# Run the full local test suite first
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit

# Then smoke-test the running stack
curl -f http://localhost:8000/health
curl -s http://localhost:8000/api/forms/ | head      # public read
curl -s -X POST http://localhost:8000/api/forms/ -d '{}' -H 'Content-Type: application/json' -w '\n%{http_code}\n'   # expect 401 (auth required)
```

---

## 6. Production hardening checklist

The May 2026 review fixed the application-layer security issues (eval-based RCE,
client-side `new Function`, unsalted passwords, open write endpoints, CSP
`unsafe-eval` in prod). The remaining items below are **infrastructure/durability**
changes you own:

- [ ] **Persistence.** Replace the in-memory dicts in `backend/routers/forms.py`,
      `submissions.py`, and `auth.py` with a database (Postgres/SQLite). The deps
      are already declared (`sqlalchemy`, `aiosqlite`, `alembic`).
- [ ] **Sessions.** Move `_sessions` to Redis or signed JWTs (`python-jose` is
      already a dependency) so tokens survive restarts and work across replicas.
- [ ] **Change the seeded admin.** `admin@formengine.io / Admin@1234` is a known
      default — rotate it (and seed admin creds from env) before exposing publicly.
- [ ] **Secrets via env/secret manager**, never committed. `.env` is git-ignored.
- [ ] **Set cookies `Secure`** (the auth cookie is `SameSite=Strict`; add `Secure`
      behind HTTPS) in `frontend/src/providers/auth-context.tsx`.
- [ ] **Rate-limit** `/auth/*` and `/api/submissions/` (e.g. at the reverse proxy).
- [ ] **CORS allow-list**: in `backend/main.py`, remove the broad `localhost`
      regex and list only your real origins for production.
- [ ] **Run behind HTTPS only**; redirect HTTP→HTTPS at the proxy.
- [ ] **Backups & monitoring** once a datastore is in place; ship logs; alert on
      the `/health` endpoint.
- [ ] **Pin image digests** and scan images (e.g. `docker scout`/Trivy) in CI.

## 7. CI hint

```yaml
# .github/workflows/ci.yml (sketch)
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f docker-compose.test.yml up --build \
               --abort-on-container-exit --exit-code-from backend-tests
```
