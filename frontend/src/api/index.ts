import type {
  FormManifest,
  ManifestSummary,
  FormSubmissionPayload,
  FormSubmissionResponse,
} from "form-engine/src/libs/types";
import { getConfig, resolveApiUrl } from "@form-engine/libs/config";

// ─── Core fetcher ─────────────────────────────────────────────────────────────
// Uses relative paths by default (Next.js /api proxy), or an absolute base URL
// when configured via FormEngineProvider / configureFormEngine().

/** Read the stored auth token from localStorage (client-only). */
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("fe_auth_user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { token?: string };
    return u.token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const cfg = getConfig();
  const url = resolveApiUrl(path);
  const token = getAuthToken();
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...cfg.headers,
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        errMsg = err.detail || err.message || errMsg;
      } catch {
        try { errMsg = await res.text(); } catch {}
      }
      throw new Error(errMsg);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  } catch (err: unknown) {
    if (err instanceof TypeError) {
      const msg = err.message.includes("fetch")
        ? "Network error. Is the backend running?"
        : err.message;
      console.error("[API Request Error]", url, err);
      throw new Error(msg);
    }
    throw err;
  }
}

export interface CategorySummary {
  category_id: string;
  name: string;
  description?: string;
  form_count: number;
  created_at?: string;
  updated_at?: string;
}

export const categoryApi = {
  list: (): Promise<CategorySummary[]> =>
    request("/api/categories/"),

  create: (body: { name: string; category_id: string; description?: string }): Promise<{ category_id: string; name: string }> =>
    request("/api/categories/", { method: "POST", body: JSON.stringify(body) }),

  rename: (id: string, body: { name: string; category_id: string; description?: string }): Promise<unknown> =>
    request(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};

// ─── Forms ────────────────────────────────────────────────────────────────────
export const api = {
  // List all manifests
  listManifests: (): Promise<ManifestSummary[]> =>
    request("/api/forms/"),

  // Get full manifest — checks localManifests first (zero-network for bundled forms)
  getManifest: (manifestId: string): Promise<FormManifest> => {
    const local = getConfig().localManifests?.[manifestId];
    if (local) return Promise.resolve(local);
    return request(`/api/forms/${manifestId}`);
  },

  // Get single form with context
  getForm: (manifestId: string, formId: string): Promise<{
    manifest_id: string;
    form_id: string;
    manifest: FormManifest;
    form: unknown;
  }> => {
    // If the manifest is local, we can resolve without a network call
    const local = getConfig().localManifests?.[manifestId];
    if (local) {
      return Promise.resolve({
        manifest_id: manifestId,
        form_id: formId,
        manifest: local,
        form: (local.forms as Record<string, unknown>)[formId] ?? null,
      });
    }
    return request(`/api/forms/${manifestId}/forms/${formId}`);
  },

  // Create/update manifest
  upsertManifest: (manifest: Record<string, unknown>): Promise<{ manifest_id: string; status: string }> =>
    request("/api/forms/", { method: "POST", body: JSON.stringify(manifest) }),

  // Update manifest
  updateManifest: (manifestId: string, manifest: Record<string, unknown>): Promise<unknown> =>
    request(`/api/forms/${manifestId}`, { method: "PUT", body: JSON.stringify(manifest) }),

  // Delete manifest
  deleteManifest: (manifestId: string): Promise<void> =>
    request(`/api/forms/${manifestId}`, { method: "DELETE" }),

  // Upload YAML/JSON file
  uploadManifest: async (file: File): Promise<{ manifest_id: string; forms: string[] }> => {
    const cfg = getConfig();
    const url = resolveApiUrl("/api/forms/upload");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(url, {
      method: "POST",
      headers: cfg.headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  // Validate without saving
  validateManifest: (manifest: Record<string, unknown>): Promise<{
    valid: boolean;
    manifest_id?: string;
    forms?: string[];
    error?: string;
  }> => request("/api/forms/validate", { method: "POST", body: JSON.stringify(manifest) }),

  // ─── Submissions ─────────────────────────────────────────────────────────────
  submit: (payload: FormSubmissionPayload): Promise<FormSubmissionResponse> => {
    // Allow a global onSubmit override from config (e.g. for auth token injection)
    const override = getConfig().onSubmit;
    if (override) {
      return override(payload.manifest_id||"", payload.form_id, payload.answers) as Promise<FormSubmissionResponse>;
    }
    return request("/api/submissions/", { method: "POST", body: JSON.stringify(payload) });
  },

  listSubmissions: (params?: { form_id?: string; manifest_id?: string }): Promise<unknown[]> => {
    const qs = new URLSearchParams();
    if (params?.form_id) qs.set("form_id", params.form_id);
    if (params?.manifest_id) qs.set("manifest_id", params.manifest_id);
    return request(`/api/submissions/?${qs}`);
  },

  getSubmission: (id: string): Promise<unknown> =>
    request(`/api/submissions/${id}`),

  getDraft: (manifestId: string, formId: string): Promise<{ answers: Record<string, unknown> }> =>
    request(`/api/submissions/drafts/${manifestId}/${formId}`),

  deleteDraft: (manifestId: string, formId: string): Promise<void> =>
    request(`/api/submissions/drafts/${manifestId}/${formId}`, { method: "DELETE" }),
};

// ─── Admin API ────────────────────────────────────────────────────────────────

export interface AdminUser {
  email: string;
  name?: string;
  role: string;
  created_at?: string;
}

export const adminApi = {
  /** List all users. Requires admin token. */
  listUsers: (): Promise<AdminUser[]> =>
    request("/auth/users"),

  /** Delete a user by email. Requires admin token. */
  deleteUser: (email: string): Promise<void> =>
    request(`/auth/users/${encodeURIComponent(email)}`, { method: "DELETE" }),
};
