/**
 * ui_builder_forms.ts
 *
 * Provides the FormManifest that powers every editor form inside VisualUIBuilder,
 * plus helper functions that extract current manifest values as FieldAnswers so
 * FormEngine can pre-populate the fields.
 *
 * USAGE (inside VisualUIBuilder)
 *   const builderManifest = useMemo(() => buildUIBuilderManifest(manifest), [manifest]);
 *   <FormEngine manifest={builderManifest} formId="screen_editor" initialAnswers={screenAnswers(sel)} … />
 *
 * FORM IDs exposed
 *   overview            – manifest identity + engine config
 *   add_screen          – quick-add a new screen
 *   screen_editor       – edit an existing screen
 *   add_component       – quick-add a new component
 *   component_editor    – edit an existing component
 *   form_config_editor  – bind a form_ref + embed mode to a Form-type component
 *   navigation_editor   – global navigation settings
 *   route_editor        – add / edit a route
 *   add_theme           – quick-add a new theme
 *   theme_editor        – edit an existing theme (colours, typography, motion)
 *   button_editor       – add a reusable button asset
 *   dialog_editor       – add a reusable dialog asset
 *   toast_editor        – add a reusable toast asset
 *   icon_editor         – add a reusable icon asset
 *
 * DYNAMIC CHOICES
 *   buildUIBuilderManifest() receives the current UISystemManifest so it can
 *   inject live choices (screen keys, component keys, theme keys, form IDs)
 *   into the appropriate select / multiselect fields.
 */

import type { UISystemManifest, Component, Screen, NavigationConfig, ThemeDefinition } from "@form-engine/components/UIEngine/types";

// ---------------------------------------------------------------------------
// FormManifest compat types
// (mirrors @form-engine/libs/types — kept local to avoid circular deps)
// ---------------------------------------------------------------------------

type FieldType =
  | "text" | "multiline" | "boolean" | "number"
  | "select" | "multiselect" | "color" | "hidden";

interface StaticChoice { value: string | number | boolean; label: string; }

interface FormField {
  id: string;
  type: FieldType;
  label?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  default?: unknown;
  width?: "full" | "half" | "third";
  // select / multiselect
  choices?: { static: StaticChoice[] };
  display_as?: string;
  // text
  min_length?: number;
  max_length?: number;
  pattern?: string;
  // number
  min?: number;
  max?: number;
  decimal_places?: number;
  // color
  format?: "hex" | "rgba" | "hsl";
}

interface Section {
  id: string;
  title?: string;
  description?: string;
  fields: FormField[];
}

interface FormDef {
  title: string;
  version: string;
  layout: { type: "single-page" | "wizard" | "grid"; columns?: number };
  sections?: Section[];
  pages?: Array<{ id: string; title: string; sections: Section[] }>;
  on_submit?: { type: "local"; handler_name: string };
}

export interface FormManifest {
  manifest_id: string;
  manifest_version: string;
  forms: Record<string, FormDef>;
}

export type FieldAnswers = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Static choice lists
// ---------------------------------------------------------------------------

const NAMESPACE_CHOICES: StaticChoice[] = [
  { value: "core",     label: "core"     },
  { value: "schemata", label: "schemata" },
  { value: "uam",      label: "uam"      },
  { value: "form",     label: "form"     },
  { value: "ui",       label: "ui"       },
];

const ENGINE_MODE_CHOICES: StaticChoice[] = [
  { value: "reactive", label: "reactive – re-evaluate on any change" },
  { value: "static",   label: "static – evaluate on blur / submit" },
];

const ENGINE_ERROR_CHOICES: StaticChoice[] = [
  { value: "collect-all", label: "collect-all – show every error" },
  { value: "fail-fast",   label: "fail-fast – stop at first error" },
];

