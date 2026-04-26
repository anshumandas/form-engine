"use client";

/**
 * UIManifestRenderer
 *
 * Runtime renderer for UISystemManifest. Given a manifest and a screen key,
 * it resolves component placements and renders them — including Form
 * components via @form-engine's FormEngine.
 *
 * This is the "form-engine powered UI rendering" layer referenced in the
 * auth page and landing page.
 */

import React, { useMemo } from "react";
import type {
  UISystemManifest,
  UIComponent,
  UIScreen,
  LayoutDirection,
} from "@/components/UIBuilder/VisualUIBuilder";
import { FormEngine } from "@form-engine/components/FormEngine";
import type { FormManifest, FieldAnswers } from "@form-engine/libs/types";
import { cn } from "@form-engine/libs/utils";

// ─── Action handler map ───────────────────────────────────────────────────────

export type ActionHandlerMap = Record<string, (answers?: FieldAnswers) => Promise<void> | void>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface UIManifestRendererProps {
  /** The full UISystemManifest to render */
  manifest: UISystemManifest;
  /** Which screen to render (key from manifest.screens) */
  screenKey: string;
  /** Handlers invoked by Form on_submit local handlers and button on_press */
  handlers?: ActionHandlerMap;
  /** Extra className on the root element */
  className?: string;
}

// ─── Placement helpers ────────────────────────────────────────────────────────

type PlacedComponents = {
  top:     UIComponent[];
  left:    UIComponent[];
  center:  UIComponent[];
  right:   UIComponent[];
  bottom:  UIComponent[];
  floating: UIComponent[];
};

