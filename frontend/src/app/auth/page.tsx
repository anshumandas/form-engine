"use client";

/**
 * auth/page.tsx
 *
 * The auth page is now driven by `authUIManifest` (a UISystemManifest),
 * rendered via UIManifestRenderer. The embedded Form components delegate to
 * @form-engine's FormEngine — demonstrating that both pages and forms can
 * live in a single YAML config.
 *
 * Handler wiring (signin / signup) stays in React; the manifest describes
 * *structure*, not business logic.
 */

import React, { useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FieldAnswers } from "@form-engine/libs/types";
import { useAuth } from "@/providers/auth-context";
import { toast } from "sonner";

import { authUIManifest } from "@/forms/auth_ui_manifest";
import { UIManifestRenderer }  from "@/components/UIBuilder/UIManifestRenderer";
import type { ActionHandlerMap } from "@/components/UIBuilder/UIManifestRenderer";

// ─── Background decorations (extracted from original auth page) ────────────

function BackgroundGrid() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
        <radialGradient id="fade" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="#0a0a1a" stopOpacity="0" />
          <stop offset="100%" stopColor="#0a0a1a" stopOpacity="1" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <rect width="100%" height="100%" fill="url(#fade)" />
    </svg>
  );
}

function Orbs() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute rounded-full opacity-20 blur-[120px]"
        style={{ width: 600, height: 600, top: "-10%", left: "20%",
          background: "radial-gradient(circle, #4f46e5 0%, #7c3aed 50%, transparent 70%)",
          animation: "orb1 18s ease-in-out infinite alternate" }} />
      <div className="absolute rounded-full opacity-15 blur-[100px]"
        style={{ width: 400, height: 400, bottom: "5%", left: "5%",
          background: "radial-gradient(circle, #0ea5e9 0%, #2563eb 50%, transparent 70%)",
          animation: "orb2 24s ease-in-out infinite alternate" }} />
      <style>{`
        @keyframes orb1 { from{transform:translate(0,0) scale(1)} to{transform:translate(60px,40px) scale(1.08)} }
        @keyframes orb2 { from{transform:translate(0,0) scale(1)} to{transform:translate(-40px,-30px) scale(1.1)} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .anim-fade-up { animation: fadeSlideUp 0.65s cubic-bezier(0.22,1,0.36,1) both; }
        .delay-100{animation-delay:.10s} .delay-200{animation-delay:.20s}
        .delay-300{animation-delay:.30s} .delay-400{animation-delay:.40s}

        /* ── FormEngine reskin inside auth card ─────────────────────── */
        .auth-manifest-wrap .form-page-title,
        .auth-manifest-wrap .form-section-title { display: none; }
        .auth-manifest-wrap label {
          color: #4b5563 !important;
          font-size: 0.8125rem !important;
          font-weight: 500 !important;
        }
        .auth-manifest-wrap input[type=text],
        .auth-manifest-wrap input[type=email],
        .auth-manifest-wrap input[type=password] {
          border-color: #e5e7eb !important;
          border-radius: 0.625rem !important;
          padding: 0.625rem 0.875rem !important;
          font-size: 0.9375rem !important;
          background: #fff !important;
          transition: border-color .15s, box-shadow .15s;
        }
        .auth-manifest-wrap input:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,.12) !important;
          outline: none !important;
        }
        .auth-manifest-wrap button[type=submit] {
          width: 100% !important;
          background: linear-gradient(135deg,#6366f1 0%,#4f46e5 100%) !important;
          border: none !important;
          border-radius: 0.625rem !important;
          padding: .75rem 1.5rem !important;
          font-size: .9375rem !important;
          font-weight: 600 !important;
          color: white !important;
          cursor: pointer;
          transition: opacity .15s, transform .1s;
          margin-top: .5rem;
        }
        .auth-manifest-wrap button[type=submit]:hover  { opacity:.92; transform:translateY(-1px); }
        .auth-manifest-wrap button[type=submit]:active  { transform:translateY(0); }
        .auth-manifest-wrap button[type=submit]:disabled{ opacity:.5; cursor:not-allowed; transform:none; }
      `}</style>
    </div>
  );
}

// ─── Auth mode tabs ───────────────────────────────────────────────────────────

type AuthMode = "signin" | "signup";

