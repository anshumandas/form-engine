"use client";

import React, {
  useState, useCallback, useEffect, useRef, useMemo,
} from "react";
import { cn } from "@form-engine/libs/utils";
import type { FormManifest } from "@form-engine/libs/types";
import { VisualFormBuilder } from "@/components/FormBuilder/VisualFormBuilder";
import { FormEngine } from "@form-engine/components/FormEngine";
import { api } from "@/api";
import { toast } from "sonner";

// ─── Types (UISystemManifest subset) ─────────────────────────────────────────

export type ComponentType =
  | "Tree" | "Table" | "Form" | "VerticalList" | "HorizontalList"
  | "Search" | "Card" | "Tile" | "FileGallery" | "FilterBuilder"
  | "Avatar" | "Custom";

export type LayoutDirection = "Center" | "Top" | "Bottom" | "Left" | "Right" | "Floating" | "Modal";

export interface UIComponent {
  name: string;
  label?: string;
  type: ComponentType;
  form_ref?: string;
  form_embed?: { mode?: "inline" | "modal" | "drawer" | "panel" };
  schema_ref?: string;
  text?: string;
  foreground_color?: string;
  background_color?: string;
  feature_ref?: string;
  theme_ref?: string;
  sub_components?: Array<{ component_ref: string; direction: LayoutDirection }>;
}

export interface UIScreen {
  name: string;
  label?: string;
  icon_ref?: string;
  is_home?: boolean;
  nav_order?: number;
  theme_ref?: string;
  background_color?: string;
  auth_rules?: {
    require_auth?: boolean;
    redirect_on_denied?: string;
  };
  allowed_role_categories?: string[];
  components?: Array<{ component_ref: string; direction: LayoutDirection }>;
}

export interface UIRoute {
  screen: string;
  path?: string;
  auth_required?: boolean;
  feature_ref?: string;
}

export interface UINavigation {
  initial_screen?: string;
  type?: "tab_bar" | "drawer" | "stack" | "none";
  tab_bar_position?: "top" | "bottom";
  routes?: Record<string, UIRoute>;
}

export interface ThemeColors {
  primary?: string;
  primary_light?: string;
  primary_dark?: string;
  surface?: string;
  on_surface?: string;
  outline?: string;
  error?: string;
  success?: string;
  warning?: string;
}

export interface ThemeDefinition {
  label?: string;
  extends?: string;
  colors?: ThemeColors;
  dark_mode?: Partial<ThemeColors>;
  selectable?: boolean;
  preview_color?: string;
}

