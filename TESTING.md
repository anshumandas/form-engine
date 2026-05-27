# Testing Guide

Everything runs locally — no cloud resources, no external services. The backend
tests use FastAPI's in-process `TestClient`, and the lib tests run in `jsdom`.

## TL;DR

```bash
# Everything, in Docker (recommended — reproducible, nothing to install):
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit

# Or natively (needs python3.12 + node 20):
./scripts/run-tests.sh                # macOS / Linux / WSL / git-bash
powershell -ExecutionPolicy Bypass -File scripts\run-tests.ps1   # Windows
```

## What's covered

### Backend — `pytest` (`backend/tests/`)

| File | Covers |
|------|--------|
| `test_condition_evaluator.py` | Expression + simple/composite conditions, the new `ends_with` op, **and security tests proving the evaluator never executes code** (the old `eval()` is gone). |
| `test_auth.py` | Salted PBKDF2 hashing, signup/signin, sessions, admin-only gating. |
| `test_forms.py` | Public reads; **writes require auth**; `manifest_id` validation. |
| `test_submissions.py` | Public submit + server-side validation; **listing requires auth**; rule-based `required` regression. |
| `test_categories_and_create_form.py` | Auth-gated category + builder endpoints; ID validation. |
| `test_ai_chat.py` | Graceful no-API-key behavior; Pydantic v2 input sanitisation/limits. |

Run just the backend:

```bash
pip install -r backend/requirements-dev.txt
pytest                      # from repo root (uses pytest.ini)
pytest backend/tests/test_condition_evaluator.py -v
```

### Lib — `vitest` (`lib/test/`)

| File | Covers |
|------|--------|
| `condition-evaluator.test.ts` | All operators incl. `ends_with`; the eval-free expression interpreter. |
| `validate-field.test.ts` | Field validation incl. the rule-based `required` regression. |
| `manifest-loader.test.ts` | YAML/JSON/object loading + SSRF protocol guard. |
| `form-engine-success-screen.test.tsx` | **The overridable submit/success-screen feature** (default shows it; `show_success_screen:false` and the `showSuccessScreen` prop suppress it; errors surface instead). |

Run just the lib:

```bash
cd lib
npm install --legacy-peer-deps
npm test
```

### Type checks

```bash
cd lib && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

## Manual end-to-end smoke test

```bash
docker compose up --build         # api :8000, web :3000
```

1. Open http://localhost:3000 → redirected to `/auth`.
2. Sign in with the seeded admin: `admin@formengine.io` / `Admin@1234`.
   Observe that the submit button **waits for the server** and redirects on
   success — it does **not** flash the "🎉 submitted" screen (that's the
   `show_success_screen: false` override).
3. Sign in with bad credentials → an inline error appears (no success screen).
4. Create a category, build a form (`/create`), open it, submit it → here the
   success screen **does** appear (default behavior).
5. API docs: http://localhost:8000/docs.
