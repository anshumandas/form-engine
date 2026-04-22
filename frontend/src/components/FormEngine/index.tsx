"use client";

import React, { useEffect } from "react";
import type { FormManifest, FormDef, FormField, FieldAnswers, FormContext } from "@/lib/types";
import { useFormEngineStore } from "@/store/form-engine-store";
import {
  TextFieldRenderer, MultilineFieldRenderer, BooleanFieldRenderer,
  NumberFieldRenderer, SelectFieldRenderer, MultiselectFieldRenderer,
  DateFieldRenderer, RatingFieldRenderer, FileFieldRenderer, ColorFieldRenderer,
  FieldWrapper
} from "./fields/FieldRenderers";
import { WizardLayout } from "./layouts/WizardLayout";
import { SinglePageLayout } from "./layouts/SinglePageLayout";
import type { FormSubmissionResponse } from "@/lib/types";

interface FormEngineProps {
  manifest: FormManifest;
  formId: string;
  initialAnswers?: FieldAnswers;
  context?: FormContext;
  onSubmit?: (payload: FieldAnswers, response?: FormSubmissionResponse) => Promise<void> | void;
  onDraftSave?: (answers: FieldAnswers) => Promise<void> | void;
  readOnly?: boolean;
}

export function FormEngine({
  manifest, formId, initialAnswers, context, onSubmit, onDraftSave, readOnly
}: FormEngineProps) {
  const { init, form, submitted } = useFormEngineStore();

  useEffect(() => {
    init(manifest, formId, initialAnswers, context);
  }, [manifest, formId]);

  if (!form) return (
    <div className="flex items-center justify-center p-12 text-gray-400">
      Form "{formId}" not found in manifest.
    </div>
  );

  if (submitted) {
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

  if (form.layout.type === "wizard" && form.pages?.length) {
    return <WizardLayout manifest={manifest} form={form} formId={formId}
      onSubmit={onSubmit} onDraftSave={onDraftSave} readOnly={readOnly} />;
  }

  return <SinglePageLayout manifest={manifest} form={form} formId={formId}
    onSubmit={onSubmit} onDraftSave={onDraftSave} readOnly={readOnly} />;
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

  const type = (field as Record<string, unknown>).type as string;

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
