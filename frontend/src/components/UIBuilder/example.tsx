/**
 * Example: UIBuilder & UIEngine Integration
 * Demonstrates how to use the UIBuilder component with a sample manifest
 */

import React, { useState } from 'react';
import { ButtonType, ComponentType, IconType, LayoutDirection, ScreenAccessType, UIBuilder, useUIEngine, type UIDesignManifest, type UIEngineHandlers } from '@form-engine/components/UIEngine';

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE MANIFEST
// ─────────────────────────────────────────────────────────────────────────────

const sampleManifest: UIDesignManifest = {
  manifest_id: 'example_app',
  manifest_version: '1.0.0',
  description: 'Example application manifest',
  namespaces: ['core', 'schemata', 'uam', 'form', 'ui'],

  // Design tokens and theme
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

  // Icon registry
  icons: {
    home: {
      type: IconType.Lucide,
      name: 'home',
      alt: 'Home',
    },
    settings: {
      type: IconType.Lucide,
      name: 'settings',
      alt: 'Settings',
    },
    user: {
      type: IconType.Lucide,
      name: 'home',
      alt: 'Home',
    },
  },

  // Responsive breakpoints
  breakpoints: {
    mobile: {
      min_width_px: 0,
      max_width_px: 640,
      label: 'Mobile',
      columns: 4,
    },
    tablet: {
      min_width_px: 640,
      max_width_px: 1024,
      label: 'Tablet',
      columns: 8,
    },
    desktop: {
      min_width_px: 1024,
      label: 'Desktop',
      columns: 12,
    },
  },

  // Navigation configuration
  navigation: {
    initial_screen: 'home',
    type: 'tab_bar',
    tab_bar_position: 'bottom',
  },

  // Feature flags
  features: {
    premium_features: {
      name: 'premium_features',
      label: 'Premium Features',
      components: ['premium_card', 'advanced_search'],
    },
    beta_features: {
      name: 'beta_features',
      label: 'Beta Features',
      components: ['experimental_list'],
    },
  },

  // Reusable buttons
  buttons: {
    primary_action: {
      name: 'primary_action',
      label: 'Continue',
      button_type: ButtonType.Flat,
      on_press: 'Submit',
      foreground_color: 'FFFFFF',
      background_color: '007AFF',
      accessibility: {
        label: 'Continue to next step',
        role: 'button',
      },
    },
    secondary_action: {
      name: 'secondary_action',
      label: 'Cancel',
      button_type: ButtonType.Flat,
      on_press: 'Cancel',
      foreground_color: '007AFF',
      background_color: 'FFFFFF',
      accessibility: {
        label: 'Cancel operation',
        role: 'button',
      },
    },
  },

  // Reusable components
  components: {
    header: {
      name: 'header',
      label: 'App Header',
      type: ComponentType.Card,
      text: 'Example App',
      text_size: 'headline_lg',
      background_color: '007AFF',
      foreground_color: 'FFFFFF',
      accessibility: {
        role: 'heading',
        label: 'Application header',
      },
    },
    welcome_card: {
      name: 'welcome_card',
      label: 'Welcome',
      type: ComponentType.Card,
      text: 'Welcome to the Example App. This demonstrates the UIBuilder component with various UI patterns.',
      text_size: 'body_md',
      sub_components: [
        {
          component_ref: 'action_buttons',
          direction: LayoutDirection.Bottom,
        
        },
      ],
    },
    action_buttons: {
      name: 'action_buttons',
      type: ComponentType.Card,
      actions: [
        {
          button_ref: 'primary_action',
        },
        {
          button_ref: 'secondary_action',
        },
      ],
    },
    content_list: {
      name: 'content_list',
      label: 'Items',
      type: ComponentType.VerticalList,
      data_binding: {
        source_ref: 'items_source',
        pagination: {
          type: 'page_number',
          page_size: 20,
        },
      },
      loading_state: {
        style: 'skeleton',
        skeleton_rows: 5,
      },
      empty_state: {
        text: 'No items found',
        action_ref: 'primary_action',
      },
    },
    premium_card: {
      name: 'premium_card',
      label: 'Premium Features',
      type: ComponentType.Card,
      text: 'This card is only visible when premium_features flag is enabled',
      feature_ref: 'premium_features',
    },
    contact_form: {
      name: 'contact_form',
      label: 'Contact Form',
      type: ComponentType.Form,
      form_ref: 'contact_form_manifest',
      data_binding: {
        write_action_ref: 'submit_contact_form',
        optimistic_updates: false,
      },
      fields: ['name', 'email', 'message'],
      loading_state: {
        style: 'spinner',
      },
      lifecycle: {
        on_mount: 'init_contact_form',
        on_data_load: 'on_form_loaded',
        on_data_error: 'on_form_error',
      },
      accessibility: {
        label: 'Contact form',
        role:  undefined,
      },
    },
    feedback_form: {
      name: 'feedback_form',
      label: 'User Feedback',
      type: ComponentType.Form,
      schema_ref: 'feedback_schema',
      text: 'Please share your feedback with us',
      actions: [
        {
          name: 'submit_feedback',
          label: 'Submit Feedback',
          on_press: 'Submit',
          foreground_color: 'FFFFFF',
          background_color: '1B8A5A',
        },
      ],
      data_binding: {
        write_action_ref: 'save_feedback',
      },
    },
    settings_form: {
      name: 'settings_form',
      label: 'Settings',
      type: ComponentType.Form,
      form_ref: 'settings_form',
      data_binding: {
        write_action_ref: 'save_settings',
      },
    },
  },

  // Screen definitions
  screens: {
    home: {
      name: 'home',
      label: 'Home',
      is_home: true,
      nav_order: 0,
      background_color: 'FFFFFF',
      components: [
        {
          component_ref: 'header',
          direction: LayoutDirection.Top,
        
        },
        {
          component_ref: 'welcome_card',
          direction: LayoutDirection.Center,
        },
        {
          component_ref: 'content_list',
          direction: LayoutDirection.Center,
        },
        {
          component_ref: 'premium_card',
          direction: LayoutDirection.Center,
        },
      ],
    },
    profile: {
      name: 'profile',
      label: 'Profile',
      is_home: true,
      nav_order: 1,
      icon_ref: 'user',
      background_color: 'FFFFFF',
      components: [
        {
          component_ref: 'header',
          direction: LayoutDirection.Top,
        },
        {
          component_ref: 'settings_form',
          direction: LayoutDirection.Center,
        },
      ],
    },
    contact: {
      name: 'contact',
      label: 'Contact',
      is_home: true,
      nav_order: 2,
      background_color: 'FFFFFF',
      components: [
        {
          component_ref: 'header',
          direction: LayoutDirection.Top,
        },
        {
          component_ref: 'contact_form',
          direction: LayoutDirection.Center,
        },
      ],
    },
    feedback: {
      name: 'feedback',
      label: 'Feedback',
      background_color: 'FFFFFF',
      components: [
        {
          component_ref: 'header',
          direction: LayoutDirection.Top,
        },
        {
          component_ref: 'feedback_form',
          direction: LayoutDirection.Center,
        },
      ],
      secondary_screens: [
        {
          screen_ref: 'contact',
          access_type: ScreenAccessType.Stacked,
          menu_label: 'Contact Support',
        },
      ],
    },
  },

  // Toasts for notifications
  toasts: {
    success_message: {
      message: 'Operation completed successfully',
      severity: 'success',
      duration_ms: 3000,
      position: 'bottom',
    },
    error_message: {
      message: 'An error occurred. Please try again.',
      severity: 'error',
      duration_ms: 5000,
      position: 'bottom',
    },
  },

  // Dialogs for modals
  dialogs: {
    confirm_action: {
      title: 'Confirm Action',
      body: 'Are you sure you want to proceed?',
      severity: 'warning',
      dismissible: true,
      primary_action: {
        name: 'confirm',
        label: 'Confirm',
        on_press: 'Custom',
      },
      secondary_action: {
        name: 'cancel',
        label: 'Cancel',
        on_press: 'Cancel',
      },
    },
  },

  // Transitions/animations
  transitions: {
    fade_in: {
      type: 'fade',
      duration_ms: 300,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
    slide_up: {
      type: 'slide_up',
      duration_ms: 400,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

const customHandlers: UIEngineHandlers = {
  onSubmit: async (context: any) => {
    console.log('Submit handler called', context);
    // Handle form submission
  },

  onCancel: async (context: any) => {
    console.log('Cancel handler called', context);
    // Handle cancellation
  },

  save_settings: async (context: any) => {
    console.log('Saving settings', context);
    // Save settings to backend
  },

  submit_contact_form: async (context: any) => {
    console.log('Submitting contact form', context);
    // POST to /api/contact with context.formData
  },

  save_feedback: async (context: any) => {
    console.log('Saving feedback', context);
    // POST to /api/feedback with context.formData
  },

  init_contact_form: async (context: any) => {
    console.log('Initializing contact form', context);
    // Load any initial data, set defaults
  },

  on_form_loaded: async (context: any) => {
    console.log('Contact form loaded', context);
    // Form data loaded successfully
  },

  on_form_error: async (context: any) => {
    console.log('Contact form error', context);
    // Handle form loading error
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ExampleUIBuilderApp() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <div>
      {/* Optional: Dark mode toggle */}
      <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000 }}>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          style={{
            padding: '8px 16px',
            backgroundColor: isDarkMode ? '#333' : '#eee',
            color: isDarkMode ? '#fff' : '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {isDarkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      {/* Main UIBuilder component */}
      <UIBuilder
        manifest={sampleManifest}
        handlers={customHandlers}
        showNavigation={true}
        navigationMode="tab_bar"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALTERNATIVE: USE CASE EXAMPLES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Example 1: Custom Navigation Mode
 * Show drawer instead of tab bar
 */
export function DrawerNavigationExample() {
  const manifest = {
    ...sampleManifest,
    navigation: {
      ...sampleManifest.navigation,
      type: 'drawer',
    },
  };

  return <UIBuilder manifest={manifest} handlers={customHandlers} />;
}

/**
 * Example 2: Hidden Navigation
 * Stack-based navigation without visible chrome
 */
export function StackNavigationExample() {
  const manifest = {
    ...sampleManifest,
    navigation: {
      ...sampleManifest.navigation,
      type: 'stack',
    },
  };

  return <UIBuilder manifest={manifest} handlers={customHandlers} showNavigation={false} />;
}

/**
 * Example 3: Feature-Gated Content
 * Only premium users see premium features
 */
export function FeatureGatedExample() {
  const { dispatch } = useUIEngine?.();

  React.useEffect(() => {
    // Simulate checking user subscription
    const isPremium = true; // Check from backend

    if (isPremium) {
      dispatch?.({ type: 'SET_ENABLED_FEATURES', payload: ['premium_features', 'beta_features'] });
    }
  }, []);

  return <UIBuilder manifest={sampleManifest} handlers={customHandlers} />;
}

export default ExampleUIBuilderApp;
