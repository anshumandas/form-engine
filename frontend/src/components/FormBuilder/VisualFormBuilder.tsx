"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@form-engine/libs/utils";
import type { FormField, Section, Page, FormDef, FormManifest, ConditionOrRef } from "@form-engine/libs/types";

// ─── Field catalogue ──────────────────────────────────────────────────────────
const FIELD_TYPES = [
  { type: "text",        icon: "T",   label: "Text",        group: "Basic" },
  { type: "multiline",   icon: "¶",   label: "Long Text",   group: "Basic" },
  { type: "number",      icon: "#",   label: "Number",      group: "Basic" },
  { type: "boolean",     icon: "☑",   label: "Toggle",      group: "Basic" },
  { type: "select",      icon: "▾",   label: "Select",      group: "Choice" },
  { type: "multiselect", icon: "☰",   label: "Multiselect", group: "Choice" },
  { type: "date",        icon: "📅",  label: "Date",        group: "DateTime" },
  { type: "time",        icon: "🕐",  label: "Time",        group: "DateTime" },
  { type: "datetime",    icon: "🗓",  label: "DateTime",    group: "DateTime" },
  { type: "daterange",   icon: "↔",   label: "Date Range",  group: "DateTime" },
  { type: "rating",      icon: "★",   label: "Rating",      group: "Rich" },
  { type: "file",        icon: "📎",  label: "File",        group: "Rich" },
  { type: "color",       icon: "🎨",  label: "Colour",      group: "Rich" },
  { type: "richtext",    icon: "✎",   label: "Rich Text",   group: "Rich" },
  { type: "signature",   icon: "✍",   label: "Signature",   group: "Rich" },
  { type: "hidden",      icon: "👁",  label: "Hidden",      group: "Advanced" },
  { type: "json",        icon: "{}",  label: "JSON",        group: "Advanced" },
] as const;

const GROUPS = ["Basic", "Choice", "DateTime", "Rich", "Advanced"] as const;