const COMPONENT_TYPE_CHOICES: StaticChoice[] = [
  { value: "Form",          label: "📋 Form"          },
  { value: "Table",         label: "⊞  Table"         },
  { value: "Card",          label: "🃏 Card"          },
  { value: "VerticalList",  label: "☰  VerticalList"  },
  { value: "HorizontalList",label: "↔  HorizontalList"},
  { value: "Search",        label: "🔍 Search"        },
  { value: "Tile",          label: "⬜ Tile"          },
  { value: "Tree",          label: "🌲 Tree"          },
  { value: "FileGallery",   label: "🗂  FileGallery"  },
  { value: "FilterBuilder", label: "⚙  FilterBuilder" },
  { value: "Avatar",        label: "👤 Avatar"        },
  { value: "Custom",        label: "⚡ Custom"        },
];

const DIRECTION_CHOICES: StaticChoice[] = [
  { value: "Center",   label: "⊙ Center"   },
  { value: "Top",      label: "⬆ Top"      },
  { value: "Bottom",   label: "⬇ Bottom"   },
  { value: "Left",     label: "⬅ Left"     },
  { value: "Right",    label: "➡ Right"    },
  { value: "Floating", label: "⤢ Floating" },
  { value: "Modal",    label: "⊡ Modal"    },
];

const EMBED_MODE_CHOICES: StaticChoice[] = [
  { value: "inline", label: "inline – renders inside the component"  },
  { value: "modal",  label: "modal – opens in a dialog"              },
  { value: "drawer", label: "drawer – opens as a side drawer"        },
  { value: "panel",  label: "panel – opens in a right split panel"   },
];

const NAV_TYPE_CHOICES: StaticChoice[] = [
  { value: "stack",    label: "stack – push/pop navigation"   },
  { value: "tab_bar",  label: "tab_bar – bottom or top tabs"  },
  { value: "drawer",   label: "drawer – hamburger side menu"  },
  { value: "none",     label: "none – manual routing only"    },
];

const TAB_BAR_POSITION_CHOICES: StaticChoice[] = [
  { value: "bottom", label: "bottom" },
  { value: "top",    label: "top"    },
];

const BASE_THEME_CHOICES: StaticChoice[] = [
  { value: "default",  label: "default – runtime default"       },
  { value: "material", label: "material – Material Design 3"    },
  { value: "ios-hig",  label: "ios-hig – Apple HIG tokens"      },
  { value: "fluent",   label: "fluent – Microsoft Fluent tokens" },
];

const SEVERITY_CHOICES: StaticChoice[] = [
  { value: "info",    label: "ℹ info"    },
  { value: "success", label: "✅ success" },
  { value: "warning", label: "⚠ warning" },
  { value: "error",   label: "❌ error"   },
];

const ICON_TYPE_CHOICES: StaticChoice[] = [
  { value: "lucide",      label: "lucide"      },
  { value: "fontawesome", label: "fontawesome" },
  { value: "svg",         label: "svg"         },
  { value: "png",         label: "png"         },
  { value: "custom",      label: "custom"      },
];

// ---------------------------------------------------------------------------
// buildUIBuilderManifest
// ---------------------------------------------------------------------------

/**
 * Constructs the FormManifest that drives all of UIBuilder's editor panels.
 * Pass the current UISystemManifest so select fields can offer live choices
 * (e.g. "pick a screen" uses the screens currently defined in the manifest).
 */
