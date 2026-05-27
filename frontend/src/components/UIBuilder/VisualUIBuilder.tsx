"use client";

/**
 * VisualUIBuilder.tsx
 *
 * Every editor panel (Overview, Screens, Components, Navigation, Themes,
 * Assets) uses FormEngine to render its fields — the same engine that renders
 * end-user forms. Form definitions live in ui_builder_forms.ts and conform to
 * the FormManifest schema.  onSubmit patches the UISystemManifest state.
 *
 * FIXED (compared to original UIBuilder/VisualUIBuilder.tsx)
 *  1. All UI-layer types (UISystemManifest, Component, Screen, ThemeDefinition,
 *     LayoutDirection, etc.) are now IMPORTED from UIEngine — the single source
 *     of truth — instead of being redeclared locally with incomplete shapes.
 *  2. The local UIComponent / UIScreen / UINavigation aliases are replaced by
 *     the canonical Component / Screen / NavigationConfig from UIEngine/types.
 *  3. UIManifestRenderer is imported from UIEngine (not from this file).
 *  4. The local ThemeDefinition re-declaration (which was missing typography,
 *     spacing, radius, elevation, motion, dark_mode) is removed.
 *
 * ARCHITECTURE REMINDER
 *  UIBuilder  uses UIEngine  to render ITS OWN UI   (tab bar, panels, etc.)
 *  UIBuilder  uses FormEngine to render the EDITOR FORMS inside each panel.
 *  UIEngine   uses FormEngine when it encounters a type=Form component.
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@form-engine/libs/utils";
import type { FormManifest, FieldAnswers } from "@form-engine/libs/types";
import { FormEngine } from "@form-engine/components/FormEngine";
import { VisualFormBuilder } from "@/components/FormBuilder/VisualFormBuilder";
import { api } from "@/api";
import { toast } from "sonner";

// ── All UI-layer types come from UIEngine (single source of truth) ────────────
import {
  UISystemManifest,
  Component,
  Screen,
  NavigationConfig,
  ThemeDefinition,
  LayoutDirection,
  Route,
  Toast,
} from "@form-engine/components/UIEngine/types";

// ── The builder's own UI is rendered by UIEngine ──────────────────────────────
// (UIBuilder wraps itself in UIEngineProvider + loads ui_builder.yaml)
import { UIManifestRenderer } from "@form-engine/components/UIEngine/UIManifestRenderer";

// ── Form helpers — see forms/ui_builder_forms.ts ──────────────────────────────
import {
  buildUIBuilderManifest,
  overviewAnswers,
  screenAnswers,
  componentAnswers,
  formConfigAnswers,
  navigationAnswers,
  routeAnswers,
  themeAnswers,
} from "@/forms/ui_builder_forms";

// ─── Local aliases for convenience (use UIEngine canonical types) ──────────────
// These are the same shapes — just shorter names used inside this file.
type UIComponent  = Component;
type UIScreen     = Screen;
type UINavigation = NavigationConfig;

// ─── Component type options (for the Add Component picker) ─────────────────────
export type ComponentType =
  | "Tree" | "Table" | "Form" | "VerticalList" | "HorizontalList"
  | "Search" | "Card" | "Tile" | "FileGallery" | "FilterBuilder"
  | "Avatar" | "Custom";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const DIRECTION_OPTIONS: LayoutDirection[] = [
  LayoutDirection.Center, LayoutDirection.Top, LayoutDirection.Bottom,
  LayoutDirection.Left, LayoutDirection.Right, LayoutDirection.Floating, LayoutDirection.Modal,
];

const DIRECTION_ICONS: Record<string, string> = {
  Center: "⊙", Top: "⬆", Bottom: "⬇", Left: "⬅", Right: "➡", Floating: "⤢", Modal: "⊡",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface VisualUIBuilderProps {
  initialManifest?: UISystemManifest;
  onChange?: (manifest: UISystemManifest) => void;
}

type NavTab = "overview" | "screens" | "components" | "navigation" | "themes" | "assets";

// ─── Root ─────────────────────────────────────────────────────────────────────

export function VisualUIBuilder({ initialManifest, onChange }: VisualUIBuilderProps) {
  const [manifest, setManifest] = useState<UISystemManifest>(initialManifest ?? emptyManifest());
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [yamlOutput, setYamlOutput] = useState("");

  // Form-picker state for Form-type components
  const [formPickerMode, setFormPickerMode] = useState<"existing" | "wizard" | "advanced">("existing");
  const [formCreatorManifest, setFormCreatorManifest] = useState<FormManifest | null>(null);
  const [formCreatorLoading, setFormCreatorLoading] = useState(false);

  // Build the FormManifest for the UI builder's own forms — rebuilt whenever
  // the UISystemManifest changes so dynamic choices stay current.
  const builderManifest = useMemo(() => buildUIBuilderManifest(manifest), [manifest]);

  const update = useCallback((next: UISystemManifest) => {
    setManifest(next);
    onChange?.(next);
  }, [onChange]);

  // Live YAML
  useEffect(() => {
    let alive = true;
    import("yaml").then(({ stringify }) => {
      if (alive) setYamlOutput(stringify(manifest, { indent: 2 }));
    }).catch(() => {
      if (alive) setYamlOutput(JSON.stringify(manifest, null, 2));
    });
    return () => { alive = false; };
  }, [manifest]);

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

      {/* ── Left: editor ───────────────────────────────────────────────────── */}
      <div className="flex flex-col w-3/5 border-r border-gray-200 dark:border-gray-700 overflow-hidden">

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
                  activeTab === t.id ? "bg-white/20" : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="flex-1 overflow-auto">
          {activeTab === "overview" && (
            <OverviewPanel manifest={manifest} builderManifest={builderManifest} onUpdate={update} />
          )}
          {activeTab === "screens" && (
            <ScreensPanel
              manifest={manifest}
              builderManifest={builderManifest}
              selected={selectedScreen}
              onSelect={setSelectedScreen}
              onUpdate={update}
            />
          )}
          {activeTab === "components" && (
            <ComponentsPanel
              manifest={manifest}
              builderManifest={builderManifest}
              selected={selectedComponent}
              onSelect={setSelectedComponent}
              onUpdate={update}
              formPickerMode={formPickerMode}
              onFormPickerModeChange={setFormPickerMode}
              formCreatorManifest={formCreatorManifest}
              formCreatorLoading={formCreatorLoading}
              onNeedFormCreator={ensureFormCreator}
            />
          )}
          {activeTab === "navigation" && (
            <NavigationPanel
              manifest={manifest}
              builderManifest={builderManifest}
              onUpdate={update}
            />
          )}
          {activeTab === "themes" && (
            <ThemesPanel
              manifest={manifest}
              builderManifest={builderManifest}
              selected={selectedTheme}
              onSelect={setSelectedTheme}
              onUpdate={update}
            />
          )}
          {activeTab === "assets" && (
            <AssetsPanel
              manifest={manifest}
              builderManifest={builderManifest}
              onUpdate={update}
            />
          )}
        </div>
      </div>

      {/* ── Right: YAML output ──────────────────────────────────────────────── */}
      <div className="flex flex-col w-2/5 overflow-hidden bg-gray-950">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 flex-shrink-0">
          <span className="text-xs font-medium text-gray-400">ui_system.yaml</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 font-mono">{manifest.manifest_id}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(yamlOutput); toast.success("Copied!"); }}
              className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <pre className="p-4 text-xs font-mono text-green-300 leading-relaxed whitespace-pre-wrap break-all select-all">
            {yamlOutput || "# Loading…"}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── Shared: FormEngine wrapper ───────────────────────────────────────────────

