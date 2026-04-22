"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { FormField, Section, Page, FormDef, FormManifest } from "@/lib/types";

// ─── Field type catalogue ─────────────────────────────────────────────────────
const FIELD_TYPES = [
  { type: "text",        icon: "T",  label: "Text",         group: "Basic" },
  { type: "multiline",   icon: "¶",  label: "Long Text",    group: "Basic" },
  { type: "number",      icon: "#",  label: "Number",       group: "Basic" },
  { type: "boolean",     icon: "☑",  label: "Toggle",       group: "Basic" },
  { type: "select",      icon: "▾",  label: "Select",       group: "Choice" },
  { type: "multiselect", icon: "☰",  label: "Multiselect",  group: "Choice" },
  { type: "date",        icon: "📅", label: "Date",         group: "Date/Time" },
  { type: "time",        icon: "🕐", label: "Time",         group: "Date/Time" },
  { type: "datetime",    icon: "🗓", label: "DateTime",     group: "Date/Time" },
  { type: "daterange",   icon: "↔",  label: "Date Range",   group: "Date/Time" },
  { type: "rating",      icon: "★",  label: "Rating",       group: "Rich" },
  { type: "file",        icon: "📎", label: "File Upload",  group: "Rich" },
  { type: "color",       icon: "🎨", label: "Color",        group: "Rich" },
  { type: "richtext",    icon: "✎",  label: "Rich Text",    group: "Rich" },
  { type: "signature",   icon: "✍",  label: "Signature",    group: "Rich" },
  { type: "hidden",      icon: "👁", label: "Hidden",       group: "Advanced" },
  { type: "json",        icon: "{}",  label: "JSON",        group: "Advanced" },
] as const;

const FIELD_GROUPS = ["Basic", "Choice", "Date/Time", "Rich", "Advanced"] as const;

