"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/libs/api";
import { FormEngine } from "@form-engine/components/FormEngine";
import { VisualFormBuilder } from "@/components/FormBuilder/VisualFormBuilder";
import type { FormManifest } from "@form-engine/libs/types";
import { toast } from "sonner";
import { cn } from "@form-engine/libs/utils";

const STARTER_YAML = `manifest_id: my_manifest
manifest_version: "4.0.0"
engine:
  mode: reactive
  error_mode: collect-all

forms:
  contact_form:
    title: Contact Us
    description: We'd love to hear from you.
    version: "1.0.0"
    form_state: active
    layout:
      type: single-page
    submit_label: Send Message
    on_submit:
      type: none
      success_message: "Thanks! We'll be in touch."
    sections:
      - id: contact_info
        title: Your Details
        fields:
          - id: name
            type: text
            label: Full Name
            required: true
            width: half
          - id: email
            type: text
            label: Email Address
            required: true
            width: half
          - id: message
            type: multiline
            label: Message
            required: true
            rows: 4
`;

type EditorMode = "visual" | "yaml" | "json";
type PanelMode  = "preview" | "json" | "schema";

function BuilderPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const existingId  = searchParams.get("manifest");
  const categoryId  = searchParams.get("category");

  const [editorMode,  setEditorMode]  = useState<EditorMode>("visual");
  const [panelMode,   setPanelMode]   = useState<PanelMode>("preview");
  const [yamlContent, setYamlContent] = useState(STARTER_YAML);
  const [parsed,      setParsed]      = useState<FormManifest | null>(null);
  const [parseError,  setParseError]  = useState<string | null>(null);
  const [previewFid,  setPreviewFid]  = useState("contact_form");
  const [saving,      setSaving]      = useState(false);
  const [validating,  setValidating]  = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"editor" | "preview">("editor");

  // Load existing manifest
  useEffect(() => {
    if (!existingId) {
      if (categoryId) {
        // Pre-fill manifest_id from category
        setYamlContent(STARTER_YAML.replace("my_manifest", categoryId));
      }
      return;
    }
    api.getManifest(existingId).then(async m => {
      const { stringify } = await import("yaml");
      setYamlContent(stringify(m));
      setParsed(m);
      const fids = Object.keys(m.forms ?? {});
      if (fids.length) setPreviewFid(fids[0]);
    }).catch(() => toast.error("Failed to load manifest"));
  }, [existingId, categoryId]);

  // Parse content (text modes)
  useEffect(() => {
    if (editorMode === "visual") return;
    const t = setTimeout(async () => {
      try {
        let p: FormManifest;
        if (editorMode === "json") p = JSON.parse(yamlContent);
        else { const { parse } = await import("yaml"); p = parse(yamlContent) as FormManifest; }
        setParsed(p); setParseError(null);
        const fids = Object.keys(p.forms ?? {});
        if (fids.length && !fids.includes(previewFid)) setPreviewFid(fids[0]);
      } catch (e) { setParseError(e instanceof Error ? e.message : "Parse error"); }
    }, 350);
    return () => clearTimeout(t);
  }, [yamlContent, editorMode]);

  const handleVisualChange = useCallback(async (updated: FormManifest) => {
    setParsed(updated); setParseError(null);
    try { const { stringify } = await import("yaml"); setYamlContent(stringify(updated)); }
    catch { /* silent */ }
  }, []);

  const switchMode = async (mode: EditorMode) => {
    if (mode === editorMode) return;
    if (parsed) {
      try {
        if (mode === "json") setYamlContent(JSON.stringify(parsed, null, 2));
        else if (mode === "yaml") { const { stringify } = await import("yaml"); setYamlContent(stringify(parsed)); }
      } catch { /* keep existing */ }
    }
    setEditorMode(mode);
  };

  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      if (existingId) {
        await api.updateManifest(existingId, parsed as never);
        toast.success("Updated!");
      } else {
        const r = await api.upsertManifest(parsed as never);
        toast.success(`Saved as "${r.manifest_id}"`);
        router.push(`/builder?manifest=${r.manifest_id}`);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const handleValidate = async () => {
    if (!parsed) return;
    setValidating(true);
    try {
      const r = await api.validateManifest(parsed as never);
      if (r.valid) toast.success(`✅ Valid — ${r.forms?.length ?? 0} form(s)`);
      else toast.error("Invalid", { description: r.error });
    } catch { toast.error("Validation error"); }
    finally { setValidating(false); }
  };

  const formIds = Object.keys(parsed?.forms ?? {});
  const activeForm = parsed?.forms?.[previewFid];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/" className="text-gray-400 hover:text-blue-600 text-sm font-medium flex-shrink-0">⬅</Link>
          <span className="text-gray-300 dark:text-gray-600 hidden sm:block">|</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-white truncate hidden sm:block max-w-[200px]">
            {existingId ?? "New Manifest"}
          </span>
          {parseError && <span className="badge bg-red-100 text-red-700 text-xs hidden sm:inline-flex">⚠ Error</span>}
          {!parseError && parsed && <span className="badge bg-green-100 text-green-700 text-xs hidden sm:inline-flex">✓ {formIds.length} form{formIds.length !== 1 ? "s" : ""}</span>}

          {/* Mode switcher — hidden on mobile visual */}
          <div className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 ml-2">
            {(["visual", "yaml", "json"] as EditorMode[]).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all",
                  editorMode === m ? "bg-white dark:bg-gray-700 text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}>
                {m === "visual" ? "🎨 Visual" : m.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Mobile: editor/preview tabs */}
          <div className="md:hidden flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 ml-auto">
            {(["editor","preview"] as const).map(p => (
              <button key={p} onClick={() => setMobilePanel(p)}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all capitalize",
                  mobilePanel === p ? "bg-white dark:bg-gray-700 text-gray-900 shadow-sm" : "text-gray-500"
                )}>
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto md:ml-0">
            <button onClick={handleValidate} disabled={validating || !parsed}
              className="btn-secondary text-xs py-1.5 hidden sm:flex">
              {validating ? "…" : "Validate"}
            </button>
            <button onClick={handleSave} disabled={saving || !!parseError || !parsed}
              className="btn-primary text-xs py-1.5">
              {saving ? "Saving…" : existingId ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Split pane ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 49px)" }}>

        {/* Left: editor — hidden on mobile when preview tab active */}
        <div className={cn(
          "flex flex-col border-r border-gray-200 dark:border-gray-700 overflow-hidden transition-all",
          "w-full md:w-3/5",
          mobilePanel === "preview" && "hidden md:flex"
        )}>
          {editorMode === "visual" ? (
            parsed && formIds.length > 0 ? (
              <div className="flex flex-col h-full overflow-hidden">
                {formIds.length > 1 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 overflow-x-auto">
                    {formIds.map(id => (
                      <button key={id} onClick={() => setPreviewFid(id)}
                        className={cn("px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0",
                          previewFid === id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600")}>
                        {parsed.forms?.[id]?.title ?? id}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <VisualFormBuilder manifest={parsed} formId={previewFid} onChange={handleVisualChange} />
                </div>
              </div>
            ) : (
              <NewFormSetup
                defaultManifestId={categoryId ?? undefined}
                onCreateForm={(meta) => {
                  const m: FormManifest = {
                    manifest_id: meta.manifestId,
                    manifest_version: "4.0.0",
                    forms: {
                      [meta.formId]: {
                        title: meta.title,
                        version: "1.0.0",
                        form_state: "active",
                        layout: { type: meta.layoutType as "single-page" | "wizard" | "grid" },
                        sections: meta.layoutType !== "wizard"
                          ? [{ id: "section_1", title: "Section 1", fields: [] }]
                          : undefined,
                        pages: meta.layoutType === "wizard"
                          ? [{ id: "page_1", title: "Page 1", sections: [{ id: "s1", fields: [] }] }]
                          : undefined,
                      }
                    }
                  };
                  setParsed(m); setPreviewFid(meta.formId); handleVisualChange(m);
                }}
              />
            )
          ) : (
            <>
              {/* Mode switcher for mobile */}
              <div className="flex md:hidden border-b border-gray-800 bg-gray-950">
                {(["yaml", "json"] as EditorMode[]).map(m => (
                  <button key={m} onClick={() => switchMode(m)}
                    className={cn("px-4 py-2 text-xs font-medium uppercase transition-colors border-b-2",
                      editorMode === m ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500")}>
                    {m}
                  </button>
                ))}
                <button onClick={() => switchMode("visual")}
                  className="ml-auto px-4 py-2 text-xs text-gray-500">
                  🎨 Visual
                </button>
              </div>
              <div className="flex-1 relative bg-gray-950">
                <textarea value={yamlContent} onChange={e => setYamlContent(e.target.value)}
                  spellCheck={false}
                  className="absolute inset-0 w-full h-full resize-none px-4 py-4 font-mono text-xs text-green-300 bg-transparent focus:outline-none leading-relaxed" />
              </div>
              {parseError && (
                <div className="bg-red-950 border-t border-red-800 px-3 py-2 text-xs text-red-300 font-mono truncate">
                  ⚠ {parseError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: preview — hidden on mobile when editor tab active */}
        <div className={cn(
          "flex flex-col overflow-auto bg-gray-50 dark:bg-gray-950 transition-all",
          "w-full md:w-2/5",
          mobilePanel === "editor" && "hidden md:flex"
        )}>
          {/* Panel header */}
          <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500">Preview</span>
            {formIds.length > 1 && formIds.map(id => (
              <button key={id} onClick={() => setPreviewFid(id)}
                className={cn("px-2.5 py-1 rounded-lg text-xs font-medium",
                  previewFid === id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600")}>
                {id}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {(["preview","json"] as PanelMode[]).map(m => (
                <button key={m} onClick={() => setPanelMode(m)}
                  className={cn("px-2.5 py-1 text-xs rounded-md transition-colors",
                    panelMode === m ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500")}>
                  {m === "preview" ? "Form" : "JSON"}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4">
            {!parsed || !formIds.length ? (
              <div className="text-center py-16 text-gray-400">
                <span className="text-4xl block mb-3">🖊</span>
                <p className="text-sm">{editorMode === "visual" ? "Create a form to preview" : "Write a manifest to preview"}</p>
              </div>
            ) : panelMode === "json" ? (
              <pre className="text-xs font-mono bg-gray-900 text-green-300 rounded-xl p-4 overflow-auto max-h-[70vh]">
                {JSON.stringify(activeForm, null, 2)}
              </pre>
            ) : activeForm ? (
              <div className="bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="font-bold text-lg text-gray-900 dark:text-white">{activeForm.title}</h2>
                  {activeForm.description && <p className="text-sm text-gray-500 mt-1">{activeForm.description}</p>}
                </div>
                <FormEngine
                  key={`${previewFid}-${JSON.stringify(activeForm).length}`}
                  manifest={parsed}
                  formId={previewFid}
                  onSubmit={async (payload: {}) => {
                    toast.success("Preview submit ✓", { description: `${Object.keys(payload).length} fields` });
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewFormSetup({ onCreateForm, defaultManifestId }: {
  onCreateForm: (meta: { manifestId: string; formId: string; title: string; layoutType: string }) => void;
  defaultManifestId?: string;
}) {
  const [manifestId, setManifestId] = useState(defaultManifestId ?? "my_manifest");
  const [formId, setFormId] = useState("my_form");
  const [title, setTitle] = useState("My Form");
  const [layoutType, setLayoutType] = useState("single-page");
  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="w-full max-w-md form-card p-6">
        <h2 className="text-lg font-bold mb-1">New Form</h2>
        <p className="text-sm text-gray-500 mb-5">Configure to start building.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Form Title</label>
            <input value={title} onChange={e => { setTitle(e.target.value); setFormId(e.target.value.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"")); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="My Form" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Form ID</label>
              <input value={formId} onChange={e => setFormId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category ID</label>
              <input value={manifestId} onChange={e => setManifestId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Layout</label>
            <div className="grid grid-cols-3 gap-2">
              {[{value:"single-page",icon:"📄",label:"Single Page"},{value:"wizard",icon:"🧙",label:"Wizard"},{value:"grid",icon:"⊞",label:"Grid"}].map(opt => (
                <button key={opt.value} type="button" onClick={() => setLayoutType(opt.value)}
                  className={cn("flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs transition-all",
                    layoutType === opt.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300")}>
                  <span className="text-xl">{opt.icon}</span>{opt.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => onCreateForm({ manifestId, formId, title, layoutType })}
            disabled={!formId || !manifestId || !title} className="w-full btn-primary justify-center">
            Create Form →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><span className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" /></div>}>
      <BuilderPageInner />
    </Suspense>
  );
}
