# ⚡ Form Engine

A full-stack dynamic form creation and submission system built on the **FormEngineManifest v4.0.0** specification. Define forms in YAML, render them instantly with the React engine, build them visually with drag-and-drop, or create them via AI chat.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser — Next.js 14 (App Router)                              │
│  ┌────────────┐  ┌──────────────┐  ┌───────────┐  ┌─────────┐  │
│  │ /          │  │ /builder     │  │ /create   │  │ /chat   │  │
│  │ Categories │  │ YAML + Visual│  │ Form      │  │ AI Chat │  │
│  │ Dashboard  │  │ Editor       │  │ Builder   │  │         │  │
│  └────────────┘  └──────────────┘  └───────────┘  └─────────┘  │
│                                                                   │
│  Zustand store · Safe expression evaluator (no eval/Function)    │
│  Draft persistence via localStorage                              │
└─────────────────────────────────────────────────────────────────┘
                     │ HTTP (rewrite proxy in dev)
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI (Python 3.12)                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  /api/forms      │  │  /api/submissions│  │ /api/ai/chat  │  │
│  │  CRUD manifests  │  │  Submit, drafts  │  │ Claude proxy  │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ /api/categories  │  │ /api/create-form │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                   │
│  Pydantic v2 models · Security headers · 4 MB request limit     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites
- **Node.js** 20+
- **Python** 3.12+
- (Optional) **Docker** + Docker Compose

### Option A — Docker (recommended)

```bash
git clone <repo> && cd form-engine
docker compose up --build
```

- **Frontend** → http://localhost:3000  
- **API docs** → http://localhost:8000/docs

To enable AI chat, add your Anthropic API key:

```bash
# docker-compose.yml
services:
  api:
    environment:
      - ANTHROPIC_API_KEY=sk-ant-...
```

---

### Option B — Local Development

#### 1. Backend

```bash
cd backend

# Create virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Optional: set AI key
export ANTHROPIC_API_KEY=sk-ant-...

# Start
uvicorn main:app --reload --port 8000
```

API available at http://localhost:8000  
Interactive docs at http://localhost:8000/docs

#### 2. Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Frontend available at http://localhost:3000

> Local dev note: if you are running the frontend with `npm run dev`, ensure `frontend/.env.local` contains:
>
> ```env
> NEXT_PUBLIC_API_URL=http://localhost:8000
> ```
>
> This keeps the Next.js rewrite proxy targeting the local FastAPI backend.

---

## Features

### Categories (Manifests)
A **Category** groups related forms together. Create one from the dashboard with a name and ID, then add forms to it.

### Form Builder (`/create`)
Step-by-step wizard that creates a form without any code. Fill in the form name, add fields (with optional advanced configuration), configure wizard pages, set submit action — your form appears instantly.

### YAML/Visual Editor (`/builder`)
Split-pane editor with three modes:
- **🎨 Visual** — drag-and-drop field palette, section management, page tabs for wizard forms, field inspector with branching/conditions in "More options"
- **YAML** — raw YAML with live parse errors
- **JSON** — raw JSON editing

Mobile-responsive with editor/preview tab switcher.

### AI Chat (`/chat`)
Three modes powered by Claude:
- **Fill Form** — guide users through completing a form; AI sets field values and submits
- **Create Form** — describe a form in plain language; AI generates YAML and loads it into the preview
- **Help** — answers questions about the schema, conditions, field types, YAML syntax

### Supported Field Types

| Type | Variants |
|------|---------|
| `text` | min/max length, regex pattern |
| `multiline` | rows, max length |
| `richtext` | configurable toolbar |
| `boolean` | switch · checkbox · yes-no-radio |
| `number` | input · slider · stepper; prefix/suffix |
| `select` | auto · radio · dropdown · button-group; allow_others |
| `multiselect` | auto · checkbox · dropdown · tag-input; min/max_selected |
| `date` / `time` / `datetime` / `daterange` | use_current, min/max, disable_weekends |
| `file` | accept, max_size_mb, max_files |
| `rating` | stars · numeric-scale · emoji-scale |
| `color` | hex/rgba/hsl, presets |
| `json` | inline JSON editor |
| `signature` | canvas-based pad |
| `location` | address-search · coordinates · map-pin |
| `hidden` | default · context · query-param · computed |

