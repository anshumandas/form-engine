# UIBuilder vs UIEngine - Clear Separation

## Quick Reference

| Aspect | UIBuilder | UIEngine |
|--------|-----------|----------|
| **Purpose** | Visual designer tool for creating UI manifests | Runtime library for rendering manifests |
| **User** | Designers, UX developers | Application developers |
| **Input** | Nothing (starts blank) or existing manifest yaml/json | Manifest yaml/json |
| **Output** | Manifest yaml/json file | Rendered UI components |
| **Where** | `frontend/src/apps/UIBuilder/` | `lib/src/components/UIEngine/` |
| **When Used** | Design-time (create designs) | Runtime (render designs) |
| **Deployment** | Standalone app for designers | NPM package for developers |
| **Data Storage** | Design files in git repo | Used in memory by applications |

## The Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DESIGN PHASE (UIBuilder)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Designer opens UIBuilder app                                  │
│  ↓                                                              │
│  Creates screens visually (drag-drop interface)                │
│  ↓                                                              │
│  Adds components to screens                                    │
│  ↓                                                              │
│  Configures properties (text, colors, actions, etc.)           │
│  ↓                                                              │
│  Exports as manifest.yaml → committed to git                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                      manifest.yaml file
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                   RUNTIME PHASE (UIEngine)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  App developer imports UIEngine library                        │
│  ↓                                                              │
│  App imports manifest.yaml from git                            │
│  ↓                                                              │
│  App renders: <UIEngineProvider manifest={manifest}>           │
│  ↓                                                              │
│  UIEngine reads manifest and renders actual UI                 │
│  ↓                                                              │
│  End user sees rendered UI in application                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Differences

### UIBuilder (Designer Tool)
- **Only developers/designers use this**
- Creates the blueprint (manifest)
- Visual, no code needed
- Output: `manifest.yaml`
- Location: `frontend/src/apps/UIBuilder/`
- Do NOT try to render end-user UIs here
- Do NOT import manifest into this app

### UIEngine (Runtime Library)
- **Applications import this**
- Reads the blueprint (manifest)
- Renders actual UI for end users
- Input: `manifest.yaml`
- Location: `lib/src/components/UIEngine/`
- Exported as NPM package: `@form-engine/ui-engine`
- Do NOT use for designing/creating manifests

## Example: Contact Form App

### Design Time (UIBuilder)
```
Designer → Opens UIBuilder app
         → Creates "ContactForm" screen
         → Adds Form component
         → Configures: label="Email", type="email"
         → Adds Button component
         → Configures: label="Submit", action="submit"
         → Exports as "contact_form_manifest.yaml"
         → Commits to git
```

### Runtime (UIEngine)
```
App Developer → Imports UIEngine library (npm)
              → Imports manifest: import manifest from './contact_form_manifest.yaml'
              → Renders: <UIEngineProvider manifest={manifest}>
              → UIEngine reads manifest
              → UIEngine renders Form + Button
              → User fills form and clicks submit
              → Form data flows to handlers
```

## Files and Their Roles

### UIBuilder (Designer)
- `frontend/src/apps/UIBuilder/index.tsx` - Main designer app
  - ScreenTree - Manage screens
  - ComponentPalette - Available components
  - CanvasEditor - Visual canvas
  - PropertyEditor - Configure selected component
  - Export button - Generate yaml

### UIEngine (Runtime)
- `lib/src/components/UIEngine/types.ts` - Type definitions
- `lib/src/components/UIEngine/context.ts` - State management
- `lib/src/components/UIEngine/renderers.tsx` - Component renderers
- `lib/src/components/UIEngine/layout.tsx` - Layout system
- `lib/src/components/UIEngine/index.ts` - Public exports

### Test/Example Files
- `frontend/src/components/UIEngine/TestViewer.tsx` - Example of using UIEngine
  - Shows how developers use UIEngine
  - Loads a manifest
  - Renders it in an app
  - NOT for designing manifests

## Common Mistakes to Avoid

❌ **Don't**: Try to use UIBuilder to render end-user UIs
✅ **Do**: Use UIBuilder only to create manifests

❌ **Don't**: Try to use UIEngine to design manifests
✅ **Do**: Use UIEngine only to render manifests

❌ **Don't**: Import manifest in UIBuilder for editing
✅ **Do**: UIBuilder creates new manifests from scratch (or imports for editing/exporting)

❌ **Don't**: Deploy UIBuilder to production for end users
✅ **Do**: Deploy applications that use UIEngine to production

## Why This Separation Matters

1. **Tool vs Library**: UIBuilder is a meta-tool (tool for making tools), UIEngine is a library for using tools
2. **No Circular Dependency**: UIBuilder doesn't depend on UIEngine for rendering
3. **Reusability**: UIEngine can be used by any application
4. **Scaling**: Designers can work independently on manifests
5. **Clarity**: Clear roles and responsibilities

## Integration Points

### FormEngine Integration
- **In UIEngine**: Form component type integrates FormEngine
- **Via**: FormEngineWrapper in renderers.tsx
- **Data Flow**: Manifest → UIEngine → Form component → FormEngine
- **Purpose**: Allows complex form rendering through existing FormEngine

### Feature Flags (UAM)
- **In Both**: UIBuilder shows feature_ref property
- **In Both**: UIEngine evaluates feature gates
- **Result**: Conditional component rendering

### Theme System
- **In UIBuilder**: Theme editor (planned)
- **In UIEngine**: Theme application to components
- **Storage**: Theme defined in manifest

## Next Steps

### For UIBuilder Enhancement
- [ ] Live preview pane (showing actual UIEngine rendering)
- [ ] Drag-drop to canvas (not just property editor)
- [ ] Import manifest from file
- [ ] Template library
- [ ] Undo/redo support

### For UIEngine Distribution
- [ ] Package as npm: `@form-engine/ui-engine`
- [ ] Create npm package.json
- [ ] Version management
- [ ] Distribution documentation

### For Developer Experience
- [ ] CLI tool to validate manifests
- [ ] CLI tool to generate TypeScript from manifests
- [ ] Schema documentation generator
- [ ] Integration examples

---

**Remember**: UIBuilder creates the recipe, UIEngine follows the recipe.
