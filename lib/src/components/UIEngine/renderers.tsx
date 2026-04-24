/**
 * UIEngine Component Renderers
 * Handles rendering of different component types
 * Integrates with FormEngine for Form component type
 */

import React, { useMemo, useCallback } from 'react';
import { Component, ComponentType, LoadingState, StateConfig } from './types';
import {
  useUIEngine,
  useComponentState,
  useFeatureGate,
  useConditionEvaluator,
  useAccessControl,
  useTheme,
} from './context';

// ─────────────────────────────────────────────────────────────────────────────
// LOADING STATE RENDERER
// ─────────────────────────────────────────────────────────────────────────────

export function LoadingIndicator({ loadingState }: { loadingState?: LoadingState }) {
  const style = loadingState?.style ?? 'skeleton';
  const theme = useTheme();

  if (style === 'none') return null;

  const commonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100px',
    color: theme.colors.on_surface || '#666',
  };

  if (style === 'spinner') {
    return (
      <div style={commonStyle}>
        <div
          style={{
            width: '40px',
            height: '40px',
            border: `4px solid ${theme.colors.surface || '#eee'}`,
            borderTop: `4px solid ${theme.colors.primary || '#007AFF'}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    );
  }

  if (style === 'skeleton' || style === 'shimmer') {
    const rows = loadingState?.skeleton_rows ?? 3;
    return (
      <div style={commonStyle}>
        <div style={{ width: '100%' }}>
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              style={{
                height: '20px',
                backgroundColor: theme.colors.surface || '#eee',
                marginBottom: '12px',
                borderRadius: theme.radius.default || '4px',
                animation: style === 'shimmer' ? 'shimmer 2s infinite' : 'none',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (style === 'progress_bar') {
    return (
      <div
        style={{
          width: '100%',
          height: '4px',
          backgroundColor: theme.colors.surface || '#eee',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: theme.colors.primary || '#007AFF',
            animation: 'progress 2s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  if (style === 'overlay') {
    const opacity = loadingState?.overlay_opacity ?? 0.6;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: `rgba(0, 0, 0, ${opacity})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={commonStyle}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: `4px solid rgba(255, 255, 255, 0.3)`,
              borderTop: `4px solid white`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE RENDERER
// ─────────────────────────────────────────────────────────────────────────────

export function EmptyStateRenderer({ component }: { component: Component }) {
  const { manifest } = useUIEngine();
  const theme = useTheme();
  const empty = component.empty_state;

  if (!empty) return null;

  const iconEntry = empty.icon_ref ? manifest.icons[empty.icon_ref] : null;
  const actionButton = empty.action_ref ? manifest.buttons[empty.action_ref] : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        padding: '24px',
        textAlign: 'center',
        color: theme.colors.on_surface || '#666',
      }}
    >
      {iconEntry && (
        <div style={{ marginBottom: '16px', fontSize: '48px' }}>
          {/* Icon rendering would depend on icon type */}
          📭
        </div>
      )}
      {empty.text && (
        <p
          style={{
            fontSize: theme.typography.scale.body_md || '14px',
            marginBottom: actionButton ? '16px' : '0',
          }}
        >
          {empty.text}
        </p>
      )}
      {actionButton && (
        <button
          style={{
            padding: '8px 16px',
            backgroundColor: theme.colors.primary || '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: theme.radius.default || '4px',
            cursor: 'pointer',
            fontSize: theme.typography.scale.body_sm || '12px',
          }}
        >
          {actionButton.label || 'Action'}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR STATE RENDERER
// ─────────────────────────────────────────────────────────────────────────────

export function ErrorStateRenderer({ component }: { component: Component }) {
  const { manifest } = useUIEngine();
  const theme = useTheme();
  const error = component.error_state;

  if (!error) return null;

  const iconEntry = error.icon_ref ? manifest.icons[error.icon_ref] : null;
  const retryButton = error.retry_action_ref ? manifest.buttons[error.retry_action_ref] : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        padding: '24px',
        textAlign: 'center',
        color: theme.colors.error || '#BA1A1A',
      }}
    >
      {iconEntry && (
        <div style={{ marginBottom: '16px', fontSize: '48px' }}>
          ⚠️
        </div>
      )}
      {error.text && (
        <p
          style={{
            fontSize: theme.typography.scale.body_md || '14px',
            marginBottom: retryButton ? '16px' : '0',
          }}
        >
          {error.text}
        </p>
      )}
      {retryButton && (
        <button
          style={{
            padding: '8px 16px',
            backgroundColor: theme.colors.error || '#BA1A1A',
            color: 'white',
            border: 'none',
            borderRadius: theme.radius.default || '4px',
            cursor: 'pointer',
            fontSize: theme.typography.scale.body_sm || '12px',
          }}
        >
          {retryButton.label || 'Retry'}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT TYPE RENDERERS
// ─────────────────────────────────────────────────────────────────────────────

function TreeRenderer({ component }: { component: Component }) {
  const theme = useTheme();
  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: theme.colors.surface || '#FFFFFF',
        borderRadius: theme.radius.default || '4px',
      }}
    >
      <p style={{ fontSize: theme.typography.scale.body_sm || '12px' }}>
        Tree: {component.label || component.name}
      </p>
      {/* Tree rendering implementation would go here */}
    </div>
  );
}

function TableRenderer({ component }: { component: Component }) {
  const theme = useTheme();
  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: theme.colors.surface || '#FFFFFF',
        borderRadius: theme.radius.default || '4px',
        overflowX: 'auto',
      }}
    >
      <p style={{ fontSize: theme.typography.scale.body_sm || '12px' }}>
        Table: {component.label || component.name}
      </p>
      {/* Table rendering implementation would go here */}
    </div>
  );
}

