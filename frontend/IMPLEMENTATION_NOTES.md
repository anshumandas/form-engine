# VisualUIBuilder — Implementation Notes

## What was built

### 1. `src/components/UIBuilder/VisualUIBuilder.tsx`
Full visual editor for `UISystemManifest` (conforming to `ui_system.schema.yaml`).

**Left panel — 6 tabs:**
| Tab | What it edits |
|---|---|
| Overview | `manifest_id`, `manifest_version`, `description`, `active_theme`, `engine` config, `namespaces` |
| Screens | Create/edit/delete screens, configure `auth_rules`, place component refs with `LayoutDirection` |
| Components | Create/edit/delete components with all `ComponentType` values |
| Navigation | `type`, `initial_screen`, `tab_bar_position`, full route table |
| Themes | Named `ThemeDefinition` objects with colour pickers for all semantic tokens |
| Assets | Reusable `buttons`, `dialogs`, `toasts`, `icons` |

**Right panel:** Live YAML output (conforming to schema), copy button.

**Form component special behaviour (when `componentType === "Form"`):**

Three sub-modes toggled by a row of buttons inside the component detail panel:

| Mode | What it shows |
|---|---|
| `existing` | Dropdown of `manifest.forms` keys → sets `form_ref`. Shows `form_embed.mode` picker. |
| `wizard` | Loads the `form_creator` manifest from the backend and renders it via `FormEngine`. On submit, adds the new form to `manifest.forms` and sets `form_ref`. |
| `advanced` | Embeds `VisualFormBuilder` for in-place drag-and-drop field editing of any existing form in the manifest. |

---

### 2. `src/app/ui-builder/page.tsx`
Full-page wrapper around `VisualUIBuilder` with:
- Load existing manifest via `?manifest=<id>` query param
- Save / Update via `api.upsertManifest` / `api.updateManifest`
- Export as `.yaml` download
- Paste YAML panel (parse + load into builder)
- Upload YAML file

---

### 3. `src/app/page.tsx` (updated)
Added UI Builder entry points in three places:
1. **Header** — `🏗 UI Builder` button alongside Form Builder
2. **Stats bar** — 4th stat tile counting UI manifests
3. **Category card** — `🏗 UI` button in action row + the "Add to category" dropdown now shows three options: _New Form_, _Form via YAML_, **_UI Builder_**

---

### 4. `src/forms/auth_ui_manifest.ts`
The landing page and auth page expressed as a `UISystemManifest` TypeScript literal. Contains:
- Two form definitions (`signin`, `signup`) in `forms`
- Six `components` (hero_column, feature_grid, auth_card, signin_form, signup_form, auth_card_stripe)
- Two screens (`landing`, `auth`, `home`) with component placements and `auth_rules`
- Navigation routes (`/`, `/auth`, `/home`)
- One custom theme (`auth_dark`)
- Reusable `buttons`, `toasts`, `icons`

The inline YAML comment at the bottom of the file can be pasted directly into the UI Builder's "Paste YAML" panel to load the manifest visually.

---

### 5. `src/components/UIBuilder/UIManifestRenderer.tsx`
Runtime renderer that consumes a `UISystemManifest` + `screenKey`:
- Groups component placements by `LayoutDirection` (Top / Left / Center / Right / Bottom / Floating)
- Dispatches each component to a typed renderer based on `ComponentType`
- For `type: Form` — delegates entirely to `FormEngine` from `@form-engine`
- Accepts an `ActionHandlerMap` that wires `on_press` / `handler_name` values to real functions

---

### 6. `src/app/auth/page.tsx` (updated)
Auth page now renders via `UIManifestRenderer` + `authUIManifest`:
- `HeroColumn` renders the left side (static, matches the manifest's `hero_column` component)
- `AuthCard` uses `UIManifestRenderer` with a focused sub-manifest to render `signin_form` or `signup_form` — which are `type: Form` components pointing at the form definitions in the manifest
- Business logic (API calls, `useAuth().signin`) stays in React; the manifest describes structure only
- A small schema badge at the bottom of the card shows `rendered via UISystemManifest · auth_ui.yaml`

---

## Data flow

```
authUIManifest (TypeScript literal / YAML)
  │
  ├─ forms.signin / forms.signup     ← FormManifest shape
  │     └─ rendered by FormEngine    (@form-engine)
  │
  ├─ components.*                    ← UIComponent definitions
  │     └─ resolved by UIManifestRenderer
  │
  ├─ screens.auth                    ← component placements + auth_rules
  │     └─ rendered by UIManifestRenderer
  │
  ├─ navigation                      ← routes + guards
  └─ themes.auth_dark                ← colour tokens
```

## How to use the UI Builder

1. Navigate to `/ui-builder` from the main page header or any category card
2. Use the **Overview** tab to set your manifest ID and active theme
3. Add **Screens** and **Components** — for Form components, use the three-mode form picker
4. Set up **Navigation** routes
5. Define custom **Themes** with the colour pickers
6. Copy or export the YAML from the right panel
7. Paste the `authUIManifest` YAML (from the comment at the bottom of `auth_ui_manifest.ts`) to see the auth/landing page manifest load in the builder
