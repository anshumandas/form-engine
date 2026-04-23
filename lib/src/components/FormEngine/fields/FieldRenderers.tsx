"use client";

import React from "react";
import type {
  FormField, TextField, MultilineField, BooleanField, NumberField,
  SelectField, MultiselectField, DateField, RatingField, FileField,
  StaticChoice,
} from "../../../libs/types";
import { cn } from "../../../libs/utils";

// ─── Shared Field Wrapper ─────────────────────────────────────────────────────
interface FieldWrapperProps {
  label?: string;
  required?: boolean;
  hint?: string;
  description?: string;
  errors?: string[];
  children: React.ReactNode;
  width?: "full" | "half" | "third";
  className?: string;
}

export function FieldWrapper({
  label, required, hint, description, errors, children, width = "full", className
}: FieldWrapperProps) {
  return (
    <div className={cn(
      "flex flex-col gap-1.5",
      width === "half" && "col-span-1",
      width === "third" && "col-span-1",
      className
    )}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {description && <p className="text-xs text-gray-500">{description}</p>}
      {children}
      {hint && !errors?.length && <p className="text-xs text-gray-400">{hint}</p>}
      {errors?.map((e, i) => (
        <p key={i} className="text-xs text-red-500 flex items-center gap-1">
          <span>⚠</span> {e}
        </p>
      ))}
    </div>
  );
}

// ─── Text Field ───────────────────────────────────────────────────────────────
interface FieldProps<T extends FormField> {
  field: T;
  value: unknown;
  onChange: (val: unknown) => void;
  onBlur?: () => void;
  errors?: string[];
  disabled?: boolean;
}

export function TextFieldRenderer({ field, value, onChange, onBlur, errors, disabled }: FieldProps<TextField>) {
  const f = field as TextField;
  return (
    <FieldWrapper label={f.label} required={f.required} hint={f.hint}
      description={f.description} errors={errors} width={f.width}>
      <input
        type="text"
        value={String(value ?? "")}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={f.placeholder}
        autoComplete={f.autocomplete}
        disabled={disabled || f.disabled}
        readOnly={f.readonly}
        maxLength={f.max_length}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
          "border-gray-300 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
          "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          errors?.length && "border-red-400 focus:border-red-500 focus:ring-red-500/20"
        )}
      />
    </FieldWrapper>
  );
}

// ─── Multiline Field ──────────────────────────────────────────────────────────
export function MultilineFieldRenderer({ field, value, onChange, onBlur, errors, disabled }: FieldProps<MultilineField>) {
  const f = field as MultilineField;
  const current = String(value ?? "");
  return (
    <FieldWrapper label={f.label} required={f.required} hint={f.hint}
      description={f.description} errors={errors} width={f.width}>
      <div className="relative">
        <textarea
          value={current}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={f.placeholder}
          disabled={disabled || f.disabled}
          readOnly={f.readonly}
          rows={f.rows ?? 4}
          maxLength={f.max_length}
          style={{ resize: f.resize === "none" ? "none" : f.resize === "both" ? "both" : "vertical" }}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
            "border-gray-300 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
            "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
            errors?.length && "border-red-400"
          )}
        />
        {f.max_length && (
          <span className="absolute bottom-2 right-3 text-xs text-gray-400">
            {current.length}/{f.max_length}
          </span>
        )}
      </div>
    </FieldWrapper>
  );
}

// ─── Boolean Field ────────────────────────────────────────────────────────────
export function BooleanFieldRenderer({ field, value, onChange, errors, disabled }: FieldProps<BooleanField>) {
  const f = field as BooleanField;
  const checked = value === true;
  const displayAs = f.display_as ?? "switch";

  if (displayAs === "yes-no-radio") {
    return (
      <FieldWrapper label={f.label} required={f.required} hint={f.hint}
        description={f.description} errors={errors} width={f.width}>
        <div className="flex gap-4">
          {[true, false].map((v) => (
            <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={value === v}
                onChange={() => onChange(v)}
                disabled={disabled || f.disabled}
                className="accent-blue-600"
              />
              <span className="text-sm">{v ? (f.true_label ?? "Yes") : (f.false_label ?? "No")}</span>
            </label>
          ))}
        </div>
      </FieldWrapper>
    );
  }

  if (displayAs === "checkbox") {
    return (
      <FieldWrapper hint={f.hint} description={f.description} errors={errors} width={f.width}>
        <label className={cn(
          "flex items-start gap-3 cursor-pointer",
          (disabled || f.disabled) && "opacity-50 cursor-not-allowed"
        )}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => onChange(e.target.checked)}
            disabled={disabled || f.disabled}
            className="mt-0.5 h-4 w-4 rounded accent-blue-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {f.label}{f.required && <span className="text-red-500 ml-1">*</span>}
          </span>
        </label>
      </FieldWrapper>
    );
  }

  // Switch
  return (
    <FieldWrapper hint={f.hint} description={f.description} errors={errors} width={f.width}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {f.label}{f.required && <span className="text-red-500 ml-1">*</span>}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => !disabled && !f.disabled && onChange(!checked)}
          disabled={disabled || f.disabled}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40",
            checked ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600",
            (disabled || f.disabled) && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
            checked ? "translate-x-6" : "translate-x-1"
          )} />
        </button>
      </div>
    </FieldWrapper>
  );
}