function FormRenderer({ component }: { component: Component }) {
  const theme = useTheme();
  const { manifest } = useUIEngine();
  
  // If form_ref is specified, try to use FormEngine
  if (component.form_ref) {
    return (
      <FormEngineWrapper
        component={component}
        manifest={manifest}
      />
    );
  }

  // Fallback to schema-based rendering if no form_ref
  if (component.schema_ref) {
    return (
      <SchemaBasedFormRenderer
        component={component}
        manifest={manifest}
      />
    );
  }

  // Minimal fallback
  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.surface || '#FFFFFF',
        borderRadius: theme.radius.default || '4px',
        border: `2px dashed ${theme.colors.outline || '#E0E0E0'}`,
      }}
    >
      <p style={{ fontSize: theme.typography.scale.body_md || '14px', margin: 0 }}>
        {component.label || 'Form'}
      </p>
      <p style={{ fontSize: theme.typography.scale.body_sm || '12px', margin: '8px 0 0 0', color: theme.colors.on_surface || '#666' }}>
        No form_ref or schema_ref specified
      </p>
    </div>
  );
}

/**
 * FormEngineWrapper - Integrates with FormEngine for embedded forms
 * Handles form submission, lifecycle hooks, and data binding
 */
interface FormEngineWrapperProps {
  component: Component;
  manifest: any; // UIDesignManifest type
}

