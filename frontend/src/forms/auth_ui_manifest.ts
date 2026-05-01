/**
 * auth_ui_manifest.ts
 *
 * The complete landing + auth page expressed as a UISystemManifest.
 *
 * ── How the page is rendered ────────────────────────────────────────────────
 * UIManifestRenderer renders the `auth` screen end-to-end.
 * page.tsx provides:
 *   handlers         — submit functions + on_press callbacks
 *   customComponents — React implementations keyed by component.name
 *   context          — { mode: "signin" | "signup" } for hidden_condition eval
 *
 * ── Custom component nesting ─────────────────────────────────────────────────
 * `auth_card` is type: Custom with sub_components. The patched ComponentRenderer
 * walks sub_components, filters each placement by hidden_condition (evaluated
 * against context.mode via new Function()), resolves the child component from
 * manifest.components, and renders it recursively via ComponentRenderer.
 * The resulting React nodes are passed as `children` to AuthCardWrapper.
 *
 * hidden_condition strings use the `context` variable which maps to engineContext.
 *
 * ── Component map ────────────────────────────────────────────────────────────
 *  Floating  background_grid   SVG grid overlay             (Custom)
 *  Floating  orbs              Animated gradient blobs      (Custom)
 *  Left      hero_column       Brand + headline + bullets   (Custom)
 *  Right     auth_card         Card shell                   (Custom, has sub_components)
 *              ├─ Top     auth_card_header   Logo + heading            (Custom)
 *              ├─ Top     auth_mode_tabs     Sign in / Sign up toggle  (Custom)
 *              ├─ Center  signin_form        FormEngine form           (Form — hidden when mode≠signin)
 *              ├─ Center  signup_form        FormEngine form           (Form — hidden when mode≠signup)
 *              └─ Bottom  auth_card_footer   Toggle link + badge       (Custom)
 */

import {
  ComponentType,
  IconType,
  LayoutDirection,
  type UISystemManifest,
} from "@form-engine/components/UIEngine/types";

