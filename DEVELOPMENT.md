# Local Development Setup

## Prerequisites
- **Node.js** 20+
- **Python** 3.12+

## Quick Start (Two Terminals)

### Terminal 1: Backend
```bash
cd backend

# Create and activate virtual environment (recommended)
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI (will auto-reload on file changes)
uvicorn main:app --reload --port 8000
```

You should see:
```
Uvicorn running on http://0.0.0.0:8000
```

Visit http://localhost:8000/docs for interactive API docs.

---

### Terminal 2: Frontend
```bash
cd frontend

# Install dependencies (first time only)
npm install --legacy-peer-deps

# IMPORTANT: Ensure .env.local exists with:
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000

# Start Next.js dev server (will hot-reload on file changes)
npm run dev
```

You should see:
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

Visit http://localhost:3000 in your browser.

---

## Troubleshooting

### "Keep Loading" / Categories Not Appearing

1. **Check backend is running**
   - Open http://localhost:8000/docs in your browser
   - You should see the Swagger/FastAPI docs
   - If 404 or connection refused, start the backend

2. **Check Next.js rewrite proxy**
   - Open the browser's **DevTools** (F12) → **Network** tab
   - Try clicking "New Category" or wait for the page to load
   - Look for a request to `/api/forms/`
   - It should show `200 OK` with JSON response
   - If it shows CORS error or network error, check step 3

3. **Verify frontend environment**
   - Ensure `frontend/.env.local` exists and contains:
     ```
     NEXT_PUBLIC_API_URL=http://localhost:8000
     ```
   - If you just created or edited `.env.local`, **restart `npm run dev`** in Terminal 2
   - Stop (`Ctrl+C`) and restart: `npm run dev`

4. **Check CORS headers**
   - In browser DevTools → Network tab, click on the `/api/forms/` request
   - Look for response headers: `Access-Control-Allow-Origin`
   - Should show `http://localhost:3000` or match your browser's origin
   - If missing or wrong, the backend's CORS config might need updating

5. **Clear cache and rebuild**
   ```bash
   # Stop both servers
   # Then:
   
   # Frontend
   rm -rf frontend/.next
   npm run dev
   
   # Backend (usually auto-reloads)
   # Just restart it
   ```

---

## Enable AI Chat (Optional)

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Windows (PowerShell)
$env:ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Then start the backend
uvicorn main:app --reload --port 8000
```

---

## Accessing the App

- **Dashboard** (categories & forms list): http://localhost:3000
- **Create Form** (step-by-step builder): http://localhost:3000/create
- **YAML/Visual Editor**: http://localhost:3000/builder
- **AI Chat**: http://localhost:3000/chat (requires ANTHROPIC_API_KEY)
- **Form Submissions**: http://localhost:3000/submissions
- **API Docs**: http://localhost:8000/docs

---

## Common Issues

| Issue | Solution |
|-------|----------|
| `fetch failed` / network error in browser | Backend not running or wrong port. Check Terminal 1. |
| CORS error in browser console | `.env.local` missing or backend CORS config wrong. See step 3 above. |
| Page keeps loading (spinner) | Check DevTools Network tab for failed `/api/forms/` request. |
| Changes in backend not showing | Kill backend (Ctrl+C) and restart—uvicorn should auto-reload. |
| Changes in frontend not showing | Kill frontend (Ctrl+C) and restart—Next.js auto-reloads but sometimes needs restart. |
| Import/upload fails | Backend not running or file format invalid (YAML/JSON only). |

---

## Architecture

```
┌──────────────────┐
│  Your Browser    │
│  localhost:3000  │
│  (Next.js app)   │
└────────┬─────────┘
         │
         │ http://localhost:3000/api/forms
         │ (rewritten by Next.js to ↓)
         │
┌────────▼─────────────────────┐
│  Next.js Dev Server Proxy     │
│  Rewrites /api/* to           │
│  http://localhost:8000/api/*  │
└────────┬─────────────────────┘
         │
         │ http://localhost:8000/api/forms
         │
┌────────▼─────────────────────┐
│  FastAPI Backend              │
│  localhost:8000               │
│  (Python, SQLite in-mem)      │
└───────────────────────────────┘
```

All frontend requests use relative paths (`/api/*`), which Next.js rewrites to the backend URL. This keeps frontend and backend decoupled during development.
