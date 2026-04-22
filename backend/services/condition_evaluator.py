"""
Server-side condition evaluator for form visibility, branching, and cross-field validation.
Mirrors the client-side evaluator in the Next.js frontend.
"""
from typing import Any, Dict, Optional
from models.form_schema import (
    ConditionOrRef, SimpleCondition, CompositeCondition,
    ExpressionCondition, ConditionRef, NamedCondition
)
import re


def _get_field_value(fields: Dict[str, Any], field_id: str) -> Any:
    """Resolve dot-notation paths from field answers."""
    parts = field_id.split(".")
    current = fields
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _eval_simple(condition: SimpleCondition, fields: Dict[str, Any]) -> bool:
    field_val = _get_field_value(fields, condition.field)
    op = condition.op
    cmp_val = condition.value

    if op == "eq":         return field_val == cmp_val
    if op == "neq":        return field_val != cmp_val
    if op == "gt":         return field_val is not None and field_val > cmp_val
    if op == "gte":        return field_val is not None and field_val >= cmp_val
    if op == "lt":         return field_val is not None and field_val < cmp_val
    if op == "lte":        return field_val is not None and field_val <= cmp_val
    if op == "in":         return field_val in (cmp_val or [])
    if op == "not_in":     return field_val not in (cmp_val or [])
    if op == "contains":   return cmp_val in (field_val or "")
    if op == "starts_with":return str(field_val or "").startswith(str(cmp_val or ""))
    if op == "is_empty":   return field_val is None or field_val == "" or field_val == [] or field_val == {}
    if op == "is_not_empty":return not (field_val is None or field_val == "" or field_val == [] or field_val == {})
    if op == "is_true":    return field_val is True
    if op == "is_false":   return field_val is False
    return False


def _eval_expression(expression: str, fields: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> bool:
    """
    Very simple safe expression evaluator.
    Supports: fields.field_id, context.key, ==, !=, >, <, >=, <=, and, or, not
    """
    try:
        # Replace fields.x references with actual values
        def replace_field(match):
            path = match.group(1)
            val = _get_field_value(fields, path)
            if val is None:
                return "None"
            if isinstance(val, str):
                return repr(val)
            if isinstance(val, bool):
                return str(val)
            return str(val)

        def replace_context(match):
            key = match.group(1)
            ctx = context or {}
            val = ctx.get(key)
            if val is None:
                return "None"
            if isinstance(val, str):
                return repr(val)
            return str(val)

        expr = re.sub(r'fields\.([a-zA-Z_][a-zA-Z0-9_.]*)', replace_field, expression)
        expr = re.sub(r'context\.([a-zA-Z_][a-zA-Z0-9_.]*)', replace_context, expr)

        # Safely evaluate
        result = eval(expr, {"__builtins__": {}}, {})
        return bool(result)
    except Exception:
        return False


def evaluate_condition(
    condition: Any,
    fields: Dict[str, Any],
    named_conditions: Optional[Dict[str, NamedCondition]] = None,
    context: Optional[Dict[str, Any]] = None
) -> bool:
    """Recursively evaluate a ConditionOrRef against the current field answers."""
    if condition is None:
        return True

    if isinstance(condition, dict):
        # Handle raw dict conditions (when parsed from JSON directly)
        if "ref" in condition:
            ref_name = condition["ref"]
            if named_conditions and ref_name in named_conditions:
                nc = named_conditions[ref_name]
                if nc.expression:
                    return _eval_expression(nc.expression, fields, context)
                if nc.condition:
                    return evaluate_condition(nc.condition, fields, named_conditions, context)
            return True
        if "field" in condition and "op" in condition:
            return _eval_simple(SimpleCondition(**condition), fields)
        if "expression" in condition:
            return _eval_expression(condition["expression"], fields, context)
        if "all" in condition:
            return all(evaluate_condition(c, fields, named_conditions, context) for c in condition["all"])
        if "any" in condition:
            return any(evaluate_condition(c, fields, named_conditions, context) for c in condition["any"])
        if "not" in condition:
            return not evaluate_condition(condition["not"], fields, named_conditions, context)
        return True

    if isinstance(condition, ConditionRef):
        ref_name = condition.ref
        if named_conditions and ref_name in named_conditions:
            nc = named_conditions[ref_name]
            if nc.expression:
                return _eval_expression(nc.expression, fields, context)
            if nc.condition:
                return evaluate_condition(nc.condition, fields, named_conditions, context)
        return True

    if isinstance(condition, SimpleCondition):
        return _eval_simple(condition, fields)

    if isinstance(condition, ExpressionCondition):
        return _eval_expression(condition.expression, fields, context)

    if isinstance(condition, CompositeCondition):
        if condition.all is not None:
            return all(evaluate_condition(c, fields, named_conditions, context) for c in condition.all)
        if condition.any is not None:
            return any(evaluate_condition(c, fields, named_conditions, context) for c in condition.any)
        if condition.not_ is not None:
            return not evaluate_condition(condition.not_, fields, named_conditions, context)

    return True


def filter_visible_fields(
    answers: Dict[str, Any],
    form,
    named_conditions: Optional[Dict[str, NamedCondition]] = None,
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Return only the answers for fields that are visible (condition passes)
    and not marked as ui_only. Used to clean payloads before submission.
    """
    visible: Dict[str, Any] = {}

    def process_sections(sections):
        for section in (sections or []):
            # Check section condition
            if section.condition and not evaluate_condition(
                section.condition, answers, named_conditions, context
            ):
                continue
            for field in (section.fields or []):
                if getattr(field, "ui_only", False):
                    continue
                if field.condition and not evaluate_condition(
                    field.condition, answers, named_conditions, context
                ):
                    continue
                if field.id in answers:
                    visible[field.id] = answers[field.id]

    for form_def in (form.forms or {}).values():
        if form_def.pages:
            for page in form_def.pages:
                if page.condition and not evaluate_condition(
                    page.condition, answers, named_conditions, context
                ):
                    continue
                process_sections(page.sections)
        elif form_def.sections:
            process_sections(form_def.sections)

    return visible
