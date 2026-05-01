"use client";

/**
 * app/auth/page.tsx
 *
 * Thin orchestration layer. Responsibilities:
 *  1. Business-logic state  — `mode` (signin | signup)
 *  2. Submit handlers       — handleSignin / handleSignup (fetch + useAuth)
 *  3. customComponents registry — React implementations for every type: Custom
 *     component declared in authUIManifest
 *  4. Single <UIManifestRenderer> — renders the full "auth" screen
 *
 * No hardcoded page layout lives here. All composition, nesting, and
 * conditional rendering is driven by authUIManifest and executed by the engine.
 *
 * ── How sub-component nesting works ─────────────────────────────────────────
 * auth_card declares sub_components in the manifest. The patched CustomRenderer
 * (renderers.tsx) walks them, evaluates hidden_condition strings against
 * engineContext ({ mode }), resolves each visible child from manifest.components,
 * and renders them via ComponentRenderer recursively. The resulting React nodes
 * are passed as `children` to AuthCardWrapper, which just renders a card shell
 * around {children}. No inner UIManifestRenderer or manual sub-component
 * handling is needed anywhere in this file.
 *
 * ── CustomComponentProps ─────────────────────────────────────────────────────
 * Each registered Custom implementation receives:
 *   context  — engineContext ({ mode }) from UIEngineProvider
 *   handlers — the full UIEngineHandlers map
 *   children — pre-rendered sub-components resolved by CustomRenderer (if any)
 */

