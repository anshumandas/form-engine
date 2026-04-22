"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface Submission {
  submission_id: string;
  form_id: string;
  manifest_id: string;
  answers: Record<string, unknown>;
  submitted_at: string;
}

export default function SubmissionsPage() {
  const params = useSearchParams();
  const manifestId = params.get("manifest") ?? undefined;
  const formId = params.get("form") ?? undefined;

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listSubmissions({ form_id: formId, manifest_id: manifestId })
      .then(data => setSubmissions(data as Submission[]))
      .catch(() => toast.error("Failed to load submissions"))
      .finally(() => setLoading(false));
  }, [manifestId, formId]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-blue-600">⬅ Categories</Link>
            <span>/</span>
            <span className="font-semibold text-gray-800 dark:text-white">Submissions</span>
            {manifestId && <><span>/</span><span className="font-mono text-xs">{manifestId}</span></>}
            {formId && <><span>/</span><span className="font-mono text-xs">{formId}</span></>}
          </div>
          <span className="badge bg-gray-100 text-gray-600">
            {submissions.length} record{submissions.length !== 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 flex gap-6">
        {/* List */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex justify-center py-24">
              <span className="h-7 w-7 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <span className="text-5xl mb-4 block">📭</span>
              <p>No submissions yet for this form.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map(sub => (
                <button
                  key={sub.submission_id}
                  onClick={() => setSelected(sub)}
                  className={`w-full text-left form-card p-4 hover:border-blue-400 transition-all ${
                    selected?.submission_id === sub.submission_id ? "border-blue-500 ring-2 ring-blue-200" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-gray-400 truncate">{sub.submission_id}</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white mt-0.5">
                        {sub.form_id}
                        <span className="ml-2 text-xs text-gray-400 font-normal font-mono">{sub.manifest_id}</span>
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(sub.answers).slice(0, 4).map(([k, v]) => (
                          <span key={k} className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                            <span className="text-gray-400">{k}: </span>
                            {String(v ?? "–").slice(0, 30)}
                          </span>
                        ))}
                        {Object.keys(sub.answers).length > 4 && (
                          <span className="text-xs text-gray-400">+{Object.keys(sub.answers).length - 4} more</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(sub.submitted_at)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail pane */}
        {selected && (
          <div className="w-80 flex-shrink-0">
            <div className="form-card p-5 sticky top-20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-gray-800 dark:text-white">Submission Detail</h3>
                <button onClick={() => setSelected(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>

              <dl className="space-y-3">
                <div>
                  <dt className="text-xs text-gray-400">ID</dt>
                  <dd className="text-xs font-mono text-gray-700 dark:text-gray-200 break-all">
                    {selected.submission_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Form</dt>
                  <dd className="text-xs font-mono">{selected.manifest_id}/{selected.form_id}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Submitted</dt>
                  <dd className="text-xs">{formatDate(selected.submitted_at)}</dd>
                </div>
              </dl>

              <hr className="my-4 border-gray-200 dark:border-gray-700" />

              <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Answers</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {Object.entries(selected.answers).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-gray-400">{k}</p>
                    <p className="text-xs text-gray-800 dark:text-gray-200 break-words">
                      {v == null ? <em className="text-gray-400">—</em>
                        : typeof v === "boolean" ? (v ? "Yes" : "No")
                        : Array.isArray(v) ? v.join(", ")
                        : String(v)}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selected, null, 2));
                  toast.success("Copied to clipboard");
                }}
                className="mt-4 w-full btn-secondary text-xs py-1.5 justify-center">
                Copy JSON
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