export function buildUIBuilderManifest(manifest: UISystemManifest): FormManifest {
  // Dynamic choices derived from the live manifest
  const screenChoices  = keysToChoices(Object.keys(manifest.screens     ?? {}));
  const compChoices    = keysToChoices(Object.keys(manifest.components  ?? {}));
  const themeChoices   = [...BASE_THEME_CHOICES, ...keysToChoices(Object.keys(manifest.themes ?? {}))];
  const formChoices    = keysToChoices(Object.keys(manifest.forms        ?? {}));

  return {
    manifest_id:      "ui_builder_forms",
    manifest_version: "1.0.0",
    forms: {

      // ── Overview ─────────────────────────────────────────────────────────
      overview: {
        title: "Manifest Overview",
        version: "1.0.0",
        layout: { type: "single-page", columns: 12 },
        on_submit: { type: "local", handler_name: "onOverviewSave" },
        sections: [{
          id: "identity",
          title: "Identity",
          fields: [
            field("manifest_id",      "text",   "Manifest ID",      { required: true, placeholder: "my_application", hint: "snake_case, min 2 chars" }),
            field("manifest_version", "text",   "Version",          { placeholder: "1.0.0", width: "third" }),
            field("description",      "multiline","Description",    { placeholder: "Describe this UI manifest…" }),
          ],
        }, {
          id: "engine",
          title: "Engine Configuration",
          fields: [
            selectField("engine_mode",        "Engine Mode",     ENGINE_MODE_CHOICES,  "reactive"),
            selectField("engine_error_mode",  "Error Mode",      ENGINE_ERROR_CHOICES, "collect-all"),
            field("engine_debounce_ms", "number", "Debounce (ms)", { default: 300, min: 0, max: 5000, width: "third" }),
          ],
        }, {
          id: "theme_ns",
          title: "Theme & Namespaces",
          fields: [
            selectField("active_theme", "Active Theme", themeChoices, "default"),
            multiselectField("namespaces", "Namespaces", NAMESPACE_CHOICES, ["core", "schemata", "uam", "form", "ui"]),
          ],
        }],
      },

      // ── Add Screen ───────────────────────────────────────────────────────
      add_screen: {
        title: "Add Screen",
        version: "1.0.0",
        layout: { type: "single-page" },
        on_submit: { type: "local", handler_name: "onAddScreen" },
        sections: [{
          id: "basic",
          fields: [
            field("key",   "text",    "Key",   { required: true, placeholder: "home_screen", hint: "snake_case identifier" }),
            field("label", "text",    "Label", { placeholder: "Home" }),
            boolField("is_home",      "Is Home Screen?"),
            boolField("require_auth", "Require Authentication?", true),
          ],
        }],
      },

      // ── Screen Editor ─────────────────────────────────────────────────────
      screen_editor: {
        title: "Screen Settings",
        version: "1.0.0",
        layout: { type: "single-page", columns: 12 },
        on_submit: { type: "local", handler_name: "onScreenSave" },
        sections: [{
          id: "display",
          title: "Display",
          fields: [
            field("label",    "text",  "Label",       { placeholder: "Displayed tab / header title" }),
            field("nav_order","number","Nav Order",   { min: 0, width: "third" }),
            selectField("theme_ref", "Theme Override", themeChoices, ""),
            field("background_color","color","Background Color", { format: "hex" }),
          ],
        }, {
          id: "access",
          title: "Access Control",
          fields: [
            boolField("is_home",            "Set as Home Screen?"),
            boolField("require_auth",       "Require Authentication?", true),
            selectField("redirect_on_denied","Redirect if Denied", [{ value: "", label: "— none —" }, ...screenChoices], ""),
          ],
        }],
      },

      // ── Add Component ────────────────────────────────────────────────────
      add_component: {
        title: "Add Component",
        version: "1.0.0",
        layout: { type: "single-page" },
        on_submit: { type: "local", handler_name: "onAddComponent" },
        sections: [{
          id: "basic",
          fields: [
            field("key",   "text", "Key",  { required: true, placeholder: "my_component", hint: "snake_case identifier" }),
            field("label", "text", "Label",{ placeholder: "My Component" }),
            selectField("type", "Component Type", COMPONENT_TYPE_CHOICES, "Card"),
          ],
        }],
      },

      // ── Component Editor ─────────────────────────────────────────────────
      component_editor: {
        title: "Component Settings",
        version: "1.0.0",
        layout: { type: "single-page", columns: 12 },
        on_submit: { type: "local", handler_name: "onComponentSave" },
        sections: [{
          id: "basic",
          title: "Basic",
          fields: [
            field("label",      "text", "Label",       { placeholder: "Display name" }),
            selectField("type", "Type", COMPONENT_TYPE_CHOICES, "Card"),
          ],
        }, {
          id: "data",
          title: "Data & Content",
          fields: [
            field("schema_ref", "text", "Schema Ref",  { placeholder: "my_entity", hint: "Bind to a schema data type" }),
            field("text",       "text", "Static Text", { placeholder: "Shown for Card / Custom text content" }),
          ],
        }, {
          id: "access",
          title: "Access & Theming",
          fields: [
            field("feature_ref", "text", "Feature Gate", { placeholder: "feature_key", hint: "Hide component if feature not in auth.features" }),
            selectField("theme_ref", "Theme Override", themeChoices, ""),
          ],
        }],
      },

      // ── Form Config Editor ────────────────────────────────────────────────
      form_config_editor: {
        title: "Form Binding",
        version: "1.0.0",
        layout: { type: "single-page" },
        on_submit: { type: "local", handler_name: "onFormConfigSave" },
        sections: [{
          id: "binding",
          title: "Form Reference",
          description: "Bind this Form-type component to an existing form definition.",
          fields: [
            selectField("form_ref",   "Form",       [{ value: "", label: "— none —" }, ...formChoices], ""),
            selectField("embed_mode", "Embed Mode", EMBED_MODE_CHOICES, "inline"),
          ],
        }],
      },

      // ── Navigation Editor ─────────────────────────────────────────────────
      navigation_editor: {
        title: "Navigation",
        version: "1.0.0",
        layout: { type: "single-page", columns: 12 },
        on_submit: { type: "local", handler_name: "onNavSave" },
        sections: [{
          id: "global",
          fields: [
            selectField("nav_type",          "Navigation Type",   NAV_TYPE_CHOICES,          "stack"),
            selectField("initial_screen",    "Initial Screen",    [{ value: "", label: "— none —" }, ...screenChoices], ""),
            selectField("tab_bar_position",  "Tab Bar Position",  TAB_BAR_POSITION_CHOICES,  "bottom"),
          ],
        }],
      },

      // ── Route Editor ─────────────────────────────────────────────────────
      route_editor: {
        title: "Add Route",
        version: "1.0.0",
        layout: { type: "single-page" },
        on_submit: { type: "local", handler_name: "onRouteSave" },
        sections: [{
          id: "route",
          fields: [
            field("route_key",     "text",   "Route Key",    { required: true, placeholder: "home", hint: "snake_case key" }),
            selectField("screen",  "Screen", [{ value: "", label: "— select screen —" }, ...screenChoices], ""),
            field("path",          "text",   "URL Path",     { placeholder: "/home", hint: "Optional deep-link path" }),
            boolField("auth_required", "Require Authentication?", true),
          ],
        }],
      },

      // ── Add Theme ────────────────────────────────────────────────────────
      add_theme: {
        title: "Add Theme",
        version: "1.0.0",
        layout: { type: "single-page" },
        on_submit: { type: "local", handler_name: "onAddTheme" },
        sections: [{
          id: "basic",
          fields: [
            field("key",     "text", "Key",     { required: true, placeholder: "brand_dark", hint: "snake_case identifier" }),
            field("label",   "text", "Label",   { placeholder: "Brand Dark" }),
            selectField("extends", "Base Theme", BASE_THEME_CHOICES, "default"),
          ],
        }],
      },

      // ── Theme Editor ─────────────────────────────────────────────────────
      theme_editor: {
        title: "Theme Editor",
        version: "1.0.0",
        layout: { type: "single-page", columns: 12 },
        on_submit: { type: "local", handler_name: "onThemeSave" },
        sections: [{
          id: "meta",
          title: "Metadata",
          fields: [
            field("label",    "text",  "Display Name",  { placeholder: "Brand Dark" }),
            selectField("extends", "Extends (base)", BASE_THEME_CHOICES, "default"),
            boolField("selectable", "Show in theme picker?", true),
            field("preview_color", "color", "Preview Colour", { format: "hex", hint: "Swatch shown in theme picker" }),
          ],
        }, {
          id: "colours",
          title: "Colour Tokens",
          description: "Hex values (with or without leading #). Leave blank to inherit from the base theme.",
          fields: [
            colorHalfField("color_primary",       "Primary"),
            colorHalfField("color_primary_light",  "Primary Light"),
            colorHalfField("color_primary_dark",   "Primary Dark"),
            colorHalfField("color_surface",        "Surface"),
            colorHalfField("color_on_surface",     "On Surface"),
            colorHalfField("color_outline",        "Outline"),
            colorHalfField("color_error",          "Error"),
            colorHalfField("color_success",        "Success"),
            colorHalfField("color_warning",        "Warning"),
          ],
        }],
      },

      // ── Button Editor ────────────────────────────────────────────────────
      button_editor: {
        title: "Add Button",
        version: "1.0.0",
        layout: { type: "single-page" },
        on_submit: { type: "local", handler_name: "onButtonSave" },
        sections: [{
          id: "button",
          fields: [
            field("key",      "text", "Key",      { required: true, placeholder: "primary_cta" }),
            field("label",    "text", "Label",    { placeholder: "Get Started" }),
            field("on_press", "text", "on_press", { required: true, placeholder: "navigate | custom_handler", hint: "Action key or handler name" }),
          ],
        }],
      },

      // ── Dialog Editor ────────────────────────────────────────────────────
      dialog_editor: {
        title: "Add Dialog",
        version: "1.0.0",
        layout: { type: "single-page" },
        on_submit: { type: "local", handler_name: "onDialogSave" },
        sections: [{
          id: "dialog",
          fields: [
            field("key",   "text",      "Key",   { required: true, placeholder: "confirm_delete" }),
            field("title", "text",      "Title", { required: true, placeholder: "Delete this item?" }),
            field("body",  "multiline", "Body",  { placeholder: "This action cannot be undone." }),
          ],
        }],
      },

      // ── Toast Editor ─────────────────────────────────────────────────────
      toast_editor: {
        title: "Add Toast",
        version: "1.0.0",
        layout: { type: "single-page" },
        on_submit: { type: "local", handler_name: "onToastSave" },
        sections: [{
          id: "toast",
          fields: [
            field("key",     "text", "Key",     { required: true, placeholder: "saved_success" }),
            field("message", "text", "Message", { required: true, placeholder: "Changes saved!" }),
            selectField("severity", "Severity", SEVERITY_CHOICES, "info"),
          ],
        }],
      },

      // ── Icon Editor ──────────────────────────────────────────────────────
      icon_editor: {
        title: "Add Icon",
        version: "1.0.0",
        layout: { type: "single-page" },
        on_submit: { type: "local", handler_name: "onIconSave" },
        sections: [{
          id: "icon",
          fields: [
            field("key",  "text", "Key",  { required: true, placeholder: "home_icon" }),
            selectField("type", "Icon Type", ICON_TYPE_CHOICES, "lucide"),
            field("name", "text", "Name / Path", { placeholder: "Home (Lucide) or /icons/home.svg (svg/png)" }),
          ],
        }],
      },

    }, // end forms
  };
}

