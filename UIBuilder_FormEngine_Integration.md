# UIBuilder Form Component Integration Guide

## Overview

The UIBuilder's **Form component type** is fully integrated with the FormEngine, enabling seamless embedding of complex form workflows within UI designs defined in `ui_design.yaml`.

## How It Works

When a component specifies `type: Form`, the UIBuilder detects this and routes rendering through one of two paths:

### 1. FormEngine Integration Path (Recommended)

When a Form component has a `form_ref`:

```yaml
components:
  contact_form:
    name: contact_form
    label: Contact Us
    type: Form
    form_ref: contact_form_manifest        # ← References a FormEngine manifest
    data_binding:
      write_action_ref: submit_contact_form  # ← Called on form submit
      optimistic_updates: false
    lifecycle:
      on_mount: init_form
      on_data_load: form_loaded_handler
      on_data_error: form_error_handler
```

**Flow:**
1. UIBuilder detects `type: Form` and `form_ref`
2. Dynamically imports FormEngine component (lazy loaded)
3. Passes form manifest reference to FormEngine
4. FormEngine handles field rendering, validation, conditions
5. On submission, calls the `write_action_ref` handler
6. Handler updates UIBuilder state and backend
7. Lifecycle hooks triggered at appropriate points

### 2. Schema-Based Fallback Path

When only `schema_ref` is specified (no `form_ref`):

```yaml
components:
  feedback_form:
    type: Form
    schema_ref: feedback_schema
    fields: [name, email, message]
    actions:
      - name: submit_feedback
        label: Submit
        on_press: Submit
```

**Flow:**
1. UIBuilder renders simple form from schema fields
2. Auto-generates input fields for each field name
3. Renders buttons from actions list
4. Calls handler on form submission

## Configuration Options

### Form Component Properties

```typescript
interface FormComponent extends Component {
  type: ComponentType.Form;
  form_ref?: string;              // FormEngine manifest reference
  schema_ref?: string;            // Fallback to schema rendering
  data_binding?: DataBinding;     // Submission & data loading config
  fields?: string[];              // Which fields to render (if any)
  sections?: string[];            // Group fields into sections
  actions?: (Button | ButtonRef)[];  // Submit/clear/cancel buttons
  lifecycle?: ComponentLifecycle;  // Hooks for form lifecycle
  loading_state?: LoadingState;   // Loading feedback style
  empty_state?: EmptyState;       // What to show when no data
  error_state?: ErrorState;       // Error feedback
}
```

### Data Binding Configuration

```typescript
data_binding: {
  write_action_ref: 'submit_form',          // Handler called on form submit
  query_params: { /* pre-fill data */ },    // Initial form data
  pagination: { /* not used for forms */ }, // Ignored for Form type
  polling_interval_ms: null,                // Not applicable
  optimistic_updates: false,                // Update UI before server response
}
```

### Lifecycle Hooks

```typescript
lifecycle: {
  on_mount: 'init_form',           // When form first loads
  on_unmount: 'cleanup_form',      // When form is removed
  on_focus: 'form_focused',        // When form gains focus
  on_blur: 'form_blurred',         // When form loses focus
  on_data_load: 'form_loaded',     // After successful data fetch
  on_data_error: 'form_error',     // On data loading error
  on_refresh: 'refresh_form',      // On pull-to-refresh
}
```

## Handler Implementation

Handlers receive context with form data and can call APIs:

```typescript
const customHandlers: UIEngineHandlers = {
  submit_contact_form: async (context) => {
    const { formData, componentId, componentState } = context;
    
    // Validate (if not handled by FormEngine)
    if (!formData.email) {
      throw new Error('Email is required');
    }
    
    // Call your API
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit form');
    }
    
    // Handler can dispatch navigation or state updates
    return response.json();
  },

  init_form: async (context) => {
    // Load default values, fetch related data, etc.
    console.log('Form initializing:', context.componentId);
  },

  form_loaded: async (context) => {
    // Form data successfully loaded
    console.log('Form data loaded:', context.formData);
  },

  form_error: async (context) => {
    // Handle loading error
    console.error('Form error:', context.error);
  },
};
```

## Complete Example

### UI Design (ui_design.yaml)

```yaml
components:
  customer_form:
    name: customer_form
    label: Customer Information
    type: Form
    form_ref: customer_form_manifest
    fields: [first_name, last_name, email, phone]
    data_binding:
      write_action_ref: save_customer
      query_params:
        customerId: '{{context.customerId}}'
    loading_state:
      style: skeleton
      skeleton_rows: 4
    empty_state:
      text: No customer data loaded
      action_ref: retry_button
    error_state:
      text: Failed to load form
      retry_action_ref: retry_button
    lifecycle:
      on_mount: init_customer_form
      on_data_load: customer_form_ready
      on_data_error: customer_form_error
    accessibility:
      label: Customer information form
      role: form

screens:
  customer_detail:
    name: customer_detail
    components:
      - component_ref: customer_form
        direction: Center
```

### Frontend Integration

```tsx
import { UIBuilder } from '@/components/UIBuilder';
import manifest from './ui_design.json';

const handlers = {
  save_customer: async (context) => {
    const { customerId } = context.query_params;
    const response = await api.put(`/customers/${customerId}`, context.formData);
    return response.data;
  },

  init_customer_form: async (context) => {
    // Load customer data if needed
  },

  customer_form_ready: async (context) => {
    console.log('Form ready with data:', context.formData);
  },

  customer_form_error: async (context) => {
    console.error('Form error:', context.error);
  },
};

export function CustomerPage() {
  return (
    <UIBuilder
      manifest={manifest}
      handlers={handlers}
    />
  );
}
```

