"use client";

/**
 * /ui/[manifestId]/page.tsx
 *
 * Lists every screen defined inside a UISystemManifest, letting users browse,
 * inspect the component tree, and navigate to individual screens.
 *
 * Layout
 * ──────
 *   ┌──── header (breadcrumb + manifest meta) ────────────────────────┐
 *   │  screens grid (cards)                  │  inspector panel        │
 *   │  – click a card to select it           │  – selected screen info │
 *   │  – each card shows name, theme,        │  – component placement  │
 *   │    component count, auth badge         │    tree with types      │
 *   └────────────────────────────────────────┴─────────────────────────┘
 *
 * Data
 * ────
 * Calls GET /api/ui/{manifestId} → full UISystemManifest JSON.
 * Falls back to a clear error state when the API is not yet wired up.
 */

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { uiApi } from "@/api";
import { type UISystemManifest, type SubComponentPlacement, LayoutDirection } from "@form-engine/components/UIEngine/types";

// ─── tiny helpers ─────────────────────────────────────────────────────────────

const DIRECTION_COLORS: Record<string, string> = {
  Left:     "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Right:    "bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300",
  Center:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Top:      "bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300",
  Bottom:   "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  Floating: "bg-pink-100   text-pink-700   dark:bg-pink-900/40   dark:text-pink-300",
  Modal:    "bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300",
};

const COMPONENT_TYPE_ICONS: Record<string, string> = {
  Custom:         "🧩",
  Form:           "📝",
  Table:          "📊",
  VerticalList:   "☰",
  HorizontalList: "⋯",
  Tree:           "🌳",
  Card:           "🗂",
  Tile:           "▦",
  Search:         "🔍",
  FileGallery:    "📂",
  FilterBuilder:  "⚙️",
  Avatar:         "👤",
};

const DIRECTION_ICONS: Record<string, string> = {
  Left: "◧", Right: "◨", Center: "◫", Top: "⬆", Bottom: "⬇", Floating: "◈", Modal: "◻",
};

function badge(text: string, cls: string) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {text}
    </span>
  );
}

// ─── Component tree node ──────────────────────────────────────────────────────

