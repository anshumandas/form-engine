/**
 * form_creator_manifest.ts
 *
 * The FormManifest that drives the "Create Form" wizard inside VisualUIBuilder
 * (the form-based, FormEngine-rendered form creator — not the drag-drop builder).
 *
 * Registered as a localManifest under the key "form_creator" so the
 * `api.getManifest("form_creator")` call resolves instantly without a network
 * hit.
 *
 * ── What this solves ─────────────────────────────────────────────────────────
 *
 * 1. Complex-type fields (permissions, sub-roles, tags …) render as repeatable
 *    sections with an "Add Item" button instead of raw JSON textarea.
 *
 * 2. When layout_type = "wizard" the form shows a Pages section first so the
 *    user defines the wizard pages before adding fields.
 *
 * 3. Field-type selection dynamically branches: choosing "select" reveals a
 *    choices editor, "number" reveals min/max, "boolean" reveals display style,
 *    etc. — all powered by `condition` on each field so FormEngine hides
 *    irrelevant rows automatically.
 *
 * 4. UAM-specific forms (uam_role_editor, uam_permission_editor) use repeatable
 *    sections to manage permissions[] and sub_roles[] properly.
 *
 * ── Form IDs exposed ─────────────────────────────────────────────────────────
 *   create_form           – quick-create a new FormDef (step 1: identity + layout)
 *   field_editor          – add / edit a single field with dynamic type branching
 *   section_editor        – add / edit a section (with collection toggle)
 *   wizard_page_editor    – add / edit a wizard page
 *   uam_role_editor       – create / edit a UAM role with permissions + sub-roles
 *   uam_permission_editor – define a single permission object
 */

import type { FormManifest } from "@form-engine/libs/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const eq  = (field: string, value: unknown) => ({ field, op: "eq"  as const, value });
const neq = (field: string, value: unknown) => ({ field, op: "neq" as const, value });
const inSet = (field: string, value: unknown[]) => ({ field, op: "in" as const, value });

// ─── Choice lists ─────────────────────────────────────────────────────────────

const FIELD_TYPE_CHOICES = [
  { value: "text",        label: "T  Text" },
  { value: "multiline",   label: "¶  Long Text" },
  { value: "number",      label: "#  Number" },
  { value: "boolean",     label: "☑  Toggle / Checkbox" },
  { value: "select",      label: "▾  Select (single)" },
  { value: "multiselect", label: "☰  Multiselect" },
  { value: "date",        label: "📅 Date" },
  { value: "time",        label: "🕐 Time" },
  { value: "datetime",    label: "🗓  Date + Time" },
  { value: "daterange",   label: "↔  Date Range" },
  { value: "rating",      label: "★  Rating" },
  { value: "file",        label: "📎 File upload" },
  { value: "color",       label: "🎨 Colour picker" },
  { value: "richtext",    label: "✎  Rich Text" },
  { value: "signature",   label: "✍  Signature" },
  { value: "hidden",      label: "👁  Hidden" },
  { value: "json",        label: "{}  JSON / Object" },
];

const WIDTH_CHOICES = [
  { value: "full",  label: "Full width" },
  { value: "half",  label: "Half width" },
  { value: "third", label: "One-third width" },
];

const LAYOUT_TYPE_CHOICES = [
  { value: "single-page", label: "Single page — all sections on one screen" },
  { value: "wizard",      label: "Wizard — multi-step with pages" },
  { value: "grid",        label: "Grid — fixed column layout" },
];

const TEXT_DISPLAY_CHOICES = [
  { value: "input",    label: "Plain text" },
  { value: "email",    label: "Email" },
  { value: "password", label: "Password (masked)" },
  { value: "url",      label: "URL" },
  { value: "tel",      label: "Phone number" },
  { value: "search",   label: "Search" },
];

const NUMBER_DISPLAY_CHOICES = [
  { value: "input",   label: "Number input" },
  { value: "slider",  label: "Slider" },
  { value: "stepper", label: "Stepper" },
];

const BOOL_DISPLAY_CHOICES = [
  { value: "switch",         label: "Toggle switch" },
  { value: "checkbox",       label: "Checkbox" },
  { value: "yes-no-radio",   label: "Yes / No" },
];

const SELECT_DISPLAY_CHOICES = [
  { value: "auto",         label: "Auto (engine decides)" },
  { value: "dropdown",     label: "Dropdown" },
  { value: "radio",        label: "Radio buttons" },
  { value: "button-group", label: "Button group" },
];

const MULTISELECT_DISPLAY_CHOICES = [
  { value: "auto",      label: "Auto" },
  { value: "dropdown",  label: "Dropdown" },
  { value: "checkbox",  label: "Checkboxes" },
  { value: "tag-input", label: "Tag input" },
];

const RATING_DISPLAY_CHOICES = [
  { value: "stars",         label: "Stars" },
  { value: "numeric-scale", label: "Numeric scale" },
  { value: "emoji-scale",   label: "Emoji scale" },
];

const COLOR_FORMAT_CHOICES = [
  { value: "hex",  label: "#rrggbb hex" },
  { value: "rgba", label: "rgba()" },
  { value: "hsl",  label: "hsl()" },
];