// ─── Number Field ─────────────────────────────────────────────────────────────
export function NumberFieldRenderer({ field, value, onChange, onBlur, errors, disabled }: FieldProps<NumberField>) {
  const f = field as NumberField;
  const displayAs = f.display_as ?? "input";

  if (displayAs === "slider") {
    const min = f.min ?? 0;
    const max = f.max ?? 100;
    const val = Number(value ?? min);
    return (
      <FieldWrapper label={f.label} required={f.required} hint={f.hint}
        description={f.description} errors={errors} width={f.width}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={min} max={max} step={f.step ?? 1}
            value={val}
            onChange={e => onChange(Number(e.target.value))}
            disabled={disabled || f.disabled}
            className="flex-1 accent-blue-600"
          />
          <span className="text-sm font-medium w-12 text-center">
            {f.prefix}{val}{f.suffix}
          </span>
        </div>
      </FieldWrapper>
    );
  }

  if (displayAs === "stepper") {
    const val = Number(value ?? 0);
    const step = f.step ?? 1;
    return (
      <FieldWrapper label={f.label} required={f.required} hint={f.hint}
        description={f.description} errors={errors} width={f.width}>
        <div className="flex items-center gap-2">
          {f.prefix && <span className="text-sm text-gray-500">{f.prefix}</span>}
          <button type="button" onClick={() => onChange(val - step)}
            disabled={disabled || (f.min != null && val <= f.min)}
            className="h-8 w-8 rounded-full border border-gray-300 text-lg font-bold hover:bg-gray-50 disabled:opacity-40">
            −
          </button>
          <span className="w-16 text-center font-medium">{val}</span>
          <button type="button" onClick={() => onChange(val + step)}
            disabled={disabled || (f.max != null && val >= f.max)}
            className="h-8 w-8 rounded-full border border-gray-300 text-lg font-bold hover:bg-gray-50 disabled:opacity-40">
            +
          </button>
          {f.suffix && <span className="text-sm text-gray-500">{f.suffix}</span>}
        </div>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper label={f.label} required={f.required} hint={f.hint}
      description={f.description} errors={errors} width={f.width}>
      <div className="relative flex items-center">
        {f.prefix && (
          <span className="absolute left-3 text-sm text-gray-500 pointer-events-none">{f.prefix}</span>
        )}
        <input
          type="number"
          value={value == null ? "" : String(value)}
          onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
          onBlur={onBlur}
          min={f.min} max={f.max} step={f.step ?? 1}
          placeholder={f.placeholder}
          disabled={disabled || f.disabled}
          readOnly={f.readonly}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-sm",
            "border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
            "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
            f.prefix && "pl-8", f.suffix && "pr-10",
            errors?.length && "border-red-400"
          )}
        />
        {f.suffix && (
          <span className="absolute right-3 text-sm text-gray-500 pointer-events-none">{f.suffix}</span>
        )}
      </div>
    </FieldWrapper>
  );
}

// ─── Select Field ─────────────────────────────────────────────────────────────
function resolveChoices(choices: unknown): StaticChoice[] {
  if (!Array.isArray(choices)) return [];
  return choices as StaticChoice[];
}