function ComponentNode({
  placement,
  manifest,
  depth = 0,
}: {
  placement: SubComponentPlacement;
  manifest: UISystemManifest;
  depth?: number;
}) {
  const component = manifest.components?.[placement.component_ref];
  const [open, setOpen] = useState(depth < 2);
  const subPlacements = component?.sub_components ?? [];
  const hasChildren = subPlacements.length > 0;
  const dirColor = DIRECTION_COLORS[placement.direction] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  const typeIcon = component ? (COMPONENT_TYPE_ICONS[component.type] ?? "◻") : "?";
  const dirIcon  = DIRECTION_ICONS[placement.direction] ?? "·";

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg group cursor-pointer select-none
          hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors`}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        {/* expand toggle */}
        <span className="w-4 text-center text-gray-300 dark:text-gray-600 text-xs flex-shrink-0">
          {hasChildren ? (open ? "▾" : "▸") : "·"}
        </span>

        {/* type icon */}
        <span className="text-sm w-5 text-center flex-shrink-0">{typeIcon}</span>

        {/* component name */}
        <span className="font-mono text-xs font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">
          {placement.component_ref}
        </span>

        {/* direction badge */}
        <span className={`hidden group-hover:inline-flex sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${dirColor}`}>
          <span>{dirIcon}</span>
          <span>{placement.direction}</span>
        </span>

        {/* span badge */}
        {placement.span && placement.span !== 1 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300 flex-shrink-0">
            ×{placement.span}
          </span>
        )}

        {/* hidden condition indicator */}
        {placement.hidden_condition && (
          <span title={`hidden when: ${placement.hidden_condition}`}
            className="text-[10px] text-amber-500 flex-shrink-0">⚡</span>
        )}
      </div>

      {/* sub_components */}
      {open && hasChildren && (
        <div className="border-l border-dashed border-gray-200 dark:border-gray-700 ml-4 mt-0.5 mb-1">
          {subPlacements.map((sub, i) => (
            <ComponentNode key={`${sub.component_ref}-${i}`} placement={sub} manifest={manifest} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inspector panel ──────────────────────────────────────────────────────────

function InspectorPanel({
  manifest,
  screenId,
}: {
  manifest: UISystemManifest;
  screenId: string | null;
}) {
  if (!screenId) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[240px] text-center p-8">
        <span className="text-4xl mb-3">👆</span>
        <p className="text-sm text-gray-500 dark:text-gray-400">Select a screen to inspect its component tree</p>
      </div>
    );
  }

  const screen = manifest.screens?.[screenId];
  if (!screen) return null;

  const placements = screen.components ?? [];
  const theme = screen.theme_ref ? manifest.themes?.[screen.theme_ref] : undefined;
  const formRefs = placements
    .map(p => manifest.components?.[p.component_ref])
    .filter(Boolean)
    .flatMap(c => c?.sub_components ?? [{direction: LayoutDirection.Center, component_ref: c!.form_ref} as SubComponentPlacement])
    .map(c => manifest.components?.[c.component_ref ?? (c as any).name])
    .filter(c => c?.form_ref)
    .map(c => c!.form_ref!);

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* screen header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white text-base leading-tight">
            {screen.label ?? screenId}
          </h3>
          {screen.nav_order != null && (
            <span className="text-xs text-gray-400 font-mono mt-0.5">nav#{screen.nav_order}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {screen.auth_rules?.require_auth
            ? badge("🔒 auth required", "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400")
            : badge("🌐 public", "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400")}
          {screen.theme_ref && badge(`🎨 ${screen.theme_ref}`,
            "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300")}
          {screen.auth_rules?.redirect_on_denied && badge(
            `↩ ${screen.auth_rules.redirect_on_denied}`,
            "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400")}
        </div>

        {/* theme preview swatch */}
        {theme?.preview_color && (
          <div className="mt-3 flex items-center gap-2">
            <span
              className="h-4 w-4 rounded-full border border-white/20 shadow-sm flex-shrink-0"
              style={{ background: `#${theme.preview_color}` }}
            />
            <span className="text-xs text-gray-400 font-mono">#{theme.preview_color}</span>
            {theme.label && <span className="text-xs text-gray-400">· {theme.label}</span>}
          </div>
        )}

        {/* embedded forms */}
        {formRefs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {[...new Set(formRefs)].map(ref => (
              <Link
                key={ref}
                href={`/forms/${manifest.manifest_id}/${ref}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                  bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400
                  dark:hover:bg-blue-900/40 transition-colors"
              >
                📝 {ref} ↗
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* component tree */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold px-2 mb-2">
          Component tree · {placements.length} placement{placements.length !== 1 ? "s" : ""}
        </p>
        {placements.length === 0 ? (
          <p className="text-xs text-gray-400 px-2">No components declared on this screen.</p>
        ) : (
          placements.map((p, i) => (
            <ComponentNode key={`${p.component_ref}-${i}`} placement={p} manifest={manifest} depth={0} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Screen card ──────────────────────────────────────────────────────────────

function ScreenCard({
  screenId,
  manifest,
  selected,
  onSelect,
}: {
  screenId: string;
  manifest: UISystemManifest;
  selected: boolean;
  onSelect: () => void;
}) {
  const screen = manifest.screens?.[screenId];
  if (!screen) return null;

  const placements = screen.components ?? [];
  const directions = [...new Set(placements.map(p => p.direction))];
  const theme = screen.theme_ref ? manifest.themes?.[screen.theme_ref] : undefined;
  const componentCount = placements.length;

  // Direction layout mini-diagram — shows which slots are occupied
  const allDirections = Object.values(LayoutDirection);
  const activeSet = new Set(directions);

  return (
    <button
      onClick={onSelect}
      className={`group w-full text-left rounded-2xl border transition-all duration-200 overflow-hidden
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
        ${selected
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-400 shadow-md shadow-indigo-100 dark:shadow-indigo-900/30"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm"
        }`}
    >
      {/* colour strip from theme preview */}
      <div
        className="h-1 w-full"
        style={{
          background: theme?.preview_color
            ? `#${theme.preview_color}`
            : selected
              ? "linear-gradient(90deg,#6366f1,#8b5cf6)"
              : "linear-gradient(90deg,#e5e7eb,#f3f4f6)",
        }}
      />

      <div className="p-4">
        {/* header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate text-sm leading-tight">
              {screen.label ?? screenId}
            </p>
            <p className="font-mono text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
              {screenId}
            </p>
          </div>
          {screen.nav_order != null && (
            <span className="flex-shrink-0 text-[11px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
              #{screen.nav_order}
            </span>
          )}
        </div>

        {/* badges */}
        <div className="flex flex-wrap gap-1 mb-3">
          {screen.auth_rules?.require_auth
            ? badge("🔒 auth", "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400")
            : badge("🌐 public", "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400")}
          {screen.theme_ref && badge(screen.theme_ref,
            "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300")}
        </div>

        {/* mini direction diagram */}
        <div className="flex flex-wrap gap-1">
          {allDirections.map((dir) => {
            const active = activeSet.has(dir);
            const color = active ? DIRECTION_COLORS[dir] : "bg-gray-100 text-gray-300 dark:bg-gray-800/50 dark:text-gray-600";
            return (
              <span key={dir} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${color} ${active ? "" : "opacity-50"}`}>
                {DIRECTION_ICONS[dir]} {dir}
              </span>
            );
          })}
        </div>

        {/* component count */}
        <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
          {componentCount} placement{componentCount !== 1 ? "s" : ""}
        </p>
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UIManifestPage() {
  const { manifestId } = useParams<{ manifestId: string }>();

  const [manifest, setManifest] = useState<UISystemManifest | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    uiApi
      .getManifest(manifestId)
      .then(raw => {
        setManifest(raw as unknown as UISystemManifest);
        // Auto-select the initial screen if declared
        const initial = (raw as any).navigation?.initial_screen as string | undefined;
        const screens = Object.keys((raw as any).screens ?? {});
        setSelectedScreen(initial ?? screens[0] ?? null);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load UI manifest"))
      .finally(() => setLoading(false));
  }, [manifestId]);

  const screenIds = useMemo(
    () =>
      manifest?.screens
        ? Object.entries(manifest.screens)
            .sort(([, a], [, b]) => (a.nav_order ?? 99) - (b.nav_order ?? 99))
            .map(([id]) => id)
        : [],
    [manifest]
  );

  const componentCount = useMemo(
    () => manifest?.components ? Object.keys(manifest.components).length : 0,
    [manifest]
  );

  const themeCount = useMemo(
    () => manifest?.themes ? Object.keys(manifest.themes).length : 0,
    [manifest]
  );

  const formCount = useMemo(
    () => manifest?.forms ? Object.keys(manifest.forms).length : 0,
    [manifest]
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) return (
    <Shell manifestId={manifestId} title="Loading…">
      <div className="flex items-center justify-center py-32">
        <span className="h-8 w-8 rounded-full border-2 border-gray-300 dark:border-gray-700 border-t-indigo-500 animate-spin" />
      </div>
    </Shell>
  );

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !manifest) return (
    <Shell manifestId={manifestId} title="Error">
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <span className="text-5xl mb-4">⚠️</span>
        <p className="text-red-500 font-medium mb-2">{error ?? "Manifest not found"}</p>
        <p className="text-sm text-gray-400 mb-6 max-w-sm">
          Make sure <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">GET /api/ui/{manifestId}</code> returns a valid UISystemManifest.
        </p>
        <Link href="/" className="text-indigo-600 hover:underline text-sm">← Back to home</Link>
      </div>
    </Shell>
  );

  // ── Manifest loaded ────────────────────────────────────────────────────────
  return (
    <Shell manifestId={manifestId} title={manifest.manifest_id}>
      {/* Manifest-level meta bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {manifest.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 flex-1 min-w-0 truncate">
            {manifest.description}
          </p>
        )}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <MetaStat icon="🖥" label="screens"    value={screenIds.length} />
          <MetaStat icon="🧩" label="components" value={componentCount}   />
          {formCount > 0 && <MetaStat icon="📝" label="forms"  value={formCount}   />}
          {themeCount > 0 && <MetaStat icon="🎨" label="themes" value={themeCount} />}
          {manifest.manifest_version && (
            <span className="text-xs text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              v{manifest.manifest_version}
            </span>
          )}
        </div>
      </div>

      {/* Two-column layout: screen grid + inspector */}
      <div className="flex gap-5 items-start min-h-[500px]">

        {/* ── Screen grid ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {screenIds.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <span className="text-4xl block mb-2">🖥</span>
              <p className="text-sm">No screens defined in this manifest.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {screenIds.map(id => (
                <ScreenCard
                  key={id}
                  screenId={id}
                  manifest={manifest}
                  selected={selectedScreen === id}
                  onSelect={() => setSelectedScreen(id)}
                />
              ))}
            </div>
          )}

          {/* Component registry section */}
          {componentCount > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <span>🧩</span> Component registry
                <span className="text-xs text-gray-400 font-normal font-mono">({componentCount})</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.entries(manifest.components ?? {}).map(([name, comp]) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-800
                      bg-white dark:bg-gray-900 text-sm min-w-0"
                  >
                    <span className="text-base flex-shrink-0">
                      {COMPONENT_TYPE_ICONS[comp.type] ?? "◻"}
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">{name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{comp.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Inspector panel ───────────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 sticky top-[72px]">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Inspector
              </span>
              {selectedScreen && (
                <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{selectedScreen}</span>
              )}
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              <InspectorPanel manifest={manifest} screenId={selectedScreen} />
            </div>
          </div>
        </div>

      </div>
    </Shell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetaStat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900
      border border-gray-200 dark:border-gray-700 text-sm shadow-sm">
      <span>{icon}</span>
      <span className="font-semibold text-gray-800 dark:text-gray-200">{value}</span>
      <span className="text-gray-400 text-xs">{label}</span>
    </div>
  );
}

function Shell({
  manifestId,
  title,
  children,
}: {
  manifestId: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top nav */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
            <Link href="/" className="hover:text-indigo-600 transition-colors flex-shrink-0">
              ⬅ Home
            </Link>
            <span className="text-gray-300 dark:text-gray-700">/</span>
            <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">ui</span>
            <span className="text-gray-300 dark:text-gray-700">/</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{title}</span>
          </div>
          <span className="text-xs text-gray-400 font-mono flex-shrink-0 hidden sm:block">
            {manifestId}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}