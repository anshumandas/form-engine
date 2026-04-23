"""
Submissions router — handles form submissions, drafts, and validation.
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any, Optional
import uuid, datetime

from ..models.form_schema import FormSubmission, FormSubmissionResponse, ValidationRule
from ..services.condition_evaluator import evaluate_condition, filter_visible_fields
from .forms import _manifests

router = APIRouter(prefix="/api/submissions", tags=["submissions"])

# In-memory submission store
_submissions: Dict[str, Dict[str, Any]] = {}
_drafts: Dict[str, Dict[str, Any]] = {}  # keyed by "{manifest_id}:{form_id}:{draft_key}"


def _validate_field(field: Dict[str, Any], value: Any, answers: Dict[str, Any]) -> List[str]:
    """Run server-side validation on a single field value."""
    errors: List[str] = []

    required = field.get("required", False)
    field_type = field.get("type")

    # Required check
    is_empty = value is None or value == "" or value == [] or value == {}
    if required and is_empty:
        errors.append(field.get("validation_message") or f"{field.get('label', field.get('id'))} is required")
        return errors  # No point checking further if empty

    if is_empty:
        return errors

    # Type-specific validation
    if field_type == "text":
        if "min_length" in field and len(str(value)) < field["min_length"]:
            errors.append(f"Minimum {field['min_length']} characters required")
        if "max_length" in field and len(str(value)) > field["max_length"]:
            errors.append(f"Maximum {field['max_length']} characters allowed")
        if "pattern" in field:
            import re
            if not re.match(field["pattern"], str(value)):
                errors.append(field.get("pattern_message") or "Invalid format")

    elif field_type == "number":
        try:
            num = float(value)
            if "min" in field and num < field["min"]:
                errors.append(f"Minimum value is {field['min']}")
            if "max" in field and num > field["max"]:
                errors.append(f"Maximum value is {field['max']}")
            if not field.get("signed", True) and num < 0:
                errors.append("Negative values are not allowed")
        except (TypeError, ValueError):
            errors.append("Must be a valid number")

    elif field_type == "multiselect":
        if isinstance(value, list):
            n = len(value)
            if "min_selected" in field and n < field["min_selected"]:
                errors.append(f"Select at least {field['min_selected']} options")
            if "max_selected" in field and n > field["max_selected"]:
                errors.append(f"Select at most {field['max_selected']} options")

    elif field_type in ("date", "datetime"):
        pass  # Date validation would need date parsing

    # Generic validation rules
    validation = field.get("validation", {}) or {}
    for rule in validation.get("rules", []):
        rule_type = rule.get("type")
        rule_value = rule.get("value")
        msg = rule.get("message")

        if rule_type == "required" and is_empty:
            errors.append(msg or "This field is required")
        elif rule_type == "min_length" and len(str(value)) < int(rule_value or 0):
            errors.append(msg or f"Minimum {rule_value} characters")
        elif rule_type == "max_length" and len(str(value)) > int(rule_value or 0):
            errors.append(msg or f"Maximum {rule_value} characters")
        elif rule_type == "regex":
            import re
            if not re.match(str(rule_value), str(value)):
                errors.append(msg or "Invalid format")
        elif rule_type == "min" and float(value) < float(rule_value or 0):
            errors.append(msg or f"Minimum value: {rule_value}")
        elif rule_type == "max" and float(value) > float(rule_value or 0):
            errors.append(msg or f"Maximum value: {rule_value}")

    return errors


def _validate_submission(
    manifest_dict: Dict[str, Any],
    form_id: str,
    answers: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, List[str]]:
    """Validate a full form submission. Returns dict of field_id → [errors]."""
    all_errors: Dict[str, List[str]] = {}
    form_dict = (manifest_dict.get("forms") or {}).get(form_id)
    if not form_dict:
        return all_errors

    named_conditions = manifest_dict.get("conditions") or {}

    def process_sections(sections):
        for section in (sections or []):
            # Skip hidden sections
            if section.get("condition"):
                if not evaluate_condition(section["condition"], answers, named_conditions, context):
                    continue
            for field in (section.get("fields") or []):
                # Skip hidden fields
                if field.get("condition"):
                    if not evaluate_condition(field["condition"], answers, named_conditions, context):
                        continue
                if field.get("ui_only") or field.get("system_generated"):
                    continue
                field_errors = _validate_field(field, answers.get(field["id"]), answers)
                if field_errors:
                    all_errors[field["id"]] = field_errors

    if form_dict.get("pages"):
        for page in form_dict["pages"]:
            if page.get("condition"):
                if not evaluate_condition(page["condition"], answers, named_conditions, context):
                    continue
            process_sections(page.get("sections") or [])
    elif form_dict.get("sections"):
        process_sections(form_dict["sections"])

    return all_errors


@router.post("/", response_model=FormSubmissionResponse, status_code=201)
async def submit_form(submission: FormSubmission):
    """Submit a form. Validates all visible fields and persists the result."""
    manifest_id = submission.manifest_id or list(_manifests.keys())[0] if _manifests else None
    if not manifest_id or manifest_id not in _manifests:
        raise HTTPException(status_code=404, detail="Manifest not found")

    manifest_dict = _manifests[manifest_id]
    forms = manifest_dict.get("forms") or {}
    if submission.form_id not in forms:
        raise HTTPException(status_code=404, detail=f"Form '{submission.form_id}' not found")

    if submission.draft:
        draft_key = f"{manifest_id}:{submission.form_id}"
        _drafts[draft_key] = {
            "answers": submission.answers,
            "saved_at": datetime.datetime.utcnow().isoformat(),
            "context": submission.context,
        }
        return FormSubmissionResponse(
            submission_id=str(uuid.uuid4()),
            form_id=submission.form_id,
            status="draft_saved",
            message="Draft saved successfully",
        )

    # Validate
    errors = _validate_submission(
        manifest_dict, submission.form_id, submission.answers, submission.context
    )
    if errors:
        return FormSubmissionResponse(
            submission_id="",
            form_id=submission.form_id,
            status="rejected",
            errors=errors,
        )

    # Persist
    submission_id = str(uuid.uuid4())
    _submissions[submission_id] = {
        "submission_id": submission_id,
        "manifest_id": manifest_id,
        "form_id": submission.form_id,
        "answers": submission.answers,
        "context": submission.context,
        "submitted_at": datetime.datetime.utcnow().isoformat(),
    }

    return FormSubmissionResponse(
        submission_id=submission_id,
        form_id=submission.form_id,
        status="accepted",
        message=forms[submission.form_id].get("on_submit", {}).get(
            "success_message", "Form submitted successfully!"
        ),
    )


@router.get("/")
async def list_submissions(form_id: Optional[str] = None, manifest_id: Optional[str] = None):
    """List all submissions, optionally filtered by form_id or manifest_id."""
    subs = list(_submissions.values())
    if form_id:
        subs = [s for s in subs if s["form_id"] == form_id]
    if manifest_id:
        subs = [s for s in subs if s.get("manifest_id") == manifest_id]
    return subs


@router.get("/{submission_id}")
async def get_submission(submission_id: str):
    if submission_id not in _submissions:
        raise HTTPException(status_code=404, detail="Submission not found")
    return _submissions[submission_id]


@router.get("/drafts/{manifest_id}/{form_id}")
async def get_draft(manifest_id: str, form_id: str):
    key = f"{manifest_id}:{form_id}"
    if key not in _drafts:
        raise HTTPException(status_code=404, detail="No draft found")
    return _drafts[key]


@router.delete("/drafts/{manifest_id}/{form_id}", status_code=204)
async def delete_draft(manifest_id: str, form_id: str):
    key = f"{manifest_id}:{form_id}"
    _drafts.pop(key, None)