// ---------------------------------------------------------------------------
// Answer extractors
// (map current manifest values back to FormEngine FieldAnswers for pre-fill)
// ---------------------------------------------------------------------------

export function overviewAnswers(m: UISystemManifest): FieldAnswers {
  return {
    manifest_id:      m.manifest_id      ?? "",
    manifest_version: m.manifest_version ?? "1.0.0",
    description:      m.description      ?? "",
    active_theme:     m.active_theme     ?? "default",
    namespaces:       m.namespaces        ?? ["core", "schemata", "uam", "form", "ui"],
    engine_mode:        (m.engine as any)?.mode       ?? "reactive",
    engine_error_mode:  (m.engine as any)?.error_mode ?? "collect-all",
    engine_debounce_ms: (m.engine as any)?.debounce_ms ?? 300,
  };
}

export function screenAnswers(s: Screen): FieldAnswers {
  return {
    label:              s.label             ?? "",
    nav_order:          s.nav_order         ?? "",
    theme_ref:          s.theme_ref         ?? "",
    background_color:   s.background_color  ?? "",
    is_home:            s.is_home           ?? false,
    require_auth:       s.auth_rules?.require_auth       ?? true,
    redirect_on_denied: s.auth_rules?.redirect_on_denied ?? "",
  };
}

