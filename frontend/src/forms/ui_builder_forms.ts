/**
 * ui_builder_forms.ts
 *
 * FormManifest definitions for every editor panel in VisualUIBuilder.
 * These are consumed by FormEngine exactly like any other form — the builder
 * just wires onSubmit to patch the UISystemManifest state instead of posting
 * to an API.
 *
 * Dynamic choices (screen list, component list, form list) are injected at
 * runtime by buildUIBuilderManifest() before passing to FormEngine.
 *
 * ─── Equivalent YAML (abbreviated) ──────────────────────────────────────────
 *
 * manifest_id: ui_builder_forms
 * manifest_version: "1.0.0"
 * forms:
 *   overview:
 *     title: Manifest Overview
 *     layout: { type: single-page }
 *     submit_label: Apply
 *     sections:
 *       - id: identity
 *         title: Identity
 *         fields:
 *           - { id: manifest_id,      type: text,   label: Manifest ID,      required: true }
 *           - { id: manifest_version, type: text,   label: Version }
 *           - { id: description,      type: multiline, label: Description }
 *           - { id: active_theme,     type: text,   label: Active Theme }
 *       - id: engine_config
 *         title: Engine Config
 *         fields:
 *           - { id: engine_mode,         type: select, label: Mode,        choices: [reactive, static] }
 *           - { id: engine_error_mode,   type: select, label: Error Mode,  choices: [collect-all, fail-fast] }
 *           - { id: engine_debounce_ms,  type: number, label: Debounce ms }
 *           - { id: namespaces,          type: multiselect, label: Namespaces, choices: [core,schemata,uam,form,ui] }
 *   screen_editor:
 *     title: Screen
 *     layout: { type: single-page }
 *     submit_label: Apply Changes
 *     sections: ...
 *   component_editor: ...
 *   form_config_editor: ...
 *   navigation_editor: ...
 *   route_editor: ...
 *   theme_editor: ...
 *   button_editor: ...
 *   dialog_editor: ...
 *   toast_editor: ...
 *   icon_editor: ...
 *   add_screen: ...
 *   add_component: ...
 *   add_theme: ...
 *   add_route: ...
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { UISystemManifest } from "@form-engine/components/UIEngine/types";
import type { FormManifest } from "@form-engine/libs/types";

// ─── Static base manifest (no dynamic choices yet) ────────────────────────────

export const UI_BUILDER_MANIFEST_ID = "ui_builder_forms";

export const uiBuilderFormsBase: FormManifest = {
  manifest_id: UI_BUILDER_MANIFEST_ID,
  manifest_version: "1.0.0",
  forms: {
    // ── Overview ─────────────────────────────────────────────────────────────
    overview: {
      title: "Manifest Overview",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Apply",
      sections: [
        {
          id: "identity",
          title: "Identity",
          fields: [
            {
              id: "manifest_id",
              type: "text",
              label: "Manifest ID",
              required: true,
              placeholder: "my_app_ui",
              hint: "Lowercase letters, numbers and underscores only",
              width: "half",
            },
            {
              id: "manifest_version",
              type: "text",
              label: "Version",
              placeholder: "1.0.0",
              width: "half",
            },
            {
              id: "description",
              type: "multiline",
              label: "Description",
              placeholder: "Describe what this UI manifest covers…",
              rows: 2,
            },
            {
              id: "active_theme",
              type: "text",
              label: "Active Theme",
              placeholder: "default",
              hint: "Built-in: default · material · ios-hig · fluent — or a key from your Themes tab",
              width: "half",
            },
          ],
        },
        {
          id: "engine_config",
          title: "Engine Config",
          fields: [
            {
              id: "engine_mode",
              type: "select",
              label: "Mode",
              width: "third",
              choices: [
                { value: "reactive", label: "reactive" },
                { value: "static",   label: "static" },
              ],
            },
            {
              id: "engine_error_mode",
              type: "select",
              label: "Error Mode",
              width: "third",
              choices: [
                { value: "collect-all", label: "collect-all" },
                { value: "fail-fast",   label: "fail-fast" },
              ],
            },
            {
              id: "engine_debounce_ms",
              type: "number",
              label: "Debounce ms",
              width: "third",
              display_as: "input",
              min: 0,
              max: 2000,
            },
            {
              id: "namespaces",
              type: "multiselect",
              label: "Namespaces",
              choices: [
                { value: "core",     label: "core" },
                { value: "schemata", label: "schemata" },
                { value: "uam",      label: "uam" },
                { value: "form",     label: "form" },
                { value: "ui",       label: "ui" },
              ],
            },
          ],
        },
      ],
    },

    // ── Add Screen ────────────────────────────────────────────────────────────
    add_screen: {
      title: "Add Screen",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Add Screen",
      sections: [
        {
          id: "new_screen",
          fields: [
            {
              id: "key",
              type: "text",
              label: "Screen Key (ID)",
              required: true,
              placeholder: "my_screen",
              hint: "Lowercase, underscores — used as the YAML key",
              width: "half",
            },
            {
              id: "label",
              type: "text",
              label: "Display Label",
              placeholder: "My Screen",
              width: "half",
            },
            {
              id: "is_home",
              type: "boolean",
              label: "Set as home screen",
              display_as: "switch",
              width: "half",
            },
            {
              id: "require_auth",
              type: "boolean",
              label: "Require authentication",
              display_as: "switch",
              width: "half",
            },
          ],
        },
      ],
    },

    // ── Screen Editor ──────────────────────────────────────────────────────────
    screen_editor: {
      title: "Screen",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Apply Changes",
      sections: [
        {
          id: "screen_meta",
          title: "Identity",
          fields: [
            {
              id: "label",
              type: "text",
              label: "Display Label",
              placeholder: "My Screen",
              width: "half",
            },
            {
              id: "nav_order",
              type: "number",
              label: "Nav Order",
              display_as: "input",
              width: "half",
            },
            {
              id: "theme_ref",
              type: "text",
              label: "Theme Ref",
              placeholder: "default",
              width: "half",
            },
            {
              id: "background_color",
              type: "color",
              label: "Background Colour",
              format: "hex",
              width: "half",
            },
            {
              id: "is_home",
              type: "boolean",
              label: "Home screen",
              display_as: "switch",
              width: "half",
            },
          ],
        },
        {
          id: "screen_auth",
          title: "Auth Rules",
          fields: [
            {
              id: "require_auth",
              type: "boolean",
              label: "Require authentication",
              display_as: "switch",
              width: "half",
            },
            {
              id: "redirect_on_denied",
              type: "text",
              label: "Redirect on denied",
              placeholder: "login_screen",
              hint: "Screen key to redirect to when auth check fails",
              width: "half",
            },
          ],
        },
      ],
    },

    // ── Add Component ──────────────────────────────────────────────────────────
    add_component: {
      title: "Add Component",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Add Component",
      sections: [
        {
          id: "new_comp",
          fields: [
            {
              id: "key",
              type: "text",
              label: "Component Key (ID)",
              required: true,
              placeholder: "my_component",
              hint: "Lowercase, underscores — used as the YAML key",
              width: "half",
            },
            {
              id: "type",
              type: "select",
              label: "Component Type",
              required: true,
              width: "half",
              choices: [
                { value: "Form",           label: "📋 Form" },
                { value: "Table",          label: "⊞ Table" },
                { value: "Card",           label: "🃏 Card" },
                { value: "VerticalList",   label: "☰ VerticalList" },
                { value: "HorizontalList", label: "↔ HorizontalList" },
                { value: "Search",         label: "🔍 Search" },
                { value: "Tile",           label: "⬜ Tile" },
                { value: "Tree",           label: "🌲 Tree" },
                { value: "FileGallery",    label: "🗂 FileGallery" },
                { value: "FilterBuilder",  label: "⚙ FilterBuilder" },
                { value: "Avatar",         label: "👤 Avatar" },
                { value: "Custom",         label: "⚡ Custom" },
              ],
            },
            {
              id: "label",
              type: "text",
              label: "Display Label",
              placeholder: "My Component",
            },
          ],
        },
      ],
    },

    // ── Component Editor ───────────────────────────────────────────────────────
    component_editor: {
      title: "Component",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Apply Changes",
      sections: [
        {
          id: "comp_meta",
          title: "Identity",
          fields: [
            {
              id: "label",
              type: "text",
              label: "Display Label",
              placeholder: "My Component",
              width: "half",
            },
            {
              id: "type",
              type: "select",
              label: "Component Type",
              required: true,
              width: "half",
              choices: [
                { value: "Form",           label: "📋 Form" },
                { value: "Table",          label: "⊞ Table" },
                { value: "Card",           label: "🃏 Card" },
                { value: "VerticalList",   label: "☰ VerticalList" },
                { value: "HorizontalList", label: "↔ HorizontalList" },
                { value: "Search",         label: "🔍 Search" },
                { value: "Tile",           label: "⬜ Tile" },
                { value: "Tree",           label: "🌲 Tree" },
                { value: "FileGallery",    label: "🗂 FileGallery" },
                { value: "FilterBuilder",  label: "⚙ FilterBuilder" },
                { value: "Avatar",         label: "👤 Avatar" },
                { value: "Custom",         label: "⚡ Custom" },
              ],
            },
          ],
        },
        {
          id: "comp_refs",
          title: "References",
          fields: [
            {
              id: "feature_ref",
              type: "text",
              label: "Feature Ref",
              placeholder: "feature_key",
              width: "half",
            },
            {
              id: "theme_ref",
              type: "text",
              label: "Theme Ref",
              placeholder: "default",
              width: "half",
            },
            {
              id: "schema_ref",
              type: "text",
              label: "Schema Ref",
              placeholder: "MySchema",
              width: "half",
            },
          ],
        },
        {
          id: "comp_content",
          title: "Content",
          fields: [
            {
              id: "text",
              type: "multiline",
              label: "Text Content",
              placeholder: "Display text for Card / Tile / Custom components",
              rows: 2,
              visible_when: {
                field: "type",
                operator: "in",
                value: ["Card", "Tile", "Custom"],
              },
            },
          ],
        },
      ],
    },

    // ── Form Config Editor (inside component_editor when type=Form) ────────────
    // NOTE: form_ref choices are injected dynamically by buildUIBuilderManifest()
    form_config_editor: {
      title: "Form Configuration",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Apply",
      sections: [
        {
          id: "form_config",
          title: "Form Binding",
          fields: [
            {
              id: "form_ref",
              type: "select",
              label: "Form Reference (form_ref)",
              hint: "Select an existing form from this manifest",
              choices: [],  // injected by buildUIBuilderManifest
            },
            {
              id: "embed_mode",
              type: "select",
              label: "Embed Mode",
              width: "half",
              choices: [
                { value: "inline", label: "inline" },
                { value: "modal",  label: "modal" },
                { value: "drawer", label: "drawer" },
                { value: "panel",  label: "panel" },
              ],
            },
          ],
        },
      ],
    },

    // ── Navigation Editor ──────────────────────────────────────────────────────
    // initial_screen choices injected by buildUIBuilderManifest()
    navigation_editor: {
      title: "Navigation",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Apply",
      sections: [
        {
          id: "nav_config",
          title: "Navigation Config",
          fields: [
            {
              id: "nav_type",
              type: "select",
              label: "Navigation Type",
              width: "half",
              choices: [
                { value: "stack",   label: "stack" },
                { value: "tab_bar", label: "tab_bar" },
                { value: "drawer",  label: "drawer" },
                { value: "none",    label: "none" },
              ],
            },
            {
              id: "initial_screen",
              type: "select",
              label: "Initial Screen",
              width: "half",
              choices: [],  // injected by buildUIBuilderManifest
            },
            {
              id: "tab_bar_position",
              type: "select",
              label: "Tab Bar Position",
              width: "half",
              choices: [
                { value: "bottom", label: "bottom" },
                { value: "top",    label: "top" },
              ],
              visible_when: {
                field: "nav_type",
                operator: "equals",
                value: "tab_bar",
              },
            },
          ],
        },
      ],
    },

    // ── Route Editor ───────────────────────────────────────────────────────────
    // screen choices injected by buildUIBuilderManifest()
    route_editor: {
      title: "Route",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Save Route",
      sections: [
        {
          id: "route_fields",
          fields: [
            {
              id: "route_key",
              type: "text",
              label: "Route Key",
              required: true,
              placeholder: "my_route",
              hint: "Used as the key in navigation.routes",
              width: "half",
            },
            {
              id: "screen",
              type: "select",
              label: "Screen",
              required: true,
              width: "half",
              choices: [],  // injected
            },
            {
              id: "path",
              type: "text",
              label: "URL Path",
              placeholder: "/my-route",
              width: "half",
            },
            {
              id: "auth_required",
              type: "boolean",
              label: "Auth required",
              display_as: "switch",
              width: "half",
            },
          ],
        },
      ],
    },

    // ── Add Theme ─────────────────────────────────────────────────────────────
    add_theme: {
      title: "Add Theme",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Add Theme",
      sections: [
        {
          id: "new_theme",
          fields: [
            {
              id: "key",
              type: "text",
              label: "Theme Key (ID)",
              required: true,
              placeholder: "my_theme",
              width: "half",
            },
            {
              id: "label",
              type: "text",
              label: "Display Label",
              placeholder: "My Theme",
              width: "half",
            },
            {
              id: "extends",
              type: "text",
              label: "Extends",
              placeholder: "default",
              width: "half",
            },
          ],
        },
      ],
    },

    // ── Theme Editor ───────────────────────────────────────────────────────────
    theme_editor: {
      title: "Theme",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Apply Changes",
      sections: [
        {
          id: "theme_meta",
          title: "Identity",
          fields: [
            {
              id: "label",
              type: "text",
              label: "Label",
              width: "half",
            },
            {
              id: "extends",
              type: "text",
              label: "Extends",
              placeholder: "default",
              hint: "Built-in: default · material · ios-hig · fluent",
              width: "half",
            },
            {
              id: "selectable",
              type: "boolean",
              label: "User-selectable",
              display_as: "switch",
              width: "half",
            },
            {
              id: "preview_color",
              type: "color",
              label: "Preview Swatch",
              format: "hex",
              width: "half",
            },
          ],
        },
        {
          id: "theme_colors",
          title: "Colour Tokens",
          fields: [
            { id: "color_primary",       type: "color", format: "hex", label: "primary",       width: "third" },
            { id: "color_primary_light", type: "color", format: "hex", label: "primary_light", width: "third" },
            { id: "color_primary_dark",  type: "color", format: "hex", label: "primary_dark",  width: "third" },
            { id: "color_surface",       type: "color", format: "hex", label: "surface",       width: "third" },
            { id: "color_on_surface",    type: "color", format: "hex", label: "on_surface",    width: "third" },
            { id: "color_outline",       type: "color", format: "hex", label: "outline",       width: "third" },
            { id: "color_error",         type: "color", format: "hex", label: "error",         width: "third" },
            { id: "color_success",       type: "color", format: "hex", label: "success",       width: "third" },
            { id: "color_warning",       type: "color", format: "hex", label: "warning",       width: "third" },
          ],
        },
      ],
    },

    // ── Button Editor ──────────────────────────────────────────────────────────
    button_editor: {
      title: "Button",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Save",
      sections: [
        {
          id: "btn_fields",
          fields: [
            {
              id: "key",
              type: "text",
              label: "Button Key",
              required: true,
              placeholder: "my_button",
              width: "half",
            },
            {
              id: "label",
              type: "text",
              label: "Label",
              placeholder: "Click me",
              width: "half",
            },
            {
              id: "on_press",
              type: "text",
              label: "on_press action",
              required: true,
              placeholder: "navigate:home",
              hint: "e.g. navigate:screen_key · submit · dismiss",
            },
          ],
        },
      ],
    },

    // ── Dialog Editor ──────────────────────────────────────────────────────────
    dialog_editor: {
      title: "Dialog",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Save",
      sections: [
        {
          id: "dlg_fields",
          fields: [
            {
              id: "key",
              type: "text",
              label: "Dialog Key",
              required: true,
              placeholder: "confirm_delete",
              width: "half",
            },
            {
              id: "title",
              type: "text",
              label: "Title",
              required: true,
              placeholder: "Are you sure?",
              width: "half",
            },
            {
              id: "body",
              type: "multiline",
              label: "Body",
              placeholder: "This action cannot be undone.",
              rows: 2,
            },
          ],
        },
      ],
    },

    // ── Toast Editor ───────────────────────────────────────────────────────────
    toast_editor: {
      title: "Toast",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Save",
      sections: [
        {
          id: "toast_fields",
          fields: [
            {
              id: "key",
              type: "text",
              label: "Toast Key",
              required: true,
              placeholder: "save_success",
              width: "half",
            },
            {
              id: "severity",
              type: "select",
              label: "Severity",
              width: "half",
              choices: [
                { value: "info",    label: "ℹ info" },
                { value: "success", label: "✓ success" },
                { value: "warning", label: "⚠ warning" },
                { value: "error",   label: "✗ error" },
              ],
            },
            {
              id: "message",
              type: "text",
              label: "Message",
              required: true,
              placeholder: "Action completed successfully",
            },
          ],
        },
      ],
    },

    // ── Icon Editor ────────────────────────────────────────────────────────────
    icon_editor: {
      title: "Icon",
      version: "1.0.0",
      form_state: "active",
      layout: { type: "single-page" },
      submit_label: "Save",
      sections: [
        {
          id: "icon_fields",
          fields: [
            {
              id: "key",
              type: "text",
              label: "Icon Key",
              required: true,
              placeholder: "my_icon",
              width: "half",
            },
            {
              id: "type",
              type: "select",
              label: "Icon Type",
              width: "half",
              choices: [
                { value: "lucide",     label: "Lucide" },
                { value: "svg",        label: "SVG" },
                { value: "png",        label: "PNG" },
                { value: "fontawesome", label: "FontAwesome" },
                { value: "custom",     label: "Custom" },
              ],
            },
            {
              id: "name",
              type: "text",
              label: "Name / Reference",
              placeholder: "Star",
              hint: "Lucide icon name, SVG path, or component name",
            },
          ],
        },
      ],
    },
  },
} as unknown as FormManifest;

// ─── Dynamic manifest builder ─────────────────────────────────────────────────
//
// Injects runtime-derived choices (screens list, forms list, components list)
// into the select fields that need them.

export function buildUIBuilderManifest(ui: UISystemManifest): FormManifest {
  const screenChoices = Object.entries(ui.screens ?? {}).map(([k, v]) => ({
    value: k,
    label: v.label ? `${v.label} (${k})` : k,
  }));
  const formChoices = Object.keys(ui.forms ?? {}).map(k => ({ value: k, label: k }));
  const componentChoices = Object.entries(ui.components ?? {}).map(([k, v]) => ({
    value: k,
    label: v.label ? `${v.label} (${k})` : k,
  }));

  // Deep-clone base and inject
  const m = JSON.parse(JSON.stringify(uiBuilderFormsBase)) as FormManifest;
  const forms = m.forms as Record<string, {
    sections: Array<{ fields: Array<{ id: string; choices?: unknown[] }> }>;
  }>;

  const patchChoices = (formId: string, fieldId: string, choices: { value: string; label: string }[]) => {
    for (const section of forms[formId]?.sections ?? []) {
      const field = section.fields?.find(f => f.id === fieldId);
      if (field) {
        field.choices = choices.length
          ? choices
          : [{ value: "", label: "— none available —" }];
      }
    }
  };

  patchChoices("form_config_editor", "form_ref",        formChoices);
  patchChoices("navigation_editor",  "initial_screen",  screenChoices);
  patchChoices("route_editor",       "screen",          screenChoices);

  return m;
}

// ─── Helpers to map manifest state → FormEngine initialAnswers ─────────────────

export function overviewAnswers(m: UISystemManifest) {
  return {
    manifest_id:       m.manifest_id,
    manifest_version:  m.manifest_version ?? "1.0.0",
    description:       m.description ?? "",
    active_theme:      m.active_theme ?? "default",
    engine_mode:       m.engine?.mode ?? "reactive",
    engine_error_mode: m.engine?.error_mode ?? "collect-all",
    engine_debounce_ms: m.engine?.debounce_ms ?? 300,
    namespaces:        m.namespaces ?? ["core", "schemata", "uam", "form", "ui"],
  };
}

export function screenAnswers(s: {
  label?: string; nav_order?: number; theme_ref?: string;
  background_color?: string; is_home?: boolean;
  auth_rules?: { require_auth?: boolean; redirect_on_denied?: string };
}) {
  return {
    label:              s.label ?? "",
    nav_order:          s.nav_order ?? "",
    theme_ref:          s.theme_ref ?? "",
    background_color:   s.background_color ?? "",
    is_home:            s.is_home ?? false,
    require_auth:       s.auth_rules?.require_auth !== false,
    redirect_on_denied: s.auth_rules?.redirect_on_denied ?? "",
  };
}

export function componentAnswers(c: {
  label?: string; type: string; feature_ref?: string;
  theme_ref?: string; schema_ref?: string; text?: string;
}) {
  return {
    label:       c.label ?? "",
    type:        c.type,
    feature_ref: c.feature_ref ?? "",
    theme_ref:   c.theme_ref ?? "",
    schema_ref:  c.schema_ref ?? "",
    text:        c.text ?? "",
  };
}

export function formConfigAnswers(c: { form_ref?: string; form_embed?: { mode?: string } }) {
  return {
    form_ref:   c.form_ref ?? "",
    embed_mode: c.form_embed?.mode ?? "inline",
  };
}

export function navigationAnswers(n: {
  type?: string; initial_screen?: string; tab_bar_position?: string;
}) {
  return {
    nav_type:          n.type ?? "stack",
    initial_screen:    n.initial_screen ?? "",
    tab_bar_position:  n.tab_bar_position ?? "bottom",
  };
}

export function routeAnswers(key: string, r: { screen: string; path?: string; auth_required?: boolean }) {
  return {
    route_key:    key,
    screen:       r.screen,
    path:         r.path ?? "",
    auth_required: r.auth_required !== false,
  };
}

export function themeAnswers(t: {
  label?: string; extends?: string; selectable?: boolean; preview_color?: string;
  colors?: Record<string, string>;
}) {
  return {
    label:               t.label ?? "",
    extends:             t.extends ?? "default",
    selectable:          t.selectable ?? true,
    preview_color:       t.preview_color ? `#${t.preview_color}` : "#000000",
    color_primary:       t.colors?.primary ?? "#006FFD",
    color_primary_light: t.colors?.primary_light ?? "#4D96FF",
    color_primary_dark:  t.colors?.primary_dark ?? "#0040DD",
    color_surface:       t.colors?.surface ?? "#FFFFFF",
    color_on_surface:    t.colors?.on_surface ?? "#111827",
    color_outline:       t.colors?.outline ?? "#E5E7EB",
    color_error:         t.colors?.error ?? "#B91C1C",
    color_success:       t.colors?.success ?? "#1B8A5A",
    color_warning:       t.colors?.warning ?? "#D97706",
  };
}
