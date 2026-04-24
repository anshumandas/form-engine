# UIEngine vs UIBuilder - Architecture Guide

## Overview

The form-engine project provides a complete UI design and rendering system with clear separation of concerns:

```
┌────────────────────────────────────────────────────────────────┐
│                    UIBuilder (Designer Tool)                   │
│              Visual editor for creating UI designs              │
│         Drag-drop components → Export yaml/json manifests       │
└────────────────┬─────────────────────────────────────────────┘
                 │ Exports ui_design.yaml/json
                 ↓
        ┌────────────────────┐
        │  Manifest Storage  │
        │ (yaml/json files)  │
        └────────────┬───────┘
                     │ Consumed by
                     ↓
┌────────────────────────────────────────────────────────────────┐
│         UIEngine (Runtime Library for any Application)          │
│   Renders UI from manifests in other applications/frameworks   │
│           npm install @form-engine/ui-engine          │
└────────────────────────────────────────────────────────────────┘
```

## UIBuilder - Designer Tool

**Location**: `frontend/src/apps/UIBuilder/`

**Purpose**: Visual tool for designers/developers to create and edit UI manifests

**What It Does**:
- ✏️ Drag-drop interface for designing screens
- 🎨 Component palette for selecting components to add
- ⚙️ Property editor for configuring components
- 👁️ Live preview of designs
- 💾 Export designs as yaml/json
- 📥 Import existing designs to edit
- ✓ Validates manifest before export

**Key Components**:
- `ScreenTree` - List of screens, create/delete screens
- `ComponentPalette` - Available components (Tree, Table, Form, etc.)
- `CanvasEditor` - Visual design canvas
- `PropertyEditor` - Configure selected component properties
- Toolbar - Export, save, settings

**Workflow**:
```
1. Open UIBuilder
2. Create new design OR import existing yaml
3. Add screens
4. Add components to screens (drag-drop)
5. Configure component properties (right panel)
6. Live preview
7. Export yaml → use with UIEngine
```

**User**: Designers, UI/UX developers