function FormEngineWrapper({ component, manifest }: FormEngineWrapperProps) {
  const theme = useTheme();
  const { handlers } = useUIEngine();
  const { state: compState, updateState } = useComponentState(component.name);
  const evaluateCondition = useConditionEvaluator();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Dynamic import of FormEngine - only loaded when Form component is used
  const FormEngineComponent = React.lazy(() =>
    import('../FormEngine/index').then(m => ({
      default: m.FormEngine,
    }))
  );

  const handleFormSubmit = useCallback(
    async (formData: Record<string, any>) => {
      try {
        setIsSubmitting(true);
        setError(null);

        // Call write_action_ref handler if specified
        if (component.data_binding?.write_action_ref) {
          const handler = handlers[component.data_binding.write_action_ref];
          if (handler) {
            await handler({
              formData,
              componentId: component.name,
              componentState: compState,
            });
          }
        }

        // Call custom submit handler if specified
        if (component.actions) {
          const submitAction = component.actions.find(
            a => 'button_ref' in a ? manifest.buttons?.[a.button_ref]?.on_press === 'Submit' : a.on_press === 'Submit'
          );

          if (submitAction && 'button_ref' in submitAction) {
            const button = manifest.buttons?.[submitAction.button_ref];
            if (button?.custom_handler) {
              const handler = handlers[button.custom_handler];
              if (handler) {
                await handler({ formData, componentId: component.name });
              }
            }
          }
        }

        // Trigger on_data_load lifecycle hook
        if (component.lifecycle?.on_data_load) {
          const handler = handlers[component.lifecycle.on_data_load];
          if (handler) {
            await handler({ formData, componentId: component.name });
          }
        }

        updateState({ lastSubmitted: new Date().toISOString(), data: formData });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Form submission failed');

        // Trigger on_data_error lifecycle hook
        if (component.lifecycle?.on_data_error) {
          const handler = handlers[component.lifecycle.on_data_error];
          if (handler) {
            await handler({ error: err, componentId: component.name });
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [component, handlers, compState, updateState]
  );

  return (
    <div
      style={{
        padding: theme.spacing.md || '16px',
        backgroundColor: theme.colors.surface || '#FFFFFF',
        borderRadius: theme.radius.default || '4px',
      }}
    >
      {component.label && (
        <h3
          style={{
            margin: '0 0 16px 0',
            fontSize: theme.typography.scale.headline_md || '18px',
            color: theme.colors.on_surface || '#000',
          }}
        >
          {component.label}
        </h3>
      )}

      {error && (
        <div
          style={{
            padding: '12px',
            marginBottom: '16px',
            backgroundColor: theme.colors.error + '20' || '#BA1A1A20',
            border: `1px solid ${theme.colors.error || '#BA1A1A'}`,
            borderRadius: theme.radius.default || '4px',
            color: theme.colors.error || '#BA1A1A',
            fontSize: theme.typography.scale.body_sm || '12px',
          }}
        >
          {error}
        </div>
      )}

      <React.Suspense
        fallback={
          <LoadingIndicator
            loadingState={component.loading_state || { style: 'skeleton', skeleton_rows: 5 }}
          />
        }
      >
        <FormEngineComponent
          formId={component.form_ref}
          onSubmit={handleFormSubmit}
          disabled={isSubmitting}
          theme={theme}
          // Pass component settings to FormEngine
          fields={component.fields}
          sections={component.sections}
          context={compState}
        />
      </React.Suspense>

      {isSubmitting && (
        <div style={{ marginTop: '16px' }}>
          <LoadingIndicator loadingState={component.loading_state} />
        </div>
      )}
    </div>
  );
}

/**
 * SchemaBasedFormRenderer - Falls back to schema-based rendering
 * when form_ref is not specified but schema_ref is
 */
interface SchemaBasedFormRendererProps {
  component: Component;
  manifest: any;
}

function SchemaBasedFormRenderer({ component, manifest }: SchemaBasedFormRendererProps) {
  const theme = useTheme();
  const { handlers } = useUIEngine();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);

      try {
        if (component.data_binding?.write_action_ref) {
          const handler = handlers[component.data_binding.write_action_ref];
          if (handler) {
            await handler({ componentId: component.name });
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [component, handlers]
  );

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: theme.spacing.md || '16px',
        backgroundColor: theme.colors.surface || '#FFFFFF',
        borderRadius: theme.radius.default || '4px',
      }}
    >
      {component.label && (
        <h3 style={{ margin: '0 0 16px 0', fontSize: theme.typography.scale.headline_md || '18px' }}>
          {component.label}
        </h3>
      )}

      {component.text && (
        <p style={{ margin: '0 0 16px 0', fontSize: theme.typography.scale.body_md || '14px' }}>
          {component.text}
        </p>
      )}

      {/* Render fields from schema */}
      <div style={{ marginBottom: '16px', minHeight: '100px' }}>
        {component.fields && component.fields.length > 0 ? (
          <div>
            {component.fields.map(fieldName => (
              <div key={fieldName} style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: theme.typography.scale.body_sm || '12px',
                    fontWeight: 'bold',
                    marginBottom: '4px',
                  }}
                >
                  {fieldName}
                </label>
                <input
                  type="text"
                  placeholder={`Enter ${fieldName}`}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme.colors.outline || '#E0E0E0'}`,
                    borderRadius: theme.radius.default || '4px',
                    fontSize: theme.typography.scale.body_sm || '12px',
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: theme.colors.on_surface || '#666', fontSize: theme.typography.scale.body_sm || '12px' }}>
            No fields specified
          </p>
        )}
      </div>

      {/* Render actions/buttons */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {component.actions?.map((action, idx) => {
          const button =
            'button_ref' in action ? manifest.buttons?.[action.button_ref] : action;

          return (
            <button
              key={idx}
              type={button?.on_press === 'Submit' ? 'submit' : 'button'}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                backgroundColor:
                  button?.background_color
                    ? `#${button.background_color}`
                    : theme.colors.primary || '#007AFF',
                color:
                  button?.foreground_color
                    ? `#${button.foreground_color}`
                    : 'white',
                border: 'none',
                borderRadius: theme.radius.default || '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
                fontSize: theme.typography.scale.body_sm || '12px',
              }}
            >
              {button?.label || 'Submit'}
            </button>
          );
        })}
      </div>
    </form>
  );
}

function VerticalListRenderer({ component }: { component: Component }) {
  const theme = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        backgroundColor: theme.colors.surface || '#FFFFFF',
        borderRadius: theme.radius.default || '4px',
      }}
    >
      <p style={{ fontSize: theme.typography.scale.body_sm || '12px' }}>
        List (Vertical): {component.label || component.name}
      </p>
      {/* Vertical list rendering implementation would go here */}
    </div>
  );
}

