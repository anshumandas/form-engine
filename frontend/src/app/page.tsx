"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { api } from "@form-engine/libs/api";
import { categoryApi, type CategorySummary } from "@form-engine/libs/api";
import type { ManifestSummary } from "@form-engine/libs/types";
import { formatDate, cn } from "@form-engine/libs/utils";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────
const STATE_COLORS: Record<string, string> = {
  active:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  draft:      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  deprecated: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  archived:   "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const LAYOUT_ICONS: Record<string, string> = {
  wizard:       "🧙",
  "single-page": "📄",
  grid:          "⊞",
};

const CATEGORY_COLORS = [
  "from-blue-500 to-blue-600",
  "from-violet-500 to-violet-600",
  "from-emerald-500 to-emerald-600",
  "from-rose-500 to-rose-600",
  "from-amber-500 to-amber-600",
  "from-cyan-500 to-cyan-600",
  "from-pink-500 to-pink-600",
  "from-indigo-500 to-indigo-600",
];

function categoryColor(id: string) {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

// ─── New Category Modal ───────────────────────────────────────────────────────
interface NewCategoryModalProps {
  onClose: () => void;
  onCreate: (category: CategorySummary) => void;
}

function NewCategoryModal({ onClose, onCreate }: NewCategoryModalProps) {
  const [name, setName] = useState("");
  const [catId, setCatId] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [idTouched, setIdTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  // Auto-derive ID from name unless user has manually edited it
  const handleNameChange = (v: string) => {
    setName(v);
    if (!idTouched) {
      setCatId(v.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
    }
  };

  const idValid = /^[a-z][a-z0-9_]*$/.test(catId);
  const canSubmit = name.trim().length > 0 && idValid && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const result = await categoryApi.create({
        name: name.trim(),
        category_id: catId,
        description: description.trim() || undefined,
      });
      toast.success(`Category "${result.name}" created!`);
      onCreate({
        category_id: result.category_id,
        name: result.name,
        description: description.trim() || undefined,
        form_count: 0,
      });
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 animate-slide-up">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Category</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                A category groups related forms together.
              </p>
            </div>
            <button onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">×</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. HR Forms, Customer Portal…"
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Category ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Category ID <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                value={catId}
                onChange={e => { setCatId(e.target.value); setIdTouched(true); }}
                placeholder="hr_forms"
                className={cn(
                  "w-full rounded-xl border px-3 py-2.5 text-sm font-mono bg-white dark:bg-gray-800 focus:outline-none focus:ring-2",
                  idValid || !catId
                    ? "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20"
                    : "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                )}
              />
              {catId && (
                <span className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 text-sm",
                  idValid ? "text-green-500" : "text-red-400"
                )}>
                  {idValid ? "✓" : "✗"}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Lowercase letters, numbers, underscores. Used in URLs and the API.
            </p>
            {catId && !idValid && (
              <p className="text-xs text-red-500 mt-1">Must start with a letter and contain only a–z, 0–9, _</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A short description of what forms this category contains…"
              rows={2}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>

          {/* Preview badge */}
          {name && catId && idValid && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-gradient-to-br",
                categoryColor(catId)
              )}>
                {name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{name}</p>
                <p className="text-xs text-gray-400 font-mono">{catId} · 0 forms</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary justify-center">
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit}
              className="flex-1 btn-primary justify-center">
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Creating…
                </span>
              ) : "Create Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────
function RenameCategoryModal({ manifest, onClose, onRename }: {
  manifest: ManifestSummary;
  onClose: () => void;
  onRename: (name: string, desc?: string) => void;
}) {
  const currentName = (manifest as ManifestSummary & { _category_name?: string })._category_name
    ?? manifest.manifest_id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const [name, setName] = useState(currentName);
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await categoryApi.rename(manifest.manifest_id, {
        name: name.trim(),
        category_id: manifest.manifest_id,
        description: desc.trim() || undefined,
      });
      toast.success("Category renamed");
      onRename(name.trim(), desc.trim() || undefined);
      onClose();
    } catch { toast.error("Rename failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700 animate-slide-up">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-white">Rename Category</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Optional"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm resize-none focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary justify-center">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()} className="flex-1 btn-primary justify-center">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [manifests, setManifests] = useState<ManifestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [renamingManifest, setRenamingManifest] = useState<ManifestSummary | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      setManifests(await api.listManifests());
    } catch { toast.error("Failed to load categories"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.uploadManifest(file);
      toast.success(`Uploaded "${result.manifest_id}" with ${result.forms.length} form(s)`);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally { setUploading(false); e.target.value = ""; }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"?\nThis will also remove all ${manifests.find(m => m.manifest_id === id)?.forms.length ?? 0} form(s) inside it. This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await api.deleteManifest(id);
      toast.success(`Deleted "${name}"`);
      setManifests(m => m.filter(x => x.manifest_id !== id));
    } catch { toast.error("Delete failed"); }
    finally { setDeletingId(null); }
  };

  const handleCategoryCreated = (cat: CategorySummary) => {
    // Add an empty ManifestSummary for the new category so it appears instantly
    setManifests(prev => [...prev, {
      manifest_id: cat.category_id,
      manifest_version: "4.0.0",
      forms: [],
      updated_at: new Date().toISOString(),
    } as ManifestSummary]);
  };

  const filtered = search.trim()
    ? manifests.filter(m =>
        m.manifest_id.includes(search.toLowerCase()) ||
        m.forms.some(f => f.title.toLowerCase().includes(search.toLowerCase()))
      )
    : manifests;

  const totalForms  = manifests.reduce((a, m) => a + m.forms.length, 0);
  const activeForms = manifests.reduce((a, m) => a + m.forms.filter(f => f.form_state === "active").length, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top Nav */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">⚡</div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Form Engine</h1>
              <p className="text-xs text-gray-400 leading-tight">v4.0.0</p>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-sm">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search categories or forms…"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowNewModal(true)} className="btn-primary text-sm gap-2">
              <span className="text-base leading-none">＋</span>
              New Category
            </button>
            <Link href="/create" className="btn-secondary text-sm">⚡ Form Builder</Link>
            <Link href="/chat" className="btn-secondary text-sm">💬 AI Chat</Link>
            <label className="btn-secondary text-sm cursor-pointer">
              {uploading ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                  Uploading…
                </span>
              ) : "⬆ Import"}
              <input type="file" accept=".yaml,.yml,.json" className="sr-only"
                onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Categories", value: manifests.length, icon: "🗂", color: "text-blue-600" },
            { label: "Total Forms", value: totalForms, icon: "📋", color: "text-violet-600" },
            { label: "Active Forms", value: activeForms, icon: "✅", color: "text-emerald-600" },
          ].map(s => (
            <div key={s.label} className="form-card p-5">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{s.icon}</span>
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-sm text-gray-500">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Category list */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
            <span className="h-7 w-7 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
            Loading categories…
          </div>
        ) : filtered.length === 0 && !search ? (
          <EmptyState onNew={() => setShowNewModal(true)} onUpload={handleUpload} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-2">No results for "{search}"</p>
            <button onClick={() => setSearch("")} className="text-blue-500 hover:underline text-sm">Clear search</button>
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map(manifest => (
              <CategoryCard
                key={manifest.manifest_id}
                manifest={manifest}
                onDelete={(name) => handleDelete(manifest.manifest_id, name)}
                onRename={() => setRenamingManifest(manifest)}
                deleting={deletingId === manifest.manifest_id}
              />
            ))}
          </div>
        )}
      </main>

      {/* Submissions quick link */}
      <div className="max-w-6xl mx-auto px-6 pb-8 text-center">
        <Link href="/submissions" className="text-sm text-gray-400 hover:text-blue-500 transition-colors">
          View all submissions →
        </Link>
      </div>

      {/* Modals */}
      {showNewModal && (
        <NewCategoryModal onClose={() => setShowNewModal(false)} onCreate={handleCategoryCreated} />
      )}
      {renamingManifest && (
        <RenameCategoryModal
          manifest={renamingManifest}
          onClose={() => setRenamingManifest(null)}
          onRename={(name) => {
            setManifests(prev => prev.map(m =>
              m.manifest_id === renamingManifest.manifest_id
                ? { ...m, _category_name: name } as ManifestSummary & { _category_name: string }
                : m
            ));
          }}
        />
      )}
    </div>
  );
}

// ─── Category Card ─────────────────────────────────────────────────────────────
function CategoryCard({ manifest, onDelete, onRename, deleting }: {
  manifest: ManifestSummary & { _category_name?: string };
  onDelete: (name: string) => void;
  onRename: () => void;
  deleting: boolean;
}) {
  const displayName = manifest._category_name
    ?? manifest.manifest_id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const grad = categoryColor(manifest.manifest_id);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="form-card overflow-hidden">
      {/* Category header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          {/* Gradient avatar */}
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-gradient-to-br shadow-sm",
            grad
          )}>
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-gray-900 dark:text-white truncate">{displayName}</h2>
              <span className="text-xs text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded flex-shrink-0">
                {manifest.manifest_id}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {manifest.forms.length} form{manifest.forms.length !== 1 ? "s" : ""}
              {manifest.updated_at && ` · Updated ${formatDate(manifest.updated_at)}`}
            </p>
          </div>
        </div>

        {/* Action menu */}
        <div className="relative flex-shrink-0">
          <div className="flex items-center gap-2">
            <Link href={`/submissions?manifest=${manifest.manifest_id}`}
              className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              Submissions
            </Link>
            <Link href={`/builder?manifest=${manifest.manifest_id}`}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300">
              Edit YAML
            </Link>
            {/* Kebab menu */}
            <div className="relative">
              <button onClick={() => setMenuOpen(o => !o)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors">
                ···
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-8 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 w-40">
                    <button onClick={() => { onRename(); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200">
                      ✎ Rename
                    </button>
                    <hr className="border-gray-100 dark:border-gray-800 my-1" />
                    <button
                      onClick={() => { onDelete(displayName); setMenuOpen(false); }}
                      disabled={deleting}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40">
                      {deleting ? "Deleting…" : "🗑 Delete"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Forms grid */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {manifest.forms.map(form => (
          <Link
            key={form.form_id}
            href={`/forms/${manifest.manifest_id}/${form.form_id}`}
            className="group relative block rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-400 hover:shadow-md transition-all bg-white dark:bg-gray-800/50"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xl">{LAYOUT_ICONS[form.layout_type] ?? "📋"}</span>
              <span className={`badge text-xs ${STATE_COLORS[form.form_state] ?? "bg-gray-100 text-gray-500"}`}>
                {form.form_state}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-blue-600 transition-colors leading-snug">
              {form.title}
            </h3>
            <p className="text-xs text-gray-400 mt-1 font-mono">{form.form_id}</p>
            <p className="text-xs text-gray-400 mt-1.5 capitalize">{form.layout_type.replace("-", " ")} layout</p>
          </Link>
        ))}

        {/* Add form tile */}
        <Link
          href={`/create?category=${manifest.manifest_id}`}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-4 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all min-h-[110px] group"
        >
          <span className="text-2xl group-hover:scale-110 transition-transform">+</span>
          <span className="text-xs font-medium">Add form</span>
        </Link>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ onNew, onUpload }: {
  onNew: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center text-4xl mb-6">
        🗂
      </div>
      <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">No categories yet</h2>
      <p className="text-gray-400 mb-8 max-w-sm text-sm leading-relaxed">
        Categories group related forms together. Create your first category, then add forms to it
        using the Form Builder or YAML editor.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button onClick={onNew} className="btn-primary gap-2">
          <span>＋</span> New Category
        </button>
        <Link href="/create" className="btn-secondary">⚡ Form Builder</Link>
        <label className="btn-secondary cursor-pointer">
          ⬆ Import YAML
          <input type="file" accept=".yaml,.yml,.json" className="sr-only" onChange={onUpload} />
        </label>
      </div>
    </div>
  );
}