import React, { useState, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-context";
import { toast } from "sonner";

import { authUIManifest } from "@/forms/auth_ui_manifest";
import { UIManifestRenderer } from "@form-engine/components/UIEngine/UIManifestRenderer";
import type { ActionHandlerMap } from "@form-engine/components/UIEngine/UIManifestRenderer";
import type { CustomComponentRegistry, CustomComponentProps } from "@form-engine/components/UIEngine/context";
import type { FieldAnswers } from "@form-engine/libs/types";

type AuthMode = "signin" | "signup";

// ─────────────────────────────────────────────────────────────────────────────
// Shared CSS — keyframes + FormEngine field reskin
// Injected once at document level; available to all custom component subtrees.
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_STYLES = `
  @keyframes orb1 { from{transform:translate(0,0) scale(1)} to{transform:translate(60px,40px) scale(1.08)} }
  @keyframes orb2 { from{transform:translate(0,0) scale(1)} to{transform:translate(-40px,-30px) scale(1.1)} }
  @keyframes fadeSlideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  .anim-fade-up { animation:fadeSlideUp 0.65s cubic-bezier(0.22,1,0.36,1) both }
  .delay-100{animation-delay:.10s} .delay-200{animation-delay:.20s}
  .delay-300{animation-delay:.30s} .delay-400{animation-delay:.40s}

  /* FormEngine field reskin inside the auth card */
  .auth-form-wrap .form-page-title,
  .auth-form-wrap .form-section-title { display:none }
  .auth-form-wrap label {
    color:#4b5563 !important; font-size:.8125rem !important; font-weight:500 !important;
  }
  .auth-form-wrap input[type=text],
  .auth-form-wrap input[type=email],
  .auth-form-wrap input[type=password] {
    border-color:#e5e7eb !important; border-radius:.625rem !important;
    padding:.625rem .875rem !important; font-size:.9375rem !important;
    background:#fff !important; transition:border-color .15s,box-shadow .15s;
  }
  .auth-form-wrap input:focus {
    border-color:#6366f1 !important;
    box-shadow:0 0 0 3px rgba(99,102,241,.12) !important; outline:none !important;
  }
  .auth-form-wrap button[type=submit] {
    width:100% !important;
    background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%) !important;
    border:none !important; border-radius:.625rem !important;
    padding:.75rem 1.5rem !important; font-size:.9375rem !important;
    font-weight:600 !important; color:white !important;
    cursor:pointer; transition:opacity .15s,transform .1s; margin-top:.5rem;
  }
  .auth-form-wrap button[type=submit]:hover  { opacity:.92; transform:translateY(-1px) }
  .auth-form-wrap button[type=submit]:active  { transform:translateY(0) }
  .auth-form-wrap button[type=submit]:disabled{ opacity:.5; cursor:not-allowed; transform:none }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// Custom component implementations
//
// Each receives { context, handlers, children } from CustomRenderer.
//   context  = engineContext = { mode }
//   handlers = the ActionHandlerMap cast to UIEngineHandlers
//   children = engine-rendered sub_components (only for auth_card)
// ═══════════════════════════════════════════════════════════════════════════════

// ── background_grid ───────────────────────────────────────────────────────────
// Manifest: background_grid  (type: Custom, no sub_components)
// Screen placement: Floating

function BackgroundGrid(_: CustomComponentProps) {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <pattern id="auth-grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
        <radialGradient id="auth-fade" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="#0a0a1a" stopOpacity="0" />
          <stop offset="100%" stopColor="#0a0a1a" stopOpacity="1" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#auth-grid)" />
      <rect width="100%" height="100%" fill="url(#auth-fade)" />
    </svg>
  );
}

// ── orbs ──────────────────────────────────────────────────────────────────────
// Manifest: orbs  (type: Custom, no sub_components)
// Screen placement: Floating

function Orbs(_: CustomComponentProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute rounded-full opacity-20 blur-[120px]"
        style={{
          width: 600, height: 600, top: "-10%", left: "20%",
          background: "radial-gradient(circle,#4f46e5 0%,#7c3aed 50%,transparent 70%)",
          animation: "orb1 18s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute rounded-full opacity-15 blur-[100px]"
        style={{
          width: 400, height: 400, bottom: "5%", left: "5%",
          background: "radial-gradient(circle,#0ea5e9 0%,#2563eb 50%,transparent 70%)",
          animation: "orb2 24s ease-in-out infinite alternate",
        }}
      />
    </div>
  );
}

// ── HeroColumn ────────────────────────────────────────────────────────────────
// Manifest: hero_column  (type: Custom, no sub_components)
// Screen placement: Left

function HeroColumn(_: CustomComponentProps) {
  return (
    <div className="relative z-10 flex-1 flex flex-col justify-between px-10 py-12 lg:px-16 lg:py-16 max-w-[660px]">
      {/* Brand */}
      <div className="anim-fade-up flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold"
          style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
        >⚡</div>
        <span className="text-white font-semibold text-base tracking-tight" style={{ fontFamily: "var(--font-syne)" }}>
          Form Engine
        </span>
        <span className="ml-1 text-xs text-white/30 font-mono">v4.0.0</span>
      </div>

      {/* Hero text */}
      <div className="mt-auto">
        <div className="anim-fade-up delay-100">
          <span
            className="inline-block text-xs font-semibold tracking-[.18em] uppercase mb-5 px-3 py-1 rounded-full"
            style={{ color: "#a5b4fc", background: "rgba(99,102,241,.12)", border: "1px solid rgba(99,102,241,.2)", fontFamily: "var(--font-syne)" }}
          >YAML · REST · Any backend</span>
        </div>

        <h1
          className="anim-fade-up delay-200 text-white font-extrabold leading-[1.08] tracking-tight"
          style={{ fontSize: "clamp(2.6rem,5.5vw,4.2rem)", fontFamily: "var(--font-syne)" }}
        >
          Forms that live<br />
          <span style={{ background: "linear-gradient(90deg,#818cf8 0%,#a78bfa 50%,#38bdf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            in your config.
          </span>
        </h1>

        <p className="anim-fade-up delay-300 text-white/50 mt-5 max-w-md leading-relaxed" style={{ fontSize: "1.0625rem" }}>
          Define complex multi-step forms in YAML. Render them anywhere.
          Connect to any backend. Ship in minutes, not weeks.
        </p>

        <div className="anim-fade-up delay-400 mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: "⚡", title: "YAML-driven forms",    body: "Define any form in a single YAML file. No code, no migrations." },
            { icon: "🔌", title: "Pluggable backends",   body: "Point at any REST API. Local files, Docker, or cloud — your choice." },
            { icon: "🧩", title: "Dynamic data sources", body: "Dropdown choices fetched live from your APIs, with built-in caching." },
            { icon: "🧙", title: "Wizard & single-page", body: "Multi-step wizards or dense single-page layouts from the same schema." },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <span className="text-xl mt-0.5 flex-shrink-0" style={{ filter: "drop-shadow(0 0 8px rgba(129,140,248,.5))" }}>{f.icon}</span>
              <div>
                <p className="text-white/90 text-sm font-semibold leading-snug" style={{ fontFamily: "var(--font-syne)" }}>{f.title}</p>
                <p className="text-white/35 text-xs mt-0.5 leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 flex items-center gap-2">
        <p className="text-white/20 text-xs">Powered by Form Engine · YAML schema v4</p>
        <span className="text-white/10">·</span>
        <p className="text-white/15 text-xs font-mono">auth screen via UISystemManifest</p>
      </div>
    </div>
  );
}

// ── AuthCardHeader ────────────────────────────────────────────────────────────
// Manifest: auth_card_header  (type: Custom, sub-component of auth_card)
// Receives context.mode to switch heading text.

function AuthCardHeader({ context }: CustomComponentProps) {
  const mode = (context.mode as AuthMode) ?? "signin";
  return (
    <>
      <div className="flex items-center gap-2.5 mb-7">
        <div
          className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
        >⚡</div>
        <span className="text-sm font-semibold tracking-tight text-gray-800" style={{ fontFamily: "var(--font-syne)" }}>
          Form Engine
        </span>
      </div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 leading-tight" style={{ fontFamily: "var(--font-syne)" }}>
          {mode === "signin" ? "Welcome back" : "Get started free"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {mode === "signin"
            ? "Sign in to your Form Engine workspace."
            : "Create your account — no credit card required."}
        </p>
      </div>
    </>
  );
}

// ── AuthModeTabs ──────────────────────────────────────────────────────────────
// Manifest: auth_mode_tabs  (type: Custom, sub-component of auth_card)
// Reads context.mode for active tab; calls handlers to switch mode.

function AuthModeTabs({ context, handlers }: CustomComponentProps) {
  const mode = (context.mode as AuthMode) ?? "signin";
  return (
    <div className="flex gap-0 mb-6 rounded-xl overflow-hidden bg-gray-100 p-1">
      {(["signin", "signup"] as AuthMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => handlers[`navigate:auth?mode=${m}`]?.(context)}
          className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
          style={{
            fontFamily: "var(--font-syne)",
            background: mode === m ? "white"  : "transparent",
            color:      mode === m ? "#4f46e5" : "#9ca3af",
            boxShadow:  mode === m ? "0 1px 4px rgba(0,0,0,.10)" : "none",
          }}
        >
          {m === "signin" ? "Sign in" : "Sign up"}
        </button>
      ))}
    </div>
  );
}

// ── AuthCardFooter ────────────────────────────────────────────────────────────
// Manifest: auth_card_footer  (type: Custom, sub-component of auth_card)
// Reads context.mode to show the right toggle link.

function AuthCardFooter({ context, handlers }: CustomComponentProps) {
  const mode = (context.mode as AuthMode) ?? "signin";
  return (
    <>
      <p className="text-center text-xs text-gray-400 mt-5">
        {mode === "signin" ? (
          <>No account?{" "}
            <button type="button" onClick={() => handlers["navigate:auth?mode=signup"]?.(context)} className="text-indigo-500 hover:text-indigo-600 font-medium">
              Sign up free
            </button>
          </>
        ) : (
          <>Already have an account?{" "}
            <button type="button" onClick={() => handlers["navigate:auth?mode=signin"]?.(context)} className="text-indigo-500 hover:text-indigo-600 font-medium">
              Sign in
            </button>
          </>
        )}
      </p>
      <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-1.5">
        <span className="text-[10px] text-gray-300 font-mono">rendered via UISystemManifest · auth_ui.yaml</span>
      </div>
    </>
  );
}

// ── AuthCardWrapper ───────────────────────────────────────────────────────────
// Manifest: auth_card  (type: Custom, sub_components declared in manifest)
// Screen placement: Right
//
// The engine resolves auth_card.sub_components, evaluates hidden_condition on
// each placement against { mode }, renders visible children via ComponentRenderer,
// and passes them here as `children`. This component only owns the card shell.
// The form field wrapper (.auth-form-wrap) is applied here so FormEngine's
// rendered markup gets the CSS reskin regardless of which form is active.

function AuthCardWrapper({ children }: CustomComponentProps) {
  return (
    <div
      className="anim-fade-up delay-200 relative w-full max-w-[420px] rounded-3xl overflow-hidden"
      style={{
        background:     "rgba(255,255,255,0.97)",
        boxShadow:      "0 32px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.08)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Gradient accent stripe */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6,#0ea5e9)" }} />

      {/* Engine-resolved sub-components — header / tabs / active form / footer */}
      <div className="px-8 pt-7 pb-8 auth-form-wrap">
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Custom component registry
//
// Maps every `name` of a type: Custom component in authUIManifest to its React
// implementation. CustomRenderer reads this from UIEngineContext.
// ═══════════════════════════════════════════════════════════════════════════════

const AUTH_CUSTOM_COMPONENTS: CustomComponentRegistry = {
  background_grid:  BackgroundGrid,
  orbs:             Orbs,
  hero_column:      HeroColumn,
  auth_card_header: AuthCardHeader,
  auth_mode_tabs:   AuthModeTabs,
  auth_card_footer: AuthCardFooter,
  auth_card:        AuthCardWrapper,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════

function AuthPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { signin }   = useAuth();

  const [mode, setMode] = useState<AuthMode>(
    (searchParams.get("mode") as AuthMode | null) ?? "signin"
  );

  const nextPath = searchParams.get("next") ?? "/";

  // ── Submit handlers ────────────────────────────────────────────────────────
  // Referenced by manifest forms[].on_submit.handler_name → FormEngineWrapper
  // looks up handlers[handlerName] and calls it with FieldAnswers.

  const handleSignin = useCallback(async (answers: FieldAnswers) => {
    const res  = await fetch("/auth/signin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(answers) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail ?? data.message ?? "Invalid email or password");
    signin({ email: String(answers.email ?? ""), name: data.user?.name ?? data.name, token: data.token ?? data.access_token ?? "session" });
    toast.success("Signed in — welcome back!");
    router.replace(nextPath);
  }, [signin, router, nextPath]);

  const handleSignup = useCallback(async (answers: FieldAnswers) => {
    if (answers.password !== answers.confirm_password) throw new Error("Passwords do not match");
    const res  = await fetch("/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(answers) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail ?? data.message ?? "Could not create account");
    signin({ email: String(answers.email ?? ""), name: String(answers.full_name ?? data.name ?? ""), token: data.token ?? data.access_token ?? "session" });
    toast.success("Account created — welcome aboard!");
    router.replace(nextPath);
  }, [signin, router, nextPath]);

  // ── ActionHandlerMap ───────────────────────────────────────────────────────
  // Keys match:
  //  • manifest forms[].on_submit.handler_name  (handleSignin, handleSignup)
  //  • manifest buttons[].on_press              (navigate:auth?mode=…)
  //  • auth_mode_tabs action on_press values

  const handlers: ActionHandlerMap = useMemo(() => ({
    handleSignin,
    handleSignup,
    "navigate:auth?mode=signup": () => setMode("signup"),
    "navigate:auth?mode=signin": () => setMode("signin"),
    "navigate:home":             () => router.push("/"),
    "navigate:docs":             () => router.push("/docs"),
  }), [handleSignin, handleSignup, router]);

  // ── Runtime context ────────────────────────────────────────────────────────
  // Passed to UIEngineProvider as `engineContext`.
  // Available as `context` in hidden_condition expressions and Custom impls.

  const context = useMemo(() => ({ mode }), [mode]);

  // ── Render ─────────────────────────────────────────────────────────────────
  // UIManifestRenderer renders the full "auth" screen:
  //   Floating  background_grid  → BackgroundGrid
  //   Floating  orbs             → Orbs
  //   Left      hero_column      → HeroColumn
  //   Right     auth_card        → AuthCardWrapper(children=[
  //                                  AuthCardHeader,
  //                                  AuthModeTabs,
  //                                  signin_form | signup_form  (engine-toggled),
  //                                  AuthCardFooter
  //                                ])

  return (
    <UIManifestRenderer
      manifest={authUIManifest}
      screenKey="auth"
      handlers={handlers}
      customComponents={AUTH_CUSTOM_COMPONENTS}
      context={context}
    />
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function AuthPage() {
  return (
    <>
      <style>{AUTH_STYLES}</style>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen" style={{ background: "#07070e" }}>
          <span className="h-8 w-8 rounded-full border-2 border-indigo-800 border-t-indigo-400 animate-spin" />
        </div>
      }>
        <AuthPageInner />
      </Suspense>
    </>
  );
}