## FormEngine + UIBuilder Comparison

| Aspect | UIBuilder Form | Direct FormEngine |
|--------|----------------|-------------------|
| **Use Case** | Embedding forms in UI layouts | Building form-only applications |
| **Navigation** | Integrates with UIBuilder navigation | Custom navigation |
| **Layout** | Respects screen layout directions | Form-only layout |
| **Theme** | Inherits from UIBuilder theme | Custom theming |
| **State** | UIBuilder state management | FormEngine state management |
| **Composition** | Multiple forms on one screen | Single form focus |
| **Best For** | Dashboards, multi-section screens | Dedicated form pages |

## Error Handling

Form errors are handled through multiple layers:

1. **FormEngine Validation**: Field-level validation
2. **Handler Errors**: Caught and displayed in error state
3. **Error State UI**: Custom error message via component config
4. **Error Callbacks**: `on_data_error` lifecycle hook

```typescript
// Error handling in handler
submit_form: async (context) => {
  try {
    // Validation
    if (!context.formData.email) {
      throw new Error('Email is required');
    }

    // API call
    const response = await api.post('/submit', context.formData);
    
    if (!response.ok) {
      throw new Error(response.data?.message || 'Submission failed');
    }

    return response.data;
  } catch (err) {
    // Error will be caught by FormEngineWrapper
    // and stored in component error state
    throw err;
  }
},
```

Error UI displays in the component:

```
┌─────────────────────────────┐
│ Customer Information        │
├─────────────────────────────┤
│ ⚠️ Error: Email is required  │
├─────────────────────────────┤
│ [form fields]               │
│                             │
│    [Cancel]  [Retry]        │
└─────────────────────────────┘
```

## Loading States

Three loading scenarios:

### 1. Initial Load
Form shows skeleton placeholders while data loads:

```
[████] First Name
[████] Last Name
[████] Email
[████] Phone
```

### 2. Submission
After user clicks submit, shows loading indicator:

```
Submitting...
[⏳]
```

### 3. Custom Loading Style
Configure via `loading_state`:

```yaml
loading_state:
  style: spinner      # or skeleton, shimmer, progress_bar, overlay
  overlay_opacity: 0.7
  min_display_ms: 400 # Prevent flicker
```

## Conditional Forms

Show/hide forms based on conditions:

```yaml
components:
  admin_form:
    type: Form
    form_ref: admin_config
    feature_ref: admin_panel    # Only if feature enabled
    visible_access_levels: [Team, Reportee]  # Only for these roles
    hidden_condition:
      field: user_status
      operator: eq
      value: inactive
```

## Form Submission Flow

```
User Input
    ↓
FormEngine Validation
    ↓
Handler Called (write_action_ref)
    ↓
API Request
    ↓
Success → Update Component State
            └→ Trigger on_data_load hook
            └→ Show success toast/dialog
    ↓
Error → Show Error State
        └→ Trigger on_data_error hook
        └→ Show error message
```

## Performance Optimization

1. **Lazy Loading**: FormEngine is lazy loaded only when Form component is rendered
2. **Memoization**: Components are memoized to prevent unnecessary re-renders
3. **Optimistic Updates**: Enable for better perceived performance

```yaml
data_binding:
  optimistic_updates: true  # Update UI immediately while API call is pending
```

4. **Query Params**: Pass context values to pre-fill form

```yaml
data_binding:
  query_params:
    productId: '{{context.productId}}'
    category: '{{context.category}}'
```

## Testing Form Components

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UIBuilder } from '@/components/UIBuilder';

test('Form submission handler is called', async () => {
  const mockHandler = jest.fn();
  
  const manifest = {
    // ... manifest with form component
  };

  const { getByText } = render(
    <UIBuilder
      manifest={manifest}
      handlers={{
        submit_form: mockHandler,
      }}
    />
  );

  const submitButton = getByText('Submit');
  fireEvent.click(submitButton);

  await waitFor(() => {
    expect(mockHandler).toHaveBeenCalled();
  });
});
```

## Migration from Direct FormEngine

If migrating from using FormEngine directly:

**Before:**
```tsx
<FormEngine formId="my_form" onSubmit={handleSubmit} />
```

**After (with UIBuilder):**
```tsx
<UIBuilder manifest={{
  screens: {
    form_page: {
      components: [
        {
          component_ref: 'my_form',
          direction: 'Center',
        }
      ]
    }
  },
  components: {
    my_form: {
      type: 'Form',
      form_ref: 'my_form',
      data_binding: {
        write_action_ref: 'handleSubmit'
      }
    }
  },
  // ... rest of config
}} />
```

Benefits:
- Declarative configuration
- Easy to compose multiple forms
- Responsive layout support
- Theme integration
- Feature flags
- Accessibility built-in

## Troubleshooting

### Form not rendering
- Check `form_ref` matches a FormEngine manifest
- Verify FormEngine component is importable
- Check browser console for import errors

### Handler not called
- Verify `write_action_ref` matches handler key exactly
- Ensure handler is passed to UIBuilder
- Check console for errors during form submission

### Form validation not working
- Validate that FormEngine manifest has validation rules
- Check condition expressions are valid
- Enable browser devtools to debug condition evaluation

### Theme not applying to form
- Form inherits theme from UIBuilder context
- Verify theme colors are defined in manifest
- Check CSS is not overriding theme variables

## References

- [UIBuilder & UIEngine README](./UIBuilder_UIEngine_README.md)
- [ui_design.yaml Schema](../ui_design.yaml)
- [form_schema_v4.yaml](../form_schema_v4.yaml)
- [FormEngine Documentation](../FORM_ENGINE_README.md)