function defaultField(type: string, idx: number): FormField {
  const base = { id: `${type}_${idx}`, label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`, width: "full" as const };
  if (type === "select" || type === "multiselect")
    return { ...base, type: type as "select", choices: [{ value: "opt1", label: "Option 1" }, { value: "opt2", label: "Option 2" }] } as FormField;
  if (type === "boolean")   return { ...base, type: "boolean", display_as: "switch" };
  if (type === "number")    return { ...base, type: "number", display_as: "input" };
  if (type === "rating")    return { ...base, type: "rating", max: 5, display_as: "stars" };
  if (type === "file")      return { ...base, type: "file", max_files: 1 };
  if (type === "date")      return { ...base, type: "date" };
  if (type === "time")      return { ...base, type: "time" };
  if (type === "datetime")  return { ...base, type: "datetime" };
  if (type === "daterange") return { ...base, type: "daterange" };
  if (type === "color")     return { ...base, type: "color", format: "hex" };
  if (type === "multiline") return { ...base, type: "multiline", rows: 4 };
  if (type === "richtext")  return { ...base, type: "richtext" };
  if (type === "json")      return { ...base, type: "json", rows: 8 };
  if (type === "signature") return { ...base, type: "signature" };
  if (type === "hidden")    return { ...base, type: "hidden", value_from: "default" };
  return { ...base, type: "text" } as FormField;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface VisualFormBuilderProps {
  manifest: FormManifest;
  formId: string;
  onChange: (updated: FormManifest) => void;
}

export function VisualFormBuilder({ manifest, formId, onChange }: VisualFormBuilderProps) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [counter, setCounter] = useState(200);
  const [paletteOpen, setPaletteOpen] = useState(false); // mobile palette toggle

  const form = manifest.forms?.[formId];
  if (!form) return <div className="p-8 text-gray-400 text-sm">Form not found.</div>;

  const isWizard = form.layout.type === "wizard";
  const pages    = form.pages ?? [];
  const sections = isWizard
    ? (pages.find(p => p.id === (activePageId ?? pages[0]?.id))?.sections ?? [])
    : (form.sections ?? []);

  const currentPageId = isWizard ? (activePageId ?? pages[0]?.id ?? null) : null;
  const allFields     = sections.flatMap(s => s.fields ?? []);
  const selectedField = allFields.find(f => f.id === selectedFieldId) ?? null;

  const nextId = () => { setCounter(c => c + 1); return counter; };

  // ── Update helpers ──────────────────────────────────────────────────────────
  const updateForm = useCallback((updater: (f: FormDef) => FormDef) => {
    onChange({ ...manifest, forms: { ...manifest.forms, [formId]: updater(form) } });
  }, [manifest, formId, form, onChange]);

  const patchSections = (sectionsFn: (secs: Section[]) => Section[]) => {
    updateForm(f => {
      if (f.pages) {
        return { ...f, pages: f.pages.map(p =>
          p.id === currentPageId ? { ...p, sections: sectionsFn(p.sections) } : p
        )};
      }
      return { ...f, sections: sectionsFn(f.sections ?? []) };
    });
  };

  // ── Page management (wizard) ─────────────────────────────────────────────────
  const addPage = () => {
    const id = `page_${nextId()}`;
    updateForm(f => ({
      ...f,
      pages: [...(f.pages ?? []), {
        id, title: "New Page",
        sections: [{ id: `section_${id}`, title: "Section 1", fields: [] }]
      }]
    }));
    setActivePageId(id);
  };

  const renamePage = (pageId: string, title: string) => {
    updateForm(f => ({ ...f, pages: (f.pages ?? []).map(p => p.id === pageId ? { ...p, title } : p) }));
  };

  const deletePage = (pageId: string) => {
    updateForm(f => ({ ...f, pages: (f.pages ?? []).filter(p => p.id !== pageId) }));
    if (activePageId === pageId) setActivePageId(pages.find(p => p.id !== pageId)?.id ?? null);
  };

  // ── Section management ───────────────────────────────────────────────────────
  const addSection = () => {
    const id = `section_${nextId()}`;
    patchSections(secs => [...secs, { id, title: "New Section", fields: [] }]);
  };

  const updateSection = (sIdx: number, patch: Partial<Section>) => {
    patchSections(secs => secs.map((s, i) => i === sIdx ? { ...s, ...patch } : s));
  };

  const deleteSection = (sIdx: number) => {
    patchSections(secs => secs.filter((_, i) => i !== sIdx));
  };

  // ── Field management ──────────────────────────────────────────────────────────
  const addField = (type: string, sectionIdx: number) => {
    const field = defaultField(type, nextId());
    patchSections(secs => secs.map((s, i) => i === sectionIdx
      ? { ...s, fields: [...(s.fields ?? []), field] } : s
    ));
    setSelectedFieldId(field.id);
    setPaletteOpen(false);
  };

  const updateField = (fieldId: string, patch: Partial<FormField>) => {
    patchSections(secs => secs.map(s => ({
      ...s,
      fields: (s.fields ?? []).map(f => f.id === fieldId ? { ...f, ...patch } as FormField : f)
    })));
  };

  const removeField = (fieldId: string) => {
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
    patchSections(secs => secs.map(s => ({ ...s, fields: (s.fields ?? []).filter(f => f.id !== fieldId) })));
  };

  const moveField = (sIdx: number, from: number, to: number) => {
    patchSections(secs => secs.map((s, i) => {
      if (i !== sIdx) return s;
      const flds = [...(s.fields ?? [])];
      const [item] = flds.splice(from, 1);
      flds.splice(to, 0, item);
      return { ...s, fields: flds };
    }));
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: field palette (desktop always visible, mobile toggle) ─────── */}
      <div className={cn(
        "bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0 transition-all",
        "fixed inset-y-0 left-0 z-30 w-48 shadow-xl md:relative md:shadow-none md:z-auto md:w-44",
        paletteOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fields</span>
          <button className="md:hidden text-gray-400 hover:text-gray-600" onClick={() => setPaletteOpen(false)}>×</button>
        </div>
        {GROUPS.map(group => (
          <div key={group} className="mb-1">
            <div className="px-3 py-1.5 text-xs text-gray-400 font-medium">{group}</div>
            {FIELD_TYPES.filter(f => f.group === group).map(ft => (
              <button key={ft.type} draggable
                onDragStart={e => e.dataTransfer.setData("fieldType", ft.type)}
                onClick={() => { addField(ft.type, Math.max(0, sections.length - 1)); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 text-gray-600 dark:text-gray-400 transition-colors cursor-grab active:cursor-grabbing">
                <span className="w-5 text-center font-mono text-base leading-none">{ft.icon}</span>
                <span>{ft.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Palette backdrop (mobile) */}
      {paletteOpen && <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setPaletteOpen(false)} />}

      {/* ── Center: canvas ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Wizard page bar (always first for wizard forms) */}
        {isWizard && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {pages.map((p, pIdx) => (
                <PageTab
                  key={p.id}
                  page={p}
                  isActive={currentPageId === p.id || (!activePageId && pIdx === 0)}
                  onClick={() => setActivePageId(p.id)}
                  onRename={t => renamePage(p.id, t)}
                  onDelete={pages.length > 1 ? () => deletePage(p.id) : undefined}
                />
              ))}
              <button onClick={addPage}
                className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                + Page
              </button>
            </div>
          </div>
        )}

        {/* Mobile: add field button */}
        <div className="md:hidden px-3 pt-2">
          <button onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors text-sm">
            + Add Field
          </button>
        </div>

        {/* Sections */}
        <div className="p-3 space-y-3 flex-1">
          {sections.map((section, sIdx) => (
            <SectionCanvas
              key={section.id ?? sIdx}
              section={section}
              sectionIndex={sIdx}
              selectedFieldId={selectedFieldId}
              dragOverTarget={dragOverTarget}
              onDropFieldType={type => addField(type, sIdx)}
              onDragOverTarget={setDragOverTarget}
              onSelectField={setSelectedFieldId}
              onRemoveField={removeField}
              onMoveField={moveField}
              onUpdateSection={patch => updateSection(sIdx, patch)}
              onDeleteSection={sections.length > 1 ? () => deleteSection(sIdx) : undefined}
            />
          ))}
          <button onClick={addSection}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
            + Add Section
          </button>
        </div>
      </div>

      {/* ── Right: field inspector ──────────────────────────────────────────── */}
      <div className={cn(
        "w-64 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto",
        "hidden md:block",
        selectedField && "block"
      )}>
        {selectedField ? (
          <FieldInspector
            field={selectedField}
            onChange={patch => updateField(selectedField.id, patch)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-xs text-center px-4">
            <span className="text-3xl mb-2">←</span>
            Click a field to configure it
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page Tab ─────────────────────────────────────────────────────────────────
function PageTab({ page, isActive, onClick, onRename, onDelete }: {
  page: Page; isActive: boolean;
  onClick: () => void;
  onRename: (title: string) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(page.title);
  return (
    <div className={cn(
      "flex items-center gap-1 rounded-lg border px-2 py-1 flex-shrink-0 transition-all",
      isActive ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
    )}>
      {editing ? (
        <input autoFocus value={val} onChange={e => setVal(e.target.value)}
          onBlur={() => { setEditing(false); onRename(val); }}
          onKeyDown={e => { if (e.key === "Enter") { setEditing(false); onRename(val); } }}
          className="text-xs bg-transparent border-b border-blue-400 focus:outline-none w-24" />
      ) : (
        <button onClick={onClick} onDoubleClick={() => setEditing(true)}
          className="text-xs font-medium max-w-[100px] truncate text-left">
          {page.title}
        </button>
      )}
      {isActive && !editing && (
        <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-600 text-xs">✎</button>
      )}
      {onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="text-gray-300 hover:text-red-500 text-xs leading-none ml-0.5">×</button>
      )}
    </div>
  );
}

// ─── Section Canvas ───────────────────────────────────────────────────────────
interface SectionCanvasProps {
  section: Section;
  sectionIndex: number;
  selectedFieldId: string | null;
  dragOverTarget: string | null;
  onDropFieldType: (type: string) => void;
  onDragOverTarget: (id: string | null) => void;
  onSelectField: (id: string) => void;
  onRemoveField: (id: string) => void;
  onMoveField: (sIdx: number, from: number, to: number) => void;
  onUpdateSection: (patch: Partial<Section>) => void;
  onDeleteSection?: () => void;
}

function SectionCanvas({
  section, sectionIndex, selectedFieldId, dragOverTarget,
  onDropFieldType, onDragOverTarget, onSelectField, onRemoveField,
  onMoveField, onUpdateSection, onDeleteSection
}: SectionCanvasProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(section.title ?? "");
  const targetKey = `section-${sectionIndex}`;

  return (
    <div
      className={cn(
        "rounded-xl border-2 transition-colors",
        dragOverTarget === targetKey ? "border-blue-400 bg-blue-50/50 dark:bg-blue-900/10" : "border-gray-200 dark:border-gray-700"
      )}
      onDragOver={e => { e.preventDefault(); onDragOverTarget(targetKey); }}
      onDragLeave={() => onDragOverTarget(null)}
      onDrop={e => {
        e.preventDefault(); onDragOverTarget(null);
        const ft = e.dataTransfer.getData("fieldType");
        if (ft) onDropFieldType(ft);
      }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
        {editingTitle ? (
          <input autoFocus value={titleVal}
            onChange={e => setTitleVal(e.target.value)}
            onBlur={() => { setEditingTitle(false); onUpdateSection({ title: titleVal }); }}
            onKeyDown={e => { if (e.key === "Enter") { setEditingTitle(false); onUpdateSection({ title: titleVal }); } }}
            className="flex-1 text-sm font-semibold bg-transparent border-b border-blue-400 focus:outline-none" />
        ) : (
          <button onClick={() => setEditingTitle(true)}
            className="flex-1 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors truncate">
            {section.title || <span className="text-gray-400 italic font-normal">Untitled Section</span>}
            <span className="ml-1 text-gray-400 text-xs">✎</span>
          </button>
        )}
        <span className="text-xs text-gray-400 flex-shrink-0">{(section.fields ?? []).length} field{(section.fields ?? []).length !== 1 ? "s" : ""}</span>
        {section.condition && (
          <span className="badge bg-purple-100 text-purple-700 text-xs flex-shrink-0">conditional</span>
        )}
        {onDeleteSection && (
          <button onClick={onDeleteSection} className="text-gray-300 hover:text-red-500 text-sm flex-shrink-0">×</button>
        )}
      </div>

      {/* Fields */}
      <div className="p-3 space-y-2">
        {(section.fields ?? []).length === 0 && (
          <div className="py-5 text-center text-xs text-gray-400">
            Drag a field here or click one in the palette
          </div>
        )}
        {(section.fields ?? []).map((field, fIdx) => (
          <FieldCard
            key={field.id}
            field={field}
            index={fIdx}
            isSelected={selectedFieldId === field.id}
            onSelect={() => onSelectField(field.id)}
            onRemove={() => onRemoveField(field.id)}
            onMoveUp={fIdx > 0 ? () => onMoveField(sectionIndex, fIdx, fIdx - 1) : undefined}
            onMoveDown={fIdx < (section.fields ?? []).length - 1 ? () => onMoveField(sectionIndex, fIdx, fIdx + 1) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Field Card ───────────────────────────────────────────────────────────────
function FieldCard({ field, isSelected, onSelect, onRemove, onMoveUp, onMoveDown }: {
  field: FormField; index: number; isSelected: boolean;
  onSelect: () => void; onRemove: () => void;
  onMoveUp?: () => void; onMoveDown?: () => void;
}) {
  const type = (field as unknown as Record<string, unknown>).type as string;
  const typeInfo = FIELD_TYPES.find(f => f.type === type);
  const condition = (field as unknown as Record<string, unknown>).condition || false;
  return (
    <div draggable onClick={onSelect}
      className={cn(
        "group flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all",
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-gray-300 hover:shadow-sm"
      )}>
      <span className="text-gray-300 cursor-grab select-none text-sm">⠿</span>
      <span className="flex-shrink-0 w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-mono text-gray-500">
        {typeInfo?.icon ?? type.slice(0, 2)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
          {(field as unknown as Record<string, unknown>).label as string || <span className="text-gray-400 italic">{field.id}</span>}
          {field.required && <span className="ml-1 text-red-400">*</span>}
          {field.advanced && <span className="ml-1 text-purple-400 text-xs">pro</span>}
        </p>
        <p className="text-xs text-gray-400 font-mono truncate">{field.id} · {type}</p>
      </div>
      {field.width && field.width !== "full" && (
        <span className="text-xs text-gray-400 bg-gray-100 px-1 py-0.5 rounded flex-shrink-0">{field.width}</span>
      )}
      {condition && (
        <span className="text-purple-400 text-xs flex-shrink-0">⚡</span>
      )}
      <div className={cn("flex gap-0.5 flex-shrink-0", isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        {onMoveUp && <button type="button" onClick={e => { e.stopPropagation(); onMoveUp(); }} className="p-0.5 text-gray-400 hover:text-gray-700 text-xs">↑</button>}
        {onMoveDown && <button type="button" onClick={e => { e.stopPropagation(); onMoveDown(); }} className="p-0.5 text-gray-400 hover:text-gray-700 text-xs">↓</button>}
        <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }} className="p-0.5 text-gray-300 hover:text-red-500 text-xs">✕</button>
      </div>
    </div>
  );
}

// ─── Field Inspector ──────────────────────────────────────────────────────────
function FieldInspector({ field, onChange }: {
  field: FormField;
  onChange: (patch: Partial<FormField>) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const type = (field as unknown as Record<string, unknown>).type as string;
  const f = field as unknown as Record<string, unknown>;

  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-mono bg-blue-100 dark:bg-blue-900/40 text-blue-700 px-2 py-0.5 rounded">{type}</span>
        <span className="font-mono text-gray-400 truncate">{field.id}</span>
      </div>

      {/* Core */}
      <InspField label="Label">
        <InspInput value={(f.label as string) ?? ""} onChange={v => onChange({ label: v } as Partial<FormField>)} placeholder="Field label" />
      </InspField>
      <InspField label="Field ID">
        <InspInput value={field.id} onChange={v => onChange({ id: v.replace(/\s/g,"_").toLowerCase() } as Partial<FormField>)} mono />
      </InspField>
      <InspField label="Width">
        <select value={field.width ?? "full"} onChange={e => onChange({ width: e.target.value as "full"|"half"|"third" })}
          className="w-full rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs bg-white dark:bg-gray-800 focus:border-blue-400 focus:outline-none">
          <option value="full">Full</option><option value="half">Half</option><option value="third">Third</option>
        </select>
      </InspField>
      <div className="flex items-center justify-between">
        <span className="text-gray-500">Required</span>
        <Toggle checked={!!field.required} onChange={v => onChange({ required: v } as Partial<FormField>)} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-500">Pro (advanced)</span>
        <Toggle checked={!!field.advanced} onChange={v => onChange({ advanced: v } as Partial<FormField>)} />
      </div>

      {/* Type-specific basic props */}
      {(type === "text" || type === "multiline") && (
        <>
          <InspField label="Placeholder">
            <InspInput value={(f.placeholder as string) ?? ""} onChange={v => onChange({ placeholder: v } as Partial<FormField>)} />
          </InspField>
          <InspField label="Hint">
            <InspInput value={(f.hint as string) ?? ""} onChange={v => onChange({ hint: v } as Partial<FormField>)} />
          </InspField>
        </>
      )}
      {type === "number" && (
        <InspField label="Display">
          <select value={(f.display_as as string) ?? "input"} onChange={e => onChange({ display_as: e.target.value } as Partial<FormField>)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none">
            <option value="input">Input</option><option value="slider">Slider</option><option value="stepper">Stepper</option>
          </select>
        </InspField>
      )}
      {type === "boolean" && (
        <InspField label="Display">
          <select value={(f.display_as as string) ?? "switch"} onChange={e => onChange({ display_as: e.target.value } as Partial<FormField>)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none">
            <option value="switch">Toggle switch</option><option value="checkbox">Checkbox</option><option value="yes-no-radio">Yes / No</option>
          </select>
        </InspField>
      )}
      {(type === "select" || type === "multiselect") && (
        <ChoicesEditor
          choices={f.choices}
          onChange={choices => onChange({ choices } as Partial<FormField>)}
        />
      )}
      {type === "rating" && (
        <InspField label="Max">
          <input type="number" min={2} max={10} value={(f.max as number) ?? 5}
            onChange={e => onChange({ max: Number(e.target.value) } as Partial<FormField>)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
        </InspField>
      )}

      {/* More options button */}
      <button type="button" onClick={() => setShowMore(o => !o)}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors text-xs">
        <span className={cn("transition-transform", showMore && "rotate-90")}>▶</span>
        {showMore ? "Hide advanced" : "More options"}
      </button>

      {showMore && (
        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          {/* Validation */}
          {type === "text" && (
            <>
              <InspField label="Min length">
                <input type="number" min={0} value={(f.min_length as number) ?? ""}
                  onChange={e => onChange({ min_length: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
              </InspField>
              <InspField label="Max length">
                <input type="number" min={1} value={(f.max_length as number) ?? ""}
                  onChange={e => onChange({ max_length: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
              </InspField>
              <InspField label="Pattern (regex)">
                <InspInput value={(f.pattern as string) ?? ""} onChange={v => onChange({ pattern: v } as Partial<FormField>)} mono placeholder="^[A-Z]{2}[0-9]+$" />
              </InspField>
              <InspField label="Pattern message">
                <InspInput value={(f.pattern_message as string) ?? ""} onChange={v => onChange({ pattern_message: v } as Partial<FormField>)} placeholder="Invalid format" />
              </InspField>
            </>
          )}
          {type === "number" && (
            <>
              <InspField label="Min value">
                <input type="number" value={(f.min as number) ?? ""}
                  onChange={e => onChange({ min: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
              </InspField>
              <InspField label="Max value">
                <input type="number" value={(f.max as number) ?? ""}
                  onChange={e => onChange({ max: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
              </InspField>
              <div className="grid grid-cols-2 gap-2">
                <InspField label="Prefix">
                  <InspInput value={(f.prefix as string) ?? ""} onChange={v => onChange({ prefix: v } as Partial<FormField>)} placeholder="$" />
                </InspField>
                <InspField label="Suffix">
                  <InspInput value={(f.suffix as string) ?? ""} onChange={v => onChange({ suffix: v } as Partial<FormField>)} placeholder="kg" />
                </InspField>
              </div>
            </>
          )}

          {/* Condition builder */}
          <div>
            <p className="text-gray-500 font-medium mb-2">Visibility Condition</p>
            <ConditionEditor
              condition={f.condition as ConditionOrRef | undefined}
              onChange={cond => onChange({ condition: cond } as Partial<FormField>)}
            />
          </div>

          {/* Section / branching */}
          <div>
            <p className="text-gray-500 font-medium mb-2">Compliance</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500">Personal data</span>
              <Toggle checked={!!field.personal_data} onChange={v => onChange({ personal_data: v } as Partial<FormField>)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Hidden field</span>
              <Toggle checked={field.ui_only ?? false} onChange={v => onChange({ ui_only: v } as Partial<FormField>)} />
            </div>
          </div>

          <div>
            <p className="text-gray-500 font-medium mb-2">Branch on change</p>
            <BranchEditor
              branches={(f.branches as Array<{condition:{field:string;op:string;value:unknown};goto:string}>) ?? []}
              onChange={branches => onChange({ branches } as Partial<FormField>)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small inspector helpers ──────────────────────────────────────────────────
function InspField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-gray-500 mb-1">{label}</label>{children}</div>;
}

function InspInput({ value, onChange, placeholder, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={cn(
        "w-full rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs bg-white dark:bg-gray-800 focus:border-blue-400 focus:outline-none",
        mono && "font-mono"
      )} />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-5 w-9 rounded-full transition-colors", checked ? "bg-blue-600" : "bg-gray-300")}>
      <span className={cn("inline-block h-3 w-3 mt-1 rounded-full bg-white transition-transform", checked ? "translate-x-5" : "translate-x-1")} />
    </button>
  );
}

function ChoicesEditor({ choices, onChange }: {
  choices: unknown;  // may be array OR { static: [...] } OR { dynamic: {...} }
  onChange: (c: unknown) => void;
}) {
  // Detect the current mode
  const isDynamic = !Array.isArray(choices) && choices != null && typeof choices === "object" && "dynamic" in (choices as object);
  const staticList: Array<{value:string;label:string}> = isDynamic
    ? []
    : Array.isArray(choices) ? choices as Array<{value:string;label:string}>
    : (choices as {static?: Array<{value:string;label:string}>})?.static ?? [];

  type DynamicCfg = { url: string; value_key: string; label_key: string; cache_ttl_seconds?: number };
  const dynamicCfg: DynamicCfg = isDynamic
    ? (choices as {dynamic: DynamicCfg}).dynamic
    : { url: "", value_key: "id", label_key: "name" };

  const setStatic = (list: Array<{value:string;label:string}>) => onChange(list);
  const setDynamic = (cfg: DynamicCfg) => onChange({ dynamic: cfg });

  return (
    <div>
      {/* Mode tab switcher */}
      <div className="flex items-center gap-1 mb-2">
        <p className="text-gray-500 flex-1">Choices</p>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
          <button type="button"
            onClick={() => !isDynamic || setStatic([{ value: "opt1", label: "Option 1" }, { value: "opt2", label: "Option 2" }])}
            className={cn("px-2 py-0.5 transition-colors",
              !isDynamic ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
            )}>
            Static
          </button>
          <button type="button"
            onClick={() => isDynamic || setDynamic({ url: "", value_key: "id", label_key: "name" })}
            className={cn("px-2 py-0.5 transition-colors",
              isDynamic ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
            )}>
            Dynamic
          </button>
        </div>
      </div>

      {isDynamic ? (
        /* ── Dynamic config editor ─────────────────────────────────────── */
        <div className="space-y-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-2">
          <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide mb-1.5">
            REST Data Source
          </p>
          <InspField label="Endpoint URL">
            <InspInput
              value={dynamicCfg.url}
              onChange={v => setDynamic({ ...dynamicCfg, url: v })}
              placeholder="/api/categories"
              mono
            />
          </InspField>
          <div className="grid grid-cols-2 gap-1.5">
            <InspField label="Value key">
              <InspInput
                value={dynamicCfg.value_key}
                onChange={v => setDynamic({ ...dynamicCfg, value_key: v })}
                placeholder="id"
                mono
              />
            </InspField>
            <InspField label="Label key">
              <InspInput
                value={dynamicCfg.label_key}
                onChange={v => setDynamic({ ...dynamicCfg, label_key: v })}
                placeholder="name"
                mono
              />
            </InspField>
          </div>
          <InspField label="Cache (seconds)">
            <input
              type="number"
              min={0}
              value={dynamicCfg.cache_ttl_seconds ?? 60}
              onChange={e => setDynamic({ ...dynamicCfg, cache_ttl_seconds: Number(e.target.value) })}
              className="w-full rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs bg-white dark:bg-gray-800 focus:border-blue-400 focus:outline-none"
            />
          </InspField>
          {dynamicCfg.url && (
            <p className="text-[10px] text-blue-500 mt-1">
              Fetches from <span className="font-mono">{dynamicCfg.url}</span> at runtime
            </p>
          )}
        </div>
      ) : (
        /* ── Static choices editor ─────────────────────────────────────── */
        <>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {staticList.map((c, i) => (
              <div key={i} className="flex gap-1">
                <input value={c.label} placeholder="Label"
                  onChange={e => setStatic(staticList.map((x,j) => j===i ? {...x,label:e.target.value} : x))}
                  className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs bg-white focus:border-blue-400 focus:outline-none" />
                <input value={c.value} placeholder="value"
                  onChange={e => setStatic(staticList.map((x,j) => j===i ? {...x,value:e.target.value} : x))}
                  className="w-20 rounded-md border border-gray-200 px-2 py-1 text-xs font-mono bg-white focus:border-blue-400 focus:outline-none" />
                <button type="button" onClick={() => setStatic(staticList.filter((_,j) => j!==i))}
                  className="text-gray-300 hover:text-red-500 px-1 text-sm">✕</button>
              </div>
            ))}
          </div>
          <button type="button"
            onClick={() => setStatic([...staticList, {value:`opt_${staticList.length+1}`,label:`Option ${staticList.length+1}`}])}
            className="mt-1.5 text-xs text-blue-600 hover:underline">
            + Add option
          </button>
        </>
      )}
    </div>
  );
}

function ConditionEditor({ condition, onChange }: {
  condition: ConditionOrRef | undefined;
  onChange: (c: ConditionOrRef | undefined) => void;
}) {
  const cond = condition as Record<string,unknown> | undefined;
  const hasSimple = cond && "field" in cond && "op" in cond;

  if (!hasSimple) {
    return (
      <button type="button" onClick={() => onChange({ field: "", op: "eq", value: "" } as ConditionOrRef)}
        className="text-xs text-blue-600 hover:underline">+ Add condition</button>
    );
  }
  return (
    <div className="space-y-1.5">
      <InspInput value={(cond!.field as string) ?? ""} placeholder="field_id" mono
        onChange={v => onChange({ ...condition, field: v } as ConditionOrRef)} />
      <select value={(cond!.op as string) ?? "eq"}
        onChange={e => onChange({ ...condition, op: e.target.value } as ConditionOrRef)}
        className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none">
        {["eq","neq","gt","gte","lt","lte","in","not_in","contains","is_empty","is_not_empty","is_true","is_false"].map(op => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
      {!["is_empty","is_not_empty","is_true","is_false"].includes(cond!.op as string) && (
        <InspInput value={String((cond!.value as unknown) ?? "")} placeholder="value"
          onChange={v => onChange({ ...condition, value: v } as ConditionOrRef)} />
      )}
      <button type="button" onClick={() => onChange(undefined)} className="text-xs text-red-400 hover:underline">Remove</button>
    </div>
  );
}

function BranchEditor({ branches, onChange }: {
  branches: Array<{condition:{field:string;op:string;value:unknown};goto:string}>;
  onChange: (b: typeof branches) => void;
}) {
  if (branches.length === 0) {
    return (
      <button type="button"
        onClick={() => onChange([{ condition: { field: "", op: "eq", value: "" }, goto: "" }])}
        className="text-xs text-blue-600 hover:underline">
        + Add branch rule
      </button>
    );
  }
  return (
    <div className="space-y-2">
      {branches.map((b, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-2 space-y-1.5 bg-gray-50">
          <div className="flex gap-1">
            <input value={b.condition.field} placeholder="field_id"
              onChange={e => onChange(branches.map((x,j) => j===i ? {...x,condition:{...x.condition,field:e.target.value}} : x))}
              className="flex-1 rounded border border-gray-200 px-1.5 py-1 text-xs font-mono bg-white focus:outline-none focus:border-blue-400" />
            <select value={b.condition.op}
              onChange={e => onChange(branches.map((x,j) => j===i ? {...x,condition:{...x.condition,op:e.target.value}} : x))}
              className="w-20 rounded border border-gray-200 px-1 py-1 text-xs bg-white focus:outline-none">
              {["eq","neq","gt","gte","lt","lte","is_true","is_false","is_empty"].map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
          <input value={String(b.condition.value ?? "")} placeholder="value"
            onChange={e => onChange(branches.map((x,j) => j===i ? {...x,condition:{...x.condition,value:e.target.value}} : x))}
            className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs bg-white focus:outline-none focus:border-blue-400" />
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">→ go to page</span>
            <input value={b.goto} placeholder="page_id"
              onChange={e => onChange(branches.map((x,j) => j===i ? {...x,goto:e.target.value} : x))}
              className="flex-1 rounded border border-gray-200 px-1.5 py-1 text-xs font-mono bg-white focus:outline-none focus:border-blue-400" />
            <button type="button" onClick={() => onChange(branches.filter((_,j) => j!==i))}
              className="text-gray-300 hover:text-red-500 text-xs">✕</button>
          </div>
        </div>
      ))}
      <button type="button"
        onClick={() => onChange([...branches, { condition: { field: "", op: "eq", value: "" }, goto: "" }])}
        className="text-xs text-blue-600 hover:underline">+ Add rule</button>
    </div>
  );
}
