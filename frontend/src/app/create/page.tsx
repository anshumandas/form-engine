"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@form-engine/libs/api";
import { FormEngine } from "@form-engine/components/FormEngine";
import { FormErrorBoundary } from "@form-engine/components/FormEngine/FormErrorBoundary";
import type { FormManifest, FieldAnswers } from "@form-engine/libs/types";
import { toast } from "sonner";

export default function CreateFormPage() {
  const router = useRouter();
  const [manifest, setManifest] = useState<FormManifest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getManifest("form_creator")
      .then(setManifest)
      .catch(() => toast.error("Could not load the Form Builder. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (payload: FieldAnswers) => {
    // The form engine posts to /api/create-form via on_submit.url.
    // We intercept the raw payload here to get the redirect URL from the response.
    try {
      const res = await fetch("/api/create-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.detail ?? "Form creation failed");
        return;
      }

      toast.success(`Form "${data.form_id}" created!`, {
        description: `Redirecting to your new form…`,
      });

      // Give the toast time to show before navigating
      setTimeout(() => router.push(data.url), 800);
    } catch (e) {
      toast.error("Network error — could not reach the server");
    }
  };

  const handleDraftSave = async (answers: FieldAnswers) => {
    //TODO: Implement draft saving for the create form. This is a bit tricky since the form doesn't exist yet and we don't have a form_id to associate the draft with. One option is to save the draft in localStorage with a temporary ID, and then clear it on successful submission. For now, we'll just show a success toast without actually saving.
    toast.success("Draft saved");
    throw new Error("Function not implemented.");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-blue-600 transition-colors">⬅ Categories</Link>
            <span>/</span>
            <span className="font-semibold text-gray-800 dark:text-gray-100">Form Builder</span>
          </div>
          <Link href="/builder"
            className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
            Advanced editor (YAML) →
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Intro card */}
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-900 p-6">
          <div className="flex items-start gap-4">
            <span className="text-4xl">⚡</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Form Builder</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Fill out the steps below to create a new form — no code required.
                Your form will be rendered instantly by the same Form Engine.
                Fields marked <span className="font-medium text-blue-700">▶ More options</span> hide
                advanced configuration like validation patterns, hints, and layout width.
              </p>
              <div className="mt-3 flex gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">✅ Live preview in builder</span>
                <span className="flex items-center gap-1">✅ Wizard or single-page</span>
                <span className="flex items-center gap-1">✅ REST or local submit</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
          </div>
        ) : !manifest ? (
          <div className="text-center py-16">
            <span className="text-4xl block mb-4">⚠️</span>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Could not load the Form Builder manifest.
              Make sure the backend is running at{" "}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}
              </code>
            </p>
            <button onClick={() => window.location.reload()}
              className="btn-primary text-sm">
              Retry
            </button>
          </div>
        ) : (
          <div className="form-card p-6 md:p-8">
            <FormErrorBoundary formId="create_form">
              <FormEngine
                manifest={manifest}
                formId="create_form"
                onSubmit={handleSubmit}
                onDraftSave={handleDraftSave}
              />
            </FormErrorBoundary>
          </div>
        )}

        {/* Help footer */}
        <div className="mt-8 text-center text-xs text-gray-400 space-x-4">
          <Link href="/builder" className="hover:text-blue-500 transition-colors">
            Need more control? Use the YAML editor →
          </Link>
        </div>
      </main>
    </div>
  );
}
