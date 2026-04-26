/**
 * auth_ui_manifest.ts
 *
 * The landing page and auth page expressed as a UISystemManifest
 * conforming to ui_system.schema.yaml — rendered at runtime by
 * UIManifestRenderer, which resolves Form components via @form-engine.
 *
 * This file is the "use-case example" demonstrating that screens,
 * navigation, themes, and embedded forms all live in a single YAML
 * (represented here as a TypeScript literal for type safety).
 */

import type { UISystemManifest } from "@/components/UIBuilder/VisualUIBuilder";

export const authUIManifest: UISystemManifest = {
  manifest_id: "auth_ui",
  manifest_version: "1.0.0",
  description:
    "Landing page + authentication screens. " +
    "Demonstrates the UISystemManifest format: screens compose components, " +
    "Form components embed form-engine manifests, themes control brand tokens.",

  namespaces: ["core", "schemata", "uam", "form", "ui"],

  // ── Active theme ──────────────────────────────────────────────────────────
  active_theme: "auth_dark",

  // ── Form engine config ─────────────────────────────────────────────────────
  engine: {
    mode: "reactive",
    error_mode: "collect-all",
    debounce_ms: 300,
  },

  // ── Embedded form definitions (from @form-engine) ─────────────────────────
  forms: {
    signin: {
      title: "Sign in",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Sign in",
      sections: [
        {
          id: "credentials",
          fields: [
            {
              id: "email",
              type: "text",
              label: "Email address",
              required: true,
              placeholder: "you@company.com",
              autocomplete: "email",
            },
            {
              id: "password",
              type: "text",
              label: "Password",
              required: true,
              placeholder: "········",
              min_length: 6,
              autocomplete: "current-password",
            },
          ],
        },
      ],
      on_submit: { type: "local", handler_name: "handleSignin" },
    },

    signup: {
      title: "Create account",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Create account",
      sections: [
        {
          id: "identity",
          fields: [
            {
              id: "full_name",
              type: "text",
              label: "Full name",
              required: true,
              placeholder: "Jane Smith",
              autocomplete: "name",
            },
            {
              id: "email",
              type: "text",
              label: "Email address",
              required: true,
              placeholder: "you@company.com",
              autocomplete: "email",
            },
            {
              id: "password",
              type: "text",
              label: "Password",
              required: true,
              placeholder: "········",
              min_length: 8,
              hint: "At least 8 characters",
              autocomplete: "new-password",
            },
            {
              id: "confirm_password",
              type: "text",
              label: "Confirm password",
              required: true,
              placeholder: "········",
              autocomplete: "new-password",
            },
          ],
        },
      ],
      on_submit: { type: "local", handler_name: "handleSignup" },
    },
  },

  // ── Icons ──────────────────────────────────────────────────────────────────
  icons: {
    logo:         { type: "custom", name: "BrandIcon",  alt: "Form Engine logo" },
    check:        { type: "lucide", name: "Check",           alt: "Checkmark" },
    zap:          { type: "lucide", name: "Zap",             alt: "Lightning bolt" },
    plug:         { type: "lucide", name: "Plug",            alt: "Plug" },
    layers:       { type: "lucide", name: "Layers",          alt: "Layers" },
    wand:         { type: "lucide", name: "Wand2",           alt: "Magic wand" },
  },

  // ── Toasts ─────────────────────────────────────────────────────────────────
  toasts: {
    signin_success: {
      message: "Signed in — welcome back!",
      severity: "success",
      duration_ms: 3000,
      position: "top_right",
    },
    signup_success: {
      message: "Account created — welcome aboard!",
      severity: "success",
      duration_ms: 3000,
      position: "top_right",
    },
    auth_error: {
      message: "Authentication failed. Please try again.",
      severity: "error",
      duration_ms: 4000,
      position: "top_right",
    },
  },

  // ── Buttons ────────────────────────────────────────────────────────────────
  buttons: {
    goto_signup:  { name: "goto_signup",  label: "Sign up free",      on_press: "navigate:auth?mode=signup" },
    goto_signin:  { name: "goto_signin",  label: "Sign in",           on_press: "navigate:auth?mode=signin" },
    goto_home:    { name: "goto_home",    label: "Go to dashboard",   on_press: "navigate:home" },
    start_trial:  { name: "start_trial",  label: "Get started free →", on_press: "navigate:auth?mode=signup" },
    view_docs:    { name: "view_docs",    label: "Read the docs",      on_press: "navigate:docs" },
  },

  // ── Components ─────────────────────────────────────────────────────────────
  components: {
    // Hero section (left column of auth page)
    hero_column: {
      name: "hero_column",
      label: "Hero Column",
      type: "Card",
      text: "Forms that live in your config.",
    },

    // Feature grid shown under hero text
    feature_grid: {
      name: "feature_grid",
      label: "Feature Highlights",
      type: "VerticalList",
      schema_ref: "FeatureItem",
    },

    // Accent stripe at top of auth card
    auth_card_stripe: {
      name: "auth_card_stripe",
      label: "Auth Card Accent",
      type: "Custom",
      text: "gradient-stripe",
    },

    // Sign-in form component (embeds the signin form from forms above)
    signin_form: {
      name: "signin_form",
      label: "Sign In Form",
      type: "Form",
      form_ref: "signin",
      form_embed: { mode: "inline" },
    },

    // Sign-up form component
    signup_form: {
      name: "signup_form",
      label: "Sign Up Form",
      type: "Form",
      form_ref: "signup",
      form_embed: { mode: "inline" },
    },

    // Auth card wrapper (conditionally shows signin or signup)
    auth_card: {
      name: "auth_card",
      label: "Auth Card",
      type: "Card",
      sub_components: [
        { component_ref: "auth_card_stripe", direction: "Top" },
        { component_ref: "signin_form",      direction: "Center" },
      ],
    },

    // Landing page standalone CTA card
    cta_card: {
      name: "cta_card",
      label: "CTA Card",
      type: "Card",
      text: "Start building in minutes",
      actions: [
        { name: "cta_signup", label: "Get started free →", on_press: "navigate:auth?mode=signup" },
        { name: "cta_docs",   label: "Read the docs",      on_press: "navigate:docs" },
      ],
    },

    // Top navigation bar
    top_nav: {
      name: "top_nav",
      label: "Top Navigation",
      type: "HorizontalList",
      actions: [
        { name: "nav_signin", label: "Sign in",        on_press: "navigate:auth?mode=signin" },
        { name: "nav_signup", label: "Get started →",  on_press: "navigate:auth?mode=signup" },
      ],
    },
  },

  // ── Screens ────────────────────────────────────────────────────────────────
  screens: {
    // Landing / marketing page
    landing: {
      name: "landing",
      label: "Landing Page",
      is_home: true,
      nav_order: 0,
      theme_ref: "auth_dark",
      auth_rules: { require_auth: false },
      components: [
        { component_ref: "top_nav",     direction: "Top"    },
        { component_ref: "hero_column", direction: "Left"   },
        { component_ref: "feature_grid", direction: "Center" },
        { component_ref: "cta_card",    direction: "Bottom" },
      ],
    },

    // Auth screen (sign-in / sign-up toggled at runtime)
    auth: {
      name: "auth",
      label: "Authentication",
      nav_order: 1,
      theme_ref: "auth_dark",
      auth_rules: { require_auth: false, redirect_on_denied: "landing" },
      components: [
        { component_ref: "hero_column", direction: "Left"   },
        { component_ref: "auth_card",   direction: "Right"  },
      ],
    },

    // Post-auth home dashboard (placeholder)
    home: {
      name: "home",
      label: "Dashboard",
      nav_order: 2,
      auth_rules: { require_auth: true, redirect_on_denied: "auth" },
      components: [
        { component_ref: "top_nav", direction: "Top"    },
        { component_ref: "cta_card", direction: "Center" },
      ],
    },
  },

  // ── Navigation ─────────────────────────────────────────────────────────────
  navigation: {
    type: "stack",
    initial_screen: "landing",
    routes: {
      landing: { screen: "landing", path: "/",       auth_required: false },
      auth:    { screen: "auth",    path: "/auth",   auth_required: false },
      home:    { screen: "home",    path: "/home",   auth_required: true  },
    },
    guards: ["authGuard"],
  },

  // ── Themes ─────────────────────────────────────────────────────────────────
  themes: {
    auth_dark: {
      label: "Auth Dark",
      extends: "default",
      preview_color: "07070e",
      selectable: false,
      colors: {
        primary:       "#6366f1",
        primary_light: "#818cf8",
        primary_dark:  "#4f46e5",
        surface:       "#ffffff",
        on_surface:    "#111827",
        outline:       "#e5e7eb",
        error:         "#b91c1c",
        success:       "#1b8a5a",
        warning:       "#d97706",
      },
      dark_mode: {
        surface:    "#07070e",
        on_surface: "#f9fafb",
        outline:    "#1f2937",
      },
    },
  },
};

/**
 * YAML equivalent (generated from the manifest above).
 * Paste this into the UI Builder's "Paste YAML" panel to load the manifest
 * visually, or upload it as a file.
 *
 * manifest_id: auth_ui
 * manifest_version: "1.0.0"
 * description: Landing page + authentication screens.
 * active_theme: auth_dark
 * engine:
 *   mode: reactive
 *   error_mode: collect-all
 * forms:
 *   signin:
 *     title: Sign in
 *     version: "1.0.0"
 *     layout: { type: single-page }
 *     ...
 * screens:
 *   landing:
 *     name: landing
 *     is_home: true
 *     ...
 *   auth:
 *     name: auth
 *     ...
 * navigation:
 *   type: stack
 *   initial_screen: landing
 *   routes:
 *     landing: { screen: landing, path: "/" }
 *     auth:    { screen: auth,    path: /auth }
 *     home:    { screen: home,    path: /home, auth_required: true }
 * themes:
 *   auth_dark:
 *     label: Auth Dark
 *     extends: default
 *     colors:
 *       primary: "#6366f1"
 *       ...
 */
