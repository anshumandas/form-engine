import type {
  ConditionOrRef,
  SimpleCondition,
  ExpressionCondition,
  CompositeCondition,
  ConditionRef,
  NamedCondition,
  FieldAnswers,
  FormContext,
} from "./types";

// ─── Type Guards ──────────────────────────────────────────────────────────────
function isSimple(c: ConditionOrRef): c is SimpleCondition {
  return "field" in c && "op" in c;
}
function isExpression(c: ConditionOrRef): c is ExpressionCondition {
  return "expression" in c && !("field" in c);
}
function isComposite(c: ConditionOrRef): c is CompositeCondition {
  return "all" in c || "any" in c || "not" in c;
}
function isRef(c: ConditionOrRef): c is ConditionRef {
  return "ref" in c;
}

// ─── Simple Condition Evaluator ───────────────────────────────────────────────
function evalSimple(cond: SimpleCondition, fields: FieldAnswers): boolean {
  const val = getNestedValue(fields, cond.field);
  const cmp = cond.value;

  switch (cond.op) {
    case "eq":         return val === cmp;
    case "neq":        return val !== cmp;
    case "gt":         return val != null && (val as number) > (cmp as number);
    case "gte":        return val != null && (val as number) >= (cmp as number);
    case "lt":         return val != null && (val as number) < (cmp as number);
    case "lte":        return val != null && (val as number) <= (cmp as number);
    case "in":         return Array.isArray(cmp) && cmp.includes(val);
    case "not_in":     return Array.isArray(cmp) && !cmp.includes(val);
    case "contains":   return typeof val === "string" && val.includes(String(cmp));
    case "starts_with":return typeof val === "string" && val.startsWith(String(cmp));
    case "is_empty":   return val == null || val === "" || (Array.isArray(val) && val.length === 0);
    case "is_not_empty":return !(val == null || val === "" || (Array.isArray(val) && val.length === 0));
    case "is_true":    return val === true;
    case "is_false":   return val === false;
    default:           return false;
  }
}

// ─── Expression Condition Evaluator ──────────────────────────────────────────
function evalExpression(
  cond: ExpressionCondition,
  fields: FieldAnswers,
  context: FormContext = {}
): boolean {
  try {
    // Build a safe scope
    const scope = {
      fields,
      context,
      today: () => new Date().toISOString().split("T")[0],
      now: () => new Date().toISOString(),
    };

    // Replace dot-notation with bracket access for safe eval
    let expr = cond.expression;

    // Use Function constructor with limited scope
    const fn = new Function(
      "fields", "context", "today", "now",
      `"use strict"; try { return !!(${expr}); } catch(e) { return false; }`
    );
    return fn(scope.fields, scope.context, scope.today, scope.now);
  } catch {
    return false;
  }
}

// ─── Main Evaluator ───────────────────────────────────────────────────────────
export function evaluateCondition(
  condition: ConditionOrRef | undefined | null,
  fields: FieldAnswers,
  namedConditions: Record<string, NamedCondition> = {},
  context: FormContext = {}
): boolean {
  if (!condition) return true;

  if (isRef(condition)) {
    const named = namedConditions[condition.ref];
    if (!named) return true;
    if (named.expression) return evalExpression({ expression: named.expression }, fields, context);
    if (named.condition) return evaluateCondition(named.condition, fields, namedConditions, context);
    return true;
  }

  if (isSimple(condition)) return evalSimple(condition, fields);
  if (isExpression(condition)) return evalExpression(condition, fields, context);

  if (isComposite(condition)) {
    if (condition.all) return condition.all.every(c => evaluateCondition(c, fields, namedConditions, context));
    if (condition.any) return condition.any.some(c => evaluateCondition(c, fields, namedConditions, context));
    if (condition.not) return !evaluateCondition(condition.not, fields, namedConditions, context);
  }

  return true;
}

// ─── Computed Field Evaluator ─────────────────────────────────────────────────
export function evaluateComputed(
  expression: string,
  fields: FieldAnswers,
  context: FormContext = {}
): unknown {
  try {
    const fn = new Function(
      "fields", "context", "today", "now",
      `"use strict"; try { return (${expression}); } catch(e) { return null; }`
    );
    return fn(
      fields,
      context,
      () => new Date().toISOString().split("T")[0],
      () => new Date().toISOString()
    );
  } catch {
    return null;
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

// ─── Validate a single field value ────────────────────────────────────────────
import type { FormField, FieldAnswers as FA } from "./types";

export function validateField(field: FormField, value: unknown, allValues: FA): string[] {
  const errors: string[] = [];
  const isEmpty = value == null || value === "" || (Array.isArray(value) && value.length === 0);

  if (field.required && isEmpty) {
    errors.push(`${field.label || field.id} is required`);
    return errors;
  }
  if (isEmpty) return errors;

  const f = field as Record<string, unknown>;

  if (f.type === "text" || f.type === "multiline") {
    const str = String(value);
    if (f.min_length != null && str.length < (f.min_length as number))
      errors.push(`Minimum ${f.min_length} characters required`);
    if (f.max_length != null && str.length > (f.max_length as number))
      errors.push(`Maximum ${f.max_length} characters allowed`);
    if (f.pattern) {
      try {
        const re = new RegExp(f.pattern as string);
        if (!re.test(str)) errors.push((f.pattern_message as string) || "Invalid format");
      } catch { /* invalid regex */ }
    }
  }

  if (f.type === "number") {
    const num = parseFloat(String(value));
    if (isNaN(num)) { errors.push("Must be a valid number"); return errors; }
    if (!f.signed && num < 0) errors.push("Negative values not allowed");
    if (f.min != null && num < (f.min as number)) errors.push(`Minimum value is ${f.min}`);
    if (f.max != null && num > (f.max as number)) errors.push(`Maximum value is ${f.max}`);
  }

  if (f.type === "multiselect" && Array.isArray(value)) {
    if (f.min_selected != null && value.length < (f.min_selected as number))
      errors.push(`Select at least ${f.min_selected} options`);
    if (f.max_selected != null && value.length > (f.max_selected as number))
      errors.push(`Select at most ${f.max_selected} options`);
  }

  // Generic validation rules
  for (const rule of (field.validation?.rules ?? [])) {
    const v = rule.value;
    const msg = rule.message;
    if (rule.type === "required" && isEmpty) errors.push(msg || "Required");
    if (rule.type === "min_length" && String(value).length < Number(v))
      errors.push(msg || `Min ${v} characters`);
    if (rule.type === "max_length" && String(value).length > Number(v))
      errors.push(msg || `Max ${v} characters`);
    if (rule.type === "regex") {
      try {
        if (!new RegExp(String(v)).test(String(value))) errors.push(msg || "Invalid format");
      } catch { /* */ }
    }
    if (rule.type === "min" && parseFloat(String(value)) < Number(v))
      errors.push(msg || `Min ${v}`);
    if (rule.type === "max" && parseFloat(String(value)) > Number(v))
      errors.push(msg || `Max ${v}`);
    if (rule.type === "expression" && rule.expression) {
      const pass = evalExpression({ expression: rule.expression }, allValues);
      if (!pass) errors.push(msg || "Validation failed");
    }
  }

  return errors;
}