export function componentAnswers(c: Component): FieldAnswers {
  return {
    label:       c.label       ?? "",
    type:        c.type        ?? "Card",
    feature_ref: c.feature_ref ?? "",
    theme_ref:   c.theme_ref   ?? "",
    schema_ref:  c.schema_ref  ?? "",
    text:        c.text        ?? "",
  };
}

export function formConfigAnswers(c: Component): FieldAnswers {
  return {
    form_ref:   c.form_ref            ?? "",
    embed_mode: c.form_embed?.mode    ?? "inline",
  };
}

export function navigationAnswers(nav: Partial<NavigationConfig>): FieldAnswers {
  return {
    nav_type:         nav.type             ?? "stack",
    initial_screen:   nav.initial_screen   ?? "",
    tab_bar_position: nav.tab_bar_position ?? "bottom",
  };
}

export function routeAnswers(r: { screen?: string; path?: string; auth_required?: boolean }): FieldAnswers {
  return {
    screen:        r.screen        ?? "",
    path:          r.path          ?? "",
    auth_required: r.auth_required ?? true,
  };
}

export function themeAnswers(t: ThemeDefinition): FieldAnswers {
  const c = t.colors ?? {};
  return {
    label:               t.label           ?? "",
    extends:             t.extends         ?? "default",
    selectable:          t.selectable      ?? true,
    preview_color:       t.preview_color   ? `#${t.preview_color}` : "",
    color_primary:       c["primary"]       ?? "",
    color_primary_light: c["primary_light"] ?? "",
    color_primary_dark:  c["primary_dark"]  ?? "",
    color_surface:       c["surface"]       ?? "",
    color_on_surface:    c["on_surface"]    ?? "",
    color_outline:       c["outline"]       ?? "",
    color_error:         c["error"]         ?? "",
    color_success:       c["success"]       ?? "",
    color_warning:       c["warning"]       ?? "",
  };
}

