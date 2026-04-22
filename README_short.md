# ⚡ Form Engine — Dynamic Form System

A full-stack dynamic form creation & submission system powered by **FormEngineManifest v4.0.0**.

Write a YAML (or JSON) manifest, upload it, and instantly get a fully functional form with multi-step wizards, conditional logic, computed fields, client + server validation, and draft persistence.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│  Next.js 14 (App Router)                                         │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────┐ │
│  │  / Dashboard │  │ /builder  YAML  │  │ /forms/:id/:formId │ │
│  │  Manifest    │  │ editor + live   │  │ FormEngine runtime │ │
│  │  & form list │  │ preview         │  │ (wizard/single-pg) │ │
│  └──────────────┘  └─────────────────┘  └────────────────────┘ │
│                                                                   │
│  State: Zustand store  ·  Validation: client-side evaluator      │
│  Conditions: evaluateCondition()  ·  Draft: localStorage persist │
└─────────────────────────────────────────────────────────────────┘
                            │ HTTP / fetch
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI (Python 3.12)                                           │
│  ┌───────────────────┐  ┌──────────────────────────────────────┐│
│  │  /api/forms       │  │  /api/submissions                    ││
│  │  CRUD manifests   │  │  Submit · Draft · List · Get         ││
│  │  Upload YAML/JSON │  │  Server-side validation              ││
│  │  Validate schema  │  │  Condition-aware payload filter      ││
│  └───────────────────┘  └──────────────────────────────────────┘│
│                                                                   │
│  Pydantic v2 models · condition_evaluator service                │
│  In-memory store (swap to SQLAlchemy for production)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Option A — Docker (recommended)

```bash
git clone <repo>
cd form-engine
docker compose up --build
```

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

### Option B — Local dev

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

---

## Supported Field Types

| Type | Variants / Notes |
|------|-----------------|
| `text` | `min_length`, `max_length`, `pattern`, `autocomplete` |
| `multiline` | `rows`, `max_length`, `resize` |
| `richtext` | configurable `toolbar` |
| `boolean` | `switch` · `checkbox` · `yes-no-radio` |
| `number` | `input` · `slider` · `stepper`; `prefix`/`suffix`, `number_type` |
| `select` | `auto` · `radio` · `dropdown` · `button-group`; `allow_others` |
| `multiselect` | `auto` · `checkbox` · `dropdown` · `tag-input`; `min/max_selected` |
| `date` | `use_current`, `min_date`/`max_date`, `disable_weekends` |
| `time` | `min_time`/`max_time`, `step_minutes` |
| `datetime` | combined date + time constraints |
| `daterange` | `min/max_range_days` |
| `file` | `accept`, `max_size_mb`, `max_files` |
| `rating` | `stars` · `numeric-scale` · `emoji-scale` |
| `color` | `hex`/`rgba`/`hsl`, `presets` |
| `json` | inline JSON editor |
| `signature` | canvas-based signature pad |
| `location` | `address-search` · `coordinates` · `map-pin` |
| `hidden` | `default` · `context` · `query-param` · `computed` |

---

## Condition System

All three condition types from the spec are supported on fields, sections, and pages:

```yaml
# Simple
condition:
  field: employment_type
  op: eq          # eq neq gt gte lt lte in not_in
  value: full_time  # contains starts_with is_empty is_not_empty is_true is_false

# Composite
condition:
  all:
    - field: age
      op: gte
      value: 18
    - field: country
      op: in
      value: [IN, SG, US]

# Expression
condition:
  expression: "fields.quantity * fields.price > 1000"

# Named reference (defined in manifest.conditions)
condition:
  ref: is_employed
```

---

## Validation

```yaml
fields:
  - id: phone
    type: text
    required: true
    pattern: "^\\+?[0-9 ()-]{7,20}$"
    pattern_message: "Enter a valid phone number"
    validation:
      rules:
        - type: min_length
          value: 7
          message: "Too short"
        - type: regex
          value: "^\\+"
          message: "Must start with +"
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/forms/` | List all manifests |
| `GET` | `/api/forms/{id}` | Get full manifest |
| `GET` | `/api/forms/{id}/forms/{fid}` | Get single form |
| `POST` | `/api/forms/` | Create/upsert manifest |
| `PUT` | `/api/forms/{id}` | Replace manifest |
| `DELETE` | `/api/forms/{id}` | Delete manifest |
| `POST` | `/api/forms/upload` | Upload `.yaml`/`.json` file |
| `POST` | `/api/forms/validate` | Validate without saving |
| `POST` | `/api/submissions/` | Submit form or save draft |
| `GET` | `/api/submissions/` | List submissions |
| `GET` | `/api/submissions/{id}` | Get submission |
| `GET` | `/api/submissions/drafts/{mid}/{fid}` | Get draft |
| `DELETE` | `/api/submissions/drafts/{mid}/{fid}` | Delete draft |

---

## Form Builder

Navigate to `/builder` for the split-pane editor:

- **Left pane** — YAML or JSON editor with live parse error detection
- **Right pane** — real-time rendered form preview
- Switch between YAML ↔ JSON with automatic conversion
- Validate against the server schema, then save or update

Upload the sample manifests from `backend/sample_forms/` to get started immediately.

---

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — all manifests and forms |
| `/builder` | Split-pane YAML/JSON editor + preview |
| `/builder?manifest=id` | Edit existing manifest |
| `/forms/[manifestId]/[formId]` | Render and fill a form |
| `/submissions` | Browse all submissions |
| `/submissions?manifest=id&form=fid` | Filtered submissions |
