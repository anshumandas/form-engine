/**
 * UIEngine Test Viewer - Example of using UIEngine
 * 
 * This component demonstrates how applications use UIEngine to render manifests.
 * This is NOT the UIBuilder designer tool.
 * 
 * For the designer tool, see: frontend/src/apps/UIBuilder/
 */

import React, { useState } from 'react';
import {
  UIEngineProvider,
  useUIEngine,
  type UIDesignManifest,
  type UIEngineHandlers,
} from '../../lib/src/components/UIEngine';
import { ScreenLayout } from '../../lib/src/components/UIEngine/layout';

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE MANIFEST
// ─────────────────────────────────────────────────────────────────────────────

const sampleManifest: UIDesignManifest = {
  manifest_id: 'example_app',
  manifest_version: '1.0.0',
  description: 'Example application manifest',
  namespaces: ['core', 'schemata', 'uam', 'form', 'ui'],

  theme: {
    colors: {
      primary: '#007AFF',
      primary_light: '#5B9EF4',
      surface: '#FFFFFF',
      on_surface: '#1A1A2E',
      error: '#BA1A1A',
      warning: '#FF8C00',
      success: '#1B8A5A',
      outline: '#E0E0E0',
    },
    typography: {
      font_family_default: 'system-ui, -apple-system, sans-serif',
      font_family_mono: 'Menlo, Monaco, monospace',
      scale: {
        body_sm: '12px',
        body_md: '14px',
        body_lg: '16px',
        headline_sm: '16px',
        headline_md: '18px',
        headline_lg: '24px',
      },
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
    radius: {
      small: '4px',
      default: '8px',
      large: '16px',
    },
    elevation: {
      default: '0 2px 4px rgba(0,0,0,0.1)',
      raised: '0 4px 8px rgba(0,0,0,0.12)',
      floating: '0 8px 16px rgba(0,0,0,0.15)',
    },
    motion: {
      duration_fast_ms: 100,
      duration_standard_ms: 250,
      duration_slow_ms: 400,
      easing_standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },

  icons: {
    home: { type: 'lucide', name: 'home', alt: 'Home' },
    settings: { type: 'lucide', name: 'settings', alt: 'Settings' },
    user: { type: 'lucide', name: 'user', alt: 'User Profile' },
  },

  breakpoints: {
    mobile: { min_width_px: 0, max_width_px: 640, label: 'Mobile', columns: 4 },
    tablet: { min_width_px: 640, max_width_px: 1024, label: 'Tablet', columns: 8 },
    desktop: { min_width_px: 1024, label: 'Desktop', columns: 12 },
  },

  navigation: {
    initial_screen: 'home',
    type: 'tab_bar',
    tab_bar_position: 'bottom',
  },

  features: {
    premium_features: {
      name: 'premium_features',
      label: 'Premium Features',
      components: ['premium_card'],
    },
  },

  buttons: {
    primary_action: {
      name: 'primary_action',
      label: 'Continue',
      button_type: 'Flat',
      on_press: 'Submit',
      foreground_color: 'FFFFFF',
      background_color: '007AFF',
    },
    secondary_action: {
      name: 'secondary_action',
      label: 'Cancel',
      button_type: 'Flat',
      on_press: 'Cancel',
      foreground_color: '007AFF',
      background_color: 'FFFFFF',
    },
  },

  components: {
    header: {
      name: 'header',
      type: 'Card',
      label: 'App Header',
      text: 'Example App',
      text_size: 'headline_lg',
      background_color: '007AFF',
      foreground_color: 'FFFFFF',
    },
    welcome_card: {
      name: 'welcome_card',
      type: 'Card',
      label: 'Welcome',
      text: 'This is a UIEngine example showing how applications use the manifest-driven UI system.',
    },
    content_list: {
      name: 'content_list',
      type: 'VerticalList',
      label: 'Items',
    },
    premium_card: {
      name: 'premium_card',
      type: 'Card',
      label: 'Premium Features',
      text: 'This card only appears when premium_features is enabled',
      feature_ref: 'premium_features',
    },
  },

  screens: {
    home: {
      name: 'home',
      label: 'Home',
      is_home: true,
      nav_order: 0,
      background_color: 'FFFFFF',
      components: [
        { component_ref: 'header', direction: 'Top' },
        { component_ref: 'welcome_card', direction: 'Center' },
        { component_ref: 'content_list', direction: 'Center' },
        { component_ref: 'premium_card', direction: 'Center' },
      ],
    },
  },

  toasts: {},
  dialogs: {},
  transitions: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

const customHandlers: UIEngineHandlers = {
  onSubmit: async (context) => {
    console.log('Form submitted:', context);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VIEWER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const ViewerContent: React.FC = () => {
  const { manifest, state } = useUIEngine();
  const screen = manifest.screens[state.currentScreenKey];

  if (!screen) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Screen not found
      </div>
    );
  }

  return (
    <ScreenLayout componentPlacements={screen.components} />
  );
};

/**
 * Example of using UIEngine
 * Shows how an application would use the UIEngine library to render a manifest
 */
export function UIEngineExample() {
  return (
    <UIEngineProvider manifest={sampleManifest} handlers={customHandlers}>
      <ViewerContent />
    </UIEngineProvider>
  );
}

export default UIEngineExample;
