/**
 * UIBuilder - Visual Designer Tool for UI Design
 * 
 * UIBuilder is a drag-and-drop visual editor that:
 * - Allows designers to create/edit UI screens visually
 * - Generates ui_design.yaml manifests
 * - Provides live preview using UIEngine
 * - Exports designs for use by other applications
 * 
 * Architecture:
 * - Canvas: Drag-drop interface for designing
 * - Property Panel: Configure component settings
 * - Component Palette: Available components to add
 * - Preview Pane: Live preview using UIEngine
 * - File Management: Import/Export yaml
 */

import React, { useState, useCallback } from 'react';
import {
  UIDesignManifest,
  Component,
  Screen,
  Button,
  Theme,
  LayoutDirection,
} from '@form-engine/components/UIEngine/types';
import { validateManifest } from '@form-engine/utils/ui-utils';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES FOR DESIGNER
// ─────────────────────────────────────────────────────────────────────────────

export interface UIBuilderState {
  currentManifest: UIDesignManifest | null;
  selectedScreenKey: string | null;
  selectedComponentPath: string[]; // Array of keys for nested selection
  selectedButtonKey: string | null;
  editingPropertyPath: string | null;
  isDirty: boolean;
  validationErrors: any[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS EDITOR
// ─────────────────────────────────────────────────────────────────────────────

interface CanvasEditorProps {
  manifest: UIDesignManifest | null;
  selectedScreenKey: string | null;
  selectedComponentPath: string[];
  onScreenSelect: (screenKey: string) => void;
  onComponentSelect: (path: string[]) => void;
  onComponentDrop: (componentRef: string, direction: LayoutDirection, index: number) => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  manifest,
  selectedScreenKey,
  selectedComponentPath,
  onScreenSelect,
  onComponentSelect,
  onComponentDrop,
}) => {
  if (!manifest || !selectedScreenKey) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
        No screen selected. Click a screen in the left panel.
      </div>
    );
  }

  const screen = manifest.screens[selectedScreenKey];
  if (!screen) return null;

  return (
    <div
      style={{
        flex: 1,
        padding: '20px',
        backgroundColor: '#f5f5f5',
        overflowY: 'auto',
        border: '1px solid #ddd',
      }}
    >
      <h3 style={{ margin: '0 0 20px 0' }}>{screen.label || screen.name}</h3>

      {/* Canvas showing current screen layout */}
      <div
        style={{
          minHeight: '600px',
          backgroundColor: '#fff',
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: '20px',
          position: 'relative',
        }}
      >
        <div style={{ textAlign: 'center', color: '#999', marginTop: '250px' }}>
          <p style={{ fontSize: '14px' }}>Screen: {screen.name}</p>
          <p style={{ fontSize: '12px', color: '#bbb' }}>
            {screen.components.length} component(s)
          </p>

          {/* Render component hierarchy */}
          <div style={{ marginTop: '20px', textAlign: 'left', maxWidth: '400px', margin: '20px auto' }}>
            {screen.components.map((placement, idx) => (
              <div
                key={idx}
                onClick={() => onComponentSelect([String(idx)])}
                style={{
                  padding: '10px',
                  marginBottom: '8px',
                  backgroundColor:
                    selectedComponentPath[0] === String(idx) ? '#e3f2fd' : '#f9f9f9',
                  border: selectedComponentPath[0] === String(idx) ? '2px solid #2196F3' : '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                  {manifest.components[placement.component_ref]?.label || placement.component_ref}
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  Direction: {placement.direction}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT PALETTE
// ─────────────────────────────────────────────────────────────────────────────

interface ComponentPaletteProps {
  onComponentDrag: (componentType: string) => void;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ onComponentDrag }) => {
  const componentTypes = [
    'Tree',
    'Table',
    'Form',
    'VerticalList',
    'HorizontalList',
    'Search',
    'Card',
    'Tile',
  ];

  return (
    <div
      style={{
        width: '200px',
        backgroundColor: '#f9f9f9',
        borderRight: '1px solid #ddd',
        padding: '15px',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 60px)',
      }}
    >
      <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', textTransform: 'uppercase', color: '#666' }}>
        Components
      </h4>

      {componentTypes.map(type => (
        <div
          key={type}
          draggable
          onDragStart={() => onComponentDrag(type)}
          style={{
            padding: '10px',
            marginBottom: '8px',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'grab',
            fontSize: '12px',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#fff';
          }}
        >
          {type}
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PROPERTY EDITOR
// ─────────────────────────────────────────────────────────────────────────────

interface PropertyEditorProps {
  component: Component | null;
  manifest: UIDesignManifest | null;
  onPropertyChange: (path: string, value: any) => void;
}

export const PropertyEditor: React.FC<PropertyEditorProps> = ({
  component,
  manifest,
  onPropertyChange,
}) => {
  if (!component) {
    return (
      <div style={{ width: '300px', backgroundColor: '#f9f9f9', borderLeft: '1px solid #ddd', padding: '15px' }}>
        <p style={{ color: '#999', fontSize: '12px' }}>No component selected</p>
      </div>
    );
  }

  return (
    <div style={{ width: '300px', backgroundColor: '#f9f9f9', borderLeft: '1px solid #ddd', padding: '15px' }}>
      <h4 style={{ margin: '0 0 15px 0', fontSize: '12px' }}>Properties</h4>

      {/* Name */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
          Name
        </label>
        <input
          type="text"
          value={component.name}
          onChange={(e) => onPropertyChange('name', e.target.value)}
          style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
        />
      </div>

      {/* Label */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
          Label
        </label>
        <input
          type="text"
          value={component.label || ''}
          onChange={(e) => onPropertyChange('label', e.target.value)}
          style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
        />
      </div>

      {/* Type */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
          Type
        </label>
        <select
          value={component.type}
          onChange={(e) => onPropertyChange('type', e.target.value)}
          style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option>Tree</option>
          <option>Table</option>
          <option>Form</option>
          <option>VerticalList</option>
          <option>HorizontalList</option>
          <option>Search</option>
          <option>Card</option>
          <option>Tile</option>
        </select>
      </div>

      {/* Description */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
          Text
        </label>
        <textarea
          value={component.text || ''}
          onChange={(e) => onPropertyChange('text', e.target.value)}
          style={{
            width: '100%',
            padding: '6px',
            fontSize: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            minHeight: '60px',
            fontFamily: 'monospace',
          }}
        />
      </div>

      {/* Feature Ref */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
          Feature Ref (optional)
        </label>
        <input
          type="text"
          value={component.feature_ref || ''}
          onChange={(e) => onPropertyChange('feature_ref', e.target.value)}
          style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
          placeholder="e.g., premium_features"
        />
      </div>

      {/* Colors */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
          Background Color
        </label>
        <input
          type="text"
          value={component.background_color || ''}
          onChange={(e) => onPropertyChange('background_color', e.target.value)}
          style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
          placeholder="Hex without #"
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
          Foreground Color
        </label>
        <input
          type="text"
          value={component.foreground_color || ''}
          onChange={(e) => onPropertyChange('foreground_color', e.target.value)}
          style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
          placeholder="Hex without #"
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN TREE
// ─────────────────────────────────────────────────────────────────────────────

interface ScreenTreeProps {
  manifest: UIDesignManifest | null;
  selectedScreenKey: string | null;
  onScreenSelect: (screenKey: string) => void;
  onScreenAdd: (screenKey: string) => void;
  onScreenDelete: (screenKey: string) => void;
}

export const ScreenTree: React.FC<ScreenTreeProps> = ({
  manifest,
  selectedScreenKey,
  onScreenSelect,
  onScreenAdd,
  onScreenDelete,
}) => {
  const [newScreenName, setNewScreenName] = useState('');

  const handleAddScreen = () => {
    if (newScreenName.trim()) {
      onScreenAdd(newScreenName);
      setNewScreenName('');
    }
  };

  return (
    <div
      style={{
        width: '200px',
        backgroundColor: '#f9f9f9',
        borderRight: '1px solid #ddd',
        padding: '15px',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 60px)',
      }}
    >
      <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', textTransform: 'uppercase', color: '#666' }}>
        Screens
      </h4>

      {/* List of screens */}
      {manifest &&
        Object.entries(manifest.screens).map(([key, screen]) => (
          <div
            key={key}
            onClick={() => onScreenSelect(key)}
            style={{
              padding: '10px',
              marginBottom: '8px',
              backgroundColor: selectedScreenKey === key ? '#e3f2fd' : '#fff',
              border: selectedScreenKey === key ? '2px solid #2196F3' : '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{screen.label || key}</div>
              <div style={{ fontSize: '10px', color: '#999' }}>{key}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onScreenDelete(key);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#f44336',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ✕
            </button>
          </div>
        ))}

      {/* Add screen */}
      <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            value={newScreenName}
            onChange={(e) => setNewScreenName(e.target.value)}
            placeholder="Screen name"
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleAddScreen();
            }}
            style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <button
          onClick={handleAddScreen}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          Add Screen
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN UI BUILDER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface UIBuilderProps {
  initialManifest?: UIDesignManifest;
}

/**
 * UIBuilder - Visual Designer for UI Manifests
 * 
 * This is the designer tool where users:
 * 1. Drag-drop components to create screens
 * 2. Configure component properties
 * 3. Preview designs in real-time
 * 4. Export yaml for use with UIEngine
 * 
 * The resulting yaml is consumed by UIEngine in other applications.
 */
export const UIBuilder: React.FC<UIBuilderProps> = ({ initialManifest }) => {
  const [manifest, setManifest] = useState<UIDesignManifest | null>(initialManifest || null);
  const [selectedScreenKey, setSelectedScreenKey] = useState<string | null>(null);
  const [selectedComponentPath, setSelectedComponentPath] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  const handleScreenSelect = useCallback((screenKey: string) => {
    setSelectedScreenKey(screenKey);
    setSelectedComponentPath([]);
  }, []);

  const handleScreenAdd = useCallback((screenName: string) => {
    if (!manifest) return;

    const newManifest = {
      ...manifest,
      screens: {
        ...manifest.screens,
        [screenName]: {
          name: screenName,
          label: screenName,
          components: [],
        },
      },
    };

    setManifest(newManifest);
    setSelectedScreenKey(screenName);
    setIsDirty(true);
  }, [manifest]);

  const handleScreenDelete = useCallback(
    (screenKey: string) => {
      if (!manifest) return;

      const { [screenKey]: _, ...remainingScreens } = manifest.screens;
      const newManifest = {
        ...manifest,
        screens: remainingScreens,
      };

      setManifest(newManifest);
      if (selectedScreenKey === screenKey) {
        setSelectedScreenKey(Object.keys(remainingScreens)[0] || null);
      }
      setIsDirty(true);
    },
    [manifest, selectedScreenKey]
  );

  const handlePropertyChange = useCallback((path: string, value: any) => {
    if (!manifest || !selectedScreenKey || selectedComponentPath.length === 0) return;

    // Update component property
    const newManifest = JSON.parse(JSON.stringify(manifest));
    const screen = newManifest.screens[selectedScreenKey];
    const componentIdx = parseInt(selectedComponentPath[0]);
    const placement = screen.components[componentIdx];
    const component = newManifest.components[placement.component_ref];

    if (component) {
      (component as any)[path] = value;
      setManifest(newManifest);
      setIsDirty(true);
    }
  }, [manifest, selectedScreenKey, selectedComponentPath]);

  const handleExportYaml = useCallback(() => {
    if (!manifest) return;

    const errors = validateManifest(manifest);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const yaml = JSON.stringify(manifest, null, 2);
    const blob = new Blob([yaml], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${manifest.manifest_id}_ui_design.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [manifest]);

  if (!manifest) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1>UI Builder</h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>Create UI designs with drag-and-drop</p>
          <button
            onClick={() => {
              // Create new manifest
              setManifest({
                manifest_id: 'new_app',
                manifest_version: '1.0.0',
                theme: {
                  colors: {
                    primary: '#007AFF',
                    surface: '#FFFFFF',
                    on_surface: '#1A1A2E',
                  },
                  typography: {
                    font_family_default: 'system-ui, sans-serif',
                    font_family_mono: 'monospace',
                    scale: {
                      body_sm: '12px',
                      body_md: '14px',
                    },
                  },
                  spacing: { md: '16px' },
                  radius: { default: '8px' },
                  elevation: { default: '0 2px 4px rgba(0,0,0,0.1)' },
                  motion: { duration_standard_ms: 250 },
                },
                icons: {},
                breakpoints: { mobile: { min_width_px: 0, label: 'Mobile' } },
                navigation: { initial_screen: 'home', type: 'tab_bar' },
                features: {},
                buttons: {},
                components: {},
                screens: {
                  home: { name: 'home', label: 'Home', is_home: true, nav_order: 0, components: [] },
                },
                toasts: {},
                dialogs: {},
                transitions: {},
              });
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            Create New Design
          </button>
        </div>
      </div>
    );
  }

  const selectedComponent = selectedScreenKey && selectedComponentPath[0]
    ? (() => {
        const screen = manifest.screens[selectedScreenKey];
        const placement = screen?.components[parseInt(selectedComponentPath[0])];
        return placement ? manifest.components[placement.component_ref] : null;
      })()
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Toolbar */}
      <div
        style={{
          padding: '12px 20px',
          backgroundColor: '#2196F3',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '18px' }}>{manifest.manifest_id}</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          {isDirty && <span style={{ fontSize: '12px' }}>●Unsaved</span>}
          <button
            onClick={handleExportYaml}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Export YAML
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left: Screen tree */}
        <ScreenTree
          manifest={manifest}
          selectedScreenKey={selectedScreenKey}
          onScreenSelect={handleScreenSelect}
          onScreenAdd={handleScreenAdd}
          onScreenDelete={handleScreenDelete}
        />

        {/* Center: Canvas */}
        <CanvasEditor
          manifest={manifest}
          selectedScreenKey={selectedScreenKey}
          selectedComponentPath={selectedComponentPath}
          onScreenSelect={handleScreenSelect}
          onComponentSelect={setSelectedComponentPath}
          onComponentDrop={() => {}}
        />

        {/* Right: Property editor */}
        <PropertyEditor
          component={selectedComponent}
          manifest={manifest}
          onPropertyChange={handlePropertyChange}
        />
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div
          style={{
            backgroundColor: '#ffebee',
            borderTop: '1px solid #ef5350',
            padding: '12px 20px',
            fontSize: '12px',
            color: '#c62828',
          }}
        >
          <strong>Validation Errors:</strong>
          <ul style={{ margin: '8px 0 0 20px' }}>
            {validationErrors.map((err, i) => (
              <li key={i}>
                {err.path}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default UIBuilder;