export function SelectFieldRenderer({ field, value, onChange, onBlur, errors, disabled }: FieldProps<SelectField>) {
  const f = field as SelectField;
  const choices = resolveChoices(f.choices);
  const displayAs = f.display_as ?? "auto";
  const useRadio = displayAs === "radio" || (displayAs === "auto" && choices.length <= 4);

  if (displayAs === "button-group" || (displayAs === "auto" && choices.length <= 3)) {
    return (
      <FieldWrapper label={f.label} required={f.required} hint={f.hint}
        description={f.description} errors={errors} width={f.width}>
        <div className="flex flex-wrap gap-2">
          {choices.map(choice => (
            <button
              key={String(choice.value)}
              type="button"
              onClick={() => onChange(value === choice.value ? null : choice.value)}
              disabled={disabled || f.disabled || choice.disabled}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                value === choice.value
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                  : "bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50",
                (disabled || choice.disabled) && "opacity-40 cursor-not-allowed"
              )}
            >
              {choice.icon && <span className="mr-1">{choice.icon}</span>}
              {choice.label}
            </button>
          ))}
        </div>
      </FieldWrapper>
    );
  }

  if (useRadio) {
    return (
      <FieldWrapper label={f.label} required={f.required} hint={f.hint}
        description={f.description} errors={errors} width={f.width}>
        <div className="flex flex-col gap-2">
          {choices.map(choice => (
            <label key={String(choice.value)}
              className={cn("flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50",
                value === choice.value && "bg-blue-50 dark:bg-blue-900/20"
              )}>
              <input
                type="radio"
                checked={value === choice.value}
                onChange={() => onChange(choice.value)}
                disabled={disabled || f.disabled || choice.disabled}
                className="accent-blue-600"
              />
              <span className="text-sm">{choice.label}</span>
            </label>
          ))}
        </div>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper label={f.label} required={f.required} hint={f.hint}
      description={f.description} errors={errors} width={f.width}>
      <select
        value={String(value ?? "")}
        onChange={e => onChange(e.target.value || null)}
        onBlur={onBlur}
        disabled={disabled || f.disabled}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-sm bg-white",
          "border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
          "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
          errors?.length && "border-red-400"
        )}
      >
        <option value="">{f.placeholder ?? "— Select —"}</option>
        {choices.map(choice => (
          <option key={String(choice.value)} value={String(choice.value)} disabled={choice.disabled}>
            {choice.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

// ─── Multiselect Field ────────────────────────────────────────────────────────
export function MultiselectFieldRenderer({ field, value, onChange, errors, disabled }: FieldProps<MultiselectField>) {
  const f = field as MultiselectField;
  const choices = resolveChoices(f.choices);
  const selected: (string | number)[] = Array.isArray(value) ? (value as (string | number)[]) : [];
  const displayAs = f.display_as ?? "auto";

  const toggle = (v: string | number) => {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));
    else onChange([...selected, v]);
  };

  if (displayAs === "tag-input") {
    return (
      <FieldWrapper label={f.label} required={f.required} hint={f.hint}
        description={f.description} errors={errors} width={f.width}>
        <div className="flex flex-wrap gap-2 p-2 rounded-lg border border-gray-300 dark:border-gray-600 min-h-[42px]">
          {selected.map(v => {
            const choice = choices.find(c => c.value === v);
            return (
              <span key={String(v)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                {choice?.label ?? String(v)}
                <button type="button" onClick={() => toggle(v)}
                  className="hover:text-red-600 ml-0.5 leading-none">×</button>
              </span>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {choices.filter(c => !selected.includes(c.value as string)).map(choice => (
            <button key={String(choice.value)} type="button" onClick={() => toggle(choice.value as string)}
              disabled={disabled || f.max_selected != null && selected.length >= f.max_selected}
              className="px-2 py-0.5 text-xs rounded-full border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-40">
              + {choice.label}
            </button>
          ))}
        </div>
      </FieldWrapper>
    );
  }

  // Default: checkboxes
  return (
    <FieldWrapper label={f.label} required={f.required} hint={f.hint}
      description={f.description} errors={errors} width={f.width}>
      <div className="flex flex-col gap-2">
        {choices.map(choice => (
          <label key={String(choice.value)} className="flex items-center gap-3 cursor-pointer p-1.5 rounded hover:bg-gray-50">
            <input
              type="checkbox"
              checked={selected.includes(choice.value as string)}
              onChange={() => toggle(choice.value as string)}
              disabled={disabled || choice.disabled ||
                (!selected.includes(choice.value as string) && f.max_selected != null && selected.length >= f.max_selected)}
              className="h-4 w-4 rounded accent-blue-600"
            />
            <span className="text-sm">{choice.label}</span>
          </label>
        ))}
      </div>
    </FieldWrapper>
  );
}

// ─── Date Field ───────────────────────────────────────────────────────────────
export function DateFieldRenderer({ field, value, onChange, onBlur, errors, disabled }: FieldProps<DateField>) {
  const f = field as DateField;
  return (
    <FieldWrapper label={f.label} required={f.required} hint={f.hint}
      description={f.description} errors={errors} width={f.width}>
      <input
        type="date"
        value={String(value ?? "")}
        onChange={e => onChange(e.target.value || null)}
        onBlur={onBlur}
        min={f.min_date?.startsWith("today") ? undefined : f.min_date}
        max={f.max_date?.startsWith("today") ? undefined : f.max_date}
        disabled={disabled || f.disabled}
        readOnly={f.readonly}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-sm",
          "border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
          "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
          errors?.length && "border-red-400"
        )}
      />
    </FieldWrapper>
  );
}

// ─── Rating Field ─────────────────────────────────────────────────────────────
export function RatingFieldRenderer({ field, value, onChange, errors, disabled }: FieldProps<RatingField>) {
  const f = field as RatingField;
  const max = f.max ?? 5;
  const current = Number(value ?? 0);
  const displayAs = f.display_as ?? "stars";

  if (displayAs === "numeric-scale") {
    return (
      <FieldWrapper label={f.label} required={f.required} hint={f.hint}
        description={f.description} errors={errors} width={f.width}>
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            {Array.from({ length: max }, (_, i) => i + 1).map(n => (
              <button key={n} type="button"
                onClick={() => !disabled && onChange(n)}
                className={cn(
                  "h-9 w-9 rounded-lg border text-sm font-medium transition-all",
                  current === n
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                )}>
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>{f.low_label ?? "Poor"}</span>
            <span>{f.high_label ?? "Excellent"}</span>
          </div>
        </div>
      </FieldWrapper>
    );
  }

  const emojis = ["😢", "😕", "😐", "🙂", "😄"];
  if (displayAs === "emoji-scale") {
    return (
      <FieldWrapper label={f.label} required={f.required} hint={f.hint}
        description={f.description} errors={errors} width={f.width}>
        <div className="flex gap-2">
          {Array.from({ length: max }, (_, i) => i + 1).map(n => (
            <button key={n} type="button" onClick={() => !disabled && onChange(n)}
              className={cn(
                "text-3xl transition-all",
                current === n ? "scale-125" : "opacity-50 hover:opacity-80"
              )}>
              {emojis[Math.floor((n - 1) * emojis.length / max)]}
            </button>
          ))}
        </div>
      </FieldWrapper>
    );
  }

  // Stars
  return (
    <FieldWrapper label={f.label} required={f.required} hint={f.hint}
      description={f.description} errors={errors} width={f.width}>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button key={n} type="button" onClick={() => !disabled && onChange(n)}
            className={cn("text-2xl transition-all", disabled && "cursor-not-allowed")}>
            <span className={n <= current ? "text-yellow-400" : "text-gray-300"}>★</span>
          </button>
        ))}
      </div>
    </FieldWrapper>
  );
}

// ─── File Field ───────────────────────────────────────────────────────────────
export function FileFieldRenderer({ field, value, onChange, errors, disabled }: FieldProps<FileField>) {
  const f = field as FileField;
  const files: File[] = Array.isArray(value) ? (value as File[]) : [];

  return (
    <FieldWrapper label={f.label} required={f.required} hint={f.hint}
      description={f.description} errors={errors} width={f.width}>
      <label className={cn(
        "flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
        "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50",
        (disabled || f.disabled) && "opacity-50 cursor-not-allowed"
      )}>
        <span className="text-2xl">📎</span>
        <span className="text-sm text-gray-600">
          {files.length > 0
            ? files.map(f => f.name).join(", ")
            : `Drop files or click to upload`}
        </span>
        {f.accept && <span className="text-xs text-gray-400">{f.accept}</span>}
        {f.max_size_mb && <span className="text-xs text-gray-400">Max {f.max_size_mb}MB</span>}
        <input
          type="file"
          className="sr-only"
          accept={f.accept}
          multiple={f.max_files != null && f.max_files > 1}
          disabled={disabled || f.disabled}
          onChange={e => {
            const list = Array.from(e.target.files ?? []);
            onChange(f.max_files === 1 ? list[0] : list);
          }}
        />
      </label>
    </FieldWrapper>
  );
}

// ─── Color Field ──────────────────────────────────────────────────────────────
export function ColorFieldRenderer({ field, value, onChange, errors, disabled }: FieldProps<any>) {
  const f = field;
  return (
    <FieldWrapper label={f.label} required={f.required} hint={f.hint}
      description={f.description} errors={errors} width={f.width}>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={String(value ?? "#000000")}
          onChange={e => onChange(e.target.value)}
          disabled={disabled || f.disabled}
          className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
        />
        <span className="text-sm font-mono text-gray-600">{String(value ?? "#000000")}</span>
        {f.presets?.length > 0 && (
          <div className="flex gap-1">
            {f.presets.map((p: string) => (
              <button key={p} type="button" onClick={() => onChange(p)}
                className="h-6 w-6 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: p }} title={p} />
            ))}
          </div>
        )}
      </div>
    </FieldWrapper>
  );
}
