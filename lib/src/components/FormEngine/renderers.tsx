"use client";

import React, { useEffect } from "react";
import type { FormManifest, FormDef, FormField, FieldAnswers, FormContext } from "../../libs/types";
import { useFormEngineStore } from "../../store/form-engine-store";
import {
  TextFieldRenderer, MultilineFieldRenderer, BooleanFieldRenderer,
  NumberFieldRenderer, SelectFieldRenderer, MultiselectFieldRenderer,
  DateFieldRenderer, RatingFieldRenderer, FileFieldRenderer, ColorFieldRenderer,
  FieldWrapper
} from "./fields/FieldRenderers";
import { WizardLayout } from "./layouts/WizardLayout";
import { SinglePageLayout } from "./layouts/SinglePageLayout";

interface FormEngineProps {
  manifest: FormManifest;
  formId: string;
  initialAnswers?: FieldAnswers;
  context?: FormContext;
  /**
   * Called after the form is validated and the user submits.
   * The library passes the filtered payload — send it to your backend here.
   * Throw an Error to surface a message to the user.
   */
  onSubmit?: (payload: FieldAnswers) => Promise<void> | void;
  /**
   * Called when the user saves a draft.
   * Persisting the draft is entirely the app's responsibility.
   */
  onDraftSave?: (answers: FieldAnswers) => Promise<void> | void;
  readOnly?: boolean;
}

