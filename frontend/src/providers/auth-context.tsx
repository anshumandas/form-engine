"use client";

/**
 * AuthContext
 *
 * Lightweight client-side auth layer. Persists the session in:
 *   1. localStorage  — survives page reload, readable by React
 *   2. auth-token cookie — readable by Next.js middleware for server-side
 *      redirect before the page even renders (no auth flash)
 *
 * Swap `signin` / `signout` internals for your real token strategy
 * (JWT, opaque token, session cookie from HttpOnly backend, etc.)
 * without touching any consumer component.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  email: string;
  name?: string;
  token: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True while rehydrating from localStorage on first render */
  loading: boolean;
  isAuthenticated: boolean;
  signin: (user: AuthUser) => void;
  signout: () => void;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = "fe_auth_user";
const COOKIE_NAME  = "auth-token";

function readStorage(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeStorage(user: AuthUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  // Set a short-lived cookie so middleware can read it server-side.
  // Path=/ ensures all routes see it; SameSite=Strict prevents CSRF.
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(user.token)}; Path=/; Max-Age=${maxAge}; SameSite=Strict`;
}

function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
  // Expire the cookie immediately
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Strict`;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAuthenticated: false,
  signin: () => {},
  signout: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from localStorage on mount (client only)
  useEffect(() => {
    const stored = readStorage();
    if (stored) setUser(stored);
    setLoading(false);
  }, []);

  const signin = useCallback((u: AuthUser) => {
    writeStorage(u);
    setUser(u);
  }, []);

  const signout = useCallback(() => {
    clearStorage();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isAuthenticated: !!user, signin, signout }),
    [user, loading, signin, signout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
