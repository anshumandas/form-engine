"""
Server-side condition evaluator for form visibility, branching, and cross-field validation.
Mirrors the client-side evaluator in the Next.js frontend.

Expression evaluation is AST-based and does NOT use eval()/exec() (see _eval_node).
"""
from typing import Any, Dict, Optional
from ..models.form_schema import (
    ConditionOrRef, SimpleCondition, CompositeCondition,
    ExpressionCondition, ConditionRef, NamedCondition
)
import ast
import operator


def _get_field_value(fields: Dict[str, Any], field_id: str) -> Any:
    """Resolve dot-notation paths from field answers."""
    parts = field_id.split(".")
    current: Any = fields
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
    if op == "ends_with":  return str(field_val or "").endswith(str(cmp_val or ""))
    if op == "is_empty":   return field_val is None or field_val == "" or field_val == [] or field_val == {}
    if op == "is_not_empty":return not (field_val is None or field_val == "" or field_val == [] or field_val == {})
    if op == "is_true":    return field_val is True
    if op == "is_false":   return field_val is False
    return False


# ─── Safe expression interpreter (no eval / no exec) ─────────────────────────
# Manifest expressions are attacker-controllable (any client can POST a manifest
# and then submit against it), so we MUST NOT use eval(). Removing __builtins__
# does NOT sandbox eval — attribute-chain escapes (e.g. ().__class__...) remain
# possible. Instead we parse the expression into an AST and walk only an
# explicit allow-list of node types, resolving `fields.*` / `context.*` against
# the supplied dicts.

_BIN_OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.Mod: operator.mod,
}
_CMP_OPS = {
    ast.Eq: operator.eq, ast.NotEq: operator.ne,
    ast.Lt: operator.lt, ast.LtE: operator.le,
    ast.Gt: operator.gt, ast.GtE: operator.ge,
    ast.In: lambda a, b: a in b if b is not None else False,
    ast.NotIn: lambda a, b: a not in b if b is not None else True,
}


def _eval_node(node: ast.AST, names: Dict[str, Any]) -> Any:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body, names)
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        # JS-style literals used in manifests, plus the root namespaces.
        if node.id == "true":
            return True
        if node.id == "false":
            return False
        if node.id in ("null", "undefined", "None"):
            return None
        return names.get(node.id)
    if isinstance(node, ast.Attribute):
        base = _eval_node(node.value, names)
        return base.get(node.attr) if isinstance(base, dict) else None
    if isinstance(node, ast.BoolOp):
        if isinstance(node.op, ast.And):
            result: Any = True
            for v in node.values:
                result = _eval_node(v, names)
                if not result:
                    return result
            return result
        if isinstance(node.op, ast.Or):
            result = False
            for v in node.values:
                result = _eval_node(v, names)
                if result:
                    return result
            return result
        raise ValueError("unsupported boolean operator")
    if isinstance(node, ast.UnaryOp):
        operand = _eval_node(node.operand, names)
        if isinstance(node.op, ast.Not):
            return not operand
        if isinstance(node.op, ast.USub):
            return -operand
        if isinstance(node.op, ast.UAdd):
            return +operand
        raise ValueError("unsupported unary operator")
    if isinstance(node, ast.BinOp):
        op = _BIN_OPS.get(type(node.op))
        if op is None:
            raise ValueError("unsupported binary operator")
        return op(_eval_node(node.left, names), _eval_node(node.right, names))
    if isinstance(node, ast.Compare):
        left = _eval_node(node.left, names)
        for cmp_op, comparator in zip(node.ops, node.comparators):
            fn = _CMP_OPS.get(type(cmp_op))
            if fn is None:
                raise ValueError("unsupported comparison operator")
            right = _eval_node(comparator, names)
            try:
                if not fn(left, right):
                    return False
            except TypeError:
                return False
            left = right
        return True
    if isinstance(node, ast.IfExp):  # ternary: a if cond else b
        return _eval_node(node.body, names) if _eval_node(node.test, names) \
            else _eval_node(node.orelse, names)
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return [_eval_node(e, names) for e in node.elts]
    raise ValueError(f"unsupported expression node: {type(node).__name__}")


def _eval_expression(expression: str, fields: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> bool:
    """
    Safe expression evaluator (no eval/exec).
    Supports: fields.field_id, context.key, == != > < >= <=, in/not in,
    and/or/not, + - * / %, ternary (a if cond else b), and literals.
    """
    try:
        tree = ast.parse(expression, mode="eval")
        names = {"fields": fields or {}, "context": context or {}}
        return bool(_eval_node(tree, names))
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
