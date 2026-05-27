"""
Tests for the server-side condition evaluator.

The most important cases are the SECURITY tests at the bottom: the evaluator
must NEVER execute arbitrary code (it replaced a raw eval()).
"""
import pytest

from backend.services.condition_evaluator import (
    _eval_expression, evaluate_condition,
)


# ─── Expression evaluation ──────────────────────────────────────────────────
@pytest.mark.parametrize("expr,fields,ctx,expected", [
    ("fields.employment_status == 'employed'", {"employment_status": "employed"}, None, True),
    ("fields.employment_status == 'employed'", {"employment_status": "no"}, None, False),
    ("fields.has_dependents == true",          {"has_dependents": True}, None, True),   # JS literal
    ("fields.has_dependents == true",          {"has_dependents": False}, None, False),
    ("fields.nationality != 'IN'",             {"nationality": "US"}, None, True),
    ("fields.quantity * fields.price > 1000",  {"quantity": 3, "price": 500}, None, True),
    ("fields.quantity * fields.price > 1000",  {"quantity": 1, "price": 5}, None, False),
    ("fields.age >= 18 and fields.country in ['IN','SG']", {"age": 20, "country": "SG"}, None, True),
    ("fields.age >= 18 and fields.country in ['IN','SG']", {"age": 16, "country": "SG"}, None, False),
    ("context.mode == 'signup'",               {}, {"mode": "signup"}, True),
    ("fields.missing > 5",                     {}, None, False),   # None > 5 must not crash
    ("not fields.flag",                        {"flag": False}, None, True),
])
def test_expression_eval(expr, fields, ctx, expected):
    assert _eval_expression(expr, fields, ctx) is expected


# ─── Simple / composite conditions (dict form) ─────────────────────────────
def test_simple_condition_ops():
    f = {"role": "admin", "score": 7, "name": "abc", "tags": ["x", "y"]}
    assert evaluate_condition({"field": "role", "op": "eq", "value": "admin"}, f)
    assert evaluate_condition({"field": "role", "op": "neq", "value": "user"}, f)
    assert evaluate_condition({"field": "score", "op": "gte", "value": 5}, f)
    assert not evaluate_condition({"field": "score", "op": "lt", "value": 5}, f)
    assert evaluate_condition({"field": "name", "op": "starts_with", "value": "ab"}, f)
    assert evaluate_condition({"field": "name", "op": "ends_with", "value": "bc"}, f)   # newly implemented op
    assert evaluate_condition({"field": "tags", "op": "contains", "value": "x"}, f)


def test_composite_conditions():
    f = {"a": 1, "b": 2}
    assert evaluate_condition({"all": [
        {"field": "a", "op": "eq", "value": 1},
        {"field": "b", "op": "eq", "value": 2},
    ]}, f)
    assert evaluate_condition({"any": [
        {"field": "a", "op": "eq", "value": 99},
        {"field": "b", "op": "eq", "value": 2},
    ]}, f)
    assert evaluate_condition({"not": {"field": "a", "op": "eq", "value": 99}}, f)


def test_none_condition_is_true():
    assert evaluate_condition(None, {}) is True


# ─── SECURITY: the evaluator must not execute code ──────────────────────────
@pytest.mark.parametrize("payload", [
    "().__class__.__bases__[0].__subclasses__()",
    "__import__('os').system('touch /tmp/pwned_by_form_engine')",
    "fields.__class__.__mro__",
    "open('/etc/passwd').read()",
    "[c for c in ().__class__.__base__.__subclasses__()]",
])
def test_no_code_execution(payload, tmp_path):
    # Must return False (never raise, never execute) for hostile expressions.
    result = _eval_expression(payload, {}, None)
    assert result is False


def test_sandbox_escape_does_not_touch_filesystem():
    import os
    marker = "/tmp/pwned_by_form_engine"
    if os.path.exists(marker):
        os.remove(marker)
    _eval_expression("__import__('os').system('touch %s')" % marker, {}, None)
    assert not os.path.exists(marker), "evaluator executed an OS command!"
