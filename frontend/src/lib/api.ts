import type {
  FormManifest,
  ManifestSummary,
  FormSubmissionPayload,
  FormSubmissionResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
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

  // Get full manifest
  getManifest: (manifestId: string): Promise<FormManifest> =>
    request(`/api/forms/${manifestId}`),

  // Get single form with context
  getForm: (manifestId: string, formId: string): Promise<{
    manifest_id: string;
    form_id: string;
    manifest: FormManifest;
    form: unknown;
  }> => request(`/api/forms/${manifestId}/forms/${formId}`),

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
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/forms/upload`, {
      method: "POST",
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
  submit: (payload: FormSubmissionPayload): Promise<FormSubmissionResponse> =>
    request("/api/submissions/", { method: "POST", body: JSON.stringify(payload) }),

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
