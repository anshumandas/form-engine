"use client";

/**
 * UIManifestRenderer
 *
 * Runtime renderer for UISystemManifest. Given a parsed manifest and a screen
 * key, it boots a UIEngineProvider, resolves the screen's component placements,
 * and passes them to UIEngine's own ScreenLayout — so theming, feature-gating,
 * auth-level filtering, and condition evaluation all work identically to any
 * other UIEngine-powered view.
 *
 * FIXED vs. original UIBuilder/UIManifestRenderer.tsx
 *  1. Types imported from UIEngine — removes circular dep on VisualUIBuilder.
 *  2. Wrapped with UIEngineProvider so all engine hooks resolve correctly.
 *  3. Uses UIEngine's ScreenLayout + SubComponentPlacementRenderer instead of
 *     the hand-rolled groupByDirection + ComponentRenderer copy.
 *  4. FormManifest is no longer assembled inline — ComponentRenderer already
 *     holds the full manifest reference and passes it to FormEngine.
 *
 * USAGE
 *   <UIManifestRenderer manifest={parsedYaml} screenKey="home" handlers={…} />
 *
 * LOWER-LEVEL USAGE (inside an existing UIEngineProvider)
 *   const screen = manifest.screens?.["home"];
 *   <ScreenLayout componentPlacements={screen?.components ?? []} />
 */

import React, { useMemo } from "react";

// ── UIEngine — single source of truth for all UI types & rendering ─────────────
import {
  UIEngineProvider,
  ScreenLayout,
  UIEngineHandlers,
} from "./index";
import type { UISystemManifest, SubComponentPlacement } from "./types";

// ── FormEngine handler signature (for external callers) ───────────────────────
import type { FieldAnswers } from "@form-engine/libs/types";

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Map of action-key → handler invoked by FormEngine on_submit / Button on_press */
export type ActionHandlerMap = Record<
  string,
  (answers?: FieldAnswers) => Promise<void> | void
>;

interface UIManifestRendererProps {
  /** Full UISystemManifest (schema-conformant YAML parsed to JS object) */
  manifest: UISystemManifest;
  /** Key of the screen to render (from manifest.screens) */
  screenKey: string;
  /**
   * Handlers wired to:
   *  - FormEngine `on_submit.handler_name` (local submit)
   *  - Button `on_press` when action type is "custom"
   *  - ActionDef `handler` field
   */
  handlers?: ActionHandlerMap;
  /** Extra CSS class on the outermost div */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a single screen from a UISystemManifest.
 *
 * Self-contained: boots its own UIEngineProvider so it can be dropped into any
 * React tree without an ancestor engine context. If you already have an
 * ancestor UIEngineProvider (e.g. in a full app shell), use ScreenLayout
 * directly and pass screen.components as componentPlacements.
 */
export function UIManifestRenderer({
  manifest,
  screenKey,
  handlers = {},
  className,
}: UIManifestRendererProps) {
  const screen = manifest.screens?.[screenKey];

  if (!screen) {
    console.warn(
      `[UIManifestRenderer] screen "${screenKey}" not found in manifest "${manifest.manifest_id}"`
    );
    return null;
  }

  // Cast ActionHandlerMap → UIEngineHandlers
  const engineHandlers = useMemo<UIEngineHandlers>(
    () =>
      Object.fromEntries(
        Object.entries(handlers).map(([k, fn]) => [
          k,
          async (ctx: unknown) => fn(ctx as FieldAnswers),
        ])
      ),
    [handlers]
  );

  const placements: SubComponentPlacement[] = screen.components ?? [];

  return (
    <UIEngineProvider manifest={manifest} handlers={engineHandlers}>
      <div
        className={className}
        style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}
      >
        {/*
         * ScreenLayout renders the full direction-based layout:
         *   Modal / Top / Left / Center / Right / Floating / Bottom
         * Each placement is handled by SubComponentPlacementRenderer →
         * ComponentRenderer, which covers all ComponentTypes including
         * Form (delegated to FormEngine), Table, Card, Tree, Avatar, etc.
         */}
        <ScreenLayout componentPlacements={placements} />
      </div>
    </UIEngineProvider>
  );
}
