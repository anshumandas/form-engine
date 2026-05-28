"""
Few-shot exemplar pack for local LLMs.

A frontier model like Claude already knows the Form Engine schema after one
paragraph of guidance. A 7B local model does not. This module builds an
in-context exemplar block that gives the local model concrete patterns to
imitate — distilled from backend/sample_forms/*.yaml plus a hand-written
schema reference.

The pack is appended to whatever `system` prompt the caller already built
upstream (in the frontend) so existing per-mode behaviour is preserved.
"""
from __future__ import annotations
import pathlib
from functools import lru_cache
from typing import Literal

ChatMode = Literal["help", "fill", "create"]

# Smallest first — favours these for `create` exemplars to keep tokens low.
_EXEMPLAR_PREFERENCE = [
    "auth_forms.yaml",
    "product_forms.yaml",
    "job_application.yaml",
]

_SCHEMA_REFERENCE = """\
=== FORM ENGINE YAML SCHEMA — QUICK REFERENCE ===

Top-level keys (required unless noted):
  manifest_id:       snake_case identifier
  manifest_version:  "1.0.0"
  namespaces:        [core, schemata, uam, form, ui]
  engine:            {mode: reactive, evaluation_order: dependency,
                      error_mode: collect-all, debounce_ms: 200..300}
  conditions:        {name: {condition|expression|all|any: ...}}   # optional
  forms:             {form_id: <Form>}

Form shape:
  title, description, version, form_state (active|draft|archived)
  layout:        {type: single-page | wizard}
  submit_label, draft_label
  state:         {persistence: localStorage, auto_save: true, draft_key: ...}
  on_submit:     {type: none | local | rest, url?, method?, success_message?}
  sections:      [Section]      # single-page layout
  pages:         [Page]         # wizard layout — each page has sections

Section: {id, title, description?, condition?, fields: [Field]}
Page:    {id, title, icon?, sections: [Section]}

Field common keys:
  id (snake_case), type, label, required?, width? (half|full),
  default?, placeholder?, hint?, condition?, validation? or pattern?+pattern_message?

Field types:
  text       — max_length, pattern, autocomplete
  multiline  — rows, max_length
  number     — min, max, number_type (int|decimal2), prefix, display_as (stepper|slider)
  boolean    — display_as (checkbox|switch|yes-no-radio), default
  select     — required, display_as (radio|button-group|dropdown), choices.static
  multiselect— display_as (checkbox|tag-input), choices.static, allow_others
  date       — min_date, max_date  (accepts "today", "today-18y", etc.)
  time, rating, file

Choices format (note the `static:` wrapper):
  choices:
    static:
      - { value: foo, label: "Display Foo" }
      - { value: bar, label: "Display Bar" }

Conditions — three equivalent forms:
  1) Inline:     condition: { field: trip_type, op: eq, value: single }
  2) Named ref:  condition: { ref: is_single_trip }    # defined under top-level conditions:
  3) Expression: condition: { expression: "fields.x > 0 && fields.y == true" }

Condition ops: eq, neq, in, not_in, gte, gt, lte, lt, contains, is_true, is_false
Composite:     all: [...]   any: [...]   (lists of sub-conditions)

Conditions can be attached to a Section (hides whole section) OR to a Field
(hides single field). Conditions reference other field IDs by name.
"""

_DESCRIPTION_TO_YAML_TRANSCRIPT = """\
=== EXAMPLE: REQUEST → YAML ===

USER REQUEST:
  "Build me a simple newsletter signup form. Just email and a checkbox for
  marketing consent. Show a thanks message on submit."

ASSISTANT RESPONSE:
```yaml
manifest_id: newsletter_signup
manifest_version: "1.0.0"
namespaces: [core, schemata, uam, form, ui]
engine:
  mode: reactive
  evaluation_order: dependency
  error_mode: collect-all
  debounce_ms: 200
forms:
  newsletter_signup:
    title: Subscribe to our newsletter
    description: One email a month. No spam, unsubscribe any time.
    version: "1.0.0"
    form_state: active
    layout: { type: single-page }
    submit_label: Subscribe
    on_submit:
      type: none
      success_message: "🎉 Thanks for subscribing!"
    sections:
      - id: signup
        title: Your details
        fields:
          - id: email
            type: text
            label: Email address
            required: true
            placeholder: "you@example.com"
            pattern: "^[\\\\w.+-]+@[\\\\w-]+\\\\.[a-zA-Z]{2,}$"
            pattern_message: "Please enter a valid email address"
          - id: marketing_consent
            type: boolean
            label: I agree to receive monthly product updates
            required: true
            display_as: checkbox
```
Want me to add this to the live forms? Reply "load" and I'll wire it up.
"""


@lru_cache(maxsize=1)
def _sample_dir() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parent.parent / "sample_forms"


@lru_cache(maxsize=4)
def _read_exemplar(filename: str) -> str:
    path = _sample_dir() / filename
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def _full_exemplar_block() -> str:
    """One small but complete real-world manifest, verbatim, as a worked example."""
    for name in _EXEMPLAR_PREFERENCE:
        body = _read_exemplar(name)
        if body:
            return f"=== EXEMPLAR MANIFEST ({name}) ===\n```yaml\n{body}\n```\n"
    return ""


def enrich_system_prompt(base_system: str, mode: ChatMode) -> str:
    """
    Append few-shot exemplars + schema reference to the caller's system prompt.

    The base prompt (built upstream in the frontend) already tells the model
    *what to do* per mode. This adds *what the schema looks like* so a small
    local model can produce valid output.
    """
    blocks: list[str] = [base_system, _SCHEMA_REFERENCE]

    if mode == "create":
        # Show one tiny synthetic request→YAML transcript first (compact),
        # then one full real-world exemplar (richer patterns).
        blocks.append(_DESCRIPTION_TO_YAML_TRANSCRIPT)
        blocks.append(_full_exemplar_block())
    elif mode == "fill":
        # `fill` mode never emits YAML; the schema reference is enough so the
        # model recognises field-type/condition vocabulary in the form it sees.
        pass
    elif mode == "help":
        # Help mode benefits from one real exemplar so the model can quote
        # back accurate snippets when users ask "how do I do X?".
        blocks.append(_full_exemplar_block())

    return "\n\n".join(b for b in blocks if b).strip()