function AuthModeTabs({ mode, onModeChange }: { mode: AuthMode; onModeChange: (m: AuthMode) => void }) {
  return (
    <div className="flex gap-0 mb-6 rounded-xl overflow-hidden bg-gray-100 p-1">
      {(["signin", "signup"] as AuthMode[]).map(m => (
        <button
          key={m}
          type="button"
          onClick={() => onModeChange(m)}
          className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
          style={{
            fontFamily: "var(--font-syne)",
            background: mode === m ? "white" : "transparent",
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

// ─── Hero column (left side) ──────────────────────────────────────────────────

function HeroColumn() {
  return (
    <div className="relative z-10 flex-1 flex flex-col justify-between px-10 py-12 lg:px-16 lg:py-16 max-w-[660px]">
      {/* Brand */}
      <div className="anim-fade-up flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold"
          style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>⚡</div>
        <span className="text-white font-semibold text-base tracking-tight"
          style={{ fontFamily: "var(--font-syne)" }}>Form Engine</span>
        <span className="ml-1 text-xs text-white/30 font-mono">v4.0.0</span>
      </div>

      {/* Hero text */}
      <div className="mt-auto">
        <div className="anim-fade-up delay-100">
          <span className="inline-block text-xs font-semibold tracking-[.18em] uppercase mb-5 px-3 py-1 rounded-full"
            style={{ color: "#a5b4fc", background: "rgba(99,102,241,.12)", border: "1px solid rgba(99,102,241,.2)",
              fontFamily: "var(--font-syne)" }}>
            YAML · REST · Any backend
          </span>
        </div>

        <h1 className="anim-fade-up delay-200 text-white font-extrabold leading-[1.08] tracking-tight"
          style={{ fontSize: "clamp(2.6rem,5.5vw,4.2rem)", fontFamily: "var(--font-syne)" }}>
          Forms that live<br />
          <span style={{ background: "linear-gradient(90deg,#818cf8 0%,#a78bfa 50%,#38bdf8 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            in your config.
          </span>
        </h1>

        <p className="anim-fade-up delay-300 text-white/50 mt-5 max-w-md leading-relaxed"
          style={{ fontSize: "1.0625rem" }}>
          Define complex multi-step forms in YAML. Render them anywhere.
          Connect to any backend. Ship in minutes, not weeks.
        </p>

        {/* This component list is driven by the UIManifestRenderer's feature_grid component */}
        <div className="anim-fade-up delay-400 mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: "⚡", title: "YAML-driven forms",    body: "Define any form in a single YAML file. No code, no migrations." },
            { icon: "🔌", title: "Pluggable backends",   body: "Point at any REST API. Local files, Docker, or cloud — your choice." },
            { icon: "🧩", title: "Dynamic data sources", body: "Dropdown choices fetched live from your APIs, with built-in caching." },
            { icon: "🧙", title: "Wizard & single-page", body: "Multi-step wizards or dense single-page layouts from the same schema." },
          ].map(f => (
            <div key={f.title} className="flex items-start gap-3">
              <span className="text-xl mt-0.5 flex-shrink-0"
                style={{ filter: "drop-shadow(0 0 8px rgba(129,140,248,.5))" }}>{f.icon}</span>
              <div>
                <p className="text-white/90 text-sm font-semibold leading-snug"
                  style={{ fontFamily: "var(--font-syne)" }}>{f.title}</p>
                <p className="text-white/35 text-xs mt-0.5 leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Schema provenance note */}
      <div className="mt-12 flex items-center gap-2">
        <p className="text-white/20 text-xs">Powered by Form Engine · YAML schema v4</p>
        <span className="text-white/10">·</span>
        <p className="text-white/15 text-xs font-mono">auth screen via UISystemManifest</p>
      </div>
    </div>
  );
}

// ─── Auth card ────────────────────────────────────────────────────────────────

/**
 * The auth card is the right-column component of the `auth` screen in
 * authUIManifest. It renders the Form component (signin or signup) from the
 * manifest via UIManifestRenderer, wiring in the action handlers below.
 */
function AuthCard({ mode, onModeChange, handlers }: {
  mode: AuthMode;
  onModeChange: (m: AuthMode) => void;
  handlers: ActionHandlerMap;
}) {
  // Build a focused sub-manifest: only the active form
  const focusedManifest = {
    ...authUIManifest,
    // Override auth_card to point at the right form component
    components: {
      ...authUIManifest.components,
      auth_card: {
        ...authUIManifest.components!.auth_card,
        sub_components: [
          { component_ref: "auth_card_stripe", direction: "Top" as const },
          { component_ref: mode === "signin" ? "signin_form" : "signup_form", direction: "Center" as const },
        ],
      },
    },
    // Expose a minimal screen
    screens: {
      ...authUIManifest.screens,
      __auth_card__: {
        name: "__auth_card__",
        label: "Auth Card",
        auth_rules: { require_auth: false },
        components: [
          { component_ref: "auth_card_stripe", direction: "Top" as const },
          { component_ref: mode === "signin" ? "signin_form" : "signup_form", direction: "Center" as const },
        ],
      },
    },
  };

  return (
    <div
      className="anim-fade-up delay-200 relative w-full max-w-[420px] rounded-3xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.97)",
        boxShadow: "0 32px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.08)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Accent stripe — driven by auth_card_stripe component in manifest */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6,#0ea5e9)" }} />

      <div className="px-8 pt-7 pb-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-7">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>⚡</div>
          <span className="text-sm font-semibold tracking-tight text-gray-800" style={{ fontFamily: "var(--font-syne)" }}>
            Form Engine
          </span>
        </div>

        {/* Tabs */}
        <AuthModeTabs mode={mode} onModeChange={onModeChange} />

        {/* Heading */}
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

        {/*
          ── THE CORE: Form rendered via UIManifestRenderer ──────────────────
          The signin_form / signup_form components in authUIManifest are of
          type "Form" with form_ref pointing to the form definitions in
          manifest.forms. UIManifestRenderer resolves this to FormEngine.
        */}
        <div className="auth-manifest-wrap">
          <UIManifestRenderer
            manifest={focusedManifest}
            screenKey="__auth_card__"
            handlers={handlers}
          />
        </div>

        {/* Footer toggle */}
        <p className="text-center text-xs text-gray-400 mt-5">
          {mode === "signin" ? (
            <>No account?{" "}
              <button type="button" onClick={() => onModeChange("signup")}
                className="text-indigo-500 hover:text-indigo-600 font-medium">Sign up free</button></>
          ) : (
            <>Already have an account?{" "}
              <button type="button" onClick={() => onModeChange("signin")}
                className="text-indigo-500 hover:text-indigo-600 font-medium">Sign in</button></>
          )}
        </p>

        {/* Schema badge */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-1.5">
          <span className="text-[10px] text-gray-300 font-mono">rendered via UISystemManifest ·</span>
          <span className="text-[10px] text-gray-300 font-mono">auth_ui.yaml</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page inner ───────────────────────────────────────────────────────────────

function AuthPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { signin }   = useAuth();

  const [mode, setMode] = useState<AuthMode>(
    (searchParams.get("mode") as AuthMode | null) ?? "signin",
  );

  const nextPath = searchParams.get("next") ?? "/";

  // ── Handlers wired into UIManifestRenderer ────────────────────────────────

  const handleSignin = useCallback(async (answers: FieldAnswers) => {
    const res = await fetch("/auth/signin", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(answers),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.detail ?? data.message ?? "Invalid email or password");
    }

    signin({
      email: String(answers.email ?? ""),
      name:  data.user?.name ?? data.name ?? undefined,
      token: data.token ?? data.access_token ?? "session",
    });

    toast.success("Signed in — welcome back!");
    router.replace(nextPath);
  }, [signin, router, nextPath]);

  const handleSignup = useCallback(async (answers: FieldAnswers) => {
    if (answers.password !== answers.confirm_password) {
      throw new Error("Passwords do not match");
    }

    const res = await fetch("/auth/signup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(answers),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.detail ?? data.message ?? "Could not create account");
    }

    signin({
      email: String(answers.email ?? ""),
      name:  String(answers.full_name ?? data.name ?? ""),
      token: data.token ?? data.access_token ?? "session",
    });

    toast.success("Account created — welcome aboard!");
    router.replace(nextPath);
  }, [signin, router, nextPath]);

  /**
   * ActionHandlerMap — maps on_press / handler_name values from the manifest
   * to actual functions. UIManifestRenderer calls these when forms submit or
   * buttons are pressed.
   */
  const handlers: ActionHandlerMap = {
    // Form on_submit handler_name values
    handleSignin:  handleSignin as (answers?: FieldAnswers) => Promise<void>,
    handleSignup:  handleSignup as (answers?: FieldAnswers) => Promise<void>,
    handle_signin: handleSignin as (answers?: FieldAnswers) => Promise<void>,
    handle_signup: handleSignup as (answers?: FieldAnswers) => Promise<void>,

    // Button on_press values
    "navigate:auth?mode=signup": () => setMode("signup"),
    "navigate:auth?mode=signin": () => setMode("signin"),
    "navigate:home":             () => router.push("/"),
    "navigate:docs":             () => router.push("/docs"),
  };

  return (
    <div
      className="relative min-h-screen flex flex-col lg:flex-row overflow-hidden"
      style={{ background: "#07070e", fontFamily: "var(--font-dm-sans)" }}
    >
      <BackgroundGrid />
      <Orbs />

      {/* Left: Hero column */}
      <HeroColumn />

      {/* Right: Auth card — rendered via UIManifestRenderer */}
      <div className="relative z-10 flex items-center justify-center px-6 py-12 lg:px-12 lg:py-16 lg:w-[480px] lg:flex-shrink-0">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block"
          style={{ background: "linear-gradient(to right,transparent,rgba(99,102,241,.04))",
            borderLeft: "1px solid rgba(255,255,255,.04)" }} />

        <AuthCard mode={mode} onModeChange={setMode} handlers={handlers} />
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#07070e]">
        <span className="h-8 w-8 rounded-full border-2 border-indigo-800 border-t-indigo-400 animate-spin" />
      </div>
    }>
      <AuthPageInner />
    </Suspense>
  );
}
