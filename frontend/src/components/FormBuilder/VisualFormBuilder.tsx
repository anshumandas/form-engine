"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@form-engine/libs/utils";
import type { FormField, Section, Page, FormDef, FormManifest, ConditionOrRef, Collection } from "@form-engine/libs/types";

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

/** Retype a field while preserving id / label / width / required */
function reTypeField(existing: FormField, newType: string, idx: number): FormField {
  const fresh = defaultField(newType, idx);
  const e = existing as unknown as Record<string, unknown>;
  return {
    ...fresh,
    id:       existing.id,
    label:    (e.label as string) ?? fresh.id,
    width:    existing.width ?? "full",
    required: existing.required ?? false,
  } as FormField;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface VisualFormBuilderProps {
  manifest: FormManifest;
  formId: string;
  onChange: (updated: FormManifest) => void;
}

export function VisualFormBuilder({ manifest, formId, onChange }: VisualFormBuilderProps) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  // wizard tab: "pages" = overview, otherwise a page id
  const [activePageTab, setActivePageTab] = useState<string>("pages");
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [counter, setCounter] = useState(200);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const form = manifest.forms?.[formId];
  if (!form) return <div className="p-8 text-gray-400 text-sm">Form not found.</div>;

  const isWizard = form.layout.type === "wizard";
  const pages    = form.pages ?? [];

  const activePageId: string | null = isWizard
    ? (activePageTab !== "pages" ? activePageTab : (pages[0]?.id ?? null))
    : null;

  const sections = isWizard
    ? (pages.find(p => p.id === activePageId)?.sections ?? [])
    : (form.sections ?? []);

  const allFields     = sections.flatMap(s => s.fields ?? []);
  const selectedField = allFields.find(f => f.id === selectedFieldId) ?? null;

  const nextId = () => { setCounter(c => c + 1); return counter; };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const updateForm = useCallback((updater: (f: FormDef) => FormDef) => {
    onChange({ ...manifest, forms: { ...manifest.forms, [formId]: updater(form) } });
  }, [manifest, formId, form, onChange]);

  const patchSections = (fn: (secs: Section[]) => Section[]) => {
    updateForm(f => {
      if (f.pages) {
        return { ...f, pages: f.pages.map(p =>
          p.id === activePageId ? { ...p, sections: fn(p.sections) } : p
        )};
      }
      return { ...f, sections: fn(f.sections ?? []) };
    });
  };

  // ── Page management ──────────────────────────────────────────────────────────
  const addPage = () => {
    const id = `page_${nextId()}`;
    updateForm(f => ({
      ...f,
      pages: [...(f.pages ?? []), { id, title: "New Page", sections: [{ id: `s_${id}`, title: "Section 1", fields: [] }] }]
    }));
    setActivePageTab(id);
  };
  const renamePage = (pid: string, title: string) =>
    updateForm(f => ({ ...f, pages: (f.pages ?? []).map(p => p.id === pid ? { ...p, title } : p) }));
  const deletePage = (pid: string) => {
    updateForm(f => ({ ...f, pages: (f.pages ?? []).filter(p => p.id !== pid) }));
    if (activePageTab === pid) setActivePageTab("pages");
  };

  // ── Section management ───────────────────────────────────────────────────────
  const addSection = () => {
    const id = `section_${nextId()}`;
    patchSections(secs => [...secs, { id, title: "New Section", fields: [] }]);
  };
  const updateSection = (sIdx: number, patch: Partial<Section>) =>
    patchSections(secs => secs.map((s, i) => i === sIdx ? { ...s, ...patch } : s));
  const deleteSection = (sIdx: number) =>
    patchSections(secs => secs.filter((_, i) => i !== sIdx));

  // ── Field management ──────────────────────────────────────────────────────────
  const addField = (type: string, sectionIdx: number) => {
    const field = defaultField(type, nextId());
    patchSections(secs => secs.map((s, i) => i === sectionIdx ? { ...s, fields: [...(s.fields ?? []), field] } : s));
    setSelectedFieldId(field.id);
    setPaletteOpen(false);
  };
  const updateField = (fieldId: string, patch: Partial<FormField>) =>
    patchSections(secs => secs.map(s => ({
      ...s, fields: (s.fields ?? []).map(f => f.id === fieldId ? { ...f, ...patch } as FormField : f)
    })));
  const changeFieldType = (fieldId: string, newType: string) => {
    const existing = allFields.find(f => f.id === fieldId);
    if (!existing) return;
    const retype = reTypeField(existing, newType, nextId());
    patchSections(secs => secs.map(s => ({
      ...s, fields: (s.fields ?? []).map(f => f.id === fieldId ? retype : f)
    })));
  };
  const removeField = (fieldId: string) => {
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
    patchSections(secs => secs.map(s => ({ ...s, fields: (s.fields ?? []).filter(f => f.id !== fieldId) })));
  };
  const moveField = (sIdx: number, from: number, to: number) =>
    patchSections(secs => secs.map((s, i) => {
      if (i !== sIdx) return s;
      const flds = [...(s.fields ?? [])];
      const [item] = flds.splice(from, 1);
      flds.splice(to, 0, item);
      return { ...s, fields: flds };
    }));

  // ── Pages overview panel (wizard) ────────────────────────────────────────────
  const PagesOverview = () => (
    <div className="p-4 space-y-3 flex-1 overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Wizard Pages</p>
        <button onClick={addPage}
          className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          + Add Page
        </button>
      </div>
      {pages.length === 0 && (
        <div className="py-10 text-center text-xs text-gray-400 border-2 border-dashed rounded-xl">
          No pages yet. Click "Add Page" to create the first page.
        </div>
      )}
      {pages.map((p, pIdx) => (
        <div key={p.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 group">
          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
            {pIdx + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{p.title}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{p.id} · {p.sections.reduce((a, s) => a + (s.fields?.length ?? 0), 0)} fields</p>
          </div>
          <button onClick={() => setActivePageTab(p.id)}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 transition-colors flex-shrink-0">
            Edit →
          </button>
          {pages.length > 1 && (
            <button onClick={() => deletePage(p.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-sm transition-all flex-shrink-0">×</button>
          )}
        </div>
      ))}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 text-center">
        Double-click a page tab to rename it. Drag-drop reordering coming soon.
      </div>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: field palette ─────────────────────────────────────────────── */}
      <div className={cn(
        "bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0 transition-all",
        "fixed inset-y-0 left-0 z-30 w-48 shadow-xl md:relative md:shadow-none md:z-auto md:w-44",
        paletteOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fields</span>
          <button className="md:hidden text-gray-400 hover:text-gray-600" onClick={() => setPaletteOpen(false)}>×</button>
        </div>
        {isWizard && activePageTab === "pages" && (
          <div className="px-3 py-2 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100">
            Select a page tab to add fields
          </div>
        )}
        {GROUPS.map(group => (
          <div key={group} className="mb-1">
            <div className="px-3 py-1.5 text-xs text-gray-400 font-medium">{group}</div>
            {FIELD_TYPES.filter(f => f.group === group).map(ft => (
              <button key={ft.type} draggable
                onDragStart={e => e.dataTransfer.setData("fieldType", ft.type)}
                onClick={() => {
                  if (isWizard && activePageTab === "pages") return;
                  addField(ft.type, Math.max(0, sections.length - 1));
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 text-gray-600 dark:text-gray-400 transition-colors cursor-grab active:cursor-grabbing",
                  isWizard && activePageTab === "pages" && "opacity-40 cursor-not-allowed"
                )}>
                <span className="w-5 text-center font-mono text-base leading-none">{ft.icon}</span>
                <span>{ft.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {paletteOpen && <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setPaletteOpen(false)} />}

      {/* ── Center: canvas ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Wizard: tabbed page bar — Pages overview always first ─────────── */}
        {isWizard && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center overflow-x-auto">
              {/* Wizard Pages overview tab — always appears BEFORE per-page field tabs */}
              <button
                type="button"
                onClick={() => setActivePageTab("pages")}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap",
                  activePageTab === "pages"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}>
                <span>📋</span> Wizard Pages
              </button>

              <span className="text-gray-200 dark:text-gray-700 flex-shrink-0 select-none mx-0.5 text-xs">│</span>

              {/* Per-page tabs */}
              {pages.map((p, pIdx) => (
                <PageTab
                  key={p.id}
                  page={p}
                  index={pIdx}
                  isActive={activePageTab === p.id}
                  onClick={() => setActivePageTab(p.id)}
                  onRename={t => renamePage(p.id, t)}
                  onDelete={pages.length > 1 ? () => deletePage(p.id) : undefined}
                />
              ))}

              <button onClick={addPage}
                className="flex-shrink-0 px-3 py-2.5 text-xs text-gray-400 hover:text-blue-500 transition-colors whitespace-nowrap">
                + Page
              </button>
            </div>
          </div>
        )}

        {/* Mobile: add-field button */}
        <div className="md:hidden px-3 pt-2 flex-shrink-0">
          <button onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors text-sm">
            + Add Field
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {isWizard && activePageTab === "pages" ? (
            <PagesOverview />
          ) : (
            <div className="p-3 space-y-3">
              {isWizard && activePageId && (
                <div className="flex items-center gap-2 text-xs text-gray-400 pb-1">
                  <span>Editing page:</span>
                  <span className="font-semibold text-gray-600 dark:text-gray-300">
                    {pages.find(p => p.id === activePageId)?.title}
                  </span>
                  <button onClick={() => setActivePageTab("pages")}
                    className="ml-auto text-blue-500 hover:underline">← All pages</button>
                </div>
              )}
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
          )}
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
            onChangeType={newType => changeFieldType(selectedField.id, newType)}
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
function PageTab({ page, index, isActive, onClick, onRename, onDelete }: {
  page: Page; index: number; isActive: boolean;
  onClick: () => void; onRename: (title: string) => void; onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(page.title);
  return (
    <div className={cn(
      "flex items-center gap-0.5 flex-shrink-0 border-b-2 transition-colors group",
      isActive ? "border-blue-500" : "border-transparent hover:border-gray-300"
    )}>
      {editing ? (
        <input autoFocus value={val} onChange={e => setVal(e.target.value)}
          onBlur={() => { setEditing(false); onRename(val); }}
          onKeyDown={e => { if (e.key === "Enter") { setEditing(false); onRename(val); } }}
          className="text-xs bg-transparent border-b border-blue-400 focus:outline-none w-24 py-2.5 px-2" />
      ) : (
        <button onClick={onClick} onDoubleClick={() => setEditing(true)}
          className={cn(
            "text-xs font-medium px-3 py-2.5 max-w-[130px] truncate whitespace-nowrap",
            isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          )}>
          {index + 1}. {page.title}
        </button>
      )}
      {isActive && !editing && (
        <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-blue-500 text-[10px] pr-1">✎</button>
      )}
      {onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-xs pr-2 transition-all">×</button>
      )}
    </div>
  );
}

// ─── Section Canvas ───────────────────────────────────────────────────────────
interface SectionCanvasProps {
  section: Section; sectionIndex: number; selectedFieldId: string | null;
  dragOverTarget: string | null;
  onDropFieldType: (type: string) => void; onDragOverTarget: (id: string | null) => void;
  onSelectField: (id: string) => void; onRemoveField: (id: string) => void;
  onMoveField: (sIdx: number, from: number, to: number) => void;
  onUpdateSection: (patch: Partial<Section>) => void; onDeleteSection?: () => void;
}

function SectionCanvas({
  section, sectionIndex, selectedFieldId, dragOverTarget,
  onDropFieldType, onDragOverTarget, onSelectField, onRemoveField,
  onMoveField, onUpdateSection, onDeleteSection
}: SectionCanvasProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(section.title ?? "");
  const [showSettings, setShowSettings] = useState(false);
  const targetKey = `section-${sectionIndex}`;
  const isCollection = !!section.collection;
  const coll: Collection = section.collection ?? {};

  const toggleCollection = (on: boolean) => {
    onUpdateSection({ collection: on ? { add_label: "Add Item", remove_label: "Remove", sortable: false } : undefined });
  };

  return (
    <div
      className={cn(
        "rounded-xl border-2 transition-colors",
        dragOverTarget === targetKey ? "border-blue-400 bg-blue-50/50 dark:bg-blue-900/10" : "border-gray-200 dark:border-gray-700"
      )}
      onDragOver={e => { e.preventDefault(); onDragOverTarget(targetKey); }}
      onDragLeave={() => onDragOverTarget(null)}
      onDrop={e => { e.preventDefault(); onDragOverTarget(null); const ft = e.dataTransfer.getData("fieldType"); if (ft) onDropFieldType(ft); }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
        {editingTitle ? (
          <input autoFocus value={titleVal} onChange={e => setTitleVal(e.target.value)}
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
        <span className="text-xs text-gray-400 flex-shrink-0">
          {(section.fields ?? []).length} field{(section.fields ?? []).length !== 1 ? "s" : ""}
        </span>
        {isCollection && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex-shrink-0">repeatable</span>
        )}
        {section.condition && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold flex-shrink-0">conditional</span>
        )}
        <button
          onClick={() => setShowSettings(s => !s)}
          title="Section settings"
          className={cn(
            "flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-blue-500 text-xs transition-colors",
            showSettings && "bg-blue-100 dark:bg-blue-900/40 text-blue-600"
          )}>⚙</button>
        {onDeleteSection && (
          <button onClick={onDeleteSection} className="text-gray-300 hover:text-red-500 text-sm flex-shrink-0">×</button>
        )}
      </div>

      {/* Section settings panel */}
      {showSettings && (
        <div className="px-4 py-3 bg-blue-50/40 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900 space-y-3 text-xs">
          {/* Description */}
          <div>
            <label className="block text-gray-500 mb-1 font-medium">Description</label>
            <input value={section.description ?? ""} placeholder="Optional description shown above fields"
              onChange={e => onUpdateSection({ description: e.target.value || undefined })}
              className="w-full rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs bg-white dark:bg-gray-800 focus:border-blue-400 focus:outline-none" />
          </div>

          {/* Repeatable (Collection) toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-gray-700 dark:text-gray-200 font-semibold">Repeatable section</p>
                <p className="text-gray-400 text-[10px] mt-0.5">Adds an "Add Item" button — users can fill multiple entries</p>
              </div>
              <button type="button" onClick={() => toggleCollection(!isCollection)}
                className={cn("relative inline-flex h-5 w-9 rounded-full transition-colors flex-shrink-0 ml-2", isCollection ? "bg-blue-600" : "bg-gray-300")}>
                <span className={cn("inline-block h-3 w-3 mt-1 rounded-full bg-white transition-transform", isCollection ? "translate-x-5" : "translate-x-1")} />
              </button>
            </div>

            {isCollection && (
              <div className="mt-2 space-y-2 pl-3 border-l-2 border-blue-200 dark:border-blue-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-gray-500 mb-1">Add button label</label>
                    <input value={coll.add_label ?? "Add Item"}
                      onChange={e => onUpdateSection({ collection: { ...coll, add_label: e.target.value } })}
                      className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Remove button label</label>
                    <input value={coll.remove_label ?? "Remove"}
                      onChange={e => onUpdateSection({ collection: { ...coll, remove_label: e.target.value } })}
                      className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-gray-500 mb-1">Min items</label>
                    <input type="number" min={0} value={coll.min_items ?? ""}
                      onChange={e => onUpdateSection({ collection: { ...coll, min_items: e.target.value ? Number(e.target.value) : undefined } })}
                      placeholder="0" className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Max items</label>
                    <input type="number" min={1} value={coll.max_items ?? ""}
                      onChange={e => onUpdateSection({ collection: { ...coll, max_items: e.target.value ? Number(e.target.value) : undefined } })}
                      placeholder="∞" className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-500 mb-1">Item title template</label>
                  <input value={coll.item_title_template ?? ""}
                    onChange={e => onUpdateSection({ collection: { ...coll, item_title_template: e.target.value || undefined } })}
                    placeholder="{{index}}. {{fields.name}}"
                    className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs font-mono bg-white focus:border-blue-400 focus:outline-none" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Sortable items</span>
                  <button type="button" onClick={() => onUpdateSection({ collection: { ...coll, sortable: !coll.sortable } })}
                    className={cn("relative inline-flex h-5 w-9 rounded-full transition-colors", coll.sortable ? "bg-blue-600" : "bg-gray-300")}>
                    <span className={cn("inline-block h-3 w-3 mt-1 rounded-full bg-white transition-transform", coll.sortable ? "translate-x-5" : "translate-x-1")} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bind prefix */}
          <div>
            <label className="block text-gray-500 mb-1 font-medium">Bind prefix</label>
            <input value={section.bind_prefix ?? ""} placeholder="optional.path.prefix"
              onChange={e => onUpdateSection({ bind_prefix: e.target.value || undefined })}
              className="w-full rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs font-mono bg-white dark:bg-gray-800 focus:border-blue-400 focus:outline-none" />
          </div>
        </div>
      )}

      {/* Fields list */}
      <div className="p-3 space-y-2">
        {(section.fields ?? []).length === 0 && (
          <div className="py-5 text-center text-xs text-gray-400">
            Drag a field here or click one in the palette
          </div>
        )}
        {(section.fields ?? []).map((field, fIdx) => (
          <FieldCard key={field.id} field={field} index={fIdx}
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
      {condition && <span className="text-purple-400 text-xs flex-shrink-0">⚡</span>}
      <div className={cn("flex gap-0.5 flex-shrink-0", isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        {onMoveUp && <button type="button" onClick={e => { e.stopPropagation(); onMoveUp(); }} className="p-0.5 text-gray-400 hover:text-gray-700 text-xs">↑</button>}
        {onMoveDown && <button type="button" onClick={e => { e.stopPropagation(); onMoveDown(); }} className="p-0.5 text-gray-400 hover:text-gray-700 text-xs">↓</button>}
        <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }} className="p-0.5 text-gray-300 hover:text-red-500 text-xs">✕</button>
      </div>
    </div>
  );
}

// ─── Field Inspector ──────────────────────────────────────────────────────────
function FieldInspector({ field, onChange, onChangeType }: {
  field: FormField;
  onChange: (patch: Partial<FormField>) => void;
  onChangeType: (newType: string) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const type = (field as unknown as Record<string, unknown>).type as string;
  const f = field as unknown as Record<string, unknown>;

  return (
    <div className="p-4 space-y-3 text-xs">
      {/* ── Type selector — dynamically branches all config below ─────────── */}
      <div className="pb-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-mono truncate flex-1 text-[10px]">{field.id}</span>
        </div>
        <div>
          <label className="block text-gray-500 mb-1 font-medium">Field Type</label>
          <select
            value={type}
            onChange={e => onChangeType(e.target.value)}
            className="w-full rounded-md border border-blue-200 dark:border-blue-800 px-2 py-1.5 text-xs bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 font-semibold focus:border-blue-400 focus:outline-none">
            {GROUPS.map(group => (
              <optgroup key={group} label={group}>
                {FIELD_TYPES.filter(ft => ft.group === group).map(ft => (
                  <option key={ft.type} value={ft.type}>{ft.icon} {ft.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
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
        <span className="text-gray-500">Advanced (pro)</span>
        <Toggle checked={!!field.advanced} onChange={v => onChange({ advanced: v } as Partial<FormField>)} />
      </div>

      {/* ── Type-specific branching config ─────────────────────────────────── */}
      <TypeBranchConfig type={type} f={f} onChange={onChange} />

      {/* More options */}
      <button type="button" onClick={() => setShowMore(o => !o)}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors text-xs">
        <span className={cn("transition-transform text-[10px]", showMore && "rotate-90")}>▶</span>
        {showMore ? "Hide advanced" : "More options"}
      </button>

      {showMore && (
        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <TypeBranchAdvanced type={type} f={f} onChange={onChange} />
          <div>
            <p className="text-gray-500 font-medium mb-2">Visibility Condition</p>
            <ConditionEditor
              condition={f.condition as ConditionOrRef | undefined}
              onChange={cond => onChange({ condition: cond } as Partial<FormField>)}
            />
          </div>
          <div>
            <p className="text-gray-500 font-medium mb-2">Compliance</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500">Personal data</span>
              <Toggle checked={!!field.personal_data} onChange={v => onChange({ personal_data: v } as Partial<FormField>)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Hidden / UI-only</span>
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

// ─── Branching type-specific config (shown inline, not collapsed) ─────────────
function TypeBranchConfig({ type, f, onChange }: {
  type: string; f: Record<string, unknown>; onChange: (p: Partial<FormField>) => void;
}) {
  // text / multiline
  if (type === "text" || type === "multiline") return (
    <>
      <InspField label="Placeholder">
        <InspInput value={(f.placeholder as string) ?? ""} onChange={v => onChange({ placeholder: v } as Partial<FormField>)} />
      </InspField>
      <InspField label="Hint">
        <InspInput value={(f.hint as string) ?? ""} onChange={v => onChange({ hint: v } as Partial<FormField>)} />
      </InspField>
      {type === "text" && (
        <InspField label="Display as">
          <select value={(f.display_as as string) ?? "input"} onChange={e => onChange({ display_as: e.target.value } as Partial<FormField>)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none">
            <option value="input">Text</option><option value="password">Password</option>
            <option value="email">Email</option><option value="url">URL</option>
            <option value="tel">Phone</option><option value="search">Search</option>
          </select>
        </InspField>
      )}
      {type === "multiline" && (
        <InspField label="Rows">
          <input type="number" min={2} max={20} value={(f.rows as number) ?? 4}
            onChange={e => onChange({ rows: Number(e.target.value) } as Partial<FormField>)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
        </InspField>
      )}
    </>
  );

  // number
  if (type === "number") return (
    <>
      <InspField label="Display as">
        <select value={(f.display_as as string) ?? "input"} onChange={e => onChange({ display_as: e.target.value } as Partial<FormField>)}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none">
          <option value="input">Input</option><option value="slider">Slider</option><option value="stepper">Stepper</option>
        </select>
      </InspField>
      <div className="grid grid-cols-2 gap-2">
        <InspField label="Min">
          <input type="number" value={(f.min as number) ?? ""}
            onChange={e => onChange({ min: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
        </InspField>
        <InspField label="Max">
          <input type="number" value={(f.max as number) ?? ""}
            onChange={e => onChange({ max: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
        </InspField>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <InspField label="Prefix"><InspInput value={(f.prefix as string) ?? ""} onChange={v => onChange({ prefix: v } as Partial<FormField>)} placeholder="$" /></InspField>
        <InspField label="Suffix"><InspInput value={(f.suffix as string) ?? ""} onChange={v => onChange({ suffix: v } as Partial<FormField>)} placeholder="kg" /></InspField>
      </div>
    </>
  );

  // boolean
  if (type === "boolean") return (
    <InspField label="Display as">
      <select value={(f.display_as as string) ?? "switch"} onChange={e => onChange({ display_as: e.target.value } as Partial<FormField>)}
        className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none">
        <option value="switch">Toggle switch</option><option value="checkbox">Checkbox</option><option value="yes-no-radio">Yes / No radio</option>
      </select>
    </InspField>
  );

  // select / multiselect
  if (type === "select" || type === "multiselect") return (
    <>
      <InspField label="Display as">
        <select value={(f.display_as as string) ?? "auto"} onChange={e => onChange({ display_as: e.target.value } as Partial<FormField>)}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none">
          {type === "select" ? (
            <><option value="auto">Auto</option><option value="dropdown">Dropdown</option><option value="radio">Radio buttons</option><option value="button-group">Button group</option></>
          ) : (
            <><option value="auto">Auto</option><option value="dropdown">Dropdown</option><option value="checkbox">Checkboxes</option><option value="tag-input">Tag input</option></>
          )}
        </select>
      </InspField>
      <ChoicesEditor choices={f.choices} onChange={choices => onChange({ choices } as Partial<FormField>)} />
    </>
  );

  // rating
  if (type === "rating") return (
    <>
      <InspField label="Display as">
        <select value={(f.display_as as string) ?? "stars"} onChange={e => onChange({ display_as: e.target.value } as Partial<FormField>)}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none">
          <option value="stars">Stars</option><option value="numeric-scale">Numeric scale</option><option value="emoji-scale">Emoji scale</option>
        </select>
      </InspField>
      <InspField label="Max">
        <input type="number" min={2} max={10} value={(f.max as number) ?? 5}
          onChange={e => onChange({ max: Number(e.target.value) } as Partial<FormField>)}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
      </InspField>
    </>
  );

  // file
  if (type === "file") return (
    <>
      <InspField label="Accept (MIME / extension)">
        <InspInput value={(f.accept as string) ?? ""} onChange={v => onChange({ accept: v } as Partial<FormField>)} placeholder=".pdf,image/*" mono />
      </InspField>
      <div className="grid grid-cols-2 gap-2">
        <InspField label="Max files">
          <input type="number" min={1} value={(f.max_files as number) ?? 1}
            onChange={e => onChange({ max_files: Number(e.target.value) } as Partial<FormField>)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
        </InspField>
        <InspField label="Max size (MB)">
          <input type="number" min={1} value={(f.max_size_mb as number) ?? ""}
            onChange={e => onChange({ max_size_mb: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
        </InspField>
      </div>
    </>
  );

  // color
  if (type === "color") return (
    <InspField label="Format">
      <select value={(f.format as string) ?? "hex"} onChange={e => onChange({ format: e.target.value } as Partial<FormField>)}
        className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none">
        <option value="hex">HEX (#rrggbb)</option><option value="rgba">RGBA</option><option value="hsl">HSL</option>
      </select>
    </InspField>
  );

  // date / datetime / daterange
  if (type === "date" || type === "datetime" || type === "daterange") return (
    <>
      {"use_current" in defaultField(type, 0) || type !== "daterange" ? (
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Use current date</span>
          <Toggle checked={!!(f.use_current)} onChange={v => onChange({ use_current: v } as Partial<FormField>)} />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <InspField label="Min date"><InspInput value={(f.min_date as string) ?? ""} onChange={v => onChange({ min_date: v || undefined } as Partial<FormField>)} placeholder="YYYY-MM-DD" mono /></InspField>
        <InspField label="Max date"><InspInput value={(f.max_date as string) ?? ""} onChange={v => onChange({ max_date: v || undefined } as Partial<FormField>)} placeholder="YYYY-MM-DD" mono /></InspField>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-500">Disable weekends</span>
        <Toggle checked={!!(f.disable_weekends)} onChange={v => onChange({ disable_weekends: v } as Partial<FormField>)} />
      </div>
    </>
  );

  // time
  if (type === "time") return (
    <div className="grid grid-cols-2 gap-2">
      <InspField label="Min time"><InspInput value={(f.min_time as string) ?? ""} onChange={v => onChange({ min_time: v || undefined } as Partial<FormField>)} placeholder="09:00" mono /></InspField>
      <InspField label="Max time"><InspInput value={(f.max_time as string) ?? ""} onChange={v => onChange({ max_time: v || undefined } as Partial<FormField>)} placeholder="18:00" mono /></InspField>
    </div>
  );

  // hidden
  if (type === "hidden") return (
    <>
      <InspField label="Value from">
        <select value={(f.value_from as string) ?? "default"} onChange={e => onChange({ value_from: e.target.value } as Partial<FormField>)}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none">
          <option value="default">Default</option><option value="context">Context key</option>
          <option value="query-param">Query param</option><option value="computed">Computed</option>
        </select>
      </InspField>
      {(f.value_from as string) === "context" && (
        <InspField label="Context key"><InspInput value={(f.context_key as string) ?? ""} onChange={v => onChange({ context_key: v } as Partial<FormField>)} mono placeholder="user.id" /></InspField>
      )}
      {(f.value_from as string) === "query-param" && (
        <InspField label="Query param"><InspInput value={(f.query_param as string) ?? ""} onChange={v => onChange({ query_param: v } as Partial<FormField>)} mono placeholder="ref" /></InspField>
      )}
    </>
  );

  // json
  if (type === "json") return (
    <>
      <InspField label="Rows">
        <input type="number" min={2} max={30} value={(f.rows as number) ?? 8}
          onChange={e => onChange({ rows: Number(e.target.value) } as Partial<FormField>)}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
      </InspField>
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-2 text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
        💡 For structured lists (like permissions or sub-roles), use a <strong>Repeatable section</strong> instead — it opens a proper form per item rather than a raw JSON editor.
      </div>
    </>
  );

  // signature
  if (type === "signature") return (
    <div className="grid grid-cols-2 gap-2">
      <InspField label="Canvas width">
        <input type="number" value={(f.canvas_width as number) ?? 400}
          onChange={e => onChange({ canvas_width: Number(e.target.value) } as Partial<FormField>)}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
      </InspField>
      <InspField label="Canvas height">
        <input type="number" value={(f.canvas_height as number) ?? 200}
          onChange={e => onChange({ canvas_height: Number(e.target.value) } as Partial<FormField>)}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
      </InspField>
    </div>
  );

  return null;
}

// ─── Advanced type-specific config (under "More options") ─────────────────────
function TypeBranchAdvanced({ type, f, onChange }: {
  type: string; f: Record<string, unknown>; onChange: (p: Partial<FormField>) => void;
}) {
  if (type === "text") return (
    <>
      <div className="grid grid-cols-2 gap-2">
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
      </div>
      <InspField label="Pattern (regex)">
        <InspInput value={(f.pattern as string) ?? ""} onChange={v => onChange({ pattern: v } as Partial<FormField>)} mono placeholder="^[A-Z]{2}[0-9]+$" />
      </InspField>
      <InspField label="Pattern message">
        <InspInput value={(f.pattern_message as string) ?? ""} onChange={v => onChange({ pattern_message: v } as Partial<FormField>)} placeholder="Invalid format" />
      </InspField>
    </>
  );

  if (type === "multiselect") return (
    <div className="grid grid-cols-2 gap-2">
      <InspField label="Min selected">
        <input type="number" min={0} value={(f.min_selected as number) ?? ""}
          onChange={e => onChange({ min_selected: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
      </InspField>
      <InspField label="Max selected">
        <input type="number" min={1} value={(f.max_selected as number) ?? ""}
          onChange={e => onChange({ max_selected: e.target.value ? Number(e.target.value) : undefined } as Partial<FormField>)}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
      </InspField>
    </div>
  );

  return null;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
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
      className={cn("relative inline-flex h-5 w-9 rounded-full transition-colors flex-shrink-0", checked ? "bg-blue-600" : "bg-gray-300")}>
      <span className={cn("inline-block h-3 w-3 mt-1 rounded-full bg-white transition-transform", checked ? "translate-x-5" : "translate-x-1")} />
    </button>
  );
}

function ChoicesEditor({ choices, onChange }: { choices: unknown; onChange: (c: unknown) => void }) {
  const isDynamic = !Array.isArray(choices) && choices != null && typeof choices === "object" && "dynamic" in (choices as object);
  const staticList: Array<{value:string;label:string}> = isDynamic
    ? []
    : Array.isArray(choices) ? choices as Array<{value:string;label:string}>
    : (choices as {static?: Array<{value:string;label:string}>})?.static ?? [];

  type DynCfg = { url: string; value_key: string; label_key: string; cache_ttl_seconds?: number };
  const dynCfg: DynCfg = isDynamic
    ? (choices as {dynamic: DynCfg}).dynamic
    : { url: "", value_key: "id", label_key: "name" };

  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        <p className="text-gray-500 flex-1">Choices</p>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
          <button type="button"
            onClick={() => !isDynamic || onChange([{ value: "opt1", label: "Option 1" }, { value: "opt2", label: "Option 2" }])}
            className={cn("px-2 py-0.5 transition-colors", !isDynamic ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50")}>
            Static
          </button>
          <button type="button"
            onClick={() => isDynamic || onChange({ dynamic: { url: "", value_key: "id", label_key: "name" } })}
            className={cn("px-2 py-0.5 transition-colors", isDynamic ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50")}>
            Dynamic
          </button>
        </div>
      </div>

      {isDynamic ? (
        <div className="space-y-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-2">
          <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide mb-1.5">REST Data Source</p>
          <InspField label="Endpoint URL"><InspInput value={dynCfg.url} onChange={v => onChange({ dynamic: { ...dynCfg, url: v } })} placeholder="/api/options" mono /></InspField>
          <div className="grid grid-cols-2 gap-1.5">
            <InspField label="Value key"><InspInput value={dynCfg.value_key} onChange={v => onChange({ dynamic: { ...dynCfg, value_key: v } })} placeholder="id" mono /></InspField>
            <InspField label="Label key"><InspInput value={dynCfg.label_key} onChange={v => onChange({ dynamic: { ...dynCfg, label_key: v } })} placeholder="name" mono /></InspField>
          </div>
          <InspField label="Cache (seconds)">
            <input type="number" min={0} value={dynCfg.cache_ttl_seconds ?? 60}
              onChange={e => onChange({ dynamic: { ...dynCfg, cache_ttl_seconds: Number(e.target.value) } })}
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none" />
          </InspField>
        </div>
      ) : (
        <>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {staticList.map((c, i) => (
              <div key={i} className="flex gap-1">
                <input value={c.label} placeholder="Label"
                  onChange={e => onChange(staticList.map((x,j) => j===i ? {...x,label:e.target.value} : x))}
                  className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs bg-white focus:border-blue-400 focus:outline-none" />
                <input value={c.value} placeholder="value"
                  onChange={e => onChange(staticList.map((x,j) => j===i ? {...x,value:e.target.value} : x))}
                  className="w-20 rounded-md border border-gray-200 px-2 py-1 text-xs font-mono bg-white focus:border-blue-400 focus:outline-none" />
                <button type="button" onClick={() => onChange(staticList.filter((_,j) => j!==i))}
                  className="text-gray-300 hover:text-red-500 px-1 text-sm">✕</button>
              </div>
            ))}
          </div>
          <button type="button"
            onClick={() => onChange([...staticList, {value:`opt_${staticList.length+1}`,label:`Option ${staticList.length+1}`}])}
            className="mt-1.5 text-xs text-blue-600 hover:underline">+ Add option</button>
        </>
      )}
    </div>
  );
}

function ConditionEditor({ condition, onChange }: {
  condition: ConditionOrRef | undefined; onChange: (c: ConditionOrRef | undefined) => void;
}) {
  const cond = condition as Record<string,unknown> | undefined;
  const hasSimple = cond && "field" in cond && "op" in cond;
  if (!hasSimple) return (
    <button type="button" onClick={() => onChange({ field: "", op: "eq", value: "" } as ConditionOrRef)}
      className="text-xs text-blue-600 hover:underline">+ Add condition</button>
  );
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
  if (branches.length === 0) return (
    <button type="button"
      onClick={() => onChange([{ condition: { field: "", op: "eq", value: "" }, goto: "" }])}
      className="text-xs text-blue-600 hover:underline">+ Add branch rule</button>
  );
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