function BuilderForm({
  formKey,
  formId,
  manifest,
  initialAnswers,
  onSubmit,
  compact = false,
}: {
  formKey: string;
  formId: string;
  manifest: FormManifest;
  initialAnswers?: FieldAnswers;
  onSubmit: (a: FieldAnswers) => void;
  compact?: boolean;
}) {
  return (
    <div
      key={formKey}
      className={cn(
        "builder-form-wrap",
        compact ? "px-4 py-3" : "px-5 py-5",
      )}
    >
      <FormEngine
        key={formKey}
        manifest={manifest}
        formId={formId}
        initialAnswers={initialAnswers}
        onSubmit={async (answers) => { onSubmit(answers); }}
      />
    </div>
  );
}

// ─── Overview Panel ───────────────────────────────────────────────────────────

function OverviewPanel({ manifest, builderManifest, onUpdate }: {
  manifest: UISystemManifest;
  builderManifest: FormManifest;
  onUpdate: (m: UISystemManifest) => void;
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
  manifest: UISystemManifest;
  builderManifest: FormManifest;
  selected: string | null;
  onSelect: (k: string | null) => void;
  onUpdate: (m: UISystemManifest) => void;
}) {
  const screens     = manifest.screens ?? {};
  const screenKeys  = Object.keys(screens);
  const compKeys    = Object.keys(manifest.components ?? {});
  const sel         = selected && screens[selected] ? screens[selected] : null;

  const addScreen = (answers: FieldAnswers) => {
    const key = slugify(String(answers.key)) || `screen_${screenKeys.length + 1}`;
    onUpdate({
      ...manifest,
      screens: {
        ...screens,
        [key]: {
          name:  key,
          label: String(answers.label || key),
          is_home: Boolean(answers.is_home),
          auth_rules: { require_auth: Boolean(answers.require_auth) },
        },
      },
    });
    onSelect(key);
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
          theme_ref:        String(answers.theme_ref || "") || undefined,
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
      {/* List */}
      <div className="w-44 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {screenKeys.length === 0 && <p className="text-xs text-gray-400 p-3 text-center">No screens</p>}
          {screenKeys.map(key => (
            <div key={key} className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 group">
              <button
                type="button"
                onClick={() => onSelect(key)}
                className={cn(
                  "flex-1 text-left px-3 py-2.5 text-xs flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer select-none",
                  selected === key
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300",
                )}
              >
                <span>{screens[key].is_home ? "🏠" : "📱"}</span>
                <span className="truncate flex-1 font-medium">{screens[key].label ?? key}</span>
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); deleteScreen(key); }}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-base"
              >×</button>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700">
          <details className="group">
            <summary className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-blue-600 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 list-none">
              <span className="group-open:rotate-90 transition-transform text-base leading-none">+</span>
              Add Screen
            </summary>
            <div className="border-t border-gray-100 dark:border-gray-800">
              <BuilderForm
                formKey="add-screen"
                formId="add_screen"
                manifest={builderManifest}
                onSubmit={addScreen}
                compact
              />
            </div>
          </details>
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto">
        {!sel ? (
          <EmptyDetail icon="📱" title="Select a screen" subtitle="Choose a screen from the list or add one below." />
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
              componentLabels={
                Object.fromEntries(
                  Object.entries(manifest.components ?? {}).map(([k, v]) => [k, v.label ?? k])
                )
              }
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
  manifest: UISystemManifest;
  builderManifest: FormManifest;
  selected: string | null;
  onSelect: (k: string | null) => void;
  onUpdate: (m: UISystemManifest) => void;
  formPickerMode: "existing" | "wizard" | "advanced";
  onFormPickerModeChange: (m: "existing" | "wizard" | "advanced") => void;
  formCreatorManifest: FormManifest | null;
  formCreatorLoading: boolean;
  onNeedFormCreator: () => Promise<void>;
}) {
  const components = manifest.components ?? {};
  const compKeys   = Object.keys(components);
  const sel        = selected && components[selected] ? components[selected] : null;

  const addComponent = (answers: FieldAnswers) => {
    const key = slugify(String(answers.key)) || `component_${compKeys.length + 1}`;
    onUpdate({
      ...manifest,
      components: {
        ...components,
        [key]: {
          name:  key,
          label: String(answers.label || key),
          type:  (answers.type as ComponentType) || "Card",
        } as Component,
      },
    });
    onSelect(key);
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
          label:       String(answers.label || "") || undefined,
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
          form_ref:   String(answers.form_ref   || "") || undefined,
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
    if (selected) {
      onUpdate({
        ...manifest,
        forms: updatedForms,
        components: { ...components, [selected]: { ...components[selected], form_ref: fids[0] } },
      });
    } else {
      onUpdate({ ...manifest, forms: updatedForms });
    }
    toast.success(`Form "${fids[0]}" added`);
    onFormPickerModeChange("existing");
  };

  const deleteComponent = (key: string) => {
    const next = { ...components };
    delete next[key];
    onUpdate({ ...manifest, components: next });
    if (selected === key) onSelect(null);
  };

  const updateSubComponents = (subs: UIComponent["sub_components"]) => {
    if (!selected) return;
    onUpdate({ ...manifest, components: { ...components, [selected]: { ...components[selected], sub_components: subs } } });
  };

  const embeddedForms = useMemo<FormManifest | null>(() => {
    if (!manifest.forms || !Object.keys(manifest.forms).length) return null;
    return {
      manifest_id:      manifest.manifest_id,
      manifest_version: manifest.manifest_version ?? "1.0.0",
      forms:            manifest.forms as FormManifest["forms"],
    } as FormManifest;
  }, [manifest]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-44 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {compKeys.length === 0 && <p className="text-xs text-gray-400 p-3 text-center">No components</p>}
          {compKeys.map(key => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={cn(
                "w-full text-left px-3 py-2.5 text-xs border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group",
                selected === key
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300",
              )}
            >
              <span>{COMPONENT_TYPE_ICONS[components[key].type] ?? "🧩"}</span>
              <span className="truncate flex-1 font-medium">{components[key].label ?? key}</span>
              <span className={cn(
                "text-[8px] px-1 rounded font-mono flex-shrink-0",
                components[key].type === "Form"
                  ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                  : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500",
              )}>
                {components[key].type}
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700">
          <details className="group">
            <summary className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-blue-600 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 list-none">
              <span className="group-open:rotate-90 transition-transform text-base leading-none">+</span>
              Add Component
            </summary>
            <div className="border-t border-gray-100 dark:border-gray-800">
              <BuilderForm
                formKey="add-component"
                formId="add_component"
                manifest={builderManifest}
                onSubmit={addComponent}
                compact
              />
            </div>
          </details>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {!sel ? (
          <EmptyDetail icon="🧩" title="Select a component" subtitle="Choose a component or add one below." />
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <PanelHeader
                icon={COMPONENT_TYPE_ICONS[sel.type] ?? "🧩"}
                title={sel.label ?? selected!}
                subtitle={`key: ${selected} · type: ${sel.type}`}
              />
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
                manifest={manifest}
                builderManifest={builderManifest}
                component={sel}
                formPickerMode={formPickerMode}
                onFormPickerModeChange={onFormPickerModeChange}
                formCreatorManifest={formCreatorManifest}
                formCreatorLoading={formCreatorLoading}
                onNeedFormCreator={onNeedFormCreator}
                onFormAdded={addFormToManifest}
                onApplyConfig={applyFormConfig}
                embeddedForms={embeddedForms}
              />
            )}

            <PlacementsEditor
              title="Sub-Components"
              placements={sel.sub_components ?? []}
              componentKeys={compKeys}
              componentLabels={
                Object.fromEntries(
                  Object.entries(manifest.components ?? {}).map(([k, v]) => [k, v.label ?? k])
                )
              }
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
  manifest: UISystemManifest;
  builderManifest: FormManifest;
  component: UIComponent;
  formPickerMode: "existing" | "wizard" | "advanced";
  onFormPickerModeChange: (m: "existing" | "wizard" | "advanced") => void;
  formCreatorManifest: FormManifest | null;
  formCreatorLoading: boolean;
  onNeedFormCreator: () => Promise<void>;
  onFormAdded: (fm: FormManifest) => void;
  onApplyConfig: (a: FieldAnswers) => void;
  embeddedForms: FormManifest | null;
}) {
  return (
    <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-100 dark:border-purple-800/60">
        <span className="text-base">📋</span>
        <span className="text-sm font-bold text-purple-800 dark:text-purple-300">Form Configuration</span>
        <span className="ml-auto text-[10px] font-mono text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
          type: Form
        </span>
      </div>

      <div className="flex gap-0 px-4 pt-3">
        {([
          { id: "existing" as const, icon: "📂", label: "Existing" },
          { id: "wizard"   as const, icon: "🧙", label: "Wizard" },
          { id: "advanced" as const, icon: "⚡", label: "Advanced" },
        ] as const).map(opt => (
          <button
            key={opt.id}
            onClick={() => { onFormPickerModeChange(opt.id); if (opt.id === "wizard") onNeedFormCreator(); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-all",
              formPickerMode === opt.id
                ? "border-purple-500 text-purple-700 dark:text-purple-300"
                : "border-transparent text-gray-400 hover:text-gray-600",
            )}
          >
            <span>{opt.icon}</span>{opt.label}
          </button>
        ))}
      </div>

      {formPickerMode === "existing" && (
        <div className="px-1 pb-1">
          {Object.keys(manifest.forms ?? {}).length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 rounded-lg m-4 p-2.5">
              No forms in this manifest yet — use Wizard or Advanced to create one.
            </p>
          )}
          <BuilderForm
            formKey={`form-cfg-${component.name}`}
            formId="form_config_editor"
            manifest={builderManifest}
            initialAnswers={formConfigAnswers(component)}
            onSubmit={onApplyConfig}
          />
        </div>
      )}

      {formPickerMode === "wizard" && (
        <div className="p-4">
          {formCreatorLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
              <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-purple-500 animate-spin" />
              Loading form creator…
            </div>
          )}
          {!formCreatorLoading && !formCreatorManifest && (
            <div className="text-center py-6 text-sm text-gray-400 space-y-2">
              <p>Could not load the form creator.</p>
              <button onClick={onNeedFormCreator} className="text-purple-500 hover:underline text-xs">Retry</button>
            </div>
          )}
          {formCreatorManifest && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-purple-200 dark:border-purple-800 overflow-hidden">
              <FormEngine
                key="form-creator"
                manifest={formCreatorManifest}
                formId="create_form"
                onSubmit={async (answers) => {
                  const formId     = slugify(String(answers.form_id ?? "")) || `form_${Date.now()}`;
                  const layoutType = String(answers.layout_type ?? "single-page");

                  // Build wizard pages from comma-separated names field
                  const rawPageNames = String(answers.wizard_pages ?? "").trim();
                  const pageNames = layoutType === "wizard" && rawPageNames
                    ? rawPageNames.split(",").map(s => s.trim()).filter(Boolean)
                    : ["Page 1"];

                  const pages = pageNames.map((name, i) => ({
                    id:       `page_${i + 1}`,
                    title:    name,
                    sections: [{ id: `s_page_${i + 1}`, title: "Fields", fields: [] }],
                  }));

                  onFormAdded({
                    manifest_id:      manifest.manifest_id,
                    manifest_version: "1.0.0",
                    forms: {
                      [formId]: {
                        title:        String(answers.title ?? "New Form"),
                        version:      "1.0.0",
                        form_state:   "active",
                        layout:       { type: layoutType },
                        submit_label: String(answers.submit_label || "Submit") || undefined,
                        sections:     layoutType !== "wizard"
                          ? [{ id: "section_1", title: "Section 1", fields: [] }]
                          : undefined,
                        pages: layoutType === "wizard" ? pages : undefined,
                      } as unknown,
                    },
                  } as FormManifest);
                }}
              />
            </div>
          )}
        </div>
      )}

      {formPickerMode === "advanced" && (
        <div className="p-4">
          {embeddedForms && Object.keys(embeddedForms.forms ?? {}).length > 0 ? (
            <div className="h-[420px] rounded-xl overflow-hidden border border-purple-200 dark:border-purple-800">
              <VisualFormBuilder
                manifest={embeddedForms}
                formId={component.form_ref ?? Object.keys(embeddedForms.forms ?? {})[0] ?? ""}
                onChange={fm => onFormAdded(fm)}
              />
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-gray-400 space-y-2">
              <p>No forms to edit yet.</p>
              <button onClick={() => onFormPickerModeChange("wizard")}
                className="text-purple-600 hover:underline text-xs font-medium">
                → Create one via Wizard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Navigation Panel ──────────────────────────────────────────────────────────

function NavigationPanel({ manifest, builderManifest, onUpdate }: {
  manifest: UISystemManifest;
  builderManifest: FormManifest;
  onUpdate: (m: UISystemManifest) => void;
}) {
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
    onUpdate({
      ...manifest,
      navigation: {
        ...nav,
        routes: {
          ...routes,
          [key]: {
            screen:        String(answers.screen || ""),
            path:          String(answers.path || "") || undefined,
            auth_required: Boolean(answers.auth_required),
          },
        },
      },
    });
    toast.success("Route saved");
  };

  const deleteRoute = (key: string) => {
    const next = { ...routes };
    delete next[key];
    onUpdate({ ...manifest, navigation: { ...nav, routes: next } });
  };

  return (
    <div className="p-5 space-y-6">
      <PanelHeader icon="🧭" title="Navigation" subtitle="Stack type, initial screen, and routes" />

      <BuilderForm
        formKey={`nav-${manifest.manifest_id}`}
        formId="navigation_editor"
        manifest={builderManifest}
        initialAnswers={navigationAnswers(nav)}
        onSubmit={applyNav}
      />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Routes</h4>
        </div>

        {Object.keys(routes).length > 0 && (
          <div className="space-y-2 mb-4">
            {Object.entries(routes).map(([key, r]) => (
              <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-mono text-gray-500 flex-shrink-0 w-28 truncate">{key}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">→</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{r.screen}</span>
                {r.path && <span className="text-xs font-mono text-blue-400">{r.path}</span>}
                {r.auth_required !== false && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">auth</span>}
                <button onClick={() => deleteRoute(key)} className="text-gray-300 hover:text-red-500 text-sm flex-shrink-0">×</button>
              </div>
            ))}
          </div>
        )}

        <details className="group">
          <summary className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 cursor-pointer list-none">
            <span className="group-open:rotate-90 transition-transform text-base leading-none">+</span>
            Add Route
          </summary>
          <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <BuilderForm
              formKey={`add-route-${Object.keys(routes).length}`}
              formId="route_editor"
              manifest={builderManifest}
              onSubmit={applyRoute}
              compact
            />
          </div>
        </details>
      </div>
    </div>
  );
}

// ─── Themes Panel ─────────────────────────────────────────────────────────────

function ThemesPanel({ manifest, builderManifest, selected, onSelect, onUpdate }: {
  manifest: UISystemManifest;
  builderManifest: FormManifest;
  selected: string | null;
  onSelect: (k: string | null) => void;
  onUpdate: (m: UISystemManifest) => void;
}) {
  const themes    = manifest.themes ?? {};
  const themeKeys = Object.keys(themes);
  const sel       = selected && themes[selected] ? themes[selected] : null;

  const addTheme = (answers: FieldAnswers) => {
    const key = slugify(String(answers.key)) || `theme_${themeKeys.length + 1}`;
    onUpdate({
      ...manifest,
      themes: {
        ...themes,
        [key]: {
          label:    String(answers.label || key),
          extends:  String(answers.extends || "default"),
          colors:   { primary: "#006FFD" },
          typography: { scale: {} },
          spacing: {},
          radius: {},
          elevation: {},
          selectable: true,
        },
      },
    });
    onSelect(key);
    toast.success(`Theme "${key}" added`);
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
          label:         String(answers.label || ""),
          extends:       String(answers.extends || "default") || undefined,
          selectable:    Boolean(answers.selectable),
          preview_color: hex(answers.preview_color),
          colors: {
            ...(themes[selected].colors ?? {}),
            primary:       String(answers.color_primary || ""),
            primary_light: String(answers.color_primary_light || "") || undefined,
            primary_dark:  String(answers.color_primary_dark  || "") || undefined,
            surface:       String(answers.color_surface       || "") || undefined,
            on_surface:    String(answers.color_on_surface     || "") || undefined,
            outline:       String(answers.color_outline        || "") || undefined,
            error:         String(answers.color_error          || "") || undefined,
            success:       String(answers.color_success        || "") || undefined,
            warning:       String(answers.color_warning        || "") || undefined,
          },
        } as ThemeDefinition,
      },
    });
    toast.success("Theme updated");
  };

  const deleteTheme = (key: string) => {
    const next = { ...themes };
    delete next[key];
    onUpdate({ ...manifest, themes: next });
    if (selected === key) onSelect(null);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-44 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {themeKeys.length === 0 && <p className="text-xs text-gray-400 p-3 text-center">No custom themes</p>}
          {themeKeys.map(key => (
            <div key={key} className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 group">
              <button
                type="button"
                onClick={() => onSelect(key)}
                className={cn(
                  "flex-1 text-left px-3 py-2.5 text-xs flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer select-none",
                  selected === key
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300",
                )}
              >
                {themes[key].preview_color && (
                  <span className="h-3 w-3 rounded-full flex-shrink-0 border border-gray-200"
                    style={{ background: `#${themes[key].preview_color}` }} />
                )}
                <span className="truncate flex-1 font-medium">{themes[key].label ?? key}</span>
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); deleteTheme(key); }}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-base"
              >×</button>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700">
          <details className="group">
            <summary className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-blue-600 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 list-none">
              <span className="group-open:rotate-90 transition-transform text-base leading-none">+</span>
              Add Theme
            </summary>
            <div className="border-t border-gray-100 dark:border-gray-800">
              <BuilderForm
                formKey="add-theme"
                formId="add_theme"
                manifest={builderManifest}
                onSubmit={addTheme}
                compact
              />
            </div>
          </details>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {!sel ? (
          <EmptyDetail icon="🎨" title="Select a theme" subtitle="Custom themes extend built-in themes (default · material · ios-hig · fluent)." />
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <PanelHeader icon="🎨" title={sel.label ?? selected!} subtitle={`key: ${selected}`} />
              <button onClick={() => deleteTheme(selected!)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
            </div>
            <BuilderForm
              formKey={`theme-${selected}`}
              formId="theme_editor"
              manifest={builderManifest}
              initialAnswers={themeAnswers(sel)}
              onSubmit={applyTheme}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assets Panel ──────────────────────────────────────────────────────────────

function AssetsPanel({ manifest, builderManifest, onUpdate }: {
  manifest: UISystemManifest;
  builderManifest: FormManifest;
  onUpdate: (m: UISystemManifest) => void;
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
    const key = String(a.key || `btn_${Object.keys(buttons).length + 1}`).toLowerCase().replace(/\s+/g, "_");
    onUpdate({ ...manifest, buttons: { ...buttons, [key]: { name: key, label: String(a.label || ""), on_press: String(a.on_press || "navigate") } } });
    toast.success("Button saved");
  };

  const saveDialog = (a: FieldAnswers) => {
    const key = String(a.key || `dialog_${Object.keys(dialogs).length + 1}`).toLowerCase().replace(/\s+/g, "_");
    onUpdate({ ...manifest, dialogs: { ...dialogs, [key]: { title: String(a.title || ""), body: String(a.body || "") || undefined } } });
    toast.success("Dialog saved");
  };

  const saveToast = (a: FieldAnswers) => {
    const key = String(a.key || `toast_${Object.keys(toasts).length + 1}`).toLowerCase().replace(/\s+/g, "_");
    onUpdate({ ...manifest, toasts: { ...toasts, [key]: { message: String(a.message || ""), severity: String(a.severity || "info") } as Toast } });
    toast.success("Toast saved");
  };

  const saveIcon = (a: FieldAnswers) => {
    const key = String(a.key || `icon_${Object.keys(icons).length + 1}`).toLowerCase().replace(/\s+/g, "_");
    onUpdate({ ...manifest, icons: { ...icons, [key]: { type: String(a.type || "lucide") as any, name: String(a.name || "") || undefined } } });
    toast.success("Icon saved");
  };

  const deleteAsset = (collection: "buttons" | "dialogs" | "toasts" | "icons", key: string) => {
    const next = { ...manifest[collection] } as Record<string, unknown>;
    delete next[key];
    onUpdate({ ...manifest, [collection]: next });
  };

  return (
    <div className="p-5 space-y-4">
      <PanelHeader icon="📦" title="Assets" subtitle="Reusable buttons, dialogs, toasts, and icons" />

      <div className="flex gap-0 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
              tab === t.id ? "bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white" : "text-gray-500",
            )}
          >
            {t.label}
            {t.count > 0 && <span className="text-[10px] opacity-50 ml-1">({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === "buttons" && Object.keys(buttons).length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(buttons).map(([key, b]) => (
            <AssetRow key={key} label={b.label ?? key} sub={`on_press: ${b.on_press}`} badge={key}
              onDelete={() => deleteAsset("buttons", key)} />
          ))}
        </div>
      )}
      {tab === "dialogs" && Object.keys(dialogs).length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(dialogs).map(([key, d]) => (
            <AssetRow key={key} label={d.title} sub={d.body ?? ""} badge={key}
              onDelete={() => deleteAsset("dialogs", key)} />
          ))}
        </div>
      )}
      {tab === "toasts" && Object.keys(toasts).length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(toasts).map(([key, t]) => (
            <AssetRow key={key} label={t.message} sub={t.severity ?? "info"} badge={key}
              onDelete={() => deleteAsset("toasts", key)} />
          ))}
        </div>
      )}
      {tab === "icons" && Object.keys(icons).length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(icons).map(([key, ic]) => (
            <AssetRow key={key} label={ic.name ?? key} sub={`type: ${ic.type}`} badge={key}
              onDelete={() => deleteAsset("icons", key)} />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700">
          <span className="text-xs font-semibold text-gray-500">
            {tab === "buttons" ? "Add Button" : tab === "dialogs" ? "Add Dialog" : tab === "toasts" ? "Add Toast" : "Add Icon"}
          </span>
        </div>
        {tab === "buttons" && (
          <BuilderForm key="btn" formKey="add-button" formId="button_editor" manifest={builderManifest} onSubmit={saveButton} compact />
        )}
        {tab === "dialogs" && (
          <BuilderForm key="dlg" formKey="add-dialog" formId="dialog_editor" manifest={builderManifest} onSubmit={saveDialog} compact />
        )}
        {tab === "toasts" && (
          <BuilderForm key="tst" formKey="add-toast" formId="toast_editor" manifest={builderManifest} onSubmit={saveToast} compact />
        )}
        {tab === "icons" && (
          <BuilderForm key="ico" formKey="add-icon" formId="icon_editor" manifest={builderManifest} onSubmit={saveIcon} compact />
        )}
      </div>
    </div>
  );
}

// ─── Placements Editor ────────────────────────────────────────────────────────

function PlacementsEditor({
  title = "Component Placements",
  placements,
  componentKeys,
  componentLabels,
  onChange,
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
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          + Add
        </button>
      </div>

      {placements.length === 0 && (
        <p className="text-xs text-gray-400 italic">None yet.</p>
      )}

      {placements.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1.5">
          <select
            value={p.component_ref}
            onChange={e => {
              const next = [...placements];
              next[i] = { ...p, component_ref: e.target.value };
              onChange(next);
            }}
            className="field-input text-xs flex-1 min-w-0"
          >
            <option value="">— component —</option>
            {componentKeys.map(k => (
              <option key={k} value={k}>{componentLabels[k] ?? k}</option>
            ))}
          </select>
          <select
            value={p.direction}
            onChange={e => {
              const next = [...placements];
              next[i] = { ...p, direction: e.target.value as LayoutDirection };
              onChange(next);
            }}
            className="field-input text-xs w-28 flex-shrink-0"
          >
            {DIRECTION_OPTIONS.map(d => (
              <option key={d} value={d}>{DIRECTION_ICONS[d]} {d}</option>
            ))}
          </select>
          <button
            onClick={() => onChange(placements.filter((_, j) => j !== i))}
            className="text-gray-400 hover:text-red-500 text-sm flex-shrink-0"
          >×</button>
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

function AssetRow({ label, sub, badge, onDelete }: {
  label: string; sub: string; badge: string; onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 group">
      <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded flex-shrink-0">{badge}</span>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{label}</span>
      {sub && <span className="text-[10px] text-gray-400 truncate max-w-[120px] hidden sm:block">{sub}</span>}
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-sm flex-shrink-0 transition-opacity">×</button>
    </div>
  );
}
