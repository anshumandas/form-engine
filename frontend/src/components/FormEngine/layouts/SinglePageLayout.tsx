"use client";

import React from "react";
import type { FormManifest, FormDef, FieldAnswers, FormSubmissionResponse, Section } from "@/lib/types";
import { useFormEngineStore } from "@/store/form-engine-store";
import { FieldRouter } from "../index";
import { CollectionRenderer, ProFieldsSection } from "../CollectionRenderer";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LayoutProps {
  manifest: FormManifest;
  form: FormDef;
  formId: string;
  onSubmit?: (payload: FieldAnswers, response?: FormSubmissionResponse) => Promise<void> | void;
  onDraftSave?: (answers: FieldAnswers) => Promise<void> | void;
  readOnly?: boolean;
}

export function SinglePageLayout({ manifest, form, formId, onSubmit, onDraftSave, readOnly }: LayoutProps) {
  const {
    getVisibleSections, setSubmitting, setSubmitted, submitting, validateAllFields, errors
  } = useFormEngineStore();

  const sections = getVisibleSections(form.sections ?? []);
  const totalErrors = Object.values(errors).flat().length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAllFields()) return;
    setSubmitting(true);
    try {
      const payload = useFormEngineStore.getState().getSubmitPayload();
      const submitAction = form.on_submit;
      if (submitAction?.type === "rest" && submitAction.url) {
        const response = await api.submit({
          form_id: formId, manifest_id: manifest.manifest_id,
          answers: payload, context: useFormEngineStore.getState().context,
        });
        if (response.status === "accepted") { setSubmitted(true); await onSubmit?.(payload, response); }
      } else { setSubmitted(true); await onSubmit?.(payload); }
    } catch (err) { console.error("Submission error:", err); }
    finally { setSubmitting(false); }
  };

  const handleDraftSave = async () => {
    const answers = useFormEngineStore.getState().answers;
    await onDraftSave?.(answers);
    try { await api.submit({ form_id: formId, manifest_id: manifest.manifest_id, answers, draft: true }); }
    catch { /* silent */ }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {sections.map(section => (
        <SectionCard key={section.id ?? section.title} section={section} />
      ))}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        {totalErrors > 0 && (
          <p className="text-sm text-red-500 font-medium">
            ⚠ {totalErrors} error{totalErrors !== 1 ? "s" : ""} – please review above
          </p>
        )}
        <div className="flex gap-3 ml-auto">
          <button type="button" onClick={handleDraftSave}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            {form.draft_label ?? "Save Draft"}
          </button>
          <button type="submit" disabled={submitting || readOnly}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 shadow-sm transition-all">
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Submitting…
              </span>
            ) : (form.submit_label ?? "Submit")}
          </button>
        </div>
      </div>
    </form>
  );
}

function SectionCard({ section }: { section: Section }) {
  const { getVisibleFields } = useFormEngineStore();

  if (section.collection) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800/30">
        {section.title && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{section.title}</h3>
            {section.description && <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>}
          </div>
        )}
        <div className="p-6">
          <CollectionRenderer section={section} collection={section.collection} bindPrefix={section.bind_prefix} />
        </div>
      </div>
    );
  }

  const allVisible = getVisibleFields(section.fields ?? []);
  const basicFields = allVisible.filter(f => !f.advanced);
  const proFields   = allVisible.filter(f => !!f.advanced);
  if (allVisible.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800/30">
      {section.title && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{section.title}</h3>
          {section.description && <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>}
        </div>
      )}
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-x-5 gap-y-6">
          {basicFields.map(field => (
            <div key={field.id} className={cn(
              field.width === "half" ? "col-span-1" :
              field.width === "third" ? "col-span-1" : "col-span-2"
            )}>
              <FieldRouter field={field} />
            </div>
          ))}
        </div>
        {proFields.length > 0 && (
          <ProFieldsSection fields={proFields} />
        )}
      </div>
    </div>
  );
}
