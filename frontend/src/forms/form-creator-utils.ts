/**
 * form-creator-utils.ts
 *
 * Shared helpers for building a FormDef / FormManifest skeleton from the answers
 * collected by the form_creator FormEngine flow.
 *
 * Used by:
 *   • VisualUIBuilder → FormComponentPanel (wizard mode)
 *   • Any future client-side form creator flow that needs to materialise a
 *     skeleton before handing off to the drag-drop builder.
 *
 * The backend (`/api/create-form`) implements its own (overlapping) builder
 * because it does full validation + persistence. This file is the client-side
 * mirror that produces a FormManifest in-memory without round-tripping the
 * server.
 */

import type {
  FormManifest,
  FormDef,
  Page,
  Section,
  FormField,
  FieldAnswers,
} from "@form-engine/libs/types";

// ─── Identifier slug ──────────────────────────────────────────────────────────
export function slugify(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

// ─── Field item (one row of the fields_section collection) ────────────────────
type FieldItem = {
  field_id?: string;
  field_type?: string;
  field_label?: string;
  field_required?: boolean;
  field_width?: "full" | "half" | "third";
  field_placeholder?: string;
  field_hint?: string;
  field_default?: unknown;
  field_choices?: string;     // "value|Label" one per line
  field_min_length?: number;
  field_max_length?: number;
  field_min?: number;
  field_max?: number;
  field_pattern?: string;
  field_pattern_message?: string;
};

// ─── Page item (one row of the pages_section collection) ──────────────────────
type PageItem = {
  page_id?: string;
  page_title?: string;
  page_description?: string;
  page_icon?: string;
  page_fields?: string;       // comma-separated field IDs
};

const ID_RE = /^[a-z][a-z0-9_]*$/;

function parseChoices(raw: unknown): Array<{ value: string; label: string }> {
  const s = String(raw ?? "").trim();
  if (!s) return [{ value: "option_1", label: "Option 1" }, { value: "option_2", label: "Option 2" }];
  const out: Array<{ value: string; label: string }> = [];
  for (const line of s.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.includes("|")) {
      const [v, l] = t.split("|", 2);
      out.push({ value: v.trim(), label: l.trim() });
    } else {
      out.push({ value: t.toLowerCase().replace(/\s+/g, "_"), label: t });
    }
  }
  return out.length ? out : [{ value: "option_1", label: "Option 1" }];
}

function buildField(item: FieldItem): FormField | null {
  const id    = String(item.field_id ?? "").trim();
  const type  = String(item.field_type ?? "text").trim();
  const label = String(item.field_label ?? id).trim();

  if (!id || !ID_RE.test(id)) return null;

  const f: Record<string, unknown> = { id, type, label };
  if (item.field_required) f.required = true;
  if (item.field_width && item.field_width !== "full") f.width = item.field_width;
  if (item.field_placeholder) f.placeholder = String(item.field_placeholder);
  if (item.field_hint)        f.hint        = String(item.field_hint);
  if (item.field_default !== undefined && item.field_default !== "" && item.field_default !== null) {
    f.default = item.field_default;
  }

  if (type === "text" || type === "multiline") {
    if (item.field_min_length != null) f.min_length = Number(item.field_min_length);
    if (item.field_max_length != null) f.max_length = Number(item.field_max_length);
    if (type === "text") {
      if (item.field_pattern) {
        f.pattern = String(item.field_pattern);
        if (item.field_pattern_message) f.pattern_message = String(item.field_pattern_message);
      }
    }
  } else if (type === "number") {
    if (item.field_min != null) f.min = Number(item.field_min);
    if (item.field_max != null) f.max = Number(item.field_max);
  } else if (type === "select" || type === "multiselect") {
    f.choices = parseChoices(item.field_choices);
    f.display_as = type === "select" ? "auto" : "tag-input";
  }

  return f as unknown as FormField;
}

