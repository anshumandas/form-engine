"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/api";
import { FormEngine } from "@form-engine/components/FormEngine";
import type { FormManifest, FieldAnswers, FormSubmissionResponse } from "@form-engine/libs/types";
import { toast } from "sonner";

export default function FormPage() {
  const { manifestId, formId } = useParams<{ manifestId: string; formId: string }>();
  const router = useRouter();

  const [manifest, setManifest] = useState<FormManifest | null>(null);
  const [initialAnswers, setInitialAnswers] = useState<FieldAnswers>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const m = await api.getManifest(manifestId);
        setManifest(m);

        // Try to restore draft
        try {
          const draft = await api.getDraft(manifestId, formId);
          if (draft?.answers && Object.keys(draft.answers).length > 0) {
            setInitialAnswers(draft.answers);
            toast.info("Draft restored", { description: "Your previous progress has been loaded." });
          }
        } catch { /* no draft */ }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load form");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [manifestId, formId]);

  if (loading) return (
    <PageShell manifestId={manifestId} formId={formId} formTitle="Loading…">
      <div className="flex items-center justify-center py-24">
        <span className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
      </div>
    </PageShell>
  );

  if (error || !manifest) return (
    <PageShell manifestId={manifestId} formId={formId} formTitle="Error">
      <div className="text-center py-16">
        <span className="text-4xl mb-4 block">⚠️</span>
        <p className="text-red-500 font-medium">{error ?? "Manifest not found"}</p>
        <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline text-sm">← Back to forms</Link>
      </div>
    </PageShell>
  );

  const form = manifest.forms?.[formId];
  if (!form) return (
    <PageShell manifestId={manifestId} formId={formId} formTitle="Not Found">
      <div className="text-center py-16">
        <span className="text-4xl mb-4 block">🔍</span>
        <p className="text-gray-600">Form <code className="text-sm bg-gray-100 px-1 rounded">{formId}</code> not found in manifest <code className="text-sm bg-gray-100 px-1 rounded">{manifestId}</code></p>
        <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline text-sm">← Back to forms</Link>
      </div>
    </PageShell>
  );

  return (
    <PageShell manifestId={manifestId} formId={formId} formTitle={form.title}>
      <div className="form-card p-6 md:p-8">
        {/* Form header */}
        <div className="mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{form.title}</h1>
              {form.description && (
                <p className="mt-2 text-gray-500 text-sm leading-relaxed max-w-2xl">{form.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-gray-400 font-mono">v{form.version}</span>
              <span className="text-xs text-gray-400 capitalize">
                {form.layout.type} · {manifestId}/{formId}
              </span>
            </div>
          </div>
        </div>

        <FormEngine
          manifest={manifest}
          formId={formId}
          initialAnswers={initialAnswers}
          onSubmit={async (payload: FieldAnswers, response?: FormSubmissionResponse) => {
            if (response?.submission_id) {
              toast.success("Submitted!", {
                description: `Submission ID: ${response.submission_id}${response.message ? ` - ${response.message}` : ""}`,
              });
            }
          }}
          onDraftSave={async () => {
            toast.success("Draft saved");
          }}
        />
      </div>
    </PageShell>
  );
}

function PageShell({ manifestId, formId, formTitle, children }: {
  manifestId: string;
  formId: string;
  formTitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top nav */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-blue-600 transition-colors">⬅ Categories</Link>
            <span>/</span>
            <span className="text-xs text-gray-500">{manifestId}</span>
            <span>/</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">{formTitle}</span>
          </div>
          <Link href={`/submissions?manifest=${manifestId}&form=${formId}`}
            className="text-xs text-gray-500 hover:text-blue-600 transition-colors">
            View submissions →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