const HIDDEN_VALUE_FROM_CHOICES = [
  { value: "default",     label: "Hard-coded default value" },
  { value: "context",     label: "Context key (e.g. user.id)" },
  { value: "query-param", label: "URL query parameter" },
  { value: "computed",    label: "Computed expression" },
];

const CONDITION_OP_CHOICES = [
  { value: "eq",           label: "= equals" },
  { value: "neq",          label: "≠ not equals" },
  { value: "gt",           label: "> greater than" },
  { value: "gte",          label: "≥ greater or equal" },
  { value: "lt",           label: "< less than" },
  { value: "lte",          label: "≤ less or equal" },
  { value: "in",           label: "∈ in list" },
  { value: "not_in",       label: "∉ not in list" },
  { value: "contains",     label: "contains substring" },
  { value: "is_empty",     label: "is empty / null" },
  { value: "is_not_empty", label: "is not empty" },
  { value: "is_true",      label: "is true" },
  { value: "is_false",     label: "is false" },
];

// Types where choices config is relevant
const CHOICE_TYPES = ["select", "multiselect"];
// Types where a text-like "display_as" is relevant
const TEXT_TYPES   = ["text", "multiline"];
// Number types
const NUMBER_TYPES = ["number"];
// Boolean types
const BOOL_TYPES   = ["boolean"];
// Date family
const DATE_TYPES   = ["date", "datetime", "daterange"];
// Types where min/max length applies
const LENGTH_TYPES = ["text", "multiline"];

// ─── Main manifest ────────────────────────────────────────────────────────────