### Condition System

```yaml
# Simple
condition:
  field: employment_type
  op: eq          # eq neq gt gte lt lte in not_in contains starts_with
  value: full_time # is_empty is_not_empty is_true is_false

# Composite
condition:
  all:
    - { field: age, op: gte, value: 18 }
    - { field: country, op: in, value: [IN, SG] }

# Expression (zero-eval safe interpreter)
condition:
  expression: "fields.quantity * fields.price > 1000"

# Named reference
condition:
  ref: is_employed   # defined in manifest.conditions
```

### Pro Fields
Fields with `advanced: true` are hidden behind a "▶ More options" toggle in every section and inside collection items. Use this to reduce visual noise for simple forms while keeping full power available.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/forms/` | List all manifests |
| `GET`  | `/api/forms/{id}` | Get manifest |
| `POST` | `/api/forms/` | Create/upsert manifest |
| `PUT`  | `/api/forms/{id}` | Replace manifest |
| `DELETE` | `/api/forms/{id}` | Delete manifest |
| `POST` | `/api/forms/upload` | Upload YAML/JSON file |
| `POST` | `/api/forms/validate` | Validate without saving |
| `GET`  | `/api/categories/` | List categories |
| `POST` | `/api/categories/` | Create category |
| `PATCH`| `/api/categories/{id}` | Rename category |
| `POST` | `/api/submissions/` | Submit form / save draft |
| `GET`  | `/api/submissions/` | List submissions |
| `POST` | `/api/create-form` | Create form from builder answers |
| `POST` | `/api/ai/chat` | AI chat proxy (requires ANTHROPIC_API_KEY) |

Full interactive documentation: http://localhost:8000/docs

---

## Using as a React Library

The form engine can be embedded in any React 18+ application.

### Installation

```bash
# From npm (once published)
npm install @form-engine/react

# Or link locally from this repo
cd lib && npm run build
cd ../my-app && npm install ../form-engine/lib
```

### Basic usage

```tsx
import { FormEngine, loadManifest } from '@form-engine/react';
import '@form-engine/react/styles';  // optional pre-built Tailwind styles

export default function MyPage() {
  const [manifest, setManifest] = useState(null);

  useEffect(() => {
    loadManifest('/forms/onboarding.yaml').then(setManifest);
  }, []);

  if (!manifest) return <div>Loading…</div>;

  return (
    <FormEngine
      manifest={manifest}
      formId="onboarding"
      onSubmit={async (payload) => {
        await fetch('/api/submit', { method: 'POST', body: JSON.stringify(payload) });
      }}
    />
  );
}
```

### Load from inline YAML string

```tsx
import { FormEngine, loadManifest } from '@form-engine/react';

const yamlString = `
manifest_id: inline
forms:
  contact:
    title: Contact Us
    version: "1.0.0"
    layout: { type: single-page }
    on_submit: { type: none }
    sections:
      - id: s1
        fields:
          - { id: name, type: text, label: Name, required: true }
          - { id: message, type: multiline, label: Message }
`;

const manifest = await loadManifest(yamlString);
<FormEngine manifest={manifest} formId="contact" onSubmit={console.log} />
```

### Load from URL

```tsx
// loadManifest validates the URL (only http/https allowed — SSRF safe)
const manifest = await loadManifest('https://cdn.example.com/forms/signup.yaml');
```

### Pre-fill answers and read-only mode

```tsx
<FormEngine
  manifest={manifest}
  formId="onboarding"
  initialAnswers={{ name: "Jane", email: "jane@example.com" }}
  readOnly={true}
  context={{ userId: "u_123", auth: { create: true } }}
  onSubmit={handleSubmit}
  onDraftSave={handleDraft}