function groupByDirection(
  placements: UIScreen["components"],
  allComponents: Record<string, UIComponent>,
): PlacedComponents {
  const result: PlacedComponents = {
    top: [], left: [], center: [], right: [], bottom: [], floating: [],
  };
  for (const p of placements ?? []) {
    const comp = allComponents[p.component_ref];
    if (!comp) continue;
    const dir = (p.direction ?? "Center").toLowerCase() as keyof PlacedComponents;
    if (dir in result) (result[dir] as UIComponent[]).push(comp);
    else result.center.push(comp);
  }
  return result;
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export function UIManifestRenderer({
  manifest,
  screenKey,
  handlers = {},
  className,
}: UIManifestRendererProps) {
  const screen = manifest.screens?.[screenKey];
  if (!screen) return null;

  const allComponents = manifest.components ?? {};
  const placed = useMemo(
    () => groupByDirection(screen.components, allComponents),
    [screen.components, allComponents],
  );

  // Build a partial FormManifest so FormEngine can resolve form_ref keys
  const formManifest = useMemo<FormManifest | null>(() => {
    if (!manifest.forms || !Object.keys(manifest.forms).length) return null;
    return {
      manifest_id: manifest.manifest_id,
      manifest_version: manifest.manifest_version ?? "1.0.0",
      forms: manifest.forms as FormManifest["forms"],
    } as FormManifest;
  }, [manifest]);

  return (
    <div className={cn("flex flex-col min-h-full", className)}>
      {/* Top bar */}
      {placed.top.length > 0 && (
        <div className="flex-shrink-0">
          {placed.top.map(c => (
            <ComponentRenderer key={c.name} component={c} formManifest={formManifest} handlers={handlers} allComponents={allComponents} />
          ))}
        </div>
      )}

      {/* Main row: left + center + right */}
      <div className="flex flex-1 min-h-0">
        {placed.left.length > 0 && (
          <div className="flex-1 hidden lg:flex flex-col">
            {placed.left.map(c => (
              <ComponentRenderer key={c.name} component={c} formManifest={formManifest} handlers={handlers} allComponents={allComponents} />
            ))}
          </div>
        )}
        {placed.center.length > 0 && (
          <div className="flex-1 flex flex-col">
            {placed.center.map(c => (
              <ComponentRenderer key={c.name} component={c} formManifest={formManifest} handlers={handlers} allComponents={allComponents} />
            ))}
          </div>
        )}
        {placed.right.length > 0 && (
          <div className="flex-shrink-0 lg:w-[480px] flex flex-col justify-center">
            {placed.right.map(c => (
              <ComponentRenderer key={c.name} component={c} formManifest={formManifest} handlers={handlers} allComponents={allComponents} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom */}
      {placed.bottom.length > 0 && (
        <div className="flex-shrink-0">
          {placed.bottom.map(c => (
            <ComponentRenderer key={c.name} component={c} formManifest={formManifest} handlers={handlers} allComponents={allComponents} />
          ))}
        </div>
      )}

      {/* Floating overlays */}
      {placed.floating.map(c => (
        <div key={c.name} className="fixed bottom-4 right-4 z-50">
          <ComponentRenderer component={c} formManifest={formManifest} handlers={handlers} allComponents={allComponents} />
        </div>
      ))}
    </div>
  );
}

// ─── Component renderer ───────────────────────────────────────────────────────

interface ComponentRendererProps {
  component: UIComponent;
  formManifest: FormManifest | null;
  handlers: ActionHandlerMap;
  allComponents: Record<string, UIComponent>;
}

export function ComponentRenderer({
  component,
  formManifest,
  handlers,
  allComponents,
}: ComponentRendererProps) {
  // Render sub-components first
  const subComps = (component.sub_components ?? []).map(s => allComponents[s.component_ref]).filter(Boolean);

  // ── Form component: delegate entirely to FormEngine ──────────────────────
  if (component.type === "Form" && component.form_ref && formManifest) {
    const handler = component.form_embed?.mode === "inline"
      ? (handlers[`handle_${component.form_ref}`] ?? handlers["onFormSubmit"])
      : undefined;

    return (
      <div className="w-full">
        <FormEngine
          key={component.form_ref}
          manifest={formManifest}
          formId={component.form_ref}
          onSubmit={handler as ((answers: FieldAnswers) => Promise<void>) ?? (async () => {})}
        />
      </div>
    );
  }

  // ── HorizontalList — renders as a flex row of action buttons ─────────────
  if (component.type === "HorizontalList") {
    return (
      <nav className="flex items-center gap-3 px-6 py-4">
        {(component.actions as Array<{ name: string; label?: string; on_press: string }> ?? []).map(a => (
          <button
            key={a.name}
            onClick={() => handlers[a.on_press]?.()}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all",
              a.name.includes("signup")
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "text-gray-300 hover:text-white",
            )}
          >
            {a.label}
          </button>
        ))}
      </nav>
    );
  }

  // ── VerticalList — renders as a feature list ─────────────────────────────
  if (component.type === "VerticalList") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
        {/* Placeholder feature items — real data would come from data_binding */}
        {PLACEHOLDER_FEATURES.map(f => (
          <div key={f.title} className="flex items-start gap-3">
            <span className="text-xl mt-0.5">{f.icon}</span>
            <div>
              <p className="text-white/90 text-sm font-semibold">{f.title}</p>
              <p className="text-white/35 text-xs mt-0.5">{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Card — generic surface with optional sub-components and actions ───────
  if (component.type === "Card") {
    return (
      <div className="relative">
        {subComps.map(sub => (
          <ComponentRenderer key={sub.name} component={sub} formManifest={formManifest} handlers={handlers} allComponents={allComponents} />
        ))}
        {component.text && (
          <p className="text-gray-600 dark:text-gray-300 p-4">{component.text}</p>
        )}
        {(component.actions as Array<{ name: string; label?: string; on_press: string }> ?? []).length > 0 && (
          <div className="flex flex-wrap gap-3 p-4">
            {(component.actions as Array<{ name: string; label?: string; on_press: string }>).map(a => (
              <button
                key={a.name}
                onClick={() => handlers[a.on_press]?.()}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  a.name.includes("signup") || a.name.includes("cta")
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-50",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Custom / fallback ────────────────────────────────────────────────────
  if (component.type === "Custom" && component.text === "gradient-stripe") {
    return (
      <div
        className="h-1 w-full"
        style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6,#0ea5e9)" }}
      />
    );
  }

  return null;
}

// ─── Placeholder data ─────────────────────────────────────────────────────────

const PLACEHOLDER_FEATURES = [
  { icon: "⚡", title: "YAML-driven forms",    body: "Define any form in a single YAML file. No code, no migrations." },
  { icon: "🔌", title: "Pluggable backends",   body: "Point at any REST API. Local files, Docker, or cloud — your choice." },
  { icon: "🧩", title: "Dynamic data sources", body: "Dropdown choices fetched live from your APIs, with built-in caching." },
  { icon: "🧙", title: "Wizard & single-page", body: "Multi-step wizards or dense single-page layouts from the same schema." },
];
