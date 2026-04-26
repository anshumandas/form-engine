"use client";

/**
 * /admin — User Management Panel
 *
 * Accessible only to users with role === "admin".
 * Non-admins see a 403 screen.
 * Lists all registered users, shows their role + join date,
 * and lets the admin delete non-admin accounts.
 */

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-context";
import { adminApi, type AdminUser } from "@/api";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={
        isAdmin
          ? { background: "rgba(99,102,241,.12)", color: "#6366f1", border: "1px solid rgba(99,102,241,.25)" }
          : { background: "rgba(16,185,129,.10)", color: "#059669", border: "1px solid rgba(16,185,129,.25)" }
      }
    >
      {isAdmin ? "👑" : "👤"} {role}
    </span>
  );
}

// ─── Forbidden screen ─────────────────────────────────────────────────────────

function ForbiddenScreen() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: "#07070e", fontFamily: "var(--font-dm-sans)" }}>
      <div className="text-6xl">🔒</div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-syne)" }}>
          Admin Access Required
        </h1>
        <p className="text-white/40 text-sm">This area is restricted to administrators only.</p>
      </div>
      <button
        onClick={() => router.push("/")}
        className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
        style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
      >
        ← Back to Home
      </button>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  user,
  onConfirm,
  onCancel,
  loading,
}: {
  user: AdminUser;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative rounded-2xl shadow-2xl p-6 w-full max-w-sm border"
        style={{
          background: "#13131f",
          borderColor: "rgba(255,255,255,.08)",
        }}
      >
        <div className="text-4xl mb-4 text-center">⚠️</div>
        <h3 className="text-lg font-bold text-white text-center mb-2" style={{ fontFamily: "var(--font-syne)" }}>
          Delete User?
        </h3>
        <p className="text-white/50 text-sm text-center mb-6">
          This will permanently remove <span className="text-white font-medium">{user.email}</span>.
          This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
            style={{ borderColor: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.6)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: loading ? "rgba(239,68,68,.4)" : "#ef4444" }}
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({
  user,
  currentEmail,
  onDelete,
}: {
  user: AdminUser;
  currentEmail: string;
  onDelete: (u: AdminUser) => void;
}) {
  const isSelf   = user.email === currentEmail;
  const isAdmin  = user.role === "admin";
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();

  return (
    <tr className="border-b" style={{ borderColor: "rgba(255,255,255,.05)" }}>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: isAdmin ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "rgba(255,255,255,.08)", color: isAdmin ? "white" : "rgba(255,255,255,.7)" }}
          >
            {initials}
          </div>
          <div>
            <div className="text-sm font-medium text-white">
              {user.name ?? "—"}
              {isSelf && <span className="ml-2 text-xs text-indigo-400 font-normal">(you)</span>}
            </div>
            <div className="text-xs text-white/40">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <RoleBadge role={user.role} />
      </td>
      <td className="py-3.5 px-4 text-xs text-white/40">{fmt(user.created_at)}</td>
      <td className="py-3.5 px-4 text-right">
        {!isSelf && !isAdmin && (
          <button
            onClick={() => onDelete(user)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ color: "#ef4444", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,.1)")}
          >
            Delete
          </button>
        )}
        {(isSelf || isAdmin) && (
          <span className="text-xs text-white/20 italic">
            {isSelf ? "current session" : "protected"}
          </span>
        )}
      </td>
    </tr>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────────────────────

function AdminPanel() {
  const { user: authUser } = useAuth();
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await adminApi.listUsers();
      // Sort: admin first, then by email
      list.sort((a, b) => {
        if (a.role === "admin" && b.role !== "admin") return -1;
        if (b.role === "admin" && a.role !== "admin") return 1;
        return a.email.localeCompare(b.email);
      });
      setUsers(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await adminApi.deleteUser(deleting.email);
      toast.success(`User ${deleting.email} deleted`);
      setDeleting(null);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setDeleteLoading(false);
    }
  }, [deleting, load]);

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const adminCount = users.filter(u => u.role === "admin").length;
  const userCount  = users.filter(u => u.role !== "admin").length;

  return (
    <div
      className="min-h-screen"
      style={{ background: "#07070e", fontFamily: "var(--font-dm-sans)" }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b"
        style={{ background: "rgba(7,7,14,.9)", backdropFilter: "blur(12px)", borderColor: "rgba(255,255,255,.06)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors">
            <span>←</span> Home
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white font-semibold text-sm" style={{ fontFamily: "var(--font-syne)" }}>
            Admin Panel
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30">Signed in as</span>
          <span className="text-xs text-white/60 font-medium">{authUser?.email}</span>
          <RoleBadge role="admin" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* ── Page heading ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1
            className="text-3xl font-extrabold text-white mb-1"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            User Management
          </h1>
          <p className="text-white/40 text-sm">
            Manage all registered accounts. Only admins can access this panel.
          </p>
        </div>

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Users", value: users.length, icon: "👥" },
            { label: "Admins",      value: adminCount,   icon: "👑" },
            { label: "Regular",     value: userCount,    icon: "👤" },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-2xl p-5 border"
              style={{ background: "rgba(255,255,255,.03)", borderColor: "rgba(255,255,255,.06)" }}
            >
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Table card ───────────────────────────────────────────────── */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: "rgba(255,255,255,.02)", borderColor: "rgba(255,255,255,.06)" }}
        >
          {/* Search + refresh bar */}
          <div
            className="flex items-center gap-3 px-4 py-3 border-b"
            style={{ borderColor: "rgba(255,255,255,.06)" }}
          >
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none text-white placeholder-white/30"
            />
            <button
              onClick={load}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg font-medium text-white/60 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,.05)" }}
            >
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>

          {/* Table */}
          {error ? (
            <div className="p-10 text-center text-red-400 text-sm">{error}</div>
          ) : loading ? (
            <div className="p-10 text-center">
              <div className="inline-block h-6 w-6 rounded-full border-2 border-indigo-800 border-t-indigo-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-white/30 text-sm">
              {search ? "No users match your search." : "No users found."}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                  {["User", "Role", "Joined", ""].map(h => (
                    <th
                      key={h}
                      className="py-2.5 px-4 text-left text-xs font-semibold text-white/30 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <UserRow
                    key={u.email}
                    user={u}
                    currentEmail={authUser?.email ?? ""}
                    onDelete={setDeleting}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Admin credentials callout ─────────────────────────────────── */}
        <div
          className="mt-6 rounded-xl p-4 flex items-start gap-3 border"
          style={{ background: "rgba(99,102,241,.06)", borderColor: "rgba(99,102,241,.2)" }}
        >
          <span className="text-lg flex-shrink-0">🔑</span>
          <div className="text-xs text-white/50 leading-relaxed">
            <span className="text-indigo-400 font-semibold">Default admin credentials: </span>
            email <code className="text-indigo-300">admin@formengine.io</code>{" "}
            / password <code className="text-indigo-300">Admin@1234</code>.
            Change these in production.
          </div>
        </div>
      </main>

      {/* ── Delete confirmation modal ─────────────────────────────────── */}
      {deleting && (
        <ConfirmDeleteModal
          user={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/auth?next=/admin");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07070e" }}>
        <span className="h-8 w-8 rounded-full border-2 border-indigo-800 border-t-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null; // middleware redirect in progress

  if (!isAdmin) return <ForbiddenScreen />;

  return <AdminPanel />;
}