/>
```

### Use the hook directly

```tsx
import { useFormEngine } from '@form-engine/react';

function MyCustomForm() {
  const { answers, setAnswer, errors, submit, currentPageIndex, nextPage } = useFormEngine();

  return (
    <div>
      <input
        value={String(answers.name ?? '')}
        onChange={e => setAnswer('name', e.target.value)}
      />
      {errors.name?.map(e => <p key={e} className="text-red-500">{e}</p>)}
      <button onClick={() => submit({ formId: 'my_form', manifestId: 'my_manifest' })}>
        Submit
      </button>
    </div>
  );
}
```

### Evaluate conditions programmatically

```tsx
import { evaluateCondition } from '@form-engine/react';

const visible = evaluateCondition(
  { field: 'age', op: 'gte', value: 18 },
  { age: 21, name: 'Jane' }
);
// → true
```

### TypeScript types

```tsx
import type { FormManifest, FormField, FieldAnswers, StaticChoice } from '@form-engine/react';
```

---

## Security

- **No `eval()` or `new Function()`** — expression conditions use a hand-rolled tokeniser/interpreter
- **CSP headers** — `Content-Security-Policy` blocks external scripts; no `unsafe-eval`
- **Security response headers** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`
- **Request size limit** — 4 MB max body on all API endpoints
- **SSRF prevention** — `loadManifest()` validates URL protocol; only `http`/`https` allowed
- **Input sanitisation** — category/form IDs validated against `^[a-z][a-z0-9_]*$`; null bytes stripped
- **No reflected user input** — manifest IDs are validated before use in API paths

---

## Environment Variables

### Backend
| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | *(empty)* | Claude API key for AI chat feature |

### Frontend
| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API base URL |

---

## Project Structure

```
form-engine/
├── backend/
│   ├── main.py                    # FastAPI app + startup seed
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── middleware/
│   │   └── security.py            # Security headers + request size limit
│   ├── models/
│   │   └── form_schema.py         # Pydantic v2 models for full schema
│   ├── routers/
│   │   ├── forms.py               # CRUD manifests
│   │   ├── submissions.py         # Submit + drafts
│   │   ├── categories.py          # Category management
│   │   ├── create_form.py         # Form Builder → manifest transformer
│   │   └── ai_chat.py             # Claude API proxy
│   └── sample_forms/
│       ├── form_creator.yaml      # Meta-form for building forms
│       ├── job_application.yaml
│       ├── product_forms.yaml
│       └── uam_forms.yaml
│
├── frontend/
│   ├── next.config.mjs            # Security headers + rewrites
│   ├── package.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Categories dashboard
│   │   │   ├── builder/page.tsx   # YAML + Visual editor
│   │   │   ├── create/page.tsx    # Form Builder wizard
│   │   │   ├── chat/page.tsx      # AI Chat assistant
│   │   │   ├── forms/[m]/[f]/     # Form renderer
│   │   │   └── submissions/       # Submissions browser
│   │   ├── components/
│   │   │   ├── FormEngine/        # Core renderer
│   │   │   └── FormBuilder/       # Visual drag-drop builder
│   │   ├── lib/
│   │   │   ├── types.ts           # Full TypeScript schema types
│   │   │   ├── condition-evaluator.ts  # SAST-safe interpreter
│   │   │   ├── api.ts             # Typed API client
│   │   │   └── utils.ts
│   │   ├── store/
│   │   │   └── form-engine-store.ts    # Zustand state
│   │   └── hooks/
│   │       └── useFormEngine.ts
│
├── lib/                           # @form-engine/react npm package
│   ├── package.json
│   └── src/
│       ├── index.ts               # Public exports
│       ├── lib/
│       │   ├── types.ts
│       │   ├── condition-evaluator.ts
│       │   └── manifest-loader.ts  # SSRF-safe URL loader
│       └── components/FormEngine/ # Re-exports from app
│
├── docker-compose.yml
└── README.md
```
