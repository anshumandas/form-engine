/**
 * FormEngine Configuration
 *
 * Allows the same lib to be used across multiple frontends pointing at
 * different backends, or operating entirely offline with local manifests.
 *
 * Usage (wrap your app):
 *   <FormEngineProvider config={{ apiBase: "https://my-api.example.com" }}>
 *     <App />
 *   </FormEngineProvider>
 *
 * Or imperatively (e.g. in non-React entry points):
 *   import { configureFormEngine } from "@form-engine/libs/config";
 *   configureFormEngine({ apiBase: process.env.API_URL });
 */

import { createContext, useContext } from "react";
import type { FormManifest, FieldAnswers } from "./types";

// ─── Config Shape ─────────────────────────────────────────────────────────────

export interface FormEngineAuthConfig {
  /** URL to POST sign-in credentials to. */
  signinUrl?: string;
  /** URL to POST sign-up data to. */
  signupUrl?: string;
  /**
   * Called after successful auth response.
   * Receives the raw response body so the caller can store tokens/redirect.
   */
  onSuccess?: (action: "signin" | "signup", data: unknown) => void;
  /** Called when auth fails. Defaults to throwing the error. */
  onError?: (action: "signin" | "signup", err: Error) => void;
}

export interface FormEngineConfig {
  /**
   * Base URL for all API calls.
   * Defaults to "" (relative paths — relies on Next.js /api proxy rewrites).
   * Set to an absolute URL to talk directly to a remote backend:
   *   apiBase: "https://forms-api.mycompany.com"
   */
  apiBase?: string;

  /**
   * Local manifests that bypass HTTP entirely.
   * When a manifest_id is present here, getManifest() returns it immediately
   * without any network request. Use this to ship forms alongside the
   * frontend bundle — zero backend dependency for those forms.
   *
   * Example:
   *   import { authManifest } from "@/forms/auth";
   *   localManifests: { auth: authManifest }
   */
  localManifests?: Record<string, FormManifest>;

  /**
   * Extra HTTP headers sent with every API request.
   * Useful for Authorization tokens:
   *   headers: { Authorization: `Bearer ${token}` }
   */
  headers?: Record<string, string>;

  /**
   * Auth configuration. Used by the auth page and any form that needs
   * to integrate with sign-in / sign-up flows.
   */
  auth?: FormEngineAuthConfig;

  /**
   * Handler for form submission override.
   * When provided, this is called instead of the manifest's on_submit config
   * for every form in the app. Useful for adding auth headers or custom routing.
   */
  onSubmit?: (
    manifestId: string,
    formId: string,
    answers: FieldAnswers,
  ) => Promise<unknown>;
}

// ─── Module-level singleton (for non-React callers, e.g. api.ts) ──────────────

let _config: FormEngineConfig = {};

/**
 * Imperatively configure the Form Engine.
 * Useful for non-React entry points or SSR where you can't use a Provider.
 * The React FormEngineProvider calls this automatically.
 */
export function configureFormEngine(config: FormEngineConfig): void {
  _config = { ..._config, ...config };
}

/** Read the current module-level config. Used by api.ts and hooks. */
export function getConfig(): Readonly<FormEngineConfig> {
  return _config;
}

/** Convenience: build full URL from a relative path using configured apiBase. */
export function resolveApiUrl(path: string): string {
  const base = _config.apiBase ?? "";
  // Avoid double-slashes
  if (!base) return path;
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

// ─── React Context ────────────────────────────────────────────────────────────

export const FormEngineContext = createContext<FormEngineConfig>({});

/** Access the current FormEngine config from any React component. */
export function useFormEngineConfig(): Readonly<FormEngineConfig> {
  return useContext(FormEngineContext);
}