function HorizontalListRenderer({ component }: { component: Component }) {
  const theme = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '12px',
        padding: '12px',
        overflowX: 'auto',
        backgroundColor: theme.colors.surface || '#FFFFFF',
        borderRadius: theme.radius.default || '4px',
      }}
    >
      <p style={{ fontSize: theme.typography.scale.body_sm || '12px' }}>
        List (Horizontal): {component.label || component.name}
      </p>
      {/* Horizontal list rendering implementation would go here */}
    </div>
  );
}

function SearchRenderer({ component }: { component: Component }) {
  const theme = useTheme();
  return (
    <div style={{ padding: '12px' }}>
      <input
        type="text"
        placeholder={component.label || 'Search...'}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: `1px solid ${theme.colors.primary || '#007AFF'}`,
          borderRadius: theme.radius.default || '4px',
          fontSize: theme.typography.scale.body_md || '14px',
        }}
      />
    </div>
  );
}

function CardRenderer({ component }: { component: Component }) {
  const theme = useTheme();
  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.surface || '#FFFFFF',
        borderRadius: theme.radius.default || '4px',
        boxShadow: theme.elevation.default || '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      {component.label && (
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: theme.typography.scale.headline_md || '16px',
          }}
        >
          {component.label}
        </h3>
      )}
      {component.text && (
        <p
          style={{
            margin: 0,
            fontSize: theme.typography.scale.body_md || '14px',
            color: theme.colors.on_surface || '#666',
          }}
        >
          {component.text}
        </p>
      )}
    </div>
  );
}

function TileRenderer({ component }: { component: Component }) {
  const theme = useTheme();
  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.surface || '#FFFFFF',
        borderRadius: theme.radius.default || '4px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
      }}
    >
      {component.label && (
        <h4 style={{ margin: '0 0 8px 0', fontSize: theme.typography.scale.body_md || '14px' }}>
          {component.label}
        </h4>
      )}
      {component.text && (
        <p
          style={{
            margin: 0,
            fontSize: theme.typography.scale.body_sm || '12px',
            color: theme.colors.on_surface || '#666',
          }}
        >
          {component.text}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT RENDERER
// ─────────────────────────────────────────────────────────────────────────────

export interface ComponentRendererProps {
  component: Component;
  componentId: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  isError?: boolean;
}

export const ComponentRenderer = React.memo(function ComponentRenderer({
  component,
  componentId,
  isLoading = false,
  isEmpty = false,
  isError = false,
}: ComponentRendererProps) {
  const theme = useTheme();
  const featureEnabled = useFeatureGate(component.feature_ref);
  const { state } = useUIEngine();
  const evaluateCondition = useConditionEvaluator();
  const hasAccess = useAccessControl(component.visible_access_levels, undefined);

  // Check if component should be rendered
  const isHidden = component.hidden_condition && !evaluateCondition(component.hidden_condition);

  if (!featureEnabled || isHidden || !hasAccess) {
    return null;
  }

  // Apply theme-based styles
  const containerStyle: React.CSSProperties = {
    backgroundColor: component.background_color
      ? `#${component.background_color}`
      : theme.colors.surface || '#FFFFFF',
    color: component.foreground_color
      ? `#${component.foreground_color}`
      : theme.colors.on_surface || '#000',
    padding: theme.spacing.md || '16px',
    borderRadius: theme.radius.default || '4px',
    marginBottom: theme.spacing.sm || '8px',
  };

  // Render loading state
  if (isLoading) {
    return (
      <div style={containerStyle}>
        <LoadingIndicator loadingState={component.loading_state} />
      </div>
    );
  }

  // Render empty state
  if (isEmpty) {
    return (
      <div style={containerStyle}>
        <EmptyStateRenderer component={component} />
      </div>
    );
  }

  // Render error state
  if (isError) {
    return (
      <div style={containerStyle}>
        <ErrorStateRenderer component={component} />
      </div>
    );
  }

  // Render component based on type
  let content;

  switch (component.type) {
    case ComponentType.Tree:
      content = <TreeRenderer component={component} />;
      break;
    case ComponentType.Table:
      content = <TableRenderer component={component} />;
      break;
    case ComponentType.Form:
      content = <FormRenderer component={component} />;
      break;
    case ComponentType.VerticalList:
      content = <VerticalListRenderer component={component} />;
      break;
    case ComponentType.HorizontalList:
      content = <HorizontalListRenderer component={component} />;
      break;
    case ComponentType.Search:
      content = <SearchRenderer component={component} />;
      break;
    case ComponentType.Card:
      content = <CardRenderer component={component} />;
      break;
    case ComponentType.Tile:
      content = <TileRenderer component={component} />;
      break;
    default:
      content = <div>Unknown component type: {component.type}</div>;
  }

  return <div style={containerStyle}>{content}</div>;
});

ComponentRenderer.displayName = 'ComponentRenderer';
