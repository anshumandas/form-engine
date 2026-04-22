/**
 * useFormEngine — convenience hook for components that want to interact
 * with the form engine store without direct Zustand imports.
 *
 * Usage:
 *   const { answers, setAnswer, errors, submit } = useFormEngine();
 */
import { useCallback } from "react";
import { useFormEngineStore } from "@/store/form-engine-store";
import { api } from "@/lib/api";
import type { FieldAnswers, FormContext, FormManifest, FormSubmissionResponse } from "@/lib/types";

export interface UseFormEngineReturn {
  // State
  answers: FieldAnswers;
  errors: Record<string, string[]>;
  currentPageIndex: number;
  submitting: boolean;
  submitted: boolean;

  // Field interaction
  setAnswer: (fieldId: string, value: unknown) => void;
  touchField: (fieldId: string) => void;
  getFieldError: (fieldId: string) => string[];

  // Navigation
  nextPage: () => boolean;
  prevPage: () => void;
  goToPage: (index: number) => void;

  // Submission
  submit: (opts?: {
    manifestId?: string;
    formId?: string;
    draft?: boolean;
    context?: FormContext;
  }) => Promise<FormSubmissionResponse | null>;

  // Utilities
  reset: () => void;
  validateAll: () => boolean;
  getPayload: () => FieldAnswers;
}

export function useFormEngine(): UseFormEngineReturn {
  const store = useFormEngineStore();

  const submit = useCallback(async (opts: {
    manifestId?: string;
    formId?: string;
    draft?: boolean;
    context?: FormContext;
  } = {}): Promise<FormSubmissionResponse | null> => {
    const {
      answers, formId, manifest,
      validateAllFields, setSubmitting, setSubmitted, getSubmitPayload
    } = useFormEngineStore.getState();

    const fid = opts.formId ?? formId;
    const mid = opts.manifestId ?? manifest?.manifest_id;

    if (!fid) return null;

    if (!opts.draft && !validateAllFields()) return null;

    setSubmitting(true);
    try {
      const payload = opts.draft ? answers : getSubmitPayload();
      const response = await api.submit({
        form_id: fid,
        manifest_id: mid,
        answers: payload,
        draft: opts.draft,
        context: opts.context ?? useFormEngineStore.getState().context,
      });

      if (!opts.draft && response.status === "accepted") {
        setSubmitted(true);
      }

      return response;
    } catch (err) {
      console.error("[useFormEngine] submit error:", err);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return {
    answers: store.answers,
    errors: store.errors,
    currentPageIndex: store.currentPageIndex,
    submitting: store.submitting,
    submitted: store.submitted,

    setAnswer: store.setAnswer,
    touchField: store.touchField,
    getFieldError: store.getFieldError,

    nextPage: store.nextPage,
    prevPage: store.prevPage,
    goToPage: store.goToPage,

    submit,
    reset: store.reset,
    validateAll: store.validateAllFields,
    getPayload: store.getSubmitPayload,
  };
}

/**
 * Initialize the form engine for a given manifest + formId.
 * Call this once per form mount.
 */
export function useFormEngineInit(
  manifest: FormManifest | null,
  formId: string | null,
  options?: { initialAnswers?: FieldAnswers; context?: FormContext }
) {
  const init = useFormEngineStore(s => s.init);

  // Call init reactively when manifest/formId changes
  if (manifest && formId) {
    // Note: in a real app you'd put this inside a useEffect in the component
    // This is provided for convenience; see FormEngine/index.tsx for the pattern.
    void (() => init(manifest, formId, options?.initialAnswers, options?.context))();
  }

  return useFormEngineStore();
}