// ---------------------------------------------------------------------------
// Field builder helpers (private)
// ---------------------------------------------------------------------------

function field(
  id: string,
  type: FieldType,
  label: string,
  opts: {
    required?: boolean;
    placeholder?: string;
    hint?: string;
    default?: unknown;
    width?: "full" | "half" | "third";
    min?: number;
    max?: number;
    decimal_places?: number;
    format?: "hex" | "rgba" | "hsl";
    min_length?: number;
    max_length?: number;
    pattern?: string;
  } = {},
): FormField {
  return {
    id,
    type,
    label,
    required:       opts.required,
    placeholder:    opts.placeholder,
    hint:           opts.hint,
    default:        opts.default,
    width:          opts.width,
    min:            opts.min,
    max:            opts.max,
    decimal_places: opts.decimal_places,
    format:         opts.format,
    min_length:     opts.min_length,
    max_length:     opts.max_length,
    pattern:        opts.pattern,
  };
}

function selectField(
  id: string,
  label: string,
  choices: StaticChoice[],
  defaultValue: string,
  width?: "full" | "half" | "third",
): FormField {
  return {
    id, type: "select", label, width,
    choices: { static: choices },
    display_as: "dropdown",
    default: defaultValue,
  };
}

function multiselectField(
  id: string,
  label: string,
  choices: StaticChoice[],
  defaultValue: string[],
): FormField {
  return {
    id, type: "multiselect", label,
    choices: { static: choices },
    display_as: "checkbox",
    default: defaultValue,
  } as FormField;
}

function boolField(id: string, label: string, defaultValue = false): FormField {
  return { id, type: "boolean", label, default: defaultValue };
}

function colorHalfField(id: string, label: string): FormField {
  return { id, type: "color", label, format: "hex", width: "half" };
}

function keysToChoices(keys: string[]): StaticChoice[] {
  return keys.map(k => ({ value: k, label: k }));
}
