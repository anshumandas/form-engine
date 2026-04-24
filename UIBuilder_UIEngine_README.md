# UIEngine & UIBuilder Documentation

## Overview

UIEngine and UIBuilder are a comprehensive UI rendering system aligned with the `ui_design.yaml` schema. They provide a declarative, component-based approach to building responsive, theme-aware user interfaces.

## Architecture

### Components

- **UIEngine** (`lib/src/components/UIEngine/`): Core engine managing state, context, and rendering logic
- **UIBuilder** (`frontend/src/components/UIBuilder/`): Frontend wrapper component for rendering full UI designs
- **Utils** (`lib/src/utils/ui-utils.ts`): Helper functions for manifest validation, theme handling, breakpoints

## Key Concepts from ui_design.yaml

### 1. Component Types

Eight primary component types aligned with visual patterns:

- **Tree**: Hierarchical expandable/collapsible node structure
- **Table**: Rows-and-columns data grid
- **Form**: Field-input layout bound to forms
- **VerticalList**: Scrollable vertical list of items
- **HorizontalList**: Horizontally scrolling carousel-style list
- **Search**: Search box with result list
- **Card**: Contained surface with optional header and actions
- **Tile**: Compact fixed-size clickable tile (dashboard grid)

### 2. Layout Directions

Components are positioned using LayoutDirection within screens:

- **Center**: Fills the central content area (flex: 1)
- **Top**: Docked to top (sticky, z-index: 100)
- **Bottom**: Docked to bottom (sticky, z-index: 100)
- **Left**: Docked to left sidebar (sticky, z-index: 90)
- **Right**: Docked to right sidebar (sticky, z-index: 90)
- **Floating**: Absolutely positioned overlay (FAB, tooltips)
- **Modal**: Modal overlay that blocks interaction below (z-index: 200)

### 3. Navigation

- **Navigation Types**: `tab_bar`, `drawer`, `stack`, `none`
- **Tab Bar Position**: `top` or `bottom`
- **Home Screens**: Screens marked `is_home: true` appear in navigation
- **Nav Order**: Controls display order in navigation chrome

### 4. Theme & Design Tokens

```typescript
{
  colors: { primary, primary_light, surface, on_surface, error, warning, success },
  typography: { font_family_default, font_family_mono, scale: { body_sm, body_md, headline_md, ... } },
  spacing: { xs, sm, md, lg, xl },
  radius: { small, default, large },
  elevation: { default, raised, floating },
  motion: { duration_fast_ms, duration_standard_ms, duration_slow_ms, easing_* },
  dark_mode: { /* color overrides for dark mode */ }
}
```

### 5. Responsive Breakpoints

Named viewport breakpoints for responsive design:

```typescript
{
  mobile: { min_width_px: 0, max_width_px: 640, columns: 4 },
  tablet: { min_width_px: 640, max_width_px: 1024, columns: 8 },
  desktop: { min_width_px: 1024, columns: 12 }
}
```

### 6. Data Binding

Components can bind to data sources with:

```typescript
{
  source_ref: "data_source_key",
  query_params: { /* filter params */ },
  pagination: { type: "page_number", page_size: 20 },
  sort: { field: "name", direction: "asc" },
  optimistic_updates: true
}
```

### 7. State Feedback

Components can display:

- **LoadingState**: spinner, skeleton, shimmer, progress_bar, overlay
- **EmptyState**: Custom UI when data is empty
- **ErrorState**: Custom UI when data loading fails

### 8. Features & Access Control

```typescript
{
  feature_ref: "premium_feature",  // UAM feature gate
  visible_access_levels: ["Team", "Reportee"],  // Access control
  hidden_condition: { field: "status", operator: "eq", value: "draft" }  // Conditional visibility
}
```

## Usage

### Basic Setup

```tsx
import { UIBuilder } from '@/components/UIBuilder';
import manifest from './ui_design.json';

export default function App() {
  return (
    <UIBuilder
      manifest={manifest}
      handlers={{
        onSubmit: async (context) => {
          console.log('Form submitted:', context);
        },
      }}
    />
  );
}
```

### Using Hooks within Components

```tsx
import {
  useUIEngine,
  useTheme,
  useNavigation,
  useComponentState,
  useFeatureGate,
} from '@/components/UIEngine';

function MyComponent() {
  const { manifest, state } = useUIEngine();
  const theme = useTheme();
  const { push } = useNavigation();
  const { state: compState, updateState } = useComponentState('myComponent');
  const isPremium = useFeatureGate('premium_features');

  return (
    <div style={{ backgroundColor: theme.colors.surface }}>
      {/* Component content */}
    </div>
  );
}
```

### Creating Custom Component Types

Extend ComponentRenderer to add custom component types:

```tsx
import { ComponentRenderer, ComponentType, Component } from '@/components/UIEngine';

export function CustomComponentRenderer(props: ComponentRendererProps) {
  const component = props.component;

  if (component.type === 'CustomType') {
    return <CustomTypeComponent component={component} />;
  }

  return <ComponentRenderer {...props} />;
}
```

### Theme Customization

Apply themes to the DOM:

```tsx
import { applyThemeToDOM } from '@/lib/utils/ui-utils';

useEffect(() => {
  applyThemeToDOM(manifest.theme, isDarkMode);
}, [manifest.theme, isDarkMode]);
```

### Manifest Validation