// Default stubs for each field type
function makeDefaultField(type: string, index: number): FormField {
  const id = `${type}_${index}`;
  const base = { id, label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`, required: false, width: "full" as const };
  if (type === "select" || type === "multiselect") {
    return { ...base, type: type as "select", choices: [
      { value: "option_1", label: "Option 1" },
      { value: "option_2", label: "Option 2" },
    ] } as FormField;
  }
  if (type === "boolean") return { ...base, type: "boolean", display_as: "switch" };
  if (type === "number") return { ...base, type: "number", display_as: "input" };
  if (type === "rating") return { ...base, type: "rating", max: 5, display_as: "stars" };
  if (type === "file") return { ...base, type: "file", max_files: 1, max_size_mb: 10 };
  if (type === "hidden") return { ...base, type: "hidden", value_from: "default" };
  if (type === "date") return { ...base, type: "date" };
  if (type === "time") return { ...base, type: "time" };
  if (type === "datetime") return { ...base, type: "datetime" };
  if (type === "daterange") return { ...base, type: "daterange" };
  if (type === "color") return { ...base, type: "color", format: "hex" };
  if (type === "multiline") return { ...base, type: "multiline", rows: 4 };
  if (type === "richtext") return { ...base, type: "richtext" };
  if (type === "json") return { ...base, type: "json", rows: 8 };
  if (type === "signature") return { ...base, type: "signature" };
  return { ...base, type: "text" } as FormField;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface VisualBuilderProps {
  manifest: FormManifest;
  formId: string;
  onChange: (updated: FormManifest) => void;
}

export function VisualFormBuilder({ manifest, formId, onChange }: VisualBuilderProps) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [fieldCounter, setFieldCounter] = useState(100);

  const form = manifest.forms?.[formId];
  if (!form) return <div className="p-8 text-gray-400">Form not found.</div>;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const updateForm = useCallback((updater: (f: FormDef) => FormDef) => {
    const updated = { ...manifest, forms: { ...manifest.forms, [formId]: updater(form) } };
    onChange(updated);
  }, [manifest, formId, form, onChange]);

  const getPages = (): Page[] => form.pages ?? [];
  const getSections = (pageId?: string): Section[] => {
    if (form.pages) return getPages().find(p => p.id === pageId)?.sections ?? [];
    return form.sections ?? [];
  };

  const activePage = form.pages ? (selectedPageId ?? getPages()[0]?.id ?? null) : null;
  const sections = getSections(activePage ?? undefined);
  const selectedField = sections.flatMap(s => s.fields ?? []).find(f => f.id === selectedFieldId) ?? null;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const addField = (type: string, sectionIndex: number) => {
    const idx = fieldCounter;
    setFieldCounter(c => c + 1);
    const field = makeDefaultField(type, idx);
    updateForm(f => {
      if (f.pages) {
        return {
          ...f, pages: f.pages.map(p => p.id === activePage ? {
            ...p, sections: p.sections.map((s, si) => si === sectionIndex
              ? { ...s, fields: [...(s.fields ?? []), field] }
              : s
            )
          } : p)
        };
      }
      return {
        ...f, sections: (f.sections ?? []).map((s, si) => si === sectionIndex
          ? { ...s, fields: [...(s.fields ?? []), field] }
          : s
        )
      };
    });
    setSelectedFieldId(field.id);
  };

  const removeField = (fieldId: string, sectionIndex: number) => {
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
    updateForm(f => {
      const removeFn = (sections: Section[]) => sections.map((s, si) =>
        si === sectionIndex ? { ...s, fields: (s.fields ?? []).filter(f => f.id !== fieldId) } : s
      );
      if (f.pages) return { ...f, pages: f.pages.map(p => p.id === activePage ? { ...p, sections: removeFn(p.sections) } : p) };
      return { ...f, sections: removeFn(f.sections ?? []) };
    });
  };

  const updateField = (fieldId: string, patch: Partial<FormField>) => {
    updateForm(f => {
      const patchFn = (sections: Section[]) => sections.map(s => ({
        ...s, fields: (s.fields ?? []).map(field => field.id === fieldId ? { ...field, ...patch } as FormField : field)
      }));
      if (f.pages) return { ...f, pages: f.pages.map(p => ({ ...p, sections: patchFn(p.sections) })) };
      return { ...f, sections: patchFn(f.sections ?? []) };
    });
  };

  const addSection = () => {
    const s: Section = { id: `section_${fieldCounter}`, title: "New Section", fields: [] };
    setFieldCounter(c => c + 1);
    updateForm(f => {
      if (f.pages) return { ...f, pages: f.pages.map(p => p.id === activePage ? { ...p, sections: [...p.sections, s] } : p) };
      return { ...f, sections: [...(f.sections ?? []), s] };
    });
  };

  const addPage = () => {
    const p: Page = { id: `page_${fieldCounter}`, title: "New Page", sections: [{ id: `section_${fieldCounter + 1}`, fields: [] }] };
    setFieldCounter(c => c + 2);
    updateForm(f => ({ ...f, pages: [...(f.pages ?? []), p] }));
    setSelectedPageId(p.id);
  };

  const moveField = (fromIdx: number, toIdx: number, sectionIndex: number) => {
    updateForm(f => {
      const moveFn = (sections: Section[]) => sections.map((s, si) => {
        if (si !== sectionIndex) return s;
        const fields = [...(s.fields ?? [])];
        const [item] = fields.splice(fromIdx, 1);
        fields.splice(toIdx, 0, item);
        return { ...s, fields };
      });
      if (f.pages) return { ...f, pages: f.pages.map(p => p.id === activePage ? { ...p, sections: moveFn(p.sections) } : p) };
      return { ...f, sections: moveFn(f.sections ?? []) };
    });
  };

  return (
    <div className="flex h-full gap-0">
      {/* ── Left: Field palette ────────────────────────────────────────────── */}
      <div className="w-44 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
        <div className="px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Add Field</div>
        {FIELD_GROUPS.map(group => (
          <div key={group} className="mb-2">
            <div className="px-3 py-1 text-xs text-gray-400">{group}</div>
            {FIELD_TYPES.filter(f => f.group === group).map(ft => (
              <button
                key={ft.type}
                draggable
                onDragStart={e => e.dataTransfer.setData("fieldType", ft.type)}
                onClick={() => addField(ft.type, 0)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 text-gray-600 dark:text-gray-400 transition-colors cursor-grab"
              >
                <span className="w-5 text-center font-mono">{ft.icon}</span>
                {ft.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* ── Center: Canvas ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Page tabs for wizard forms */}
        {form.pages && (
          <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {getPages().map(p => (
              <button key={p.id} onClick={() => setSelectedPageId(p.id)}
                className={cn("px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors",
                  (activePage === p.id || (!activePage && getPages()[0]?.id === p.id))
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}>
                {p.title}
              </button>
            ))}
            <button onClick={addPage}
              className="px-3 py-1.5 text-xs rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 whitespace-nowrap">
              + Page
            </button>
          </div>
        )}

        {/* Sections */}
        <div className="p-4 space-y-4">
          {sections.map((section, sIdx) => (
            <SectionCanvas
              key={section.id ?? sIdx}
              section={section}
              sectionIndex={sIdx}
              selectedFieldId={selectedFieldId}
              dragOverId={dragOverId}
              onSelectField={setSelectedFieldId}
              onRemoveField={removeField}
              onMoveField={moveField}
              onDropFieldType={(type) => addField(type, sIdx)}
              onDragOverId={setDragOverId}
              onUpdateSectionTitle={(title) => {
                updateForm(f => {
                  const patch = (secs: Section[]) => secs.map((s, i) => i === sIdx ? { ...s, title } : s);
                  if (f.pages) return { ...f, pages: f.pages.map(p => p.id === activePage ? { ...p, sections: patch(p.sections) } : p) };
                  return { ...f, sections: patch(f.sections ?? []) };
                });
              }}
            />
          ))}

          <button onClick={addSection}
            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
            + Add Section
          </button>
        </div>
      </div>

      {/* ── Right: Field inspector ────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto">
        {selectedField ? (
          <FieldInspector
            field={selectedField}
            onChange={(patch) => updateField(selectedField.id, patch)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm px-4 text-center">
            <span className="text-3xl mb-2">←</span>
            Click a field to edit its properties
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Canvas ────────────────────────────────────────────────────────────
function SectionCanvas({ section, sectionIndex, selectedFieldId, dragOverId,
  onSelectField, onRemoveField, onMoveField, onDropFieldType, onDragOverId, onUpdateSectionTitle
}: {
  section: Section;
  sectionIndex: number;
  selectedFieldId: string | null;
  dragOverId: string | null;
  onSelectField: (id: string) => void;
  onRemoveField: (id: string, sIdx: number) => void;
  onMoveField: (from: number, to: number, sIdx: number) => void;
  onDropFieldType: (type: string) => void;
  onDragOverId: (id: string | null) => void;
  onUpdateSectionTitle: (title: string) => void;
}) {
  const fields = section.fields ?? [];
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(section.title ?? "");

  return (
    <div
      className={cn(
        "rounded-xl border-2 border-dashed transition-colors",
        dragOverId === `section-${sectionIndex}` ? "border-blue-400 bg-blue-50/50" : "border-gray-200 dark:border-gray-700"
      )}
      onDragOver={e => { e.preventDefault(); onDragOverId(`section-${sectionIndex}`); }}
      onDragLeave={() => onDragOverId(null)}
      onDrop={e => {
        e.preventDefault();
        onDragOverId(null);
        const fieldType = e.dataTransfer.getData("fieldType");
        if (fieldType) onDropFieldType(fieldType);
      }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
        {editingTitle ? (
          <input
            autoFocus
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={() => { setEditingTitle(false); onUpdateSectionTitle(titleValue); }}
            onKeyDown={e => { if (e.key === "Enter") { setEditingTitle(false); onUpdateSectionTitle(titleValue); } }}
            className="flex-1 text-sm font-semibold bg-transparent border-b border-blue-400 focus:outline-none"
          />
        ) : (
          <button onClick={() => setEditingTitle(true)}
            className="flex-1 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors">
            {section.title || <span className="text-gray-400 italic">Untitled Section</span>}
            <span className="ml-1 text-gray-400 text-xs">✎</span>
          </button>
        )}
        <span className="text-xs text-gray-400">{fields.length} field{fields.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Fields */}
      <div className="p-3 space-y-2">
        {fields.length === 0 && (
          <div className="py-6 text-center text-xs text-gray-400">
            Drag a field type here, or click one in the palette →
          </div>
        )}
        {fields.map((field, fIdx) => (
          <FieldCard
            key={field.id}
            field={field}
            index={fIdx}
            isSelected={selectedFieldId === field.id}
            onSelect={() => onSelectField(field.id)}
            onRemove={() => onRemoveField(field.id, sectionIndex)}
            onMoveUp={fIdx > 0 ? () => onMoveField(fIdx, fIdx - 1, sectionIndex) : undefined}
            onMoveDown={fIdx < fields.length - 1 ? () => onMoveField(fIdx, fIdx + 1, sectionIndex) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Field Card ────────────────────────────────────────────────────────────────
function FieldCard({ field, isSelected, onSelect, onRemove, onMoveUp, onMoveDown }: {
  field: FormField;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const type = (field as Record<string, unknown>).type as string;
  const typeInfo = FIELD_TYPES.find(f => f.type === type);

  return (
    <div
      draggable
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-gray-300 hover:shadow-sm"
      )}
    >
      {/* Drag handle */}
      <span className="text-gray-300 group-hover:text-gray-400 cursor-grab select-none">⠿</span>

      {/* Type badge */}
      <span className="flex-shrink-0 w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-mono text-gray-500">
        {typeInfo?.icon ?? type.slice(0, 2)}
      </span>

      {/* Field info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
          {field.label || <span className="text-gray-400 italic">{field.id}</span>}
          {field.required && <span className="ml-1 text-red-400">*</span>}
        </p>
        <p className="text-xs text-gray-400 font-mono">{field.id} · {type}</p>
      </div>

      {/* Width badge */}
      {field.width && field.width !== "full" && (
        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          {field.width}
        </span>
      )}

      {/* Actions (show on hover/select) */}
      <div className={cn("flex gap-0.5", isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        {onMoveUp && (
          <button type="button" onClick={e => { e.stopPropagation(); onMoveUp(); }}
            className="p-1 text-gray-400 hover:text-gray-700 rounded">↑</button>
        )}
        {onMoveDown && (
          <button type="button" onClick={e => { e.stopPropagation(); onMoveDown(); }}
            className="p-1 text-gray-400 hover:text-gray-700 rounded">↓</button>
        )}
        <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }}
          className="p-1 text-gray-300 hover:text-red-500 rounded text-xs">✕</button>
      </div>
    </div>
  );
}

// ─── Field Inspector ──────────────────────────────────────────────────────────
function FieldInspector({ field, onChange }: { field: FormField; onChange: (patch: Partial<FormField>) => void }) {
  const type = (field as Record<string, unknown>).type as string;
  const f = field as Record<string, unknown>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/40 text-blue-700 px-2 py-0.5 rounded">
          {type}
        </span>
        <span className="text-xs font-mono text-gray-400">{field.id}</span>
      </div>

      {/* Common props */}
      <InspectorField label="Label">
        <input value={field.label ?? ""} onChange={e => onChange({ label: e.target.value })}
          className="inspector-input" placeholder="Field label" />
      </InspectorField>

      <InspectorField label="Field ID">
        <input value={field.id} onChange={e => onChange({ id: e.target.value.replace(/\s/g, "_").toLowerCase() })}
          className="inspector-input font-mono" />
      </InspectorField>

      <InspectorField label="Placeholder">
        <input value={(f.placeholder as string) ?? ""} onChange={e => onChange({ placeholder: e.target.value } as Partial<FormField>)}
          className="inspector-input" />
      </InspectorField>

      <InspectorField label="Hint">
        <input value={(f.hint as string) ?? ""} onChange={e => onChange({ hint: e.target.value } as Partial<FormField>)}
          className="inspector-input" />
      </InspectorField>

      <InspectorField label="Width">
        <select value={field.width ?? "full"} onChange={e => onChange({ width: e.target.value as "full" | "half" | "third" })}
          className="inspector-input">
          <option value="full">Full</option>
          <option value="half">Half</option>
          <option value="third">Third</option>
        </select>
      </InspectorField>

      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-500">Required</label>
        <button type="button" onClick={() => onChange({ required: !field.required })}
          className={cn("relative inline-flex h-5 w-9 rounded-full transition-colors",
            field.required ? "bg-blue-600" : "bg-gray-300")}>
          <span className={cn("inline-block h-3 w-3 mt-1 rounded-full bg-white transition-transform",
            field.required ? "translate-x-5" : "translate-x-1")} />
        </button>
      </div>

      {/* Type-specific props */}
      {(type === "text" || type === "multiline") && (
        <>
          <InspectorField label="Min length">
            <input type="number" value={(f.min_length as number) ?? ""} min={0}
              onChange={e => onChange({ min_length: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)}
              className="inspector-input" />
          </InspectorField>
          <InspectorField label="Max length">
            <input type="number" value={(f.max_length as number) ?? ""} min={1}
              onChange={e => onChange({ max_length: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)}
              className="inspector-input" />
          </InspectorField>
          {type === "text" && (
            <InspectorField label="Pattern (regex)">
              <input value={(f.pattern as string) ?? ""} className="inspector-input font-mono text-xs"
                onChange={e => onChange({ pattern: e.target.value } as Partial<FormField>)} />
            </InspectorField>
          )}
        </>
      )}

      {type === "number" && (
        <>
          <InspectorField label="Display">
            <select value={(f.display_as as string) ?? "input"}
              onChange={e => onChange({ display_as: e.target.value } as Partial<FormField>)}
              className="inspector-input">
              <option value="input">Input</option>
              <option value="slider">Slider</option>
              <option value="stepper">Stepper</option>
            </select>
          </InspectorField>
          <InspectorField label="Min">
            <input type="number" value={(f.min as number) ?? ""} className="inspector-input"
              onChange={e => onChange({ min: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)} />
          </InspectorField>
          <InspectorField label="Max">
            <input type="number" value={(f.max as number) ?? ""} className="inspector-input"
              onChange={e => onChange({ max: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)} />
          </InspectorField>
          <InspectorField label="Prefix">
            <input value={(f.prefix as string) ?? ""} className="inspector-input"
              onChange={e => onChange({ prefix: e.target.value } as Partial<FormField>)} placeholder="e.g. $" />
          </InspectorField>
          <InspectorField label="Suffix">
            <input value={(f.suffix as string) ?? ""} className="inspector-input"
              onChange={e => onChange({ suffix: e.target.value } as Partial<FormField>)} placeholder="e.g. kg" />
          </InspectorField>
        </>
      )}

      {(type === "select" || type === "multiselect") && (
        <ChoicesEditor
          choices={Array.isArray(f.choices) ? f.choices as Array<{value: string; label: string}> : []}
          onChange={(choices) => onChange({ choices } as Partial<FormField>)}
        />
      )}

      {type === "boolean" && (
        <InspectorField label="Display as">
          <select value={(f.display_as as string) ?? "switch"}
            onChange={e => onChange({ display_as: e.target.value } as Partial<FormField>)}
            className="inspector-input">
            <option value="switch">Toggle switch</option>
            <option value="checkbox">Checkbox</option>
            <option value="yes-no-radio">Yes / No radio</option>
          </select>
        </InspectorField>
      )}

      {type === "rating" && (
        <>
          <InspectorField label="Max stars">
            <input type="number" min={2} max={10} value={(f.max as number) ?? 5} className="inspector-input"
              onChange={e => onChange({ max: Number(e.target.value) } as Partial<FormField>)} />
          </InspectorField>
          <InspectorField label="Display">
            <select value={(f.display_as as string) ?? "stars"}
              onChange={e => onChange({ display_as: e.target.value } as Partial<FormField>)} className="inspector-input">
              <option value="stars">Stars</option>
              <option value="numeric-scale">Numeric scale</option>
              <option value="emoji-scale">Emoji scale</option>
            </select>
          </InspectorField>
        </>
      )}

      {type === "multiline" && (
        <InspectorField label="Rows">
          <input type="number" min={2} max={30} value={(f.rows as number) ?? 4} className="inspector-input"
            onChange={e => onChange({ rows: Number(e.target.value) } as Partial<FormField>)} />
        </InspectorField>
      )}

      {/* Condition builder (simple) */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 mb-2">Visibility Condition</p>
        <SimpleConditionEditor
          condition={f.condition as Record<string, unknown> | undefined}
          onChange={(cond) => onChange({ condition: cond } as Partial<FormField>)}
        />
      </div>
    </div>
  );
}

function InspectorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ChoicesEditor({ choices, onChange }: {
  choices: Array<{ value: string; label: string }>;
  onChange: (choices: Array<{ value: string; label: string }>) => void;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">Options</p>
      <div className="space-y-1.5">
        {choices.map((c, i) => (
          <div key={i} className="flex gap-1">
            <input value={c.label} className="inspector-input flex-1"
              placeholder="Label"
              onChange={e => onChange(choices.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <input value={c.value} className="inspector-input w-24 font-mono text-xs"
              placeholder="value"
              onChange={e => onChange(choices.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
            <button type="button" onClick={() => onChange(choices.filter((_, j) => j !== i))}
              className="text-gray-300 hover:text-red-500 px-1 text-sm">✕</button>
          </div>
        ))}
      </div>
      <button type="button"
        onClick={() => onChange([...choices, { value: `option_${choices.length + 1}`, label: `Option ${choices.length + 1}` }])}
        className="mt-2 text-xs text-blue-600 hover:underline">
        + Add option
      </button>
    </div>
  );
}

function SimpleConditionEditor({ condition, onChange }: {
  condition: Record<string, unknown> | undefined;
  onChange: (cond: Record<string, unknown> | undefined) => void;
}) {
  const hasCondition = condition != null && "field" in condition;

  if (!hasCondition) {
    return (
      <button type="button" onClick={() => onChange({ field: "", op: "eq", value: "" })}
        className="text-xs text-blue-600 hover:underline">
        + Add condition
      </button>
    );
  }

  const cond = condition as { field: string; op: string; value: unknown };

  return (
    <div className="space-y-1.5">
      <input value={cond.field} className="inspector-input font-mono text-xs"
        placeholder="field_id"
        onChange={e => onChange({ ...condition, field: e.target.value })} />
      <select value={cond.op} className="inspector-input text-xs"
        onChange={e => onChange({ ...condition, op: e.target.value })}>
        {["eq","neq","gt","gte","lt","lte","in","not_in","contains","is_empty","is_not_empty","is_true","is_false"].map(op => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
      {!["is_empty","is_not_empty","is_true","is_false"].includes(cond.op) && (
        <input value={String(cond.value ?? "")} className="inspector-input text-xs"
          placeholder="value"
          onChange={e => onChange({ ...condition, value: e.target.value })} />
      )}
      <button type="button" onClick={() => onChange(undefined)}
        className="text-xs text-red-400 hover:underline">Remove condition</button>
    </div>
  );
}
