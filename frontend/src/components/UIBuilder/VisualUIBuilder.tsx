"use client";

/**
 * VisualUIBuilder.tsx  (revised v2)
 *
 * Fixes vs v1:
 *  1. "Submit another response" eliminated — BuilderForm re-keys FormEngine
 *     via queueMicrotask after every submit so the success screen never renders.
 *  2. Data now reflected on submit — each BuilderForm's onSubmit immediately
 *     calls onUpdate with the new manifest, and the re-key resets the form.
 *  3. Preview / YAML toggle is a header row ABOVE the right panel, not in
 *     the left tab bar.
 *  4. Preview supports Web (browser chrome) and Mobile (phone frame) modes.
 *  5. Preview no longer shows "Add Screen / Add Component" action buttons.
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@form-engine/libs/utils";
import type { FormManifest, FieldAnswers } from "@form-engine/libs/types";
import { FormEngine } from "@form-engine/components/FormEngine";
import { VisualFormBuilder } from "@/components/FormBuilder/VisualFormBuilder";
import { buildFormFromCreatorAnswers } from "@/forms/form-creator-utils";
import { api } from "@/api";
import { toast } from "sonner";

import {
  UISystemManifest,
  Component,
  Screen,
  NavigationConfig,
  ThemeDefinition,
  LayoutDirection,
  Toast,
} from "@form-engine/components/UIEngine/types";

import {
  buildUIBuilderManifest,
  overviewAnswers,
  screenAnswers,
  componentAnswers,
  formConfigAnswers,
  navigationAnswers,
  themeAnswers,
} from "@/forms/ui_builder_forms";

type UIComponent  = Component;
type UIScreen     = Screen;
type UINavigation = NavigationConfig;

export type ComponentType =
  | "Tree" | "Table" | "Form" | "VerticalList" | "HorizontalList"
  | "Search" | "Card" | "Tile" | "FileGallery" | "FilterBuilder"
  | "Avatar" | "Custom";

function slugify(s: string) {
  return (s ?? "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function emptyManifest(): UISystemManifest {
  return {
    manifest_id: "my_ui",
    manifest_version: "1.0.0",
    description: "",
    namespaces: ["core", "schemata", "uam", "form", "ui"],
    active_theme: "default",
    engine: { mode: "reactive", error_mode: "collect-all", debounce_ms: 300 },
    forms: {},
    screens: {},
    components: {},
    navigation: { type: "stack", initial_screen: "" },
    themes: {},
  };
}

const COMPONENT_TYPE_ICONS: Record<string, string> = {
  Form: "📋", Table: "⊞", Card: "🃏", VerticalList: "☰", HorizontalList: "↔",
  Search: "🔍", Tile: "⬜", Tree: "🌲", FileGallery: "🗂", FilterBuilder: "⚙",
  Avatar: "👤", Custom: "⚡",
};

const COMPONENT_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Form:           { bg: "bg-purple-50 dark:bg-purple-900/20",   border: "border-purple-200 dark:border-purple-700",  text: "text-purple-700 dark:text-purple-300"  },
  Table:          { bg: "bg-blue-50 dark:bg-blue-900/20",       border: "border-blue-200 dark:border-blue-700",      text: "text-blue-700 dark:text-blue-300"      },
  Card:           { bg: "bg-amber-50 dark:bg-amber-900/20",     border: "border-amber-200 dark:border-amber-700",    text: "text-amber-700 dark:text-amber-300"    },
  VerticalList:   { bg: "bg-green-50 dark:bg-green-900/20",     border: "border-green-200 dark:border-green-700",    text: "text-green-700 dark:text-green-300"    },
  HorizontalList: { bg: "bg-teal-50 dark:bg-teal-900/20",       border: "border-teal-200 dark:border-teal-700",      text: "text-teal-700 dark:text-teal-300"      },
  Search:         { bg: "bg-sky-50 dark:bg-sky-900/20",         border: "border-sky-200 dark:border-sky-700",        text: "text-sky-700 dark:text-sky-300"        },
  Tile:           { bg: "bg-orange-50 dark:bg-orange-900/20",   border: "border-orange-200 dark:border-orange-700",  text: "text-orange-700 dark:text-orange-300"  },
  Tree:           { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-700",text: "text-emerald-700 dark:text-emerald-300" },
};

function compColor(type: string) {
  return COMPONENT_TYPE_COLORS[type] ?? {
    bg: "bg-gray-50 dark:bg-gray-800/40",
    border: "border-gray-200 dark:border-gray-700",
    text: "text-gray-700 dark:text-gray-300",
  };
}

const DIRECTION_OPTIONS: LayoutDirection[] = [
  LayoutDirection.Center, LayoutDirection.Top, LayoutDirection.Bottom,
  LayoutDirection.Left, LayoutDirection.Right, LayoutDirection.Floating, LayoutDirection.Modal,
];

const DIRECTION_ICONS: Record<string, string> = {
  Center: "⊙", Top: "⬆", Bottom: "⬇", Left: "⬅", Right: "➡", Floating: "⤢", Modal: "⊡",
};

interface VisualUIBuilderProps {
  initialManifest?: UISystemManifest;
  onChange?: (manifest: UISystemManifest) => void;
}

type NavTab    = "overview" | "screens" | "components" | "navigation" | "themes" | "assets";
type RightPane = "preview" | "yaml";

// ─── Root ─────────────────────────────────────────────────────────────────────

export function VisualUIBuilder({ initialManifest, onChange }: VisualUIBuilderProps) {
  const [manifest, setManifest]   = useState<UISystemManifest>(initialManifest ?? emptyManifest());
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [selectedScreen, setSelectedScreen]       = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme]         = useState<string | null>(null);

  // Right pane — "preview" by default, null = hidden
  const [rightPane, setRightPane] = useState<RightPane | null>("preview");

  // YAML state
  const [yamlOutput, setYamlOutput] = useState("");
  const [yamlDraft,  setYamlDraft]  = useState("");
  const [yamlError,  setYamlError]  = useState<string | null>(null);

  // Form creator (wizard mode)
  const [formPickerMode, setFormPickerMode]             = useState<"existing" | "wizard" | "advanced">("existing");
  const [formCreatorManifest, setFormCreatorManifest]   = useState<FormManifest | null>(null);
  const [formCreatorLoading,  setFormCreatorLoading]    = useState(false);

  const builderManifest = useMemo(() => buildUIBuilderManifest(manifest), [manifest]);

  const update = useCallback((next: UISystemManifest) => {
    setManifest(next);
    onChange?.(next);
  }, [onChange]);

  // Regenerate YAML whenever manifest changes
  useEffect(() => {
    let alive = true;
    import("yaml").then(({ stringify }) => {
      if (!alive) return;
      const y = stringify(manifest, { indent: 2 });
      setYamlOutput(y);
      setYamlDraft(y);
    }).catch(() => {
      if (!alive) return;
      const j = JSON.stringify(manifest, null, 2);
      setYamlOutput(j);
      setYamlDraft(j);
    });
    return () => { alive = false; };
  }, [manifest]);

  const applyYaml = async () => {
    try {
      const { parse } = await import("yaml");
      update(parse(yamlDraft) as UISystemManifest);
      setYamlError(null);
      toast.success("YAML applied");
    } catch (e) {
      setYamlError(e instanceof Error ? e.message : "Parse error");
    }
  };

  const ensureFormCreator = async () => {
    if (formCreatorManifest) return;
    setFormCreatorLoading(true);
    try {
      // api.getManifest checks localManifests first (zero-network when registered
      // via FormEngineProvider config.localManifests = { form_creator: … })
      setFormCreatorManifest(await api.getManifest("form_creator"));
    } catch {
      toast.error("Could not load form creator — is the backend running?");
    } finally {
      setFormCreatorLoading(false);
    }
  };

  const screenKeys    = Object.keys(manifest.screens    ?? {});
  const componentKeys = Object.keys(manifest.components ?? {});
  const themeKeys     = Object.keys(manifest.themes     ?? {});

  const TABS: { id: NavTab; label: string; icon: string; count?: number }[] = [
    { id: "overview",   label: "Overview",   icon: "🗒" },
    { id: "screens",    label: "Screens",    icon: "📱", count: screenKeys.length },
    { id: "components", label: "Components", icon: "🧩", count: componentKeys.length },
    { id: "navigation", label: "Navigation", icon: "🧭" },
    { id: "themes",     label: "Themes",     icon: "🎨", count: themeKeys.length },
    { id: "assets",     label: "Assets",     icon: "📦" },
  ];

  return (
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-950">

      {/* ── Left: editor ──────────────────────────────────────────────── */}
      <div className={cn(
        "flex flex-col border-r border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-150",
        rightPane ? "w-[58%]" : "w-full",
      )}>
        {/* Tab bar */}
        <div className="flex items-center gap-0.5 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-x-auto flex-shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                activeTab === t.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center",
                  activeTab === t.id
                    ? "bg-white/20"
                    : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}

          {/* Show open-panel buttons when right pane is hidden */}
          {rightPane === null && (
            <div className="ml-auto flex items-center gap-1 flex-shrink-0 pl-2 border-l border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setRightPane("preview")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <span>👁</span><span className="hidden sm:inline">Preview</span>
              </button>
              <button
                onClick={() => setRightPane("yaml")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <span>{"</>"}</span><span className="hidden sm:inline">YAML</span>
              </button>
            </div>
          )}
        </div>

        {/* Editor content */}
        <div className="flex-1 overflow-auto">
          {activeTab === "overview" && (
            <OverviewPanel manifest={manifest} builderManifest={builderManifest} onUpdate={update} />
          )}
          {activeTab === "screens" && (
            <ScreensPanel
              manifest={manifest} builderManifest={builderManifest}
              selected={selectedScreen} onSelect={setSelectedScreen} onUpdate={update}
            />
          )}
          {activeTab === "components" && (
            <ComponentsPanel
              manifest={manifest} builderManifest={builderManifest}
              selected={selectedComponent} onSelect={setSelectedComponent} onUpdate={update}
              formPickerMode={formPickerMode} onFormPickerModeChange={setFormPickerMode}
              formCreatorManifest={formCreatorManifest} formCreatorLoading={formCreatorLoading}
              onNeedFormCreator={ensureFormCreator}
            />
          )}
          {activeTab === "navigation" && (
            <NavigationPanel manifest={manifest} builderManifest={builderManifest} onUpdate={update} />
          )}
          {activeTab === "themes" && (
            <ThemesPanel
              manifest={manifest} builderManifest={builderManifest}
              selected={selectedTheme} onSelect={setSelectedTheme} onUpdate={update}
            />
          )}
          {activeTab === "assets" && (
            <AssetsPanel manifest={manifest} builderManifest={builderManifest} onUpdate={update} />
          )}
        </div>
      </div>

      {/* ── Right: toggle header + Preview OR YAML ─────────────────────── */}
      {rightPane !== null && (
        <div className="flex flex-col w-[42%] overflow-hidden">

          {/* ── Toggle header — sits ABOVE the right panel content ── */}
          <div className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <button
              onClick={() => setRightPane("preview")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                rightPane === "preview"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              <span>👁</span> Preview
            </button>
            <button
              onClick={() => setRightPane("yaml")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                rightPane === "yaml"
                  ? "bg-gray-800 text-green-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              <span>{"</>"}</span> YAML
            </button>
            <button
              onClick={() => setRightPane(null)}
              title="Close panel"
              className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-sm"
            >✕</button>
          </div>

          {/* Preview */}
          {rightPane === "preview" && (
            <PreviewPanel
              manifest={manifest}
              selectedScreen={selectedScreen}
              selectedComponent={selectedComponent}
              onSelectScreen={(k) => { setSelectedScreen(k); setActiveTab("screens"); }}
              onSelectComponent={(k) => { setSelectedComponent(k); setActiveTab("components"); }}
            />
          )}

          {/* YAML editor */}
          {rightPane === "yaml" && (
            <div className="flex flex-col flex-1 overflow-hidden bg-gray-950">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 flex-shrink-0">
                <span className="text-xs font-medium text-gray-400 font-mono">ui_system.yaml</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-mono">{manifest.manifest_id}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(yamlOutput); toast.success("Copied!"); }}
                    className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                  >Copy</button>
                  <button
                    onClick={applyYaml}
                    className="text-xs px-2 py-1 rounded-md bg-green-800 text-green-200 hover:bg-green-700 font-medium"
                  >Apply</button>
                </div>
              </div>
              {yamlError && (
                <div className="px-4 py-2 bg-red-950 border-b border-red-800 text-xs text-red-400 font-mono">
                  ⚠ {yamlError}
                </div>
              )}
              <div className="flex-1 overflow-auto">
                <textarea
                  value={yamlDraft}
                  onChange={e => { setYamlDraft(e.target.value); setYamlError(null); }}
                  spellCheck={false}
                  className="w-full h-full p-4 text-xs font-mono text-green-300 leading-relaxed bg-transparent resize-none outline-none"
                  style={{ minHeight: "100%" }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── BuilderForm ──────────────────────────────────────────────────────────────
//
// FIX: "Submit another response" was caused by the FormEngine's global Zustand
// store setting `submitted = true` and rendering its success screen.
//
// Solution: after every onSubmit we increment `epoch` via queueMicrotask.
// queueMicrotask fires in the SAME async microtask queue turn as the caller's
// continuation — before React can flush a new render caused by
// markSubmitted(). Changing `epoch` changes the React `key` on FormEngine,
// which unmounts and remounts it with a fresh init(), so `submitted` is
// always false by the time anything paints.
//
// The `formKey` is also embedded in the key so that two different BuilderForms
// (e.g. the add-form sidebar and the detail editor) never share the same
// FormEngine instance key, preventing the global store from being stomped
// by the second one's init() call overwriting the first's state.

function BuilderForm({
  formKey, formId, manifest, initialAnswers, onSubmit, compact = false,
}: {
  formKey: string;
  formId: string;
  manifest: FormManifest;
  initialAnswers?: FieldAnswers;
  onSubmit: (a: FieldAnswers) => void;
  compact?: boolean;
}) {
  const [epoch, setEpoch] = useState(0);

  return (
    <div className={cn("builder-form-wrap", compact ? "px-4 py-3" : "px-5 py-5")}>
      <FormEngine
        key={`${formKey}-${epoch}`}
        manifest={manifest}
        formId={formId}
        initialAnswers={initialAnswers}
        onSubmit={async (answers) => {
          // 1. Apply the data immediately so the manifest updates right away.
          onSubmit(answers);
          // 2. Re-key the FormEngine on the next microtask — before the store's
          //    markSubmitted() continuation can paint the success screen.
          queueMicrotask(() => setEpoch(e => e + 1));
        }}
      />
    </div>
  );
}

// ─── Preview Panel ────────────────────────────────────────────────────────────

type ViewMode = "mobile" | "web";

function PreviewPanel({
  manifest, selectedScreen, selectedComponent, onSelectScreen, onSelectComponent,
}: {
  manifest: UISystemManifest;
  selectedScreen: string | null;
  selectedComponent: string | null;
  onSelectScreen: (k: string) => void;
  onSelectComponent: (k: string) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("mobile");

  const screens    = manifest.screens    ?? {};
  const components = manifest.components ?? {};
  const nav        = manifest.navigation;
  const screenKeys = Object.keys(screens);

  const activeScreenKey = selectedScreen && screens[selectedScreen]
    ? selectedScreen
    : screenKeys[0] ?? null;
  const activeScreen = activeScreenKey ? screens[activeScreenKey] : null;

  const navIsTab = nav?.type === "tab_bar";// || nav?.type === "bottom-tab" || nav?.type === "top-tab";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* View mode toggle */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex gap-0.5 bg-gray-200 dark:bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("mobile")}
            className={cn(
              "px-3 py-1 rounded-md text-[10px] font-semibold transition-all",
              viewMode === "mobile"
                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white"
                : "text-gray-500 hover:text-gray-700",
            )}
          >📱 Mobile</button>
          <button
            onClick={() => setViewMode("web")}
            className={cn(
              "px-3 py-1 rounded-md text-[10px] font-semibold transition-all",
              viewMode === "web"
                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white"
                : "text-gray-500 hover:text-gray-700",
            )}
          >🖥 Web</button>
        </div>
        <span className="text-[10px] text-gray-400 ml-auto font-mono truncate">
          {activeScreen?.label ?? activeScreenKey ?? "no screen"}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Screen sidebar */}
        <div className="w-28 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
          <div className="px-2 py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Screens</span>
          </div>
          <div className="flex-1 overflow-auto">
            {screenKeys.length === 0 ? (
              <p className="text-[10px] text-gray-400 p-3 text-center">No screens yet</p>
            ) : (
              screenKeys.map(key => (
                <button
                  key={key}
                  onClick={() => onSelectScreen(key)}
                  className={cn(
                    "w-full text-left px-2 py-2 text-[10px] border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors",
                    activeScreenKey === key
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 font-semibold"
                      : "text-gray-600 dark:text-gray-400",
                  )}
                >
                  <span className="text-sm flex-shrink-0">{screens[key].is_home ? "🏠" : "📱"}</span>
                  <span className="truncate">{screens[key].label ?? key}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 overflow-auto flex items-start justify-center py-6 px-4">
          {viewMode === "mobile" ? (
            <MobileFrame
              screen={activeScreen}
              screenKey={activeScreenKey}
              components={components}
              selectedComponent={selectedComponent}
              onSelectComponent={onSelectComponent}
              navIsTab={navIsTab}
              screenKeys={screenKeys}
              screens={screens}
              activeScreenKey={activeScreenKey}
              onSelectScreen={onSelectScreen}
            />
          ) : (
            <WebFrame
              screen={activeScreen}
              screenKey={activeScreenKey}
              components={components}
              selectedComponent={selectedComponent}
              onSelectComponent={onSelectComponent}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mobile phone frame ───────────────────────────────────────────────────────

function MobileFrame({
  screen, screenKey, components, selectedComponent, onSelectComponent,
  navIsTab, screenKeys, screens, activeScreenKey, onSelectScreen,
}: {
  screen: UIScreen | null;
  screenKey: string | null;
  components: Record<string, Component>;
  selectedComponent: string | null;
  onSelectComponent: (k: string) => void;
  navIsTab: boolean;
  screenKeys: string[];
  screens: Record<string, UIScreen>;
  activeScreenKey: string | null;
  onSelectScreen: (k: string) => void;
}) {
  return (
    <div className="relative w-60 flex-shrink-0" style={{ minHeight: 520 }}>
      <div className="absolute inset-0 rounded-[30px] border-[7px] border-gray-800 dark:border-gray-600 bg-white dark:bg-gray-950 shadow-2xl overflow-hidden flex flex-col">
        {/* Status bar */}
        <div className="flex items-center justify-between px-4 pt-2 pb-1 bg-white dark:bg-gray-900 relative flex-shrink-0">
          <span className="text-[8px] font-bold text-gray-800 dark:text-gray-200">9:41</span>
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-gray-800 dark:bg-gray-600 rounded-full" />
          <span className="text-[7px] text-gray-500">▬▬▬</span>
        </div>

        {/* Screen title */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300">
            {screen?.label ?? screenKey ?? "No screen"}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-2 space-y-1.5">
          <ComponentTiles
            screen={screen}
            components={components}
            selectedComponent={selectedComponent}
            onSelectComponent={onSelectComponent}
          />
        </div>

        {/* Tab bar */}
        {navIsTab && screenKeys.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 flex-shrink-0">
            <div className="flex justify-around">
              {screenKeys.slice(0, 5).map(key => (
                <button
                  key={key}
                  onClick={() => onSelectScreen(key)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-1.5 py-0.5 rounded-lg transition-colors",
                    activeScreenKey === key ? "text-blue-600" : "text-gray-400",
                  )}
                >
                  <span className="text-sm">{screens[key].is_home ? "🏠" : "📱"}</span>
                  <span className="text-[7px] font-medium truncate max-w-[30px]">{screens[key].label ?? key}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Home indicator */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-700 dark:bg-gray-500 rounded-full" />
    </div>
  );
}

// ─── Web browser frame ────────────────────────────────────────────────────────

function WebFrame({
  screen, screenKey, components, selectedComponent, onSelectComponent,
}: {
  screen: UIScreen | null;
  screenKey: string | null;
  components: Record<string, Component>;
  selectedComponent: string | null;
  onSelectComponent: (k: string) => void;
}) {
  return (
    <div
      className="w-full max-w-2xl flex-shrink-0 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 shadow-xl overflow-hidden flex flex-col"
      style={{ minHeight: 480 }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex gap-1.5 flex-shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-2 bg-white dark:bg-gray-700 rounded-md px-2 py-0.5 min-w-0">
          <span className="text-[9px] text-gray-400 font-mono truncate block">
            app.local/{screenKey ?? ""}
          </span>
        </div>
      </div>

      {/* Page header */}
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 flex items-center gap-3">
        <div className="flex-1">
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
            {screen?.label ?? screenKey ?? "No screen selected"}
          </span>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 p-5 grid grid-cols-1 gap-3 overflow-auto content-start">
        <ComponentTiles
          screen={screen}
          components={components}
          selectedComponent={selectedComponent}
          onSelectComponent={onSelectComponent}
          webMode
        />
      </div>
    </div>
  );
}

// ─── Shared: component tiles rendered inside a frame ─────────────────────────

function ComponentTiles({
  screen, components, selectedComponent, onSelectComponent, webMode = false,
}: {
  screen: UIScreen | null;
  components: Record<string, Component>;
  selectedComponent: string | null;
  onSelectComponent: (k: string) => void;
  webMode?: boolean;
}) {
  if (!screen) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <span className="text-3xl opacity-20 mb-2">{webMode ? "🖥" : "📱"}</span>
        <p className="text-[9px] text-gray-400">No screen selected</p>
      </div>
    );
  }
  if (!screen.components?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <span className="text-3xl opacity-20 mb-2">🧩</span>
        <p className="text-[9px] text-gray-400">No components on this screen</p>
        <p className="text-[9px] text-gray-300 mt-0.5">Add placements in the Screens tab</p>
      </div>
    );
  }

  return (
    <>
      {screen.components.map((placement, idx) => {
        const comp     = components[placement.component_ref];
        const compType = comp?.type ?? "Custom";
        const c        = compColor(compType);
        const isSelected = placement.component_ref === selectedComponent;

        return (
          <button
            key={idx}
            onClick={() => onSelectComponent(placement.component_ref)}
            className={cn(
              "w-full text-left rounded-lg border transition-all",
              c.bg, c.border, c.text,
              webMode ? "px-4 py-3" : "px-2.5 py-2",
              isSelected ? "ring-2 ring-blue-500 ring-offset-1" : "hover:brightness-95",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("flex-shrink-0", webMode ? "text-lg" : "text-sm")}>
                {COMPONENT_TYPE_ICONS[compType] ?? "🧩"}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cn("font-semibold truncate", webMode ? "text-xs" : "text-[9px]")}>
                  {comp?.label ?? placement.component_ref}
                </div>
                <div className={cn("opacity-60 flex items-center gap-1 mt-0.5", webMode ? "text-[10px]" : "text-[8px]")}>
                  <span>{DIRECTION_ICONS[placement.direction] ?? ""}</span>
                  <span>{placement.direction}</span>
                  <span className="opacity-60">· {compType}</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </>
  );
}

// ─── Overview Panel ───────────────────────────────────────────────────────────

function OverviewPanel({ manifest, builderManifest, onUpdate }: {
  manifest: UISystemManifest; builderManifest: FormManifest; onUpdate: (m: UISystemManifest) => void;
}) {
  return (
    <div className="p-5 space-y-3">
      <PanelHeader icon="🗒" title="Manifest Overview" subtitle="Identity and global settings" />
      <BuilderForm
        formKey={`overview-${manifest.manifest_id}`}
        formId="overview"
        manifest={builderManifest}
        initialAnswers={overviewAnswers(manifest)}
        onSubmit={(a) => {
          onUpdate({
            ...manifest,
            manifest_id:      slugify(String(a.manifest_id)) || "my_ui",
            manifest_version: String(a.manifest_version || "1.0.0"),
            description:      String(a.description || ""),
            active_theme:     String(a.active_theme || "default"),
            namespaces:       Array.isArray(a.namespaces) ? a.namespaces as string[] : manifest.namespaces,
            engine: {
              mode:        (a.engine_mode as "reactive" | "static") || "reactive",
              error_mode:  String(a.engine_error_mode || "collect-all"),
              debounce_ms: Number(a.engine_debounce_ms) || 300,
            },
          });
          toast.success("Overview updated");
        }}
      />
    </div>
  );
}

// ─── Screens Panel ────────────────────────────────────────────────────────────

function ScreensPanel({ manifest, builderManifest, selected, onSelect, onUpdate }: {
  manifest: UISystemManifest; builderManifest: FormManifest;
  selected: string | null; onSelect: (k: string | null) => void;
  onUpdate: (m: UISystemManifest) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const screens    = manifest.screens    ?? {};
  const screenKeys = Object.keys(screens);
  const compKeys   = Object.keys(manifest.components ?? {});
  const sel        = selected && screens[selected] ? screens[selected] : null;

  const addScreen = (answers: FieldAnswers) => {
    const key = slugify(String(answers.key)) || `screen_${screenKeys.length + 1}`;
    const next = {
      ...manifest,
      screens: {
        ...screens,
        [key]: {
          name: key,
          label: String(answers.label || key),
          is_home: Boolean(answers.is_home),
          auth_rules: { require_auth: Boolean(answers.require_auth) },
        },
      },
    };
    onUpdate(next);
    onSelect(key);
    setShowAdd(false);
    toast.success(`Screen "${key}" added`);
  };

  const applyScreen = (answers: FieldAnswers) => {
    if (!selected) return;
    onUpdate({
      ...manifest,
      screens: {
        ...screens,
        [selected]: {
          ...screens[selected],
          label:            String(answers.label || ""),
          nav_order:        answers.nav_order ? Number(answers.nav_order) : undefined,
          theme_ref:        String(answers.theme_ref        || "") || undefined,
          background_color: String(answers.background_color || "") || undefined,
          is_home:          Boolean(answers.is_home),
          auth_rules: {
            require_auth:       Boolean(answers.require_auth),
            redirect_on_denied: String(answers.redirect_on_denied || "") || undefined,
          },
        },
      },
    });
    toast.success("Screen updated");
  };

  const deleteScreen = (key: string) => {
    const next = { ...screens };
    delete next[key];
    onUpdate({ ...manifest, screens: next });
    if (selected === key) onSelect(null);
  };

  const updatePlacements = (comps: UIScreen["components"]) => {
    if (!selected) return;
    onUpdate({ ...manifest, screens: { ...screens, [selected]: { ...screens[selected], components: comps } } });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-48 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Screens</span>
          <button
            onClick={() => setShowAdd(v => !v)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all",
              showAdd ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40",
            )}
          >
            <span className={cn("text-sm leading-none transition-transform", showAdd && "rotate-45")}>+</span>
            Add Screen
          </button>
        </div>

        {showAdd && (
          <div className="border-b border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10">
            <BuilderForm formKey="add-screen" formId="add_screen" manifest={builderManifest} onSubmit={addScreen} compact />
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {screenKeys.length === 0 && !showAdd && (
            <div className="p-4 text-center">
              <p className="text-xs text-gray-400 mb-2">No screens yet</p>
              <button onClick={() => setShowAdd(true)} className="text-xs text-blue-500 hover:underline">+ Add your first screen</button>
            </div>
          )}
          {screenKeys.map(key => (
            <div key={key} className="flex items-center border-b border-gray-100 dark:border-gray-800 group">
              <button
                type="button"
                onClick={() => onSelect(key)}
                className={cn(
                  "flex-1 text-left px-3 py-2.5 text-xs flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors",
                  selected === key ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : "text-gray-700 dark:text-gray-300",
                )}
              >
                <span>{screens[key].is_home ? "🏠" : "📱"}</span>
                <span className="truncate flex-1 font-medium">{screens[key].label ?? key}</span>
                {!!screens[key].components?.length && (
                  <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 rounded">
                    {screens[key].components!.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); deleteScreen(key); }}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 pr-2 text-base"
              >×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto">
        {!sel ? (
          <EmptyDetail icon="📱" title="Select a screen" subtitle="Choose from the list, or click + Add Screen to create one." />
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <PanelHeader icon="📱" title={sel.label ?? selected!} subtitle={`key: ${selected}`} />
              <button onClick={() => deleteScreen(selected!)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
            </div>
            <BuilderForm
              formKey={`screen-${selected}`}
              formId="screen_editor"
              manifest={builderManifest}
              initialAnswers={screenAnswers(sel)}
              onSubmit={applyScreen}
            />
            <PlacementsEditor
              placements={sel.components ?? []}
              componentKeys={compKeys}
              componentLabels={Object.fromEntries(
                Object.entries(manifest.components ?? {}).map(([k, v]) => [k, v.label ?? k])
              )}
              onChange={updatePlacements}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Components Panel ──────────────────────────────────────────────────────────

function ComponentsPanel({
  manifest, builderManifest, selected, onSelect, onUpdate,
  formPickerMode, onFormPickerModeChange,
  formCreatorManifest, formCreatorLoading, onNeedFormCreator,
}: {
  manifest: UISystemManifest; builderManifest: FormManifest;
  selected: string | null; onSelect: (k: string | null) => void;
  onUpdate: (m: UISystemManifest) => void;
  formPickerMode: "existing" | "wizard" | "advanced";
  onFormPickerModeChange: (m: "existing" | "wizard" | "advanced") => void;
  formCreatorManifest: FormManifest | null; formCreatorLoading: boolean;
  onNeedFormCreator: () => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const components = manifest.components ?? {};
  const compKeys   = Object.keys(components);
  const sel        = selected && components[selected] ? components[selected] : null;

  const addComponent = (answers: FieldAnswers) => {
    const key = slugify(String(answers.key)) || `component_${compKeys.length + 1}`;
    onUpdate({
      ...manifest,
      components: {
        ...components,
        [key]: { name: key, label: String(answers.label || key), type: (answers.type as ComponentType) || "Card" } as Component,
      },
    });
    onSelect(key);
    setShowAdd(false);
    toast.success(`Component "${key}" added`);
  };

  const applyComponent = (answers: FieldAnswers) => {
    if (!selected) return;
    onUpdate({
      ...manifest,
      components: {
        ...components,
        [selected]: {
          ...components[selected],
          label:       String(answers.label       || "") || undefined,
          type:        (answers.type as ComponentType) || components[selected].type,
          feature_ref: String(answers.feature_ref || "") || undefined,
          theme_ref:   String(answers.theme_ref   || "") || undefined,
          schema_ref:  String(answers.schema_ref  || "") || undefined,
          text:        String(answers.text        || "") || undefined,
        } as Component,
      },
    });
    toast.success("Component updated");
  };

  const applyFormConfig = (answers: FieldAnswers) => {
    if (!selected) return;
    onUpdate({
      ...manifest,
      components: {
        ...components,
        [selected]: {
          ...components[selected],
          form_ref:   String(answers.form_ref || "") || undefined,
          form_embed: { mode: (answers.embed_mode as "inline" | "modal" | "drawer" | "panel") || "inline" },
        },
      },
    });
    toast.success("Form binding updated");
  };

  const addFormToManifest = (fm: FormManifest) => {
    const fids = Object.keys(fm.forms ?? {});
    if (!fids.length) return;
    const updatedForms = { ...(manifest.forms ?? {}), ...fm.forms };
    onUpdate(selected
      ? { ...manifest, forms: updatedForms, components: { ...components, [selected]: { ...components[selected], form_ref: fids[0] } } }
      : { ...manifest, forms: updatedForms });
    toast.success(`Form "${fids[0]}" added`);
    onFormPickerModeChange("existing");
  };

  const deleteComponent = (key: string) => {
    const next = { ...components }; delete next[key];
    onUpdate({ ...manifest, components: next });
    if (selected === key) onSelect(null);
  };

  const updateSubComponents = (subs: UIComponent["sub_components"]) => {
    if (!selected) return;
    onUpdate({ ...manifest, components: { ...components, [selected]: { ...components[selected], sub_components: subs } } });
  };

  const embeddedForms = useMemo<FormManifest | null>(() => {
    if (!manifest.forms || !Object.keys(manifest.forms).length) return null;
    return { manifest_id: manifest.manifest_id, manifest_version: manifest.manifest_version ?? "1.0.0", forms: manifest.forms as FormManifest["forms"] } as FormManifest;
  }, [manifest]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-48 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Components</span>
          <button
            onClick={() => setShowAdd(v => !v)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all",
              showAdd ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40",
            )}
          >
            <span className={cn("text-sm leading-none transition-transform", showAdd && "rotate-45")}>+</span>
            Add
          </button>
        </div>

        {showAdd && (
          <div className="border-b border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10">
            <BuilderForm formKey="add-component" formId="add_component" manifest={builderManifest} onSubmit={addComponent} compact />
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {compKeys.length === 0 && !showAdd && (
            <div className="p-4 text-center">
              <p className="text-xs text-gray-400 mb-2">No components yet</p>
              <button onClick={() => setShowAdd(true)} className="text-xs text-blue-500 hover:underline">+ Add your first</button>
            </div>
          )}
          {compKeys.map(key => {
            const c = compColor(components[key].type);
            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                className={cn(
                  "w-full text-left px-3 py-2.5 text-xs border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors",
                  selected === key ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : "text-gray-700 dark:text-gray-300",
                )}
              >
                <span>{COMPONENT_TYPE_ICONS[components[key].type] ?? "🧩"}</span>
                <span className="truncate flex-1 font-medium">{components[key].label ?? key}</span>
                <span className={cn("text-[8px] px-1 py-0.5 rounded font-mono border flex-shrink-0", c.bg, c.border, c.text)}>
                  {components[key].type}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto">
        {!sel ? (
          <EmptyDetail icon="🧩" title="Select a component" subtitle="Choose from the list, or click + Add to create one." />
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <PanelHeader icon={COMPONENT_TYPE_ICONS[sel.type] ?? "🧩"} title={sel.label ?? selected!} subtitle={`key: ${selected} · type: ${sel.type}`} />
              <button onClick={() => deleteComponent(selected!)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
            </div>
            <BuilderForm
              formKey={`comp-${selected}`}
              formId="component_editor"
              manifest={builderManifest}
              initialAnswers={componentAnswers(sel)}
              onSubmit={applyComponent}
            />
            {sel.type === "Form" && (
              <FormComponentPanel
                manifest={manifest} builderManifest={builderManifest} component={sel}
                formPickerMode={formPickerMode} onFormPickerModeChange={onFormPickerModeChange}
                formCreatorManifest={formCreatorManifest} formCreatorLoading={formCreatorLoading}
                onNeedFormCreator={onNeedFormCreator} onFormAdded={addFormToManifest}
                onApplyConfig={applyFormConfig} embeddedForms={embeddedForms}
              />
            )}
            <PlacementsEditor
              title="Sub-Components"
              placements={sel.sub_components ?? []}
              componentKeys={compKeys}
              componentLabels={Object.fromEntries(Object.entries(manifest.components ?? {}).map(([k, v]) => [k, v.label ?? k]))}
              onChange={updateSubComponents as (p: Array<{ component_ref: string; direction: LayoutDirection }>) => void}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Form Component Panel ─────────────────────────────────────────────────────

function FormComponentPanel({
  manifest, builderManifest, component,
  formPickerMode, onFormPickerModeChange,
  formCreatorManifest, formCreatorLoading, onNeedFormCreator,
  onFormAdded, onApplyConfig, embeddedForms,
}: {
  manifest: UISystemManifest; builderManifest: FormManifest; component: UIComponent;
  formPickerMode: "existing" | "wizard" | "advanced";
  onFormPickerModeChange: (m: "existing" | "wizard" | "advanced") => void;
  formCreatorManifest: FormManifest | null; formCreatorLoading: boolean;
  onNeedFormCreator: () => Promise<void>;
  onFormAdded: (fm: FormManifest) => void; onApplyConfig: (a: FieldAnswers) => void;
  embeddedForms: FormManifest | null;
}) {
  // Tracks the form just created via the wizard so we can hand off to
  // VisualFormBuilder for per-page field editing without losing context.
  const [wizardCreatedFormId, setWizardCreatedFormId] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-100 dark:border-purple-800/60">
        <span>📋</span>
        <span className="text-sm font-bold text-purple-800 dark:text-purple-300">Form Configuration</span>
        <span className="ml-auto text-[10px] font-mono text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">type: Form</span>
      </div>
      <div className="flex gap-0 px-4 pt-3">
        {([ { id: "existing" as const, icon: "📂", label: "Existing" }, { id: "wizard" as const, icon: "🧙", label: "Wizard" }, { id: "advanced" as const, icon: "⚡", label: "Advanced" } ] as const).map(opt => (
          <button
            key={opt.id}
            onClick={() => { onFormPickerModeChange(opt.id); if (opt.id === "wizard") onNeedFormCreator(); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-all",
              formPickerMode === opt.id ? "border-purple-500 text-purple-700 dark:text-purple-300" : "border-transparent text-gray-400 hover:text-gray-600",
            )}
          ><span>{opt.icon}</span>{opt.label}</button>
        ))}
      </div>
      {formPickerMode === "existing" && (
        <div className="px-1 pb-1">
          {!Object.keys(manifest.forms ?? {}).length && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 rounded-lg m-4 p-2.5">
              No forms yet — use Wizard or Advanced to create one.
            </p>
          )}
          <BuilderForm formKey={`form-cfg-${component.name}`} formId="form_config_editor" manifest={builderManifest} initialAnswers={formConfigAnswers(component)} onSubmit={onApplyConfig} />
        </div>
      )}
      {formPickerMode === "wizard" && (
        <div className="p-4">
          {/* Stage 1 — creator form (collect identity, pages, fields, submission) */}
          {!wizardCreatedFormId && formCreatorLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
              <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-purple-500 animate-spin" />
              Loading…
            </div>
          )}
          {!wizardCreatedFormId && !formCreatorLoading && !formCreatorManifest && (
            <div className="text-center py-6 text-sm text-gray-400 space-y-2">
              <p>Could not load the form creator.</p>
              <button onClick={onNeedFormCreator} className="text-purple-500 hover:underline text-xs">Retry</button>
            </div>
          )}
          {!wizardCreatedFormId && formCreatorManifest && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-purple-200 dark:border-purple-800 overflow-hidden">
              <FormEngine
                key="form-creator"
                manifest={formCreatorManifest}
                formId="create_form"
                onSubmit={async (answers) => {
                  const { formId, manifest: skeleton } = buildFormFromCreatorAnswers(answers, manifest.manifest_id);
                  onFormAdded(skeleton);
                  setWizardCreatedFormId(formId);
                  toast.success(`Form "${formId}" created — add fields per page below`);
                }}
              />
            </div>
          )}

          {/* Stage 2 — per-page field editing via VisualFormBuilder */}
          {wizardCreatedFormId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-purple-100/60 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-purple-800 dark:text-purple-200">
                  <span>✅</span>
                  <span>
                    Form skeleton created. Use the tabs below to add fields to each page.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setWizardCreatedFormId(null)}
                  className="text-[11px] text-purple-600 dark:text-purple-300 hover:underline"
                >
                  + Create another
                </button>
              </div>
              {embeddedForms && embeddedForms.forms?.[wizardCreatedFormId] ? (
                <div className="h-[480px] rounded-xl overflow-hidden border border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-900">
                  <VisualFormBuilder
                    manifest={embeddedForms}
                    formId={wizardCreatedFormId}
                    onChange={fm => onFormAdded(fm)}
                  />
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-gray-400">
                  Could not locate the newly created form ("{wizardCreatedFormId}").
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {formPickerMode === "advanced" && (
        <div className="p-4">
          {embeddedForms && Object.keys(embeddedForms.forms ?? {}).length > 0 ? (
            <div className="h-[420px] rounded-xl overflow-hidden border border-purple-200 dark:border-purple-800">
              <VisualFormBuilder manifest={embeddedForms} formId={component.form_ref ?? Object.keys(embeddedForms.forms ?? {})[0] ?? ""} onChange={fm => onFormAdded(fm)} />
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-gray-400 space-y-2">
              <p>No forms to edit yet.</p>
              <button onClick={() => onFormPickerModeChange("wizard")} className="text-purple-600 hover:underline text-xs font-medium">→ Create one via Wizard</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Navigation Panel ──────────────────────────────────────────────────────────

function NavigationPanel({ manifest, builderManifest, onUpdate }: {
  manifest: UISystemManifest; builderManifest: FormManifest; onUpdate: (m: UISystemManifest) => void;
}) {
  const [showAddRoute, setShowAddRoute] = useState(false);
  const nav    = manifest.navigation ?? {} as UINavigation;
  const routes = nav.routes ?? {};

  const applyNav = (answers: FieldAnswers) => {
    onUpdate({
      ...manifest,
      navigation: {
        ...nav,
        type:             (answers.nav_type as UINavigation["type"]) || "stack",
        initial_screen:   String(answers.initial_screen || ""),
        tab_bar_position: (answers.tab_bar_position as "top" | "bottom") || undefined,
      },
    });
    toast.success("Navigation updated");
  };

  const applyRoute = (answers: FieldAnswers) => {
    const key = slugify(String(answers.route_key)) || `route_${Object.keys(routes).length + 1}`;
    onUpdate({ ...manifest, navigation: { ...nav, routes: { ...routes, [key]: { screen: String(answers.screen || ""), path: String(answers.path || "") || undefined, auth_required: Boolean(answers.auth_required) } } } });
    setShowAddRoute(false);
    toast.success("Route saved");
  };

  const deleteRoute = (key: string) => {
    const next = { ...routes }; delete next[key];
    onUpdate({ ...manifest, navigation: { ...nav, routes: next } });
  };

  return (
    <div className="p-5 space-y-6">
      <PanelHeader icon="🧭" title="Navigation" subtitle="Stack type, initial screen, and routes" />
      <BuilderForm formKey={`nav-${manifest.manifest_id}`} formId="navigation_editor" manifest={builderManifest} initialAnswers={navigationAnswers(nav)} onSubmit={applyNav} />
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Routes</h4>
          <button
            onClick={() => setShowAddRoute(v => !v)}
            className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all", showAddRoute ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40")}
          >
            <span className={cn("text-sm leading-none transition-transform", showAddRoute && "rotate-45")}>+</span>
            Add Route
          </button>
        </div>
        {showAddRoute && (
          <div className="mb-4 rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden bg-blue-50/50 dark:bg-blue-900/10">
            <BuilderForm formKey={`add-route-${Object.keys(routes).length}`} formId="route_editor" manifest={builderManifest} onSubmit={applyRoute} compact />
          </div>
        )}
        {Object.keys(routes).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(routes).map(([key, r]) => (
              <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-mono text-gray-500 w-28 truncate flex-shrink-0">{key}</span>
                <span className="text-xs text-gray-400">→</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{r.screen}</span>
                {r.path && <span className="text-xs font-mono text-blue-400">{r.path}</span>}
                {r.auth_required !== false && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">auth</span>}
                <button onClick={() => deleteRoute(key)} className="text-gray-300 hover:text-red-500 text-sm">×</button>
              </div>
            ))}
          </div>
        ) : !showAddRoute && <p className="text-xs text-gray-400 italic">No routes defined yet.</p>}
      </div>
    </div>
  );
}

// ─── Themes Panel ─────────────────────────────────────────────────────────────

function ThemesPanel({ manifest, builderManifest, selected, onSelect, onUpdate }: {
  manifest: UISystemManifest; builderManifest: FormManifest;
  selected: string | null; onSelect: (k: string | null) => void;
  onUpdate: (m: UISystemManifest) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const themes    = manifest.themes ?? {};
  const themeKeys = Object.keys(themes);
  const sel       = selected && themes[selected] ? themes[selected] : null;

  const addTheme = (answers: FieldAnswers) => {
    const key = slugify(String(answers.key)) || `theme_${themeKeys.length + 1}`;
    onUpdate({ ...manifest, themes: { ...themes, [key]: { label: String(answers.label || key), extends: String(answers.extends || "default"), colors: { primary: "#006FFD" }, typography: { scale: {} }, spacing: {}, radius: {}, elevation: {}, selectable: true } } });
    onSelect(key); setShowAdd(false); toast.success(`Theme "${key}" added`);
  };

  const applyTheme = (answers: FieldAnswers) => {
    if (!selected) return;
    const hex = (v: unknown) => String(v || "").replace(/^#/, "") || undefined;
    onUpdate({
      ...manifest,
      themes: {
        ...themes,
        [selected]: {
          ...themes[selected],
          label: String(answers.label || ""), extends: String(answers.extends || "default") || undefined,
          selectable: Boolean(answers.selectable), preview_color: hex(answers.preview_color),
          colors: { ...(themes[selected].colors ?? {}), primary: String(answers.color_primary || ""), primary_light: String(answers.color_primary_light || "") || undefined, primary_dark: String(answers.color_primary_dark || "") || undefined, surface: String(answers.color_surface || "") || undefined, on_surface: String(answers.color_on_surface || "") || undefined, outline: String(answers.color_outline || "") || undefined, error: String(answers.color_error || "") || undefined, success: String(answers.color_success || "") || undefined, warning: String(answers.color_warning || "") || undefined },
        } as ThemeDefinition,
      },
    });
    toast.success("Theme updated");
  };

  const deleteTheme = (key: string) => {
    const next = { ...themes }; delete next[key];
    onUpdate({ ...manifest, themes: next });
    if (selected === key) onSelect(null);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-48 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Themes</span>
          <button onClick={() => setShowAdd(v => !v)} className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all", showAdd ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40")}>
            <span className={cn("text-sm leading-none transition-transform", showAdd && "rotate-45")}>+</span>
            Add Theme
          </button>
        </div>
        {showAdd && <div className="border-b border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10"><BuilderForm formKey="add-theme" formId="add_theme" manifest={builderManifest} onSubmit={addTheme} compact /></div>}
        <div className="flex-1 overflow-auto">
          {themeKeys.length === 0 && !showAdd && <div className="p-4 text-center"><p className="text-xs text-gray-400 mb-2">No custom themes</p><button onClick={() => setShowAdd(true)} className="text-xs text-blue-500 hover:underline">+ Add one</button></div>}
          {themeKeys.map(key => (
            <div key={key} className="flex items-center border-b border-gray-100 dark:border-gray-800 group">
              <button type="button" onClick={() => onSelect(key)} className={cn("flex-1 text-left px-3 py-2.5 text-xs flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors", selected === key ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : "text-gray-700 dark:text-gray-300")}>
                {themes[key].preview_color && <span className="h-3 w-3 rounded-full border border-gray-200 flex-shrink-0" style={{ background: `#${themes[key].preview_color}` }} />}
                <span className="truncate flex-1 font-medium">{themes[key].label ?? key}</span>
              </button>
              <button type="button" onClick={e => { e.stopPropagation(); deleteTheme(key); }} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 pr-2 text-base">×</button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {!sel ? <EmptyDetail icon="🎨" title="Select a theme" subtitle="Custom themes extend built-in themes (default · material · ios-hig · fluent)." /> : (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <PanelHeader icon="🎨" title={sel.label ?? selected!} subtitle={`key: ${selected}`} />
              <button onClick={() => deleteTheme(selected!)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
            </div>
            <BuilderForm formKey={`theme-${selected}`} formId="theme_editor" manifest={builderManifest} initialAnswers={themeAnswers(sel)} onSubmit={applyTheme} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assets Panel ──────────────────────────────────────────────────────────────

function AssetsPanel({ manifest, builderManifest, onUpdate }: {
  manifest: UISystemManifest; builderManifest: FormManifest; onUpdate: (m: UISystemManifest) => void;
}) {
  const [tab, setTab] = useState<"buttons" | "dialogs" | "toasts" | "icons">("buttons");
  const buttons = manifest.buttons ?? {};
  const dialogs = manifest.dialogs ?? {};
  const toasts  = manifest.toasts  ?? {};
  const icons   = manifest.icons   ?? {};

  const TABS = [
    { id: "buttons" as const, label: "Buttons", count: Object.keys(buttons).length },
    { id: "dialogs" as const, label: "Dialogs", count: Object.keys(dialogs).length },
    { id: "toasts"  as const, label: "Toasts",  count: Object.keys(toasts).length  },
    { id: "icons"   as const, label: "Icons",   count: Object.keys(icons).length   },
  ];

  const saveButton = (a: FieldAnswers) => {
    const key = slugify(String(a.key || `btn_${Object.keys(buttons).length + 1}`));
    onUpdate({ ...manifest, buttons: { ...buttons, [key]: { name: key, label: String(a.label || ""), on_press: String(a.on_press || "navigate") } } });
    toast.success("Button saved");
  };
  const saveDialog = (a: FieldAnswers) => {
    const key = slugify(String(a.key || `dialog_${Object.keys(dialogs).length + 1}`));
    onUpdate({ ...manifest, dialogs: { ...dialogs, [key]: { title: String(a.title || ""), body: String(a.body || "") || undefined } } });
    toast.success("Dialog saved");
  };
  const saveToast = (a: FieldAnswers) => {
    const key = slugify(String(a.key || `toast_${Object.keys(toasts).length + 1}`));
    onUpdate({ ...manifest, toasts: { ...toasts, [key]: { message: String(a.message || ""), severity: String(a.severity || "info") } as Toast } });
    toast.success("Toast saved");
  };
  const saveIcon = (a: FieldAnswers) => {
    const key = slugify(String(a.key || `icon_${Object.keys(icons).length + 1}`));
    onUpdate({ ...manifest, icons: { ...icons, [key]: { type: String(a.type || "lucide") as any, name: String(a.name || "") || undefined } } });
    toast.success("Icon saved");
  };
  const deleteAsset = (col: "buttons" | "dialogs" | "toasts" | "icons", key: string) => {
    const next = { ...manifest[col] } as Record<string, unknown>; delete next[key];
    onUpdate({ ...manifest, [col]: next });
  };

  return (
    <div className="p-5 space-y-4">
      <PanelHeader icon="📦" title="Assets" subtitle="Reusable buttons, dialogs, toasts, and icons" />
      <div className="flex gap-0 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-1 py-1.5 text-xs font-medium rounded-lg transition-all", tab === t.id ? "bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white" : "text-gray-500")}>
            {t.label}{t.count > 0 && <span className="text-[10px] opacity-50 ml-1">({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === "buttons" && Object.keys(buttons).length > 0 && <div className="space-y-1.5">{Object.entries(buttons).map(([k, b]) => <AssetRow key={k} label={b.label ?? k} sub={`on_press: ${b.on_press}`} badge={k} onDelete={() => deleteAsset("buttons", k)} />)}</div>}
      {tab === "dialogs" && Object.keys(dialogs).length > 0 && <div className="space-y-1.5">{Object.entries(dialogs).map(([k, d]) => <AssetRow key={k} label={d.title} sub={d.body ?? ""} badge={k} onDelete={() => deleteAsset("dialogs", k)} />)}</div>}
      {tab === "toasts"  && Object.keys(toasts).length  > 0 && <div className="space-y-1.5">{Object.entries(toasts).map(([k, t]) =>  <AssetRow key={k} label={t.message} sub={t.severity ?? "info"} badge={k} onDelete={() => deleteAsset("toasts", k)} />)}</div>}
      {tab === "icons"   && Object.keys(icons).length   > 0 && <div className="space-y-1.5">{Object.entries(icons).map(([k, ic]) => <AssetRow key={k} label={ic.name ?? k} sub={`type: ${ic.type}`} badge={k} onDelete={() => deleteAsset("icons", k)} />)}</div>}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700">
          <span className="text-xs font-semibold text-gray-500">
            {tab === "buttons" ? "Add Button" : tab === "dialogs" ? "Add Dialog" : tab === "toasts" ? "Add Toast" : "Add Icon"}
          </span>
        </div>
        {tab === "buttons" && <BuilderForm key="btn" formKey="add-button" formId="button_editor" manifest={builderManifest} onSubmit={saveButton} compact />}
        {tab === "dialogs" && <BuilderForm key="dlg" formKey="add-dialog" formId="dialog_editor" manifest={builderManifest} onSubmit={saveDialog} compact />}
        {tab === "toasts"  && <BuilderForm key="tst" formKey="add-toast"  formId="toast_editor"  manifest={builderManifest} onSubmit={saveToast}  compact />}
        {tab === "icons"   && <BuilderForm key="ico" formKey="add-icon"   formId="icon_editor"   manifest={builderManifest} onSubmit={saveIcon}   compact />}
      </div>
    </div>
  );
}

// ─── Placements Editor ────────────────────────────────────────────────────────

function PlacementsEditor({
  title = "Component Placements", placements, componentKeys, componentLabels, onChange,
}: {
  title?: string;
  placements: Array<{ component_ref: string; direction: LayoutDirection }>;
  componentKeys: string[];
  componentLabels: Record<string, string>;
  onChange: (p: Array<{ component_ref: string; direction: LayoutDirection }>) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</label>
        <button
          onClick={() => onChange([...placements, { component_ref: componentKeys[0] ?? "", direction: LayoutDirection.Center }])}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 transition-all"
        >+ Add Placement</button>
      </div>
      {placements.length === 0 && <p className="text-xs text-gray-400 italic">None yet.</p>}
      {placements.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1.5">
          <select
            value={p.component_ref}
            onChange={e => { const n = [...placements]; n[i] = { ...p, component_ref: e.target.value }; onChange(n); }}
            className="field-input text-xs flex-1 min-w-0"
          >
            <option value="">— component —</option>
            {componentKeys.map(k => <option key={k} value={k}>{componentLabels[k] ?? k}</option>)}
          </select>
          <select
            value={p.direction}
            onChange={e => { const n = [...placements]; n[i] = { ...p, direction: e.target.value as LayoutDirection }; onChange(n); }}
            className="field-input text-xs w-28 flex-shrink-0"
          >
            {DIRECTION_OPTIONS.map(d => <option key={d} value={d}>{DIRECTION_ICONS[d]} {d}</option>)}
          </select>
          <button onClick={() => onChange(placements.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 text-sm">×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function PanelHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <span className="text-2xl">{icon}</span>
      <div>
        <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 font-mono">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyDetail({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center px-8">
      <span className="text-5xl mb-4 opacity-30">{icon}</span>
      <h4 className="font-semibold text-gray-500 dark:text-gray-400 mb-1">{title}</h4>
      <p className="text-xs text-gray-400">{subtitle}</p>
    </div>
  );
}

function AssetRow({ label, sub, badge, onDelete }: { label: string; sub: string; badge: string; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 group">
      <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded flex-shrink-0">{badge}</span>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{label}</span>
      {sub && <span className="text-[10px] text-gray-400 truncate max-w-[120px] hidden sm:block">{sub}</span>}
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-sm flex-shrink-0 transition-opacity">×</button>
    </div>
  );
}