```tsx
import { validateManifest } from '@/lib/utils/ui-utils';

const manifest = loadYourManifest();
const errors = validateManifest(manifest);

if (errors.length > 0) {
  console.error('Manifest validation errors:', errors);
}
```

### Responsive Handling

```tsx
import { getCurrentBreakpoint } from '@/lib/utils/ui-utils';

function ResponsiveComponent() {
  const [breakpoint, setBreakpoint] = useState('mobile');

  useEffect(() => {
    const handleResize = () => {
      setBreakpoint(getCurrentBreakpoint(manifest.breakpoints));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div>Current breakpoint: {breakpoint}</div>;
}
```

## API Reference

### UIEngineProvider

Wraps your app with UIEngine context:

```tsx
<UIEngineProvider manifest={manifest} handlers={customHandlers}>
  <YourApp />
</UIEngineProvider>
```

**Props:**
- `manifest: UIDesignManifest` - The UI design manifest
- `handlers?: UIEngineHandlers` - Custom action handlers
- `children: ReactNode` - Child components

### UIBuilder

Main component for rendering UI designs:

```tsx
<UIBuilder
  manifest={manifest}
  handlers={customHandlers}
  showNavigation={true}
  navigationMode="tab_bar"
/>
```

**Props:**
- `manifest: UIDesignManifest` - Required. UI design manifest
- `handlers?: UIEngineHandlers` - Optional. Custom action handlers
- `showNavigation?: boolean` - Optional. Show navigation chrome (default: true)
- `navigationMode?: 'drawer' | 'tab_bar' | 'none'` - Optional. Override navigation type

### Hooks

#### `useUIEngine()`
Access the full UIEngine context (manifest, state, handlers, dispatch).

#### `useTheme()`
Get the current theme with dark mode applied.

#### `useNavigation()`
Navigation methods: `push(screenKey)`, `pop()`, `setScreen(screenKey)`, `canGoBack`.

#### `useComponentState(componentId)`
Manage component-local state: `{ state, setState, updateState }`.

#### `useFeatureGate(featureRef)`
Check if a feature is enabled.

#### `useAccessControl(roles, accessLevels)`
Check user access permissions.

#### `useConditionEvaluator()`
Evaluate conditional visibility expressions.

#### `useResponsiveValue(values, defaultValue)`
Get responsive values by breakpoint name.

#### `useCurrentScreen()`
Get the current screen definition.

#### `useComponent(componentKey)`
Get a component definition by key.

#### `useButton(buttonKey)`
Get a button definition by key.

#### `useIcon(iconKey)`
Get an icon definition by key.

## State Management

UIEngine uses a Redux-like reducer pattern:

```typescript
type UIEngineAction =
  | { type: 'SET_SCREEN'; payload: string }
  | { type: 'PUSH_SCREEN'; payload: string }
  | { type: 'POP_SCREEN' }
  | { type: 'SET_BREAKPOINT'; payload: string }
  | { type: 'SET_DARK_MODE'; payload: boolean }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_ROLE_CATEGORIES'; payload: string[] }
  | { type: 'SET_ENABLED_FEATURES'; payload: string[] }
  | { type: 'SET_COMPONENT_STATE'; payload: { componentId: string; state: any } }
  | { type: 'UPDATE_COMPONENT_STATE'; payload: { componentId: string; updates: any } };
```

Access the dispatcher:

```tsx
const { dispatch } = useUIEngine();

dispatch({ type: 'PUSH_SCREEN', payload: 'details_screen' });
dispatch({ type: 'SET_DARK_MODE', payload: true });
```

## Best Practices

1. **Validate Manifests Early**: Always validate your manifest using `validateManifest()` before deployment
2. **Use Feature Gates**: Gate features behind UAM feature flags for safe rollouts
3. **Responsive Design**: Use breakpoints and `breakpoint_overrides` for responsive layouts
4. **Accessibility**: Always fill `accessibility` properties for screen readers
5. **Theme Tokens**: Use theme variables instead of hardcoded colors
6. **Error Handling**: Implement `error_state` feedback for better UX
7. **Loading States**: Use appropriate `loading_state` styles to prevent layout shift

## File Structure

```
lib/src/components/UIEngine/
├── types.ts                 # Type definitions
├── context.ts              # React Context & hooks
├── renderers.tsx           # Component type renderers
├── layout.tsx              # Layout direction system
└── index.ts                # Public exports

frontend/src/components/UIBuilder/
└── index.tsx               # Main UIBuilder component

lib/src/utils/
└── ui-utils.ts            # Utility functions
```

## Troubleshooting

### "Component not found" warnings
Check that all `component_ref` values in screens and components match keys in the `components` map.

### Theme colors not applying
Ensure theme colors are properly defined and use correct property names from the schema.

### Navigation not working
Verify `initial_screen` exists in the `screens` map and navigation mode is set correctly.

### Responsive layout breaking
Check breakpoint definitions are sorted by min_width_px and cover the full viewport range.

## Contributing

When extending UIEngine:

1. Add new types to `types.ts`
2. Add hooks to `context.ts` if accessing state
3. Add renderers to `renderers.tsx` for new component types
4. Update utilities in `ui-utils.ts` for helper functions
5. Test with manifest validation

## Related Files

- `ui_design.yaml` - Schema definition this engine implements
- `form_schema_v4.yaml` - Related form engine schema