export interface UISystemManifest {
  manifest_id: string;
  manifest_version?: string;
  description?: string;
  namespaces?: string[];
  active_theme?: string;
  engine?: { mode?: "reactive" | "static"; error_mode?: string; debounce_ms?: number };
  forms?: Record<string, unknown>;
  screens?: Record<string, UIScreen>;
  components?: Record<string, UIComponent>;
  navigation?: UINavigation;
  themes?: Record<string, ThemeDefinition>;
  icons?: Record<string, { type: string; name?: string; path?: string }>;
  buttons?: Record<string, { name: string; label?: string; on_press: string }>;
  dialogs?: Record<string, { title: string; body?: string }>;
  toasts?: Record<string, { message: string; severity?: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COMPONENT_TYPES: ComponentType[] = [
  "Form", "Table", "Card", "VerticalList", "HorizontalList",
  "Search", "Tile", "Tree", "FileGallery", "FilterBuilder", "Avatar", "Custom",
];

const DIRECTION_OPTIONS: LayoutDirection[] = [
  "Center", "Top", "Bottom", "Left", "Right", "Floating", "Modal",
];

const COMPONENT_TYPE_ICONS: Record<string, string> = {
  Form: "📋", Table: "⊞", Card: "🃏", VerticalList: "☰", HorizontalList: "↔",
  Search: "🔍", Tile: "⬜", Tree: "🌲", FileGallery: "🗂", FilterBuilder: "⚙",
  Avatar: "👤", Custom: "⚡",
};

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function emptyManifest(): UISystemManifest {
  return {
    manifest_id: "my_ui",
    manifest_version: "1.0.0",
    description: "",
    namespaces: ["core", "schemata", "uam", "form", "ui"],
    active_theme: "default",
    engine: { mode: "reactive", error_mode: "collect-all" },
    forms: {},
    screens: {},
    components: {},
    navigation: { type: "stack", initial_screen: "" },
    themes: {},
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VisualUIBuilderProps {
  initialManifest?: UISystemManifest;
  onChange?: (manifest: UISystemManifest) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

type NavTab = "overview" | "screens" | "components" | "navigation" | "themes" | "assets";

export function VisualUIBuilder({ initialManifest, onChange }: VisualUIBuilderProps) {
  const [manifest, setManifest] = useState<UISystemManifest>(
    initialManifest ?? emptyManifest(),
  );
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [yamlOutput, setYamlOutput] = useState("");
  const [formPickerMode, setFormPickerMode] = useState<"existing" | "wizard" | "advanced">("existing");
  const [formCreatorManifest, setFormCreatorManifest] = useState<FormManifest | null>(null);
  const [formCreatorLoading, setFormCreatorLoading] = useState(false);

  // Sync onChange
  const update = useCallback((next: UISystemManifest) => {
    setManifest(next);
    onChange?.(next);
  }, [onChange]);

  // Generate YAML
  useEffect(() => {
    let active = true;
    import("yaml").then(({ stringify }) => {
      if (active) setYamlOutput(stringify(manifest, { indent: 2 }));
    }).catch(() => {
      if (active) setYamlOutput(JSON.stringify(manifest, null, 2));
    });
    return () => { active = false; };
  }, [manifest]);

  // Load form creator manifest when needed
  const ensureFormCreator = async () => {
    if (formCreatorManifest) return;
    setFormCreatorLoading(true);
    try {
      const m = await api.getManifest("form_creator");
      setFormCreatorManifest(m);
    } catch { toast.error("Could not load form creator — is the backend running?"); }
    finally { setFormCreatorLoading(false); }
  };

  const screenKeys = Object.keys(manifest.screens ?? {});
  const componentKeys = Object.keys(manifest.components ?? {});
  const formKeys = Object.keys(manifest.forms ?? {});

  const TABS: { id: NavTab; label: string; icon: string; count?: number }[] = [
    { id: "overview",    label: "Overview",    icon: "🗒" },
    { id: "screens",     label: "Screens",     icon: "📱", count: screenKeys.length },
    { id: "components",  label: "Components",  icon: "🧩", count: componentKeys.length },
    { id: "navigation",  label: "Navigation",  icon: "🧭" },
    { id: "themes",      label: "Themes",      icon: "🎨", count: Object.keys(manifest.themes ?? {}).length },
    { id: "assets",      label: "Assets",      icon: "📦" },
  ];

  return (
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* ── Left: editor panel ───────────────────────────────────────── */}
      <div className="flex flex-col w-3/5 border-r border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Tab bar */}
        <div className="flex items-center gap-0.5 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
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
                  activeTab === t.id ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600",
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto">
          {activeTab === "overview" && (
            <OverviewEditor manifest={manifest} onUpdate={update} />
          )}
          {activeTab === "screens" && (
            <ScreensEditor
              manifest={manifest}
              selected={selectedScreen}
              onSelect={setSelectedScreen}
              onUpdate={update}
            />
          )}
          {activeTab === "components" && (
            <ComponentsEditor
              manifest={manifest}
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
            <NavigationEditor manifest={manifest} onUpdate={update} />
          )}
          {activeTab === "themes" && (
            <ThemesEditor manifest={manifest} onUpdate={update} />
          )}
          {activeTab === "assets" && (
            <AssetsEditor manifest={manifest} onUpdate={update} />
          )}
        </div>
      </div>

      {/* ── Right: YAML output ───────────────────────────────────────── */}
      <div className="flex flex-col w-2/5 overflow-hidden bg-gray-950">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
          <span className="text-xs font-medium text-gray-400">ui_system.yaml output</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 font-mono">
              {manifest.manifest_id}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(yamlOutput);
                toast.success("Copied to clipboard!");
              }}
              className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <pre className="p-4 text-xs font-mono text-green-300 leading-relaxed whitespace-pre-wrap break-all">
            {yamlOutput || "# Loading..."}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── Overview Editor ──────────────────────────────────────────────────────────

function OverviewEditor({ manifest, onUpdate }: {
  manifest: UISystemManifest;
  onUpdate: (m: UISystemManifest) => void;
}) {
  return (
    <div className="p-5 space-y-5">
      <SectionHeader icon="🗒" title="Manifest Overview" subtitle="Identity and global settings" />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Manifest ID" required>
          <input
            value={manifest.manifest_id}
            onChange={e => onUpdate({ ...manifest, manifest_id: slugify(e.target.value) || "my_ui" })}
            className="field-input font-mono"
            placeholder="my_app_ui"
          />
        </Field>
        <Field label="Version">
          <input
            value={manifest.manifest_version ?? "1.0.0"}
            onChange={e => onUpdate({ ...manifest, manifest_version: e.target.value })}
            className="field-input"
            placeholder="1.0.0"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={manifest.description ?? ""}
          onChange={e => onUpdate({ ...manifest, description: e.target.value })}
          rows={2}
          className="field-input resize-none"
          placeholder="Describe what this UI manifest covers…"
        />
      </Field>

      <Field label="Active Theme">
        <input
          value={manifest.active_theme ?? "default"}
          onChange={e => onUpdate({ ...manifest, active_theme: e.target.value })}
          className="field-input"
          placeholder="default"
        />
        <p className="text-xs text-gray-400 mt-1">
          Built-in: <code>default</code>, <code>material</code>, <code>ios-hig</code>, <code>fluent</code> — or a key from your Themes.
        </p>
      </Field>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Engine Config</label>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Mode">
            <select
              value={manifest.engine?.mode ?? "reactive"}
              onChange={e => onUpdate({ ...manifest, engine: { ...manifest.engine, mode: e.target.value as "reactive" | "static" } })}
              className="field-input"
            >
              <option value="reactive">reactive</option>
              <option value="static">static</option>
            </select>
          </Field>
          <Field label="Error Mode">
            <select
              value={manifest.engine?.error_mode ?? "collect-all"}
              onChange={e => onUpdate({ ...manifest, engine: { ...manifest.engine, error_mode: e.target.value } })}
              className="field-input"
            >
              <option value="collect-all">collect-all</option>
              <option value="fail-fast">fail-fast</option>
            </select>
          </Field>
          <Field label="Debounce ms">
            <input
              type="number"
              value={manifest.engine?.debounce_ms ?? 300}
              onChange={e => onUpdate({ ...manifest, engine: { ...manifest.engine, debounce_ms: Number(e.target.value) } })}
              className="field-input"
            />
          </Field>
        </div>
      </div>

      <Field label="Namespaces">
        <div className="flex flex-wrap gap-2">
          {["core", "schemata", "uam", "form", "ui"].map(ns => {
            const active = (manifest.namespaces ?? ["core", "schemata", "uam", "form", "ui"]).includes(ns);
            return (
              <button
                key={ns}
                onClick={() => {
                  const current = manifest.namespaces ?? ["core", "schemata", "uam", "form", "ui"];
                  onUpdate({
                    ...manifest,
                    namespaces: active
                      ? current.filter(n => n !== ns)
                      : [...current, ns],
                  });
                }}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all",
                  active
                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                    : "bg-gray-100 text-gray-400 border border-gray-200",
                )}
              >
                {ns}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

// ─── Screens Editor ───────────────────────────────────────────────────────────

function ScreensEditor({ manifest, selected, onSelect, onUpdate }: {
  manifest: UISystemManifest;
  selected: string | null;
  onSelect: (k: string | null) => void;
  onUpdate: (m: UISystemManifest) => void;
}) {
  const screens = manifest.screens ?? {};
  const screenKeys = Object.keys(screens);
  const sel = selected && screens[selected] ? screens[selected] : null;
  const componentKeys = Object.keys(manifest.components ?? {});

  const addScreen = () => {
    const key = `screen_${screenKeys.length + 1}`;
    onUpdate({
      ...manifest,
      screens: {
        ...screens,
        [key]: { name: key, label: `Screen ${screenKeys.length + 1}`, auth_rules: { require_auth: true } },
      },
    });
    onSelect(key);
  };

  const deleteScreen = (key: string) => {
    const next = { ...screens };
    delete next[key];
    onUpdate({ ...manifest, screens: next });
    if (selected === key) onSelect(null);
  };

  const updateScreen = (key: string, updates: Partial<UIScreen>) => {
    onUpdate({
      ...manifest,
      screens: { ...screens, [key]: { ...screens[key], ...updates } },
    });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* List */}
      <div className="w-48 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-100 dark:border-gray-800">
          <button onClick={addScreen} className="w-full btn-primary text-xs py-1.5 justify-center gap-1">
            <span>＋</span> Add Screen
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {screenKeys.length === 0 && (
            <p className="text-xs text-gray-400 p-3 text-center">No screens yet</p>
          )}
          {screenKeys.map(key => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={cn(
                "w-full text-left px-3 py-2.5 text-xs border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 hover:bg-gray-50 transition-colors",
                selected === key ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : "text-gray-700 dark:text-gray-300",
              )}
            >
              <span>{screens[key].is_home ? "🏠" : "📱"}</span>
              <span className="truncate flex-1">{screens[key].label ?? key}</span>
              <button
                onClick={e => { e.stopPropagation(); deleteScreen(key); }}
                className="text-gray-300 hover:text-red-500 text-base leading-none flex-shrink-0 opacity-0 group-hover:opacity-100"
              >×</button>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto p-5">
        {!sel ? (
          <EmptyDetail icon="📱" title="Select or create a screen" subtitle="Screens compose components and define auth rules." />
        ) : (
          <div className="space-y-5">
            <SectionHeader icon="📱" title={sel.label ?? selected!} subtitle={`Key: ${selected}`} />

            <div className="grid grid-cols-2 gap-4">
              <Field label="Screen Key (ID)">
                <input
                  value={selected!}
                  disabled
                  className="field-input font-mono opacity-60"
                />
              </Field>
              <Field label="Label">
                <input
                  value={sel.label ?? ""}
                  onChange={e => updateScreen(selected!, { label: e.target.value })}
                  className="field-input"
                  placeholder="My Screen"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Nav Order">
                <input
                  type="number"
                  value={sel.nav_order ?? ""}
                  onChange={e => updateScreen(selected!, { nav_order: e.target.value ? Number(e.target.value) : undefined })}
                  className="field-input"
                />
              </Field>
              <Field label="Theme Ref">
                <input
                  value={sel.theme_ref ?? ""}
                  onChange={e => updateScreen(selected!, { theme_ref: e.target.value || undefined })}
                  className="field-input"
                  placeholder="default"
                />
              </Field>
              <Field label="">
                <label className="flex items-center gap-2 mt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sel.is_home ?? false}
                    onChange={e => updateScreen(selected!, { is_home: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Is home screen</span>
                </label>
              </Field>
            </div>

            {/* Auth rules */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Auth Rules</label>
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sel.auth_rules?.require_auth !== false}
                    onChange={e => updateScreen(selected!, {
                      auth_rules: { ...sel.auth_rules, require_auth: e.target.checked },
                    })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Require auth</span>
                </label>
                <Field label="Redirect on denied">
                  <input
                    value={sel.auth_rules?.redirect_on_denied ?? ""}
                    onChange={e => updateScreen(selected!, {
                      auth_rules: { ...sel.auth_rules, redirect_on_denied: e.target.value || undefined },
                    })}
                    className="field-input text-xs"
                    placeholder="login_screen"
                  />
                </Field>
              </div>
            </div>

            {/* Component placements */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Components</label>
                <button
                  onClick={() => {
                    const comp = componentKeys[0] ?? "component_1";
                    updateScreen(selected!, {
                      components: [
                        ...(sel.components ?? []),
                        { component_ref: comp, direction: "Center" },
                      ],
                    });
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Add placement
                </button>
              </div>
              <div className="space-y-2">
                {(sel.components ?? []).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
                    <select
                      value={p.component_ref}
                      onChange={e => {
                        const comps = [...(sel.components ?? [])];
                        comps[i] = { ...p, component_ref: e.target.value };
                        updateScreen(selected!, { components: comps });
                      }}
                      className="field-input text-xs flex-1"
                    >
                      <option value="">— select component —</option>
                      {componentKeys.map(k => (
                        <option key={k} value={k}>{manifest.components?.[k]?.label ?? k}</option>
                      ))}
                    </select>
                    <select
                      value={p.direction}
                      onChange={e => {
                        const comps = [...(sel.components ?? [])];
                        comps[i] = { ...p, direction: e.target.value as LayoutDirection };
                        updateScreen(selected!, { components: comps });
                      }}
                      className="field-input text-xs w-28"
                    >
                      {DIRECTION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <button
                      onClick={() => {
                        const comps = (sel.components ?? []).filter((_, j) => j !== i);
                        updateScreen(selected!, { components: comps });
                      }}
                      className="text-gray-400 hover:text-red-500 text-sm flex-shrink-0"
                    >×</button>
                  </div>
                ))}
                {(sel.components ?? []).length === 0 && (
                  <p className="text-xs text-gray-400 italic">No component placements yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Components Editor ────────────────────────────────────────────────────────

function ComponentsEditor({
  manifest, selected, onSelect, onUpdate,
  formPickerMode, onFormPickerModeChange,
  formCreatorManifest, formCreatorLoading, onNeedFormCreator,
}: {
  manifest: UISystemManifest;
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
  const componentKeys = Object.keys(components);
  const formKeys = Object.keys(manifest.forms ?? {});
  const sel = selected && components[selected] ? components[selected] : null;

  const addComponent = (type: ComponentType = "Card") => {
    const key = `component_${componentKeys.length + 1}`;
    onUpdate({
      ...manifest,
      components: {
        ...components,
        [key]: { name: key, label: `${type} Component`, type },
      },
    });
    onSelect(key);
  };

  const deleteComponent = (key: string) => {
    const next = { ...components };
    delete next[key];
    onUpdate({ ...manifest, components: next });
    if (selected === key) onSelect(null);
  };

  const updateComponent = (key: string, updates: Partial<UIComponent>) => {
    onUpdate({
      ...manifest,
      components: { ...components, [key]: { ...components[key], ...updates } },
    });
  };

  // When type changes to Form, optionally pre-set form_ref
  const handleTypeChange = (type: ComponentType) => {
    if (!selected) return;
    updateComponent(selected, {
      type,
      form_ref: type === "Form" ? (formKeys[0] ?? undefined) : undefined,
    });
  };

  const addFormToManifest = (formManifest: FormManifest) => {
    const fids = Object.keys(formManifest.forms ?? {});
    if (!fids.length) return;
    onUpdate({
      ...manifest,
      forms: { ...(manifest.forms ?? {}), ...formManifest.forms },
    });
    if (selected) {
      updateComponent(selected, { form_ref: fids[0] });
    }
    toast.success(`Form "${fids[0]}" added to manifest`);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* List */}
      <div className="w-48 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <button
              onClick={() => addComponent("Card")}
              className="w-full btn-primary text-xs py-1.5 justify-center gap-1"
            >
              <span>＋</span> Add Component
            </button>
          </div>
        </div>
        <div className="p-2 border-b border-gray-100 dark:border-gray-800">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider px-1 mb-1">Quick Add</p>
          <div className="flex flex-wrap gap-1">
            {(["Form", "Table", "Card", "Custom"] as ComponentType[]).map(t => (
              <button
                key={t}
                onClick={() => addComponent(t)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
              >
                {COMPONENT_TYPE_ICONS[t]} {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {componentKeys.length === 0 && (
            <p className="text-xs text-gray-400 p-3 text-center">No components yet</p>
          )}
          {componentKeys.map(key => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={cn(
                "w-full text-left px-3 py-2.5 text-xs border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 hover:bg-gray-50 transition-colors group",
                selected === key ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : "text-gray-700 dark:text-gray-300",
              )}
            >
              <span>{COMPONENT_TYPE_ICONS[components[key].type] ?? "🧩"}</span>
              <span className="truncate flex-1">{components[key].label ?? key}</span>
              <span className={cn(
                "text-[9px] px-1 rounded font-mono",
                components[key].type === "Form" ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-400",
              )}>{components[key].type}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto p-5">
        {!sel ? (
          <EmptyDetail icon="🧩" title="Select or create a component" subtitle="Components are the building blocks of screens." />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <SectionHeader
                icon={COMPONENT_TYPE_ICONS[sel.type] ?? "🧩"}
                title={sel.label ?? selected!}
                subtitle={`Key: ${selected}`}
              />
              <button
                onClick={() => deleteComponent(selected!)}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Delete
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Label">
                <input
                  value={sel.label ?? ""}
                  onChange={e => updateComponent(selected!, { label: e.target.value })}
                  className="field-input"
                  placeholder="My Component"
                />
              </Field>
              <Field label="Component Type" required>
                <select
                  value={sel.type}
                  onChange={e => handleTypeChange(e.target.value as ComponentType)}
                  className="field-input"
                >
                  {COMPONENT_TYPES.map(t => (
                    <option key={t} value={t}>{COMPONENT_TYPE_ICONS[t]} {t}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Feature Ref">
                <input
                  value={sel.feature_ref ?? ""}
                  onChange={e => updateComponent(selected!, { feature_ref: e.target.value || undefined })}
                  className="field-input"
                  placeholder="feature_key"
                />
              </Field>
              <Field label="Theme Ref">
                <input
                  value={sel.theme_ref ?? ""}
                  onChange={e => updateComponent(selected!, { theme_ref: e.target.value || undefined })}
                  className="field-input"
                  placeholder="default"
                />
              </Field>
            </div>

            {/* ── FORM-specific section ──────────────────────────────── */}
            {sel.type === "Form" && (
              <FormComponentEditor
                manifest={manifest}
                componentKey={selected!}
                component={sel}
                onUpdate={updateComponent}
                formPickerMode={formPickerMode}
                onFormPickerModeChange={onFormPickerModeChange}
                formCreatorManifest={formCreatorManifest}
                formCreatorLoading={formCreatorLoading}
                onNeedFormCreator={onNeedFormCreator}
                onFormAdded={addFormToManifest}
              />
            )}

            {/* Text / content */}
            {["Card", "Tile", "Custom"].includes(sel.type) && (
              <Field label="Text content">
                <textarea
                  value={sel.text ?? ""}
                  onChange={e => updateComponent(selected!, { text: e.target.value || undefined })}
                  rows={2}
                  className="field-input resize-none"
                  placeholder="Component display text…"
                />
              </Field>
            )}

            {/* Sub-components */}
            <SubComponentsEditor
              manifest={manifest}
              component={sel}
              onUpdate={updates => updateComponent(selected!, updates)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Form Component Editor (special Form type handling) ───────────────────────

function FormComponentEditor({
  manifest, componentKey, component, onUpdate,
  formPickerMode, onFormPickerModeChange,
  formCreatorManifest, formCreatorLoading, onNeedFormCreator, onFormAdded,
}: {
  manifest: UISystemManifest;
  componentKey: string;
  component: UIComponent;
  onUpdate: (key: string, updates: Partial<UIComponent>) => void;
  formPickerMode: "existing" | "wizard" | "advanced";
  onFormPickerModeChange: (m: "existing" | "wizard" | "advanced") => void;
  formCreatorManifest: FormManifest | null;
  formCreatorLoading: boolean;
  onNeedFormCreator: () => Promise<void>;
  onFormAdded: (fm: FormManifest) => void;
}) {
  const formKeys = Object.keys(manifest.forms ?? {});

  // Build a partial FormManifest for VisualFormBuilder from manifest.forms
  const embeddedManifest: FormManifest | null = useMemo(() => {
    if (!manifest.forms || !Object.keys(manifest.forms).length) return null;
    return {
      manifest_id: manifest.manifest_id,
      manifest_version: manifest.manifest_version ?? "1.0.0",
      forms: manifest.forms as FormManifest["forms"],
    } as FormManifest;
  }, [manifest]);

  const handleWizardSubmit = async (answers: Record<string, unknown>) => {
    // Simulate creating a form via the wizard answers
    const formId = String(answers.form_id ?? `form_${Date.now()}`);
    const title = String(answers.title ?? "New Form");
    const layoutType = String(answers.layout_type ?? "single-page");

    const newFormManifest: FormManifest = {
      manifest_id: manifest.manifest_id,
      manifest_version: "1.0.0",
      forms: {
        [formId]: {
          title,
          version: "1.0.0",
          form_state: "active",
          layout: { type: layoutType as "single-page" | "wizard" | "grid" },
          sections: layoutType !== "wizard"
            ? [{ id: "section_1", title: "Section 1", fields: [] }]
            : undefined,
          pages: layoutType === "wizard"
            ? [{ id: "page_1", title: "Page 1", sections: [{ id: "s1", fields: [] }] }]
            : undefined,
        } as unknown,
      },
    } as FormManifest;

    onFormAdded(newFormManifest);
    onFormPickerModeChange("existing");
  };

  return (
    <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-base">📋</span>
        <span className="text-sm font-bold text-purple-800 dark:text-purple-300">Form Configuration</span>
        <span className="text-xs text-purple-500 font-mono bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">type: Form</span>
      </div>

      {/* Mode picker */}
      <div>
        <label className="block text-xs font-semibold text-purple-700 dark:text-purple-400 mb-2">Form Source</label>
        <div className="flex gap-2">
          {[
            { id: "existing" as const, icon: "📂", label: "Choose Existing" },
            { id: "wizard" as const, icon: "🧙", label: "Create via Wizard" },
            { id: "advanced" as const, icon: "⚡", label: "Visual Builder" },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => {
                onFormPickerModeChange(opt.id);
                if (opt.id === "wizard") onNeedFormCreator();
              }}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-medium transition-all",
                formPickerMode === opt.id
                  ? "border-purple-500 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                  : "border-purple-100 dark:border-purple-800 text-gray-500 hover:border-purple-300",
              )}
            >
              <span className="text-lg">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Existing form picker */}
      {formPickerMode === "existing" && (
        <div className="space-y-3">
          <Field label="Form Reference (form_ref)">
            <select
              value={component.form_ref ?? ""}
              onChange={e => onUpdate(componentKey, { form_ref: e.target.value || undefined })}
              className="field-input"
            >
              <option value="">— no form selected —</option>
              {formKeys.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </Field>
          {formKeys.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
              No forms in this manifest yet. Use "Create via Wizard" or "Visual Builder" to add one.
            </p>
          )}
          <Field label="Embed Mode">
            <select
              value={component.form_embed?.mode ?? "inline"}
              onChange={e => onUpdate(componentKey, { form_embed: { mode: e.target.value as "inline" | "modal" | "drawer" | "panel" } })}
              className="field-input"
            >
              {["inline", "modal", "drawer", "panel"].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {/* Wizard: form creator via FormEngine */}
      {formPickerMode === "wizard" && (
        <div>
          {formCreatorLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
              <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
              Loading form creator…
            </div>
          )}
          {!formCreatorLoading && !formCreatorManifest && (
            <div className="py-6 text-center text-sm text-gray-400 space-y-2">
              <p>Could not load the form creator.</p>
              <button onClick={onNeedFormCreator} className="text-blue-500 hover:underline text-xs">
                Retry
              </button>
            </div>
          )}
          {formCreatorManifest && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
              <FormEngine
                manifest={formCreatorManifest}
                formId="create_form"
                onSubmit={handleWizardSubmit as never}
              />
            </div>
          )}
        </div>
      )}

      {/* Advanced: VisualFormBuilder */}
      {formPickerMode === "advanced" && (
        <div>
          {embeddedManifest && Object.keys(embeddedManifest.forms ?? {}).length > 0 ? (
            <div className="h-[420px] rounded-xl overflow-hidden border border-purple-200 dark:border-purple-800">
              <VisualFormBuilder
                manifest={embeddedManifest}
                formId={component.form_ref ?? Object.keys(embeddedManifest.forms ?? {})[0] ?? "form_1"}
                onChange={fm => onFormAdded(fm)}
              />
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-gray-400 space-y-2">
              <p>No forms to edit yet.</p>
              <p className="text-xs">Create a form via the Wizard first, then edit it here.</p>
              <button onClick={() => onFormPickerModeChange("wizard")} className="text-purple-600 hover:underline text-xs font-medium">
                → Go to Wizard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components Editor ────────────────────────────────────────────────────

function SubComponentsEditor({ manifest, component, onUpdate }: {
  manifest: UISystemManifest;
  component: UIComponent;
  onUpdate: (updates: Partial<UIComponent>) => void;
}) {
  const componentKeys = Object.keys(manifest.components ?? {});
  const subs = component.sub_components ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sub-Components</label>
        <button
          onClick={() => onUpdate({ sub_components: [...subs, { component_ref: componentKeys[0] ?? "", direction: "Center" }] })}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          + Add sub
        </button>
      </div>
      {subs.length === 0 && <p className="text-xs text-gray-400 italic">None</p>}
      {subs.map((s, i) => (
        <div key={i} className="flex gap-2 mb-1.5">
          <select
            value={s.component_ref}
            onChange={e => {
              const next = [...subs];
              next[i] = { ...s, component_ref: e.target.value };
              onUpdate({ sub_components: next });
            }}
            className="field-input text-xs flex-1"
          >
            <option value="">— component —</option>
            {componentKeys.map(k => <option key={k} value={k}>{manifest.components?.[k]?.label ?? k}</option>)}
          </select>
          <select
            value={s.direction}
            onChange={e => {
              const next = [...subs];
              next[i] = { ...s, direction: e.target.value as LayoutDirection };
              onUpdate({ sub_components: next });
            }}
            className="field-input text-xs w-28"
          >
            {DIRECTION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={() => onUpdate({ sub_components: subs.filter((_, j) => j !== i) })}
            className="text-gray-400 hover:text-red-500 text-sm flex-shrink-0">×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Navigation Editor ────────────────────────────────────────────────────────

function NavigationEditor({ manifest, onUpdate }: {
  manifest: UISystemManifest;
  onUpdate: (m: UISystemManifest) => void;
}) {
  const nav = manifest.navigation ?? {};
  const screenKeys = Object.keys(manifest.screens ?? {});
  const routes = nav.routes ?? {};

  const updateNav = (updates: Partial<UINavigation>) => {
    onUpdate({ ...manifest, navigation: { ...nav, ...updates } });
  };

  const upsertRoute = (key: string, route: Partial<UIRoute>) => {
    updateNav({ routes: { ...routes, [key]: { ...routes[key], screen: key, ...route } } });
  };

  const deleteRoute = (key: string) => {
    const next = { ...routes };
    delete next[key];
    updateNav({ routes: next });
  };

  return (
    <div className="p-5 space-y-5">
      <SectionHeader icon="🧭" title="Navigation" subtitle="Define routes and initial screen" />

      <div className="grid grid-cols-3 gap-4">
        <Field label="Nav Type">
          <select
            value={nav.type ?? "stack"}
            onChange={e => updateNav({ type: e.target.value as UINavigation["type"] })}
            className="field-input"
          >
            {["tab_bar", "drawer", "stack", "none"].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Initial Screen">
          <select
            value={nav.initial_screen ?? ""}
            onChange={e => updateNav({ initial_screen: e.target.value })}
            className="field-input"
          >
            <option value="">— select screen —</option>
            {screenKeys.map(k => <option key={k} value={k}>{manifest.screens?.[k]?.label ?? k}</option>)}
          </select>
        </Field>
        {nav.type === "tab_bar" && (
          <Field label="Tab Bar Position">
            <select
              value={nav.tab_bar_position ?? "bottom"}
              onChange={e => updateNav({ tab_bar_position: e.target.value as "top" | "bottom" })}
              className="field-input"
            >
              <option value="top">top</option>
              <option value="bottom">bottom</option>
            </select>
          </Field>
        )}
      </div>

      {/* Routes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Routes</label>
          <button
            onClick={() => {
              const key = `route_${Object.keys(routes).length + 1}`;
              upsertRoute(key, { screen: screenKeys[0] ?? "", path: `/${key}`, auth_required: true });
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add route
          </button>
        </div>
        <div className="space-y-2">
          {Object.keys(routes).map(key => (
            <div key={key} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500 w-24 truncate">{key}</span>
                <button onClick={() => deleteRoute(key)} className="ml-auto text-gray-300 hover:text-red-500 text-sm">×</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Screen">
                  <select
                    value={routes[key].screen}
                    onChange={e => upsertRoute(key, { screen: e.target.value })}
                    className="field-input text-xs"
                  >
                    {screenKeys.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label="Path">
                  <input
                    value={routes[key].path ?? ""}
                    onChange={e => upsertRoute(key, { path: e.target.value })}
                    className="field-input text-xs font-mono"
                    placeholder="/path"
                  />
                </Field>
                <Field label="">
                  <label className="flex items-center gap-1.5 mt-5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={routes[key].auth_required !== false}
                      onChange={e => upsertRoute(key, { auth_required: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">Auth required</span>
                  </label>
                </Field>
              </div>
            </div>
          ))}
          {Object.keys(routes).length === 0 && (
            <p className="text-xs text-gray-400 italic text-center py-4">No routes defined yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Themes Editor ────────────────────────────────────────────────────────────

const COLOR_TOKENS: (keyof ThemeColors)[] = [
  "primary", "primary_light", "primary_dark", "surface",
  "on_surface", "outline", "error", "success", "warning",
];

function ThemesEditor({ manifest, onUpdate }: {
  manifest: UISystemManifest;
  onUpdate: (m: UISystemManifest) => void;
}) {
  const themes = manifest.themes ?? {};
  const [selected, setSelected] = useState<string | null>(Object.keys(themes)[0] ?? null);
  const sel = selected && themes[selected] ? themes[selected] : null;

  const addTheme = () => {
    const key = `theme_${Object.keys(themes).length + 1}`;
    const next = { ...themes, [key]: { label: "New Theme", extends: "default", colors: { primary: "#006FFD" }, selectable: true } };
    onUpdate({ ...manifest, themes: next });
    setSelected(key);
  };

  const updateTheme = (key: string, updates: Partial<ThemeDefinition>) => {
    onUpdate({ ...manifest, themes: { ...themes, [key]: { ...themes[key], ...updates } } });
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-48 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-3 border-b border-gray-100 dark:border-gray-800">
          <button onClick={addTheme} className="w-full btn-primary text-xs py-1.5 justify-center gap-1">
            <span>＋</span> New Theme
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {Object.keys(themes).map(key => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={cn(
                "w-full text-left px-3 py-2.5 text-xs border-b border-gray-100 dark:border-gray-800 flex items-center gap-2",
                selected === key ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50",
              )}
            >
              {themes[key].preview_color && (
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0 border border-gray-200"
                  style={{ background: `#${themes[key].preview_color}` }}
                />
              )}
              <span className="truncate">{themes[key].label ?? key}</span>
            </button>
          ))}
          {Object.keys(themes).length === 0 && (
            <p className="text-xs text-gray-400 p-3 text-center">No custom themes</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {!sel ? (
          <EmptyDetail icon="🎨" title="No theme selected" subtitle="Create a custom theme or rely on built-in themes (default, material, ios-hig, fluent)." />
        ) : (
          <div className="space-y-5">
            <SectionHeader icon="🎨" title={sel.label ?? selected!} subtitle={`Key: ${selected}`} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Label">
                <input
                  value={sel.label ?? ""}
                  onChange={e => updateTheme(selected!, { label: e.target.value })}
                  className="field-input"
                />
              </Field>
              <Field label="Extends">
                <input
                  value={sel.extends ?? "default"}
                  onChange={e => updateTheme(selected!, { extends: e.target.value || undefined })}
                  className="field-input font-mono text-xs"
                  placeholder="default"
                />
              </Field>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Colour Tokens</label>
              <div className="grid grid-cols-3 gap-3">
                {COLOR_TOKENS.map(token => (
                  <Field key={token} label={token.replace(/_/g, " ")}>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={sel.colors?.[token] ?? "#000000"}
                        onChange={e => updateTheme(selected!, {
                          colors: { ...sel.colors, [token]: e.target.value },
                        })}
                        className="h-8 w-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                      />
                      <input
                        value={sel.colors?.[token] ?? ""}
                        onChange={e => updateTheme(selected!, {
                          colors: { ...sel.colors, [token]: e.target.value },
                        })}
                        className="field-input text-xs font-mono flex-1"
                        placeholder="#000000"
                      />
                    </div>
                  </Field>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assets Editor ────────────────────────────────────────────────────────────

function AssetsEditor({ manifest, onUpdate }: {
  manifest: UISystemManifest;
  onUpdate: (m: UISystemManifest) => void;
}) {
  const [tab, setTab] = useState<"buttons" | "dialogs" | "toasts" | "icons">("buttons");
  const buttons = manifest.buttons ?? {};
  const dialogs = manifest.dialogs ?? {};
  const toasts = manifest.toasts ?? {};
  const icons = manifest.icons ?? {};

  const addButton = () => {
    const key = `btn_${Object.keys(buttons).length + 1}`;
    onUpdate({ ...manifest, buttons: { ...buttons, [key]: { name: key, label: "Button", on_press: "navigate" } } });
  };

  const addDialog = () => {
    const key = `dialog_${Object.keys(dialogs).length + 1}`;
    onUpdate({ ...manifest, dialogs: { ...dialogs, [key]: { title: "Dialog", body: "" } } });
  };

  const addToast = () => {
    const key = `toast_${Object.keys(toasts).length + 1}`;
    onUpdate({ ...manifest, toasts: { ...toasts, [key]: { message: "Action completed", severity: "info" } } });
  };

  const ASSET_TABS = [
    { id: "buttons" as const, label: "Buttons", count: Object.keys(buttons).length },
    { id: "dialogs" as const, label: "Dialogs", count: Object.keys(dialogs).length },
    { id: "toasts" as const,  label: "Toasts",  count: Object.keys(toasts).length },
    { id: "icons" as const,   label: "Icons",   count: Object.keys(icons).length },
  ];

  return (
    <div className="p-5 space-y-4">
      <SectionHeader icon="📦" title="Assets" subtitle="Reusable buttons, dialogs, toasts, and icons" />
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {ASSET_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
              tab === t.id ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500",
            )}
          >
            {t.label} {t.count > 0 && <span className="text-[10px] opacity-60">({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === "buttons" && (
        <div className="space-y-2">
          <button onClick={addButton} className="btn-secondary text-xs">+ Add Button</button>
          {Object.entries(buttons).map(([key, btn]) => (
            <div key={key} className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
              <Field label="Key"><input value={key} disabled className="field-input text-xs font-mono opacity-60" /></Field>
              <Field label="Label">
                <input value={btn.label ?? ""} onChange={e => onUpdate({ ...manifest, buttons: { ...buttons, [key]: { ...btn, label: e.target.value } } })} className="field-input text-xs" />
              </Field>
              <Field label="on_press">
                <input value={btn.on_press} onChange={e => onUpdate({ ...manifest, buttons: { ...buttons, [key]: { ...btn, on_press: e.target.value } } })} className="field-input text-xs font-mono" />
              </Field>
            </div>
          ))}
        </div>
      )}

      {tab === "dialogs" && (
        <div className="space-y-2">
          <button onClick={addDialog} className="btn-secondary text-xs">+ Add Dialog</button>
          {Object.entries(dialogs).map(([key, dlg]) => (
            <div key={key} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Key"><input value={key} disabled className="field-input text-xs font-mono opacity-60" /></Field>
                <Field label="Title">
                  <input value={dlg.title} onChange={e => onUpdate({ ...manifest, dialogs: { ...dialogs, [key]: { ...dlg, title: e.target.value } } })} className="field-input text-xs" />
                </Field>
              </div>
              <Field label="Body">
                <input value={dlg.body ?? ""} onChange={e => onUpdate({ ...manifest, dialogs: { ...dialogs, [key]: { ...dlg, body: e.target.value } } })} className="field-input text-xs" />
              </Field>
            </div>
          ))}
        </div>
      )}

      {tab === "toasts" && (
        <div className="space-y-2">
          <button onClick={addToast} className="btn-secondary text-xs">+ Add Toast</button>
          {Object.entries(toasts).map(([key, t]) => (
            <div key={key} className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
              <Field label="Key"><input value={key} disabled className="field-input text-xs font-mono opacity-60" /></Field>
              <Field label="Message">
                <input value={t.message} onChange={e => onUpdate({ ...manifest, toasts: { ...toasts, [key]: { ...t, message: e.target.value } } })} className="field-input text-xs" />
              </Field>
              <Field label="Severity">
                <select value={t.severity ?? "info"} onChange={e => onUpdate({ ...manifest, toasts: { ...toasts, [key]: { ...t, severity: e.target.value } } })} className="field-input text-xs">
                  {["info", "success", "warning", "error"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          ))}
        </div>
      )}

      {tab === "icons" && (
        <div className="space-y-2">
          <button
            onClick={() => {
              const key = `icon_${Object.keys(icons).length + 1}`;
              onUpdate({ ...manifest, icons: { ...icons, [key]: { type: "lucide", name: "Star" } } });
            }}
            className="btn-secondary text-xs"
          >
            + Add Icon
          </button>
          {Object.entries(icons).map(([key, ic]) => (
            <div key={key} className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
              <Field label="Key"><input value={key} disabled className="field-input text-xs font-mono opacity-60" /></Field>
              <Field label="Type">
                <select value={ic.type} onChange={e => onUpdate({ ...manifest, icons: { ...icons, [key]: { ...ic, type: e.target.value } } })} className="field-input text-xs">
                  {["svg", "png", "lucide", "fontawesome", "custom"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Name">
                <input value={ic.name ?? ""} onChange={e => onUpdate({ ...manifest, icons: { ...icons, [key]: { ...ic, name: e.target.value } } })} className="field-input text-xs" placeholder="Star" />
              </Field>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared UI Primitives ─────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <span className="text-2xl">{icon}</span>
      <div>
        <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 font-mono">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyDetail({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center px-8">
      <span className="text-5xl mb-4 opacity-40">{icon}</span>
      <h4 className="font-semibold text-gray-500 dark:text-gray-400 mb-1">{title}</h4>
      <p className="text-xs text-gray-400">{subtitle}</p>
    </div>
  );
}

function Field({ label, required, children }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
    </div>
  );
}