**Does NOT**:
- ❌ Render actual UIs (doesn't show end-user interface)
- ❌ Run forms or collect data
- ❌ Execute application logic

## UIEngine - Runtime Library

**Location**: `lib/src/components/UIEngine/`

**Purpose**: Render UIs from manifests in any application

**What It Does**:
- 🎯 Reads ui_design.yaml manifests
- 🎨 Renders complete UIs based on manifest
- 🧩 Component rendering (8 types: Tree, Table, Form, etc.)
- 📐 Responsive layout system (7 directions)
- 🎪 Theme management with dark mode
- 🔒 Feature flags and access control
- ♿ Full accessibility support
- ⚡ Performance optimized

**Key Files**:
- `types.ts` - All TypeScript interfaces
- `context.ts` - React context and state management (hooks)
- `renderers.tsx` - Component type renderers
- `layout.tsx` - Layout direction system
- `index.ts` - Public exports

**How It Works**:
```
1. Import UIEngine in your app
2. Create UIEngineProvider with manifest
3. Use components that render based on manifest
4. UIEngine handles everything: layout, theme, state, navigation
```

**Example Usage**:
```tsx
import { UIBuilder as UIRenderer } from '@form-engine/ui-engine';
import manifest from './ui_design.json';

export default function MyApp() {
  return (
    <UIRenderer manifest={manifest} handlers={{
      onSubmit: async (data) => { /* API call */ }
    }} />
  );
}
```

**User**: Application developers (not designers)

**Features**:
- ✅ 8 component types
- ✅ 7 layout directions
- ✅ Theme system
- ✅ Responsive breakpoints
- ✅ Feature flags
- ✅ Access control
- ✅ State management
- ✅ Navigation
- ✅ FormEngine integration (for Form type)
- ✅ Accessibility (ARIA, keyboard, etc.)

## Architecture Comparison

| Aspect | UIBuilder | UIEngine |
|--------|-----------|----------|
| **Purpose** | Design UI visually | Render UI from manifest |
| **Users** | Designers, UX developers | App developers |
| **Input** | Visual drag-drop | Manifest (yaml/json) |
| **Output** | Manifest file (yaml/json) | Rendered UI |
| **Can render UIs?** | No (designer only) | Yes (full rendering) |
| **Can edit manifests?** | Yes (visual editor) | No (read-only consumer) |
| **Installation** | Part of project | `npm install @form-engine/ui-engine` |
| **Framework** | React (designer UI) | React (library) |
| **Business Logic** | Visual design | UI rendering + state management |

## How They Work Together

### Scenario: Bank Customer Portal

**1. Design Phase (UIBuilder)**
```
Designer opens UIBuilder
├─ Creates screens: Dashboard, Accounts, Transfers, Settings
├─ Adds components: Tables (account list), Forms (transfer form), Cards (balance)
├─ Sets theme: Bank colors, fonts, spacing
├─ Configures features: "vip_transfers" (premium feature)
├─ Exports → customer_portal_ui_design.json
└─ Checks into git
```

**2. Development Phase (UIEngine)**
```
Developer creates React app:
├─ import UIEngine from '@form-engine/ui-engine'
├─ import manifest from 'customer_portal_ui_design.json'
├─ Wraps app with UIEngine:
│  - Provides manifest
│  - Registers handlers for Form submissions
│  - Connects to backend APIs
│  - Sets feature flags based on user subscription
└─ UIEngine renders the complete UI
   ├─ Navigation (tab bar/drawer)
   ├─ All screens and components
   ├─ Theme applied
   ├─ Forms connected to APIs
   └─ Feature-gated components shown/hidden
```

**3. Runtime**
```
End user sees:
├─ Full bank portal UI
├─ Can navigate screens
├─ Can fill/submit forms
├─ VIP sees premium features
└─ All styled with bank theme
```

## Data Flow

```
UIBuilder Designer
      ↓ (visual editing)
      ↓ (creates yaml structure)
      ↓
ui_design.yaml (committed to git)
      ↓ (imported as JSON)
      ↓ (passed to UIEngine)
      ↓
UIEngine Runtime
      ↓ (validates manifest)
      ↓ (creates React components)
      ↓ (applies theme)
      ↓ (manages state)
      ↓
Rendered UI in Application
      ↓
End User
```

## Deployment

### Designer's Perspective
```
1. Open UIBuilder tool
2. Create/edit design
3. Click "Export YAML"
4. Download json file
5. Commit to git (src/manifests/)
```

### Developer's Perspective
```
1. Import manifest from git
2. Import UIEngine from npm
3. Wrap app: <UIEngine manifest={manifest} />
4. Deploy application
```

### End User's Perspective
```
1. Visit application URL
2. See full UI rendered by UIEngine
3. Interact with UI (forms, navigation, etc.)
```

## Development Workflow

### When Manifest Changes

**Designer**:
1. Open UIBuilder
2. Load manifest from git
3. Make changes
4. Export new yaml
5. Commit to git

**Developer**:
1. Pull latest manifest
2. Restart dev server
3. UIEngine automatically re-renders with new manifest
4. No code changes needed

### When Logic Changes

**Developer**:
1. Only modify handlers/backend
2. No manifest changes needed
3. UIEngine picks up changes on restart

## Key Principles

### Separation of Concerns
- **UIBuilder handles**: Visual design, manifest creation
- **UIEngine handles**: UI rendering, state, theme, navigation

### Designer-Developer Independence
- Designer can work on UI without touching code
- Developer can work on logic without touching UI
- Both work on same manifest in parallel (with git)

### Version Control
```
git repo structure:
├── src/
│   ├── manifests/
│   │   ├── dashboard_ui_design.json  ← Designer commits here
│   │   ├── forms_ui_design.json
│   │   └── admin_ui_design.json
│   ├── components/
│   │   └── handlers.ts  ← Developer commits here
│   ├── App.tsx
│   └── api.ts
```

### Deployment Independence
- UIBuilder tool can be updated without affecting deployed apps
- UIEngine library can be updated with proper versioning
- Manifests are app-specific, not tied to tool version

## File Organization

```
form-engine/
├── lib/src/components/UIEngine/          ← Runtime library
│   ├── types.ts
│   ├── context.ts
│   ├── renderers.tsx
│   ├── layout.tsx
│   └── index.ts
├── lib/src/utils/ui-utils.ts             ← Shared utilities
├── frontend/src/apps/UIBuilder/          ← Designer tool
│   └── index.tsx
├── frontend/src/components/UIBuilder/    ← Example viewer (for testing)
│   └── example.tsx
└── ARCHITECTURE.md                        ← This file
```

## Common Questions

### Q: Can I use UIEngine without UIBuilder?
**A**: Yes! You can manually create yaml/json manifests. UIBuilder just makes it easier.

### Q: Can UIBuilder render the final UI?
**A**: No. UIBuilder shows a design canvas, not the actual end-user UI. It exports manifests for UIEngine to render.

### Q: Can I embed UIBuilder in my app?
**A**: Yes, it's a React component. But it's meant as a standalone designer tool, not part of runtime apps.

### Q: Do I need both?
**A**: No. UIEngine is required for rendering. UIBuilder is optional (for visual design). You could write manifests manually.

### Q: Can designers use UIBuilder without dev knowledge?
**A**: Yes. UIBuilder is visual, no code required. Click, drag, configure.

### Q: Can developers skip UIBuilder?
**A**: Yes. Manually create yaml/json manifests if preferred. UIBuilder is a convenience tool.

### Q: How is theme managed?
**A**: Designers set theme in UIBuilder → exported in manifest → UIEngine applies theme at runtime.

### Q: How are forms handled?
**A**: UIBuilder lets designers add Form components with form_ref → UIEngine integrates with FormEngine at runtime.

### Q: What about feature flags?
**A**: Designers mark components with feature_ref → Developer sets enabled features at runtime → UIEngine shows/hides components.

## Next Steps

1. **Extend UIBuilder**:
   - Add live preview using UIEngine
   - Add component dragging to canvas
   - Add advanced property editor (colors, spacing, etc.)
   - Add manifest versioning
   - Add collaboration features

2. **Extend UIEngine**:
   - Custom component support
   - Animation library integration
   - Icon system
   - Multi-language support

3. **Workflow Tools**:
   - CLI for validating manifests
   - CLI for generating TypeScript from manifests
   - VS Code extension for yaml editing
   - Prettier plugin for manifest formatting

## Summary

- **UIBuilder** = Designer tool (visual editor, creates manifests)
- **UIEngine** = Runtime library (renders manifests in apps)
- **Manifest** = Bridge between designer and app (yaml/json file)
- **Workflow** = Designer → UIBuilder → yaml → git → App (UIEngine) → End User