export const formCreatorManifest: FormManifest = {
  manifest_id:      "form_creator",
  manifest_version: "1.0.0",

  forms: {

    // ── create_form ────────────────────────────────────────────────────────
    // Multi-step wizard. The page ordering is deliberate:
    //   1. Identity         – give the form a name, id, layout type
    //   2. Wizard Pages     – (wizard-only, ALWAYS before Fields) define the
    //                         steps the form will have, so the user thinks
    //                         about structure before content
    //   3. Form Fields      – the fields collection; each field optionally
    //                         carries a `page_fields` ref via the per-page
    //                         editor downstream (VisualFormBuilder)
    //   4. Submission       – submit action + messages
    //
    // The "Wizard Pages BEFORE Fields" order matches the UX users requested:
    // "the form creator wizard mode should add wizard pages tab before the
    // fields tab. Once user adds pages, it should introduce separate tab per
    // page to take the field info" — the per-page editing step is delegated to
    // the drag-drop VisualFormBuilder once the skeleton is created.
    create_form: {
      title:        "Form Builder",
      description:  "Design a new form — no code required. The form will be live instantly, rendered by the same engine you are using now.",
      version:      "1.0.0",
      form_state:   "active",
      layout:       { type: "wizard" },
      submit_label: "Create Form",
      draft_label:  "Save Draft",
      on_submit: {
        type:            "rest",
        url:             "/api/create-form",
        method:          "POST",
        success_message: "🎉 Your form is ready! Redirecting you now…",
        error_message:   "Could not create the form. Please check your input and try again.",
      },
      pages: [
        // ── Page 1 ── Identity ─────────────────────────────────────────────
        {
          id:    "identity",
          title: "Identity",
          description: "Give your form a name, ID, and layout style.",
          sections: [
            {
              id:    "identity_section",
              title: "Basic Information",
              fields: [
                {
                  id:          "form_title",
                  type:        "text",
                  label:       "Form Title",
                  required:    true,
                  placeholder: "e.g. Customer Onboarding",
                  hint:        "Shown as the heading on the rendered form.",
                  max_length:  120,
                },
                {
                  id:             "form_id",
                  type:           "text",
                  label:          "Form ID",
                  required:       true,
                  width:          "half",
                  placeholder:    "e.g. customer_onboarding",
                  hint:           "Lowercase, underscores only. Used in URLs.",
                  pattern:        "^[a-z][a-z0-9_]*$",
                  pattern_message:"Only lowercase letters, numbers, and underscores allowed.",
                  max_length:     60,
                },
                {
                  id:             "manifest_id",
                  type:           "text",
                  label:          "Category / Manifest ID",
                  required:       true,
                  width:          "half",
                  placeholder:    "my_manifest",
                  hint:           "Groups related forms together.",
                  pattern:        "^[a-z][a-z0-9_]*$",
                  pattern_message:"Only lowercase letters, numbers, and underscores allowed.",
                },
                {
                  id:          "form_description",
                  type:        "multiline",
                  label:       "Description",
                  rows:        3,
                  max_length:  500,
                  placeholder: "Optional subtitle or instructions shown below the title.",
                  advanced:    true,
                },
                {
                  id:         "layout_type",
                  type:       "select",
                  label:      "Layout",
                  required:   true,
                  display_as: "button-group",
                  choices:    LAYOUT_TYPE_CHOICES,
                },
              ],
            },
            {
              id:    "labels_section",
              title: "Button Labels",
              description: "Customise the text on the action buttons.",
              fields: [
                {
                  id:          "submit_label",
                  type:        "text",
                  label:       "Submit Button",
                  width:       "half",
                  placeholder: "Submit",
                  default:     "Submit",
                  advanced:    true,
                },
                {
                  id:          "draft_label",
                  type:        "text",
                  label:       "Draft Button",
                  width:       "half",
                  placeholder: "Save Draft",
                  default:     "Save Draft",
                  advanced:    true,
                },
              ],
            },
          ],
        },

        // ── Page 2 ── Wizard Pages ─────────────────────────────────────────
        // Visible ONLY when layout_type = "wizard". Always appears BEFORE the
        // Fields tab so the user defines structure first.
        {
          id:          "wizard_pages_page",
          title:       "Wizard Pages",
          description: "Define each step of your wizard. You'll add fields to each page on the next step (or in the visual builder afterwards).",
          condition:   eq("layout_type", "wizard"),
          sections: [
            {
              id:          "pages_section",
              title:       "Pages",
              description: "Each page becomes a step in the wizard. Reorder with the ▲▼ arrows.",
              collection: {
                min_items:           1,
                max_items:           10,
                add_label:           "+ Add Page",
                remove_label:        "Remove",
                sortable:            true,
                default_expanded:    true,
                item_title_template: "{{fields.page_title}}",
              },
              fields: [
                {
                  id:             "page_id",
                  type:           "text",
                  label:          "Page ID",
                  required:       true,
                  width:          "half",
                  placeholder:    "e.g. personal_info",
                  pattern:        "^[a-z][a-z0-9_]*$",
                  pattern_message:"Lowercase, underscores only.",
                },
                {
                  id:          "page_title",
                  type:        "text",
                  label:       "Page Title",
                  required:    true,
                  width:       "half",
                  placeholder: "e.g. Personal Information",
                },
                {
                  id:          "page_description",
                  type:        "text",
                  label:       "Description",
                  placeholder: "Optional description shown under the page title.",
                  advanced:    true,
                },
                {
                  id:          "page_fields",
                  type:        "text",
                  label:       "Field IDs on this page",
                  placeholder: "first_name, last_name, email",
                  hint:        "Comma-separated. Leave blank for now — you can assign fields to pages in the visual builder.",
                  advanced:    true,
                },
                {
                  id:         "page_icon",
                  type:       "select",
                  label:      "Step Icon",
                  display_as: "dropdown",
                  advanced:   true,
                  choices: [
                    { value: "",          label: "None" },
                    { value: "User",      label: "👤 User" },
                    { value: "Briefcase", label: "💼 Briefcase" },
                    { value: "Heart",     label: "❤ Heart" },
                    { value: "Lock",      label: "🔒 Lock" },
                    { value: "Settings",  label: "⚙ Settings" },
                    { value: "Star",      label: "⭐ Star" },
                    { value: "Mail",      label: "✉ Mail" },
                  ],
                },
              ],
            },
          ],
        },

        // ── Page 3 ── Form Fields ──────────────────────────────────────────
        // Always visible. For wizard layouts, this is the flat fields list —
        // the per-page tabs view is provided by the VisualFormBuilder after
        // the skeleton is created.
        {
          id:          "fields_page",
          title:       "Form Fields",
          description: "Add the fields that will appear on your form. After creation you can switch to the visual builder for per-page tab editing.",
          sections: [
            {
              id:          "fields_section",
              title:       "Fields",
              description: "Add at least one field. Reorder with the ▲▼ arrows.",
              collection: {
                min_items:           1,
                max_items:           40,
                add_label:           "+ Add Field",
                remove_label:        "Remove",
                sortable:            true,
                default_expanded:    true,
                item_title_template: "{{fields.field_label}} ({{fields.field_type}})",
              },
              fields: [
                {
                  id:             "field_id",
                  type:           "text",
                  label:          "Field ID",
                  required:       true,
                  width:          "half",
                  placeholder:    "e.g. first_name",
                  pattern:        "^[a-z][a-z0-9_]*$",
                  pattern_message:"Lowercase, underscores only.",
                  max_length:     60,
                },
                {
                  id:         "field_type",
                  type:       "select",
                  label:      "Type",
                  required:   true,
                  width:      "half",
                  display_as: "dropdown",
                  choices:    FIELD_TYPE_CHOICES,
                },
                {
                  id:          "field_label",
                  type:        "text",
                  label:       "Label",
                  required:    true,
                  placeholder: "e.g. First Name",
                  max_length:  80,
                },
                {
                  id:         "field_required",
                  type:       "boolean",
                  label:      "Required",
                  display_as: "checkbox",
                  default:    false,
                },
                {
                  id:          "field_choices",
                  type:        "multiline",
                  label:       "Options (one per line, format: value|Label)",
                  rows:        4,
                  max_length:  2000,
                  placeholder: "yes|Yes\nno|No\nmaybe|Maybe",
                  hint:        "Each line: value|Display Label. Value is stored, label is shown.",
                  condition:   inSet("field_type", ["select", "multiselect"]),
                },
                {
                  id:         "field_width",
                  type:       "select",
                  label:      "Width",
                  display_as: "button-group",
                  default:    "full",
                  advanced:   true,
                  choices:    WIDTH_CHOICES,
                },
                {
                  id:          "field_placeholder",
                  type:        "text",
                  label:       "Placeholder",
                  max_length:  120,
                  placeholder: "Placeholder text shown when empty",
                  advanced:    true,
                },
                {
                  id:          "field_hint",
                  type:        "text",
                  label:       "Hint",
                  max_length:  200,
                  placeholder: "Helper text shown below the field",
                  advanced:    true,
                },
                {
                  id:          "field_default",
                  type:        "text",
                  label:       "Default Value",
                  max_length:  200,
                  placeholder: "Pre-filled value",
                  advanced:    true,
                },
              ],
            },
          ],
        },

        // ── Page 4 ── Submission ───────────────────────────────────────────
        {
          id:          "submission_page",
          title:       "Submission",
          description: "Configure what happens when the user submits the form.",
          sections: [
            {
              id:    "submit_section",
              title: "Submit Action",
              fields: [
                {
                  id:         "submit_type",
                  type:       "select",
                  label:      "On Submit",
                  required:   true,
                  display_as: "radio",
                  choices: [
                    { value: "none", label: "Show success message only" },
                    { value: "rest", label: "POST to a REST endpoint" },
                  ],
                },
                {
                  id:          "submit_url",
                  type:        "text",
                  label:       "Endpoint URL",
                  required:    true,
                  placeholder: "https://api.example.com/submissions",
                  hint:        "The form data will be sent as a JSON POST body.",
                  condition:   eq("submit_type", "rest"),
                },
                {
                  id:         "success_message",
                  type:       "text",
                  label:      "Success Message",
                  default:    "Form submitted successfully!",
                  max_length: 300,
                },
                {
                  id:         "error_message",
                  type:       "text",
                  label:      "Error Message",
                  default:    "Submission failed. Please try again.",
                  max_length: 300,
                  advanced:   true,
                },
              ],
            },
          ],
        },
      ],
    },

    // ── wizard_page_editor ─────────────────────────────────────────────────
    // Add or rename a wizard page.
    wizard_page_editor: {
      title:        "Wizard Page",
      version:      "1.0.0",
      form_state:   "active",
      layout:       { type: "single-page" },
      submit_label: "Save Page",
      sections: [
        {
          id:    "page_meta",
          title: "Page",
          fields: [
            {
              id:          "page_id",
              type:        "text",
              label:       "Page ID",
              required:    true,
              placeholder: "step_1",
              hint:        "snake_case — unique within the form",
              width:       "half",
            },
            {
              id:          "page_title",
              type:        "text",
              label:       "Page Title",
              required:    true,
              placeholder: "Basic Information",
              width:       "half",
            },
            {
              id:          "page_description",
              type:        "multiline",
              label:       "Page Description",
              placeholder: "Shown as a subtitle under the page heading",
              rows:        2,
            },
          ],
        },
      ],
    },

    // ── section_editor ─────────────────────────────────────────────────────
    // Add or edit a section within a form (or wizard page).
    // Includes a "Repeatable" toggle that reveals collection configuration —
    // this is what enables the "Add Item" button for complex types like
    // permissions[] and sub_roles[].
    section_editor: {
      title:        "Section",
      version:      "1.0.0",
      form_state:   "active",
      layout:       { type: "single-page" },
      submit_label: "Save Section",
      sections: [
        {
          id:    "meta",
          title: "Identity",
          fields: [
            {
              id:          "section_id",
              type:        "text",
              label:       "Section ID",
              required:    true,
              placeholder: "my_section",
              hint:        "snake_case — unique within the form",
              width:       "half",
            },
            {
              id:          "section_title",
              type:        "text",
              label:       "Title",
              placeholder: "My Section",
              width:       "half",
            },
            {
              id:          "section_description",
              type:        "multiline",
              label:       "Description",
              placeholder: "Optional helper text shown above the fields",
              rows:        2,
            },
            {
              id:          "bind_prefix",
              type:        "text",
              label:       "Bind Prefix",
              placeholder: "optional.path",
              hint:        "All field IDs in this section will be nested under this path",
              width:       "half",
            },
          ],
        },

        // ── Repeatable section (Collection) ─────────────────────────────────
        // This section enables the "Add Item" button for complex list types
        {
          id:    "collection_config",
          title: "Repeatable Section",
          description: "Turn this section into a dynamic list. Users can add, remove and re-order entries. Use this for complex types like permissions, sub-roles, addresses, line-items, etc.",
          fields: [
            {
              id:         "is_collection",
              type:       "boolean",
              label:      "Make this section repeatable",
              display_as: "switch",
            },
            // ── The fields below only show when is_collection = true ─────────
            {
              id:          "add_label",
              type:        "text",
              label:       "Add button label",
              placeholder: "Add Item",
              width:       "half",
              condition:   eq("is_collection", true),
            },
            {
              id:          "remove_label",
              type:        "text",
              label:       "Remove button label",
              placeholder: "Remove",
              width:       "half",
              condition:   eq("is_collection", true),
            },
            {
              id:          "min_items",
              type:        "number",
              label:       "Minimum items",
              placeholder: "0",
              min:         0,
              display_as:  "input",
              width:       "third",
              condition:   eq("is_collection", true),
            },
            {
              id:          "max_items",
              type:        "number",
              label:       "Maximum items",
              placeholder: "unlimited",
              min:         1,
              display_as:  "input",
              width:       "third",
              condition:   eq("is_collection", true),
            },
            {
              id:         "sortable",
              type:       "boolean",
              label:      "Allow reordering",
              display_as: "switch",
              width:      "third",
              condition:  eq("is_collection", true),
            },
            {
              id:          "item_title_template",
              type:        "text",
              label:       "Item title template",
              placeholder: "{{index}}. {{fields.name}}",
              hint:        "Handlebars template used as the collapsed item header",
              condition:   eq("is_collection", true),
            },
          ],
        },
      ],
    },

    // ── field_editor ───────────────────────────────────────────────────────
    // The core field editor. Field-type selection dynamically branches —
    // only the config relevant to the chosen type is shown.
    field_editor: {
      title:        "Field",
      version:      "1.0.0",
      form_state:   "active",
      layout:       { type: "single-page" },
      submit_label: "Save Field",
      sections: [

        // ── 1. Core identity (always shown) ──────────────────────────────────
        {
          id:    "core",
          title: "Field",
          fields: [
            {
              id:          "field_id",
              type:        "text",
              label:       "Field ID",
              required:    true,
              placeholder: "my_field",
              hint:        "snake_case — must be unique within the section",
              width:       "half",
            },
            {
              id:          "label",
              type:        "text",
              label:       "Label",
              required:    true,
              placeholder: "My Field",
              width:       "half",
            },
            // ── TYPE SELECTOR — the branching pivot ────────────────────────
            {
              id:         "field_type",
              type:       "select",
              label:      "Field Type",
              required:   true,
              choices:    FIELD_TYPE_CHOICES,
              display_as: "dropdown",
            },
            {
              id:         "width",
              type:       "select",
              label:      "Width",
              choices:    WIDTH_CHOICES,
              display_as: "button-group",
            },
            {
              id:         "required",
              type:       "boolean",
              label:      "Required",
              display_as: "switch",
              width:      "half",
            },
            {
              id:         "advanced",
              type:       "boolean",
              label:      "Advanced / Pro field",
              display_as: "switch",
              width:      "half",
            },
          ],
        },

        // ── 2. Text / Multiline ────────────────────────────────────────────
        {
          id:    "text_config",
          title: "Text Options",
          condition: inSet("field_type", TEXT_TYPES),
          fields: [
            {
              id:          "placeholder",
              type:        "text",
              label:       "Placeholder",
              placeholder: "Enter value…",
            },
            {
              id:          "hint",
              type:        "text",
              label:       "Hint / helper text",
              placeholder: "Shown below the field",
            },
            {
              id:         "display_as",
              type:       "select",
              label:      "Display as",
              choices:    TEXT_DISPLAY_CHOICES,
              display_as: "dropdown",
              condition:  eq("field_type", "text"),
            },
            {
              id:          "rows",
              type:        "number",
              label:       "Rows",
              min:         2,
              max:         20,
              display_as:  "stepper",
              width:       "third",
              condition:   eq("field_type", "multiline"),
            },
          ],
        },

        // ── 3. Text validation ─────────────────────────────────────────────
        {
          id:    "text_validation",
          title: "Text Validation",
          condition: inSet("field_type", LENGTH_TYPES),
          fields: [
            {
              id:        "min_length",
              type:      "number",
              label:     "Min length",
              min:       0,
              display_as:"input",
              width:     "third",
            },
            {
              id:        "max_length",
              type:      "number",
              label:     "Max length",
              min:       1,
              display_as:"input",
              width:     "third",
            },
            {
              id:          "pattern",
              type:        "text",
              label:       "Pattern (regex)",
              placeholder: "^[A-Z]{2}[0-9]+$",
              hint:        "JavaScript RegExp — applied on blur",
            },
            {
              id:          "pattern_message",
              type:        "text",
              label:       "Pattern error message",
              placeholder: "Invalid format",
            },
          ],
        },

        // ── 4. Number ─────────────────────────────────────────────────────
        {
          id:    "number_config",
          title: "Number Options",
          condition: inSet("field_type", NUMBER_TYPES),
          fields: [
            {
              id:         "display_as",
              type:       "select",
              label:      "Display as",
              choices:    NUMBER_DISPLAY_CHOICES,
              display_as: "button-group",
            },
            {
              id:        "min",
              type:      "number",
              label:     "Minimum",
              display_as:"input",
              width:     "third",
            },
            {
              id:        "max",
              type:      "number",
              label:     "Maximum",
              display_as:"input",
              width:     "third",
            },
            {
              id:        "decimal_places",
              type:      "number",
              label:     "Decimal places",
              min:       0,
              max:       10,
              display_as:"stepper",
              width:     "third",
            },
            {
              id:          "prefix",
              type:        "text",
              label:       "Prefix",
              placeholder: "$",
              width:       "half",
            },
            {
              id:          "suffix",
              type:        "text",
              label:       "Suffix",
              placeholder: "kg",
              width:       "half",
            },
          ],
        },

        // ── 5. Boolean ────────────────────────────────────────────────────
        {
          id:    "boolean_config",
          title: "Toggle Options",
          condition: inSet("field_type", BOOL_TYPES),
          fields: [
            {
              id:         "display_as",
              type:       "select",
              label:      "Display as",
              choices:    BOOL_DISPLAY_CHOICES,
              display_as: "button-group",
            },
          ],
        },

        // ── 6. Select / Multiselect — static choices ──────────────────────
        {
          id:    "choices_static",
          title: "Choices",
          condition: inSet("field_type", CHOICE_TYPES),
          description: "Define the options the user can pick from. For a live data source see the Dynamic tab below.",
          // This section is itself a collection so users can add N choices
          collection: {
            add_label:    "Add Choice",
            remove_label: "Remove",
            item_title_template: "{{fields.choice_label}}",
            sortable: true,
          },
          fields: [
            {
              id:          "choice_value",
              type:        "text",
              label:       "Value (stored)",
              placeholder: "opt_1",
              width:       "half",
            },
            {
              id:          "choice_label",
              type:        "text",
              label:       "Label (displayed)",
              placeholder: "Option 1",
              width:       "half",
            },
          ],
        },

        // ── 7. Select display options ─────────────────────────────────────
        {
          id:    "select_display",
          title: "Select Display",
          condition: inSet("field_type", CHOICE_TYPES),
          fields: [
            {
              id:         "display_as",
              type:       "select",
              label:      "Display as (single select)",
              choices:    SELECT_DISPLAY_CHOICES,
              display_as: "dropdown",
              condition:  eq("field_type", "select"),
            },
            {
              id:         "display_as",
              type:       "select",
              label:      "Display as (multiselect)",
              choices:    MULTISELECT_DISPLAY_CHOICES,
              display_as: "dropdown",
              condition:  eq("field_type", "multiselect"),
            },
            {
              id:        "min_selected",
              type:      "number",
              label:     "Min selected",
              min:       0,
              display_as:"input",
              width:     "third",
              condition: eq("field_type", "multiselect"),
            },
            {
              id:        "max_selected",
              type:      "number",
              label:     "Max selected",
              min:       1,
              display_as:"input",
              width:     "third",
              condition: eq("field_type", "multiselect"),
            },
          ],
        },

        // ── 8. Date / DateTime / DateRange ────────────────────────────────
        {
          id:    "date_config",
          title: "Date Options",
          condition: inSet("field_type", DATE_TYPES),
          fields: [
            {
              id:         "use_current",
              type:       "boolean",
              label:      "Default to current date",
              display_as: "switch",
              width:      "half",
            },
            {
              id:         "disable_weekends",
              type:       "boolean",
              label:      "Disable weekends",
              display_as: "switch",
              width:      "half",
            },
            {
              id:          "min_date",
              type:        "text",
              label:       "Min date",
              placeholder: "YYYY-MM-DD",
              width:       "half",
            },
            {
              id:          "max_date",
              type:        "text",
              label:       "Max date",
              placeholder: "YYYY-MM-DD",
              width:       "half",
            },
          ],
        },

        // ── 9. Time ───────────────────────────────────────────────────────
        {
          id:    "time_config",
          title: "Time Options",
          condition: eq("field_type", "time"),
          fields: [
            {
              id:          "min_time",
              type:        "text",
              label:       "Earliest time",
              placeholder: "09:00",
              width:       "half",
            },
            {
              id:          "max_time",
              type:        "text",
              label:       "Latest time",
              placeholder: "18:00",
              width:       "half",
            },
          ],
        },

        // ── 10. Rating ────────────────────────────────────────────────────
        {
          id:    "rating_config",
          title: "Rating Options",
          condition: eq("field_type", "rating"),
          fields: [
            {
              id:         "display_as",
              type:       "select",
              label:      "Style",
              choices:    RATING_DISPLAY_CHOICES,
              display_as: "button-group",
            },
            {
              id:        "max",
              type:      "number",
              label:     "Max value",
              min:       2,
              max:       10,
              display_as:"stepper",
              width:     "third",
            },
          ],
        },

        // ── 11. File ──────────────────────────────────────────────────────
        {
          id:    "file_config",
          title: "File Upload Options",
          condition: eq("field_type", "file"),
          fields: [
            {
              id:          "accept",
              type:        "text",
              label:       "Accepted types (MIME / extension)",
              placeholder: ".pdf,image/*",
              hint:        "Comma-separated — e.g. .pdf, image/*, .docx",
            },
            {
              id:        "max_files",
              type:      "number",
              label:     "Max files",
              min:       1,
              display_as:"stepper",
              width:     "third",
            },
            {
              id:        "max_size_mb",
              type:      "number",
              label:     "Max size (MB)",
              min:       1,
              display_as:"input",
              width:     "third",
            },
          ],
        },

        // ── 12. Colour ────────────────────────────────────────────────────
        {
          id:    "color_config",
          title: "Colour Options",
          condition: eq("field_type", "color"),
          fields: [
            {
              id:         "format",
              type:       "select",
              label:      "Colour format",
              choices:    COLOR_FORMAT_CHOICES,
              display_as: "button-group",
            },
          ],
        },

        // ── 13. Hidden field ──────────────────────────────────────────────
        {
          id:    "hidden_config",
          title: "Hidden Field Options",
          condition: eq("field_type", "hidden"),
          fields: [
            {
              id:         "value_from",
              type:       "select",
              label:      "Populate value from",
              choices:    HIDDEN_VALUE_FROM_CHOICES,
              display_as: "dropdown",
            },
            {
              id:          "context_key",
              type:        "text",
              label:       "Context key path",
              placeholder: "user.id",
              hint:        "Dot-separated path into the form context object",
              condition:   eq("value_from", "context"),
            },
            {
              id:          "query_param",
              type:        "text",
              label:       "Query parameter name",
              placeholder: "ref",
              condition:   eq("value_from", "query-param"),
            },
            {
              id:          "computed_expression",
              type:        "text",
              label:       "Computed expression",
              placeholder: "answers.first_name + ' ' + answers.last_name",
              condition:   eq("value_from", "computed"),
            },
            {
              id:          "default_value",
              type:        "text",
              label:       "Default value",
              condition:   eq("value_from", "default"),
            },
          ],
        },

        // ── 14. JSON field ────────────────────────────────────────────────
        // Deliberately minimal — we nudge users toward repeatable sections
        {
          id:          "json_config",
          title:       "JSON Field Options",
          description: "💡 For structured lists (permissions, sub-roles, addresses…) use a Repeatable Section instead — it renders a proper form per item with an Add / Remove button.",
          condition:   eq("field_type", "json"),
          fields: [
            {
              id:        "rows",
              type:      "number",
              label:     "Editor rows",
              min:       2,
              max:       30,
              display_as:"stepper",
              width:     "third",
            },
          ],
        },

        // ── 15. Visibility condition ──────────────────────────────────────
        {
          id:          "visibility",
          title:       "Visibility Condition",
          description: "Show this field only when another field has a specific value.",
          fields: [
            {
              id:         "has_condition",
              type:       "boolean",
              label:      "Conditionally visible",
              display_as: "switch",
            },
            {
              id:          "condition_field",
              type:        "text",
              label:       "When field",
              placeholder: "other_field_id",
              width:       "third",
              condition:   eq("has_condition", true),
            },
            {
              id:         "condition_op",
              type:       "select",
              label:      "Operator",
              choices:    CONDITION_OP_CHOICES,
              display_as: "dropdown",
              width:      "third",
              condition:  eq("has_condition", true),
            },
            {
              id:          "condition_value",
              type:        "text",
              label:       "Value",
              placeholder: "expected_value",
              width:       "third",
              condition:   { all: [eq("has_condition", true), neq("condition_op", "is_empty"), neq("condition_op", "is_not_empty"), neq("condition_op", "is_true"), neq("condition_op", "is_false")] },
            },
          ],
        },

      ],
    }, // end field_editor

    // ── uam_role_editor ────────────────────────────────────────────────────
    // Create / edit a UAM Role.
    // Permissions and sub-roles are repeatable sections with Add buttons —
    // they never fall back to raw JSON.
    uam_role_editor: {
      title:        "UAM Role",
      version:      "1.0.0",
      form_state:   "active",
      layout:       { type: "wizard" },
      submit_label: "Save Role",
      pages: [
        // ── Page 1: Role identity ─────────────────────────────────────────
        {
          id:    "identity",
          title: "Identity",
          sections: [
            {
              id:    "role_meta",
              title: "Role Details",
              fields: [
                {
                  id:          "role_id",
                  type:        "text",
                  label:       "Role ID",
                  required:    true,
                  placeholder: "editor",
                  hint:        "snake_case — e.g. content_editor, billing_admin",
                  width:       "half",
                },
                {
                  id:          "role_name",
                  type:        "text",
                  label:       "Display Name",
                  required:    true,
                  placeholder: "Content Editor",
                  width:       "half",
                },
                {
                  id:          "description",
                  type:        "multiline",
                  label:       "Description",
                  placeholder: "What can users with this role do?",
                  rows:        3,
                },
                {
                  id:         "is_system",
                  type:       "boolean",
                  label:      "System role (not user-assignable)",
                  display_as: "switch",
                  width:      "half",
                },
                {
                  id:         "is_default",
                  type:       "boolean",
                  label:      "Assign to new users by default",
                  display_as: "switch",
                  width:      "half",
                },
              ],
            },
          ],
        },

        // ── Page 2: Permissions ───────────────────────────────────────────
        {
          id:    "permissions",
          title: "Permissions",
          sections: [
            {
              id:    "permissions_list",
              title: "Permissions",
              description: "Define what this role can do. Each permission is a resource + action pair.",
              // ← THIS is what renders the "Add Permission" button
              collection: {
                add_label:            "Add Permission",
                remove_label:         "Remove",
                item_title_template:  "{{fields.resource}}:{{fields.action}}",
                sortable:             false,
                default_expanded:     true,
              },
              fields: [
                {
                  id:          "resource",
                  type:        "text",
                  label:       "Resource",
                  required:    true,
                  placeholder: "documents",
                  hint:        "The entity or namespace, e.g. documents, users, billing",
                  width:       "half",
                },
                {
                  id:         "action",
                  type:       "select",
                  label:      "Action",
                  required:   true,
                  width:      "half",
                  choices: [
                    { value: "*",      label: "* — all actions" },
                    { value: "read",   label: "read" },
                    { value: "write",  label: "write" },
                    { value: "create", label: "create" },
                    { value: "update", label: "update" },
                    { value: "delete", label: "delete" },
                    { value: "share",  label: "share" },
                    { value: "admin",  label: "admin" },
                  ],
                  display_as: "dropdown",
                },
                {
                  id:         "effect",
                  type:       "select",
                  label:      "Effect",
                  width:      "third",
                  choices: [
                    { value: "allow", label: "✅ Allow" },
                    { value: "deny",  label: "🚫 Deny" },
                  ],
                  display_as: "button-group",
                },
                {
                  id:          "scope",
                  type:        "text",
                  label:       "Scope / condition",
                  placeholder: "own_records",
                  hint:        "Optional — limits when the rule applies",
                  width:       "half",
                },
              ],
            },
          ],
        },

        // ── Page 3: Sub-roles ─────────────────────────────────────────────
        {
          id:    "sub_roles",
          title: "Sub-Roles",
          sections: [
            {
              id:    "sub_roles_list",
              title: "Sub-Roles",
              description: "Sub-roles this role inherits from. Permissions from sub-roles are merged in.",
              // ← THIS renders the "Add Sub-Role" button
              collection: {
                add_label:           "Add Sub-Role",
                remove_label:        "Remove",
                item_title_template: "{{fields.sub_role_id}}",
                sortable:            true,
              },
              fields: [
                {
                  id:          "sub_role_id",
                  type:        "text",
                  label:       "Sub-Role ID",
                  required:    true,
                  placeholder: "viewer",
                  hint:        "Must match an existing role ID",
                  width:       "half",
                },
                {
                  id:          "sub_role_label",
                  type:        "text",
                  label:       "Display Label",
                  placeholder: "Viewer",
                  width:       "half",
                },
                {
                  id:         "override",
                  type:       "boolean",
                  label:      "Allow this role to override sub-role denies",
                  display_as: "switch",
                },
              ],
            },
          ],
        },

        // ── Page 4: Metadata ──────────────────────────────────────────────
        {
          id:    "metadata",
          title: "Metadata",
          sections: [
            {
              id:    "role_tags",
              title: "Tags",
              description: "Optional tags for grouping and filtering roles.",
              collection: {
                add_label:           "Add Tag",
                remove_label:        "Remove",
                item_title_template: "{{fields.tag}}",
              },
              fields: [
                {
                  id:          "tag",
                  type:        "text",
                  label:       "Tag",
                  required:    true,
                  placeholder: "finance",
                  width:       "full",
                },
              ],
            },
            {
              id:    "role_audit",
              title: "Audit",
              fields: [
                {
                  id:          "owner",
                  type:        "text",
                  label:       "Owner",
                  placeholder: "team@company.com",
                  width:       "half",
                },
                {
                  id:         "expires_at",
                  type:       "date",
                  label:      "Expires on",
                  width:      "half",
                },
              ],
            },
          ],
        },
      ],
    }, // end uam_role_editor

    // ── uam_permission_editor ──────────────────────────────────────────────
    // Standalone form to define a single permission — used when a permission
    // is opened as a sub-form rather than inside a collection row.
    uam_permission_editor: {
      title:        "Permission",
      version:      "1.0.0",
      form_state:   "active",
      layout:       { type: "single-page" },
      submit_label: "Save Permission",
      sections: [
        {
          id:    "permission_fields",
          title: "Permission",
          fields: [
            {
              id:          "resource",
              type:        "text",
              label:       "Resource",
              required:    true,
              placeholder: "documents",
              hint:        "The entity or API namespace this permission applies to",
              width:       "half",
            },
            {
              id:         "action",
              type:       "select",
              label:      "Action",
              required:   true,
              width:      "half",
              choices: [
                { value: "*",      label: "* — all actions" },
                { value: "read",   label: "read" },
                { value: "write",  label: "write" },
                { value: "create", label: "create" },
                { value: "update", label: "update" },
                { value: "delete", label: "delete" },
                { value: "share",  label: "share" },
                { value: "admin",  label: "admin" },
              ],
              display_as: "dropdown",
            },
            {
              id:         "effect",
              type:       "select",
              label:      "Effect",
              choices: [
                { value: "allow", label: "✅ Allow" },
                { value: "deny",  label: "🚫 Deny" },
              ],
              display_as: "button-group",
              width:      "half",
            },
            {
              id:          "scope",
              type:        "text",
              label:       "Scope / condition",
              placeholder: "own_records",
              hint:        "Optional — limits when the rule applies",
              width:       "half",
            },
          ],
        },
      ],
    },

  }, // end forms
} as unknown as FormManifest;
