"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/api";
import { VisualUIBuilder } from "@/components/UIBuilder/VisualUIBuilder";
import { toast } from "sonner";
import { cn } from "@form-engine/libs/utils";
import { ComponentType, LayoutDirection, UISystemManifest } from "@form-engine/components/UIEngine";

// ─── Starter manifest ─────────────────────────────────────────────────────────

const STARTER_MANIFEST: UISystemManifest = {
  manifest_id: "my_app_ui",
  manifest_version: "1.0.0",
  description: "My application UI system",
  namespaces: ["core", "schemata", "uam", "form", "ui"],
  active_theme: "default",
  engine: { mode: "reactive", error_mode: "collect-all" },
  forms: {},
  screens: {
    home: {
      name: "home",
      label: "Home",
      is_home: true,
      nav_order: 0,
      components: [{ component_ref: "main_content", direction: LayoutDirection.Center }],
      auth_rules: { require_auth: false },
    },
  },
  components: {
    main_content: {
      name: "main_content",
      label: "Main Content",
      type: ComponentType.Card,
      text: "Welcome to the app",
    },
  },
  navigation: {
    type: "stack",
    initial_screen: "home",
    routes: {
      home: { screen: "home", path: "/", auth_required: false },
    },
  },
  themes: {},
};

// ─── Page inner ───────────────────────────────────────────────────────────────

function UIBuilderPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const existingId = searchParams.get("manifest");

  const [manifest, setManifest] = useState<UISystemManifest>(STARTER_MANIFEST);
  const [loading, setLoading] = useState(!!existingId);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [yamlContent, setYamlContent] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Load existing if manifest param given
  useEffect(() => {
    if (!existingId) return;
    api.getManifest(existingId)
      .then(m => {
        // Cast — the manifest may contain ui-system fields
        setManifest(m as unknown as UISystemManifest);
      })
      .catch(() => toast.error("Failed to load manifest"))
      .finally(() => setLoading(false));
  }, [existingId]);

  const handleChange = useCallback((updated: UISystemManifest) => {
    setManifest(updated);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (existingId) {
        await api.updateManifest(existingId, manifest as never);
        toast.success("UI manifest updated!");
      } else {
        const r = await api.upsertManifest(manifest as never);
        toast.success(`Saved as "${r.manifest_id}"`);
        router.push(`/ui-builder?manifest=${r.manifest_id}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const { stringify } = await import("yaml");
      const yaml = stringify(manifest, { indent: 2 });
      const blob = new Blob([yaml], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${manifest.manifest_id ?? "ui_manifest"}.yaml`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported as YAML!");
    } catch { toast.error("Export failed"); }
  };

  const handleImportYaml = async () => {
    if (!yamlContent.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const { parse } = await import("yaml");
      const parsed = parse(yamlContent) as UISystemManifest;
      if (!parsed?.manifest_id) throw new Error("manifest_id is required");
      setManifest(parsed);
      setShowImport(false);
      toast.success(`Loaded manifest "${parsed.manifest_id}"`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Invalid YAML");
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setYamlContent(text);
      setShowImport(true);
    } catch { toast.error("Could not read file"); }
    e.target.value = "";
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Back */}
          <Link href="/" className="text-gray-400 hover:text-blue-600 text-sm flex-shrink-0">⬅</Link>
          <span className="text-gray-300 dark:text-gray-600 hidden sm:block">|</span>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-blue-600 font-semibold">🏗 UI Builder</span>
            {existingId && (
              <>
                <span className="text-gray-300">/</span>
                <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                  {existingId}
                </span>
              </>
            )}
          </div>

          {/* Manifest info badge */}
          <span className="hidden sm:inline text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            {manifest.manifest_id} · {
              Object.keys(manifest.screens ?? {}).length} screens · {
              Object.keys(manifest.components ?? {}).length} components
          </span>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Import */}
            <label className="btn-secondary text-xs py-1.5 cursor-pointer">
              ⬆ Import YAML
              <input type="file" accept=".yaml,.yml" className="sr-only" onChange={handleFileUpload} />
            </label>

            {/* Paste YAML */}
            <button
              onClick={() => setShowImport(s => !s)}
              className={cn("btn-secondary text-xs py-1.5", showImport && "bg-blue-50 text-blue-700 border-blue-200")}
            >
              📋 Paste YAML
            </button>

            {/* Export */}
            <button onClick={handleExport} className="btn-secondary text-xs py-1.5">
              ⬇ Export
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-xs py-1.5"
            >
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Saving…
                </span>
              ) : existingId ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </header>

      {/* ── YAML import panel ────────────────────────────────────────── */}
      {showImport && (
        <div className="bg-gray-950 border-b border-gray-800 px-4 py-3">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Paste UISystemManifest YAML</span>
              <button onClick={() => { setShowImport(false); setImportError(null); }}
                className="text-gray-500 hover:text-white text-sm">×</button>
            </div>
            <textarea
              value={yamlContent}
              onChange={e => setYamlContent(e.target.value)}
              rows={8}
              spellCheck={false}
              className="w-full bg-gray-900 text-green-300 font-mono text-xs rounded-xl px-4 py-3 border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
              placeholder={`manifest_id: my_app_ui\nmanifest_version: "1.0.0"\nscreens:\n  home:\n    name: home\n    label: Home Page\n    ...`}
            />
            {importError && (
              <p className="text-xs text-red-400 font-mono">⚠ {importError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleImportYaml}
                disabled={importing || !yamlContent.trim()}
                className="btn-primary text-xs py-1.5"
              >
                {importing ? "Parsing…" : "Load into Builder"}
              </button>
              <button onClick={() => setYamlContent("")} className="btn-secondary text-xs py-1.5">
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main builder ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden" style={{ height: "calc(100vh - 49px)" }}>
        {loading ? (
          <div className="flex items-center justify-center h-full gap-3 text-gray-400">
            <span className="h-7 w-7 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
            Loading manifest…
          </div>
        ) : (
          <VisualUIBuilder
            initialManifest={manifest}
            onChange={handleChange}
          />
        )}
      </div>
    </div>
  );
}

export default function UIBuilderPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <span className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
      </div>
    }>
      <UIBuilderPageInner />
    </Suspense>
  );
}