/**
 * Convert form_creator answers → FormManifest skeleton (single form).
 *
 * Behaviour:
 *  • For wizard layout: groups fields into pages using `page_fields` csv on
 *    each page item; unassigned fields land in a trailing "Other" page.
 *  • For non-wizard layout: all fields go into a single section.
 *  • If no fields are provided yet (creator only collected identity + pages),
 *    creates empty sections / placeholder per-page sections so the form
 *    skeleton is valid and downstream editors (VisualFormBuilder) can render.
 */
export function buildFormFromCreatorAnswers(
  answers: FieldAnswers,
  fallbackManifestId: string,
): { manifestId: string; formId: string; manifest: FormManifest } {
  const a = answers as Record<string, unknown>;

  const formId      = slugify(a.form_id ?? "") || `form_${Date.now()}`;
  const manifestId  = slugify(a.manifest_id ?? "") || slugify(fallbackManifestId) || "my_manifest";
  const title       = String(a.form_title ?? a.title ?? "New Form").trim() || "New Form";
  const description = a.form_description ? String(a.form_description) : undefined;
  const layoutType  = String(a.layout_type ?? "single-page") as "single-page" | "wizard" | "grid";

  // Build fields (if any were submitted via the form_creator's fields_section)
  const rawFields = Array.isArray(a.fields_section) ? (a.fields_section as FieldItem[]) : [];
  const fields    = rawFields.map(buildField).filter((f): f is FormField => f != null);
  const fieldMap  = new Map(fields.map(f => [f.id, f]));

  const form: FormDef = {
    title,
    description,
    version:      "1.0.0",
    form_state:   "active",
    layout:       { type: layoutType },
    submit_label: (a.submit_label ? String(a.submit_label) : undefined) || undefined,
    draft_label:  (a.draft_label  ? String(a.draft_label)  : undefined) || undefined,
  };

  if (layoutType === "wizard") {
    const rawPages = Array.isArray(a.pages_section) ? (a.pages_section as PageItem[]) : [];
    const assigned = new Set<string>();
    const pages: Page[] = [];

    rawPages.forEach((p, idx) => {
      const pid = (slugify(p.page_id) || `page_${idx + 1}`);
      const ptitle = String(p.page_title ?? pid).trim() || pid;
      const csv = String(p.page_fields ?? "").trim();
      const ids = csv ? csv.split(",").map(s => s.trim()).filter(id => fieldMap.has(id)) : [];
      ids.forEach(id => assigned.add(id));
      const pageFields = ids.map(id => fieldMap.get(id)!).filter(Boolean);

      const section: Section = {
        id:     `section_${pid}`,
        title:  "Fields",
        fields: pageFields, // may be empty — VisualFormBuilder will let the user add fields
      };
      const page: Page = { id: pid, title: ptitle, sections: [section] };
      if (p.page_description) page.description = String(p.page_description);
      if (p.page_icon)        page.icon        = String(p.page_icon);
      pages.push(page);
    });

    // Fields the user did NOT explicitly assign to a page — drop them in a catch-all page.
    const orphans = fields.filter(f => !assigned.has(f.id));
    if (orphans.length) {
      pages.push({
        id:    "other",
        title: "Other",
        sections: [{ id: "section_other", title: "Other fields", fields: orphans }],
      });
    }

    // Always make sure there is at least one page — otherwise VisualFormBuilder
    // shows an empty Pages overview which is confusing for new users.
    if (pages.length === 0) {
      pages.push({
        id:    "page_1",
        title: "Page 1",
        sections: [{ id: "section_page_1", title: "Fields", fields: [] }],
      });
    }
    form.pages = pages;
  } else {
    form.sections = [
      {
        id:     "main",
        title:  "Fields",
        fields,
      },
    ];
  }

  const manifest: FormManifest = {
    manifest_id:      manifestId,
    manifest_version: "1.0.0",
    forms: { [formId]: form },
  };

  return { manifestId, formId, manifest };
}
