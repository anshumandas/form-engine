"use client";

/**
 * FormEngineProvider
 *
 * Wrap your application (or just the part that uses the Form Engine) with this
 * provider to configure the backend URL, local manifests, auth handlers, etc.
 *
 * This component bridges the React context world with the module-level
 * config singleton so that both React components and non-React utilities
 * (like api.ts) pick up the same configuration.
 *
 * @example
 * // In your root layout or _app:
 * <FormEngineProvider config={{
 *   apiBase: process.env.NEXT_PUBLIC_API_URL,
 *   localManifests: { auth: authManifest },
 *   auth: {
 *     signinUrl: "/api/auth/signin",
 *     onSuccess: (action, data) => router.push("/dashboard"),
 *   },
 * }}>
 *   {children}
 * </FormEngineProvider>
 */

import React, { useEffect } from "react";
import {
  FormEngineContext,
  configureFormEngine,
  type FormEngineConfig,
} from "../libs/config";

interface FormEngineProviderProps {
  config: FormEngineConfig;
  children: React.ReactNode;
}

export function FormEngineProvider({ config, children }: FormEngineProviderProps) {
  // Sync React context → module-level singleton on every config change.
  // This ensures api.ts (which can't use hooks) also sees the latest config.
  useEffect(() => {
    configureFormEngine(config);
  }, [config]);

  return (
    <FormEngineContext.Provider value={config}>
      {children}
    </FormEngineContext.Provider>
  );
}