export function FormEngine({
  manifest, formId, initialAnswers, context, onSubmit, onDraftSave, readOnly
}: FormEngineProps) {
  const { init, form, submitted } = useFormEngineStore();

  // Holds the last submit error so the form can display it in-place.
  // We deliberately do NOT throw — throwing bypasses this component and
  // surfaces in the Next.js dev overlay (or swallows silently in prod).
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  useEffect(() => {
    init(manifest, formId, initialAnswers, context);
    // initialAnswers is intentionally excluded from the dep array:
    // re-initialising on every parent render would reset in-progress answers.
    // If callers need to change initialAnswers, they should also change formId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest?.manifest_id, formId]);

  // Clear the error banner whenever the user switches form
  useEffect(() => { setSubmitError(null); }, [formId]);

  if (!form) return (
    <div className="flex items-center justify-center p-12 text-gray-400">
      Form "{formId}" not found in manifest.
    </div>
  );

  // Only show success when there is NO submit error.
  // If onSubmit threw, `submitted` may have been set by the store already,
  // so we gate on submitError being null as well.
  if (submitted && !submitError) {
    const msg = form.on_submit?.success_message ?? "Form submitted successfully!";
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{msg}</h2>
        <button onClick={() => useFormEngineStore.getState().reset()}
          className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">
          Submit Another Response
        </button>
      </div>
    );
  }

  /**
   * Wraps the caller's onSubmit so that:
   *  • A thrown Error is caught, stored in state, and re-thrown so the layout
   *    knows not to advance / mark submitted.
   *  • On success the error banner is cleared.
   *
   * Re-throwing is intentional: the layouts use the rejection to avoid calling
   * the store's markSubmitted action. We only suppress it from reaching
   * Next.js's global handler — the layouts' own try/catch handles it locally.
   */
  const wrappedOnSubmit = onSubmit
    ? async (payload: FieldAnswers) => {
        setSubmitError(null);
        try {
          await onSubmit(payload);
          // success — banner stays clear, success screen will render
        } catch (err: unknown) {
          const msg =
            err instanceof Error
              ? err.message
              : typeof err === "string"
              ? err
              : "Submission failed. Please try again.";
          setSubmitError(msg);
          // No re-throw needed: the `submitted && !submitError` gate above
          // blocks the success screen even if the layout calls markSubmitted().
          // Both setSubmitError and the store update are queued before the next
          // render, so React sees them together and the gate holds.
        }
      }
    : undefined;

  const errorBanner = submitError ? (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
      style={{
        background: "rgba(239,68,68,.07)",
        border: "1px solid rgba(239,68,68,.22)",
        color: "#dc2626",
      }}
    >
      <span className="flex-shrink-0 mt-0.5">⚠️</span>
      <span className="font-medium leading-snug">{submitError}</span>
    </div>
  ) : null;

  if (form.layout.type === "wizard" && form.pages?.length) {
    return (
      <>
        {errorBanner}
        <WizardLayout manifest={manifest} form={form} formId={formId}
          onSubmit={wrappedOnSubmit} onDraftSave={onDraftSave} readOnly={readOnly} />
      </>
    );
  }

  return (
    <>
      {errorBanner}
      <SinglePageLayout manifest={manifest} form={form} formId={formId}
        onSubmit={wrappedOnSubmit} onDraftSave={onDraftSave} readOnly={readOnly} />
    </>
  );
}

// ─── Universal Field Router ───────────────────────────────────────────────────
interface FieldRouterProps {
  field: FormField;
  disabled?: boolean;
}

export function FieldRouter({ field, disabled }: FieldRouterProps) {
  const { answers, setAnswer, touchField, getFieldError, getComputedValue } = useFormEngineStore();

  const value = field.computed ? getComputedValue(field.id) : answers[field.id];
  const errors = getFieldError(field.id);
  const isDisabled = disabled || field.disabled ||
    field.editability === "Immutable" ||
    field.editability === "Generated" ||
    field.system_generated;
  const isReadOnly = field.readonly ||
    field.editability === "MutableIfNull" && value != null;

  const handleChange = (val: unknown) => {
    setAnswer(field.id, val);
  };

  const handleBlur = () => touchField(field.id);

  const type = (field as unknown as Record<string, unknown>).type as string;

  // Computed field display
  if (field.computed) {
    return (
      <FieldWrapper label={field.label} hint={field.hint} description={field.description} width={field.width}>
        <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-800/60 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
          {value != null ? String(value) : <span className="text-gray-400 italic">Computing...</span>}
          <span className="ml-2 text-xs text-gray-400">auto-calculated</span>
        </div>
      </FieldWrapper>
    );
  }

  const props = { field, value, onChange: handleChange, onBlur: handleBlur, errors, disabled: isDisabled };

  switch (type) {
    case "text":         return <TextFieldRenderer {...props} field={field as any} />;
    case "multiline":    return <MultilineFieldRenderer {...props} field={field as any} />;
    case "boolean":      return <BooleanFieldRenderer {...props} field={field as any} />;
    case "number":       return <NumberFieldRenderer {...props} field={field as any} />;
    case "select":       return <SelectFieldRenderer {...props} field={field as any} />;
    case "multiselect":  return <MultiselectFieldRenderer {...props} field={field as any} />;
    case "date":         return <DateFieldRenderer {...props} field={field as any} />;
    case "datetime":     return <DateFieldRenderer {...props} field={field as any} />;
    case "daterange":    return <DateFieldRenderer {...props} field={field as any} />;
    case "rating":       return <RatingFieldRenderer {...props} field={field as any} />;
    case "file":         return <FileFieldRenderer {...props} field={field as any} />;
    case "color":        return <ColorFieldRenderer {...props} field={field as any} />;
    case "hidden":       return null;
    case "richtext":
      return <MultilineFieldRenderer {...props} field={{ ...field, type: "multiline" } as any} />;
    case "time":
      return (
        <FieldWrapper label={field.label} required={field.required} hint={field.hint}
          description={field.description} errors={errors} width={field.width}>
          <input
            type="time"
            value={String(value ?? "")}
            onChange={e => handleChange(e.target.value || null)}
            onBlur={handleBlur}
            disabled={isDisabled}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </FieldWrapper>
      );
    case "json":
      return (
        <FieldWrapper label={field.label} required={field.required} hint={field.hint}
          description={field.description} errors={errors} width={field.width}>
          <textarea
            value={typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2)}
            onChange={e => {
              try { handleChange(JSON.parse(e.target.value)); }
              catch { handleChange(e.target.value); }
            }}
            onBlur={handleBlur}
            rows={(field as any).rows ?? 8}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="{}"
          />
        </FieldWrapper>
      );
    default:
      return (
        <FieldWrapper label={field.label} width={field.width}>
          <div className="text-sm text-gray-400 italic">Unsupported field type: {type}</div>
        </FieldWrapper>
      );
  }
}