export const authUIManifest: UISystemManifest = {
  manifest_id: "auth_ui",
  manifest_version: "1.0.0",
  description: "Landing + auth page. Every visual section is a manifest component.",

  namespaces: ["form", "ui"],

  active_theme: "auth_dark",

  engine: {
    mode: "reactive",
    error_mode: "collect-all",
    debounce_ms: 300,
  },

  // ── Forms ─────────────────────────────────────────────────────────────────
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
            { id: "email",    type: "text", label: "Email address", required: true, placeholder: "you@company.com", autocomplete: "email",            width: "full" },
            { id: "password", type: "text", label: "Password",      required: true, placeholder: "········",        autocomplete: "current-password", width: "full", min_length: 6, confidentiality: "Secret" },
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
            { id: "full_name",        type: "text", label: "Full name",        required: true, placeholder: "Jane Smith",      autocomplete: "name",         width: "full" },
            { id: "email",            type: "text", label: "Email address",    required: true, placeholder: "you@company.com", autocomplete: "email",        width: "full" },
            { id: "password",         type: "text", label: "Password",         required: true, placeholder: "········",        autocomplete: "new-password", width: "full", min_length: 8, hint: "At least 8 characters", confidentiality: "Secret" },
            { id: "confirm_password", type: "text", label: "Confirm password", required: true, placeholder: "········",        autocomplete: "new-password", width: "full", confidentiality: "Secret" },
          ],
        },
      ],
      on_submit: { type: "local", handler_name: "handleSignup" },
    },
  },

  // ── Icons ─────────────────────────────────────────────────────────────────
  icons: {
    logo: { type: IconType.Custom, name: "BrandIcon", alt: "Form Engine logo" },
    zap:  { type: IconType.Lucide, name: "Zap",       alt: "Lightning bolt"   },
  },

  // ── Toasts ────────────────────────────────────────────────────────────────
  toasts: {
    signin_success: { message: "Signed in — welcome back!",         severity: "success", duration_ms: 3000, position: "top_right" },
    signup_success: { message: "Account created — welcome aboard!", severity: "success", duration_ms: 3000, position: "top_right" },
    auth_error:     { message: "Authentication failed. Try again.", severity: "error",   duration_ms: 4000, position: "top_right" },
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  buttons: {
    goto_signup: { name: "goto_signup", label: "Sign up free",       on_press: "navigate:auth?mode=signup" },
    goto_signin: { name: "goto_signin", label: "Sign in",            on_press: "navigate:auth?mode=signin" },
    goto_home:   { name: "goto_home",   label: "Go to dashboard",    on_press: "navigate:home"             },
    view_docs:   { name: "view_docs",   label: "Read the docs",      on_press: "navigate:docs"             },
  },

  // ── Components ────────────────────────────────────────────────────────────
  components: {

    // ── Decorative overlays — screen placement: Floating ───────────────────

    background_grid: {
      name: "background_grid",
      label: "Background Grid",
      type: ComponentType.Custom,
      // Registered React impl → BackgroundGrid (page.tsx)
    },

    orbs: {
      name: "orbs",
      label: "Gradient Orbs",
      type: ComponentType.Custom,
      // Registered React impl → Orbs (page.tsx)
    },

    // ── Left column — screen placement: Left ──────────────────────────────

    hero_column: {
      name: "hero_column",
      label: "Hero Column",
      type: ComponentType.Custom,
      // Registered React impl → HeroColumn (page.tsx)
    },

    // ── Auth card sub-components ──────────────────────────────────────────
    //
    // Declared as top-level manifest components so CustomRenderer can resolve
    // them by name when walking auth_card.sub_components.

    auth_card_header: {
      name: "auth_card_header",
      label: "Auth Card Header",
      type: ComponentType.Custom,
      // Registered React impl → AuthCardHeader
      // Reads context.mode to switch heading text (Welcome back / Get started free)
    },

    auth_mode_tabs: {
      name: "auth_mode_tabs",
      label: "Auth Mode Tabs",
      type: ComponentType.Custom,
      // Registered React impl → AuthModeTabs
      // Reads context.mode for active tab; fires handlers["navigate:auth?mode=…"]
    },

    // Form components — visible / hidden via hidden_condition on their
    // SubComponentPlacement inside auth_card.sub_components.
    signin_form: {
      background_color: "#f9fafb",
      foreground_color: "#818cf8",
      name: "signin_form",
      label: "Sign In Form",
      type: ComponentType.Form,
      form_ref: "signin",
      form_embed: { mode: "inline" },
    },

    signup_form: {
      name: "signup_form",
      foreground_color: "#818cf8",
      label: "Sign Up Form",
      type: ComponentType.Form,
      form_ref: "signup",
      form_embed: { mode: "inline" },
    },

    auth_card_footer: {
      name: "auth_card_footer",
      label: "Auth Card Footer",
      type: ComponentType.Custom,
      // Registered React impl → AuthCardFooter
      // Reads context.mode to render "No account? Sign up" or "Have one? Sign in"
    },

    /**
     * auth_card — composition via manifest sub_components
     *
     * type: Custom → ComponentRenderer → CustomRenderer
     *
     * CustomRenderer (patched):
     *  1. Iterates sub_components in declaration order
     *  2. Evaluates each hidden_condition string with new Function('context', …)
     *     passing engineContext (= { mode }) as `context`
     *  3. Resolves component_ref → manifest.components[ref]
     *  4. Renders each visible child via ComponentRenderer recursively
     *  5. Passes the resulting React nodes as `children` to AuthCardWrapper
     *
     * AuthCardWrapper renders the white card shell and renders {children} inside.
     * No inner UIManifestRenderer call is needed — the engine owns all resolution.
     *
     * hidden_condition semantics: expression returns true → placement is HIDDEN.
     *   "context.mode !== 'signin'"  hides signin_form when mode is "signup"
     *   "context.mode !== 'signup'"  hides signup_form when mode is "signin"
     */
    auth_card: {
      name: "auth_card",
      label: "Auth Card",
      type: ComponentType.Custom,
      // Registered React impl → AuthCardWrapper
      sub_components: [
        { component_ref: "auth_card_header", direction: LayoutDirection.Top    },
        { component_ref: "auth_mode_tabs",   direction: LayoutDirection.Top    },
        {
          component_ref:    "signin_form",
          direction:         LayoutDirection.Center,
          hidden_condition: "context.mode !== 'signin'",
        },
        {
          component_ref:    "signup_form",
          direction:         LayoutDirection.Center,
          hidden_condition: "context.mode !== 'signup'",
        },
        { component_ref: "auth_card_footer", direction: LayoutDirection.Bottom },
      ],
    },
  },

  // ── Screens ───────────────────────────────────────────────────────────────
  screens: {
    auth: {
      name: "auth",
      label: "Authentication",
      nav_order: 1,
      theme_ref: "auth_dark",
      auth_rules: { require_auth: false, redirect_on_denied: "landing" },
      components: [
        { component_ref: "background_grid", direction: LayoutDirection.Floating },
        { component_ref: "orbs",            direction: LayoutDirection.Floating },
        { component_ref: "hero_column",     direction: LayoutDirection.Left,  span: 2 },
        { component_ref: "auth_card",       direction: LayoutDirection.Right},
      ],
    },
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  navigation: {
    type: "stack",
    initial_screen: "auth",
    routes: {
      auth: { screen: "auth", path: "/auth", auth_required: false },
      home: { screen: "home", path: "/",     auth_required: true  },
      docs: { screen: "docs", path: "/docs", auth_required: false },
    },
    guards: ["authGuard"],
  },

  // ── Themes ────────────────────────────────────────────────────────────────
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
        surface:       "#07070e",
        on_surface:    "#f9fafb",
        outline:       "#1f2937",
        error:         "#b91c1c",
        success:       "#1b8a5a",
      },
    },
  },
};