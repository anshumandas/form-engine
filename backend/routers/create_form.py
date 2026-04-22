"""
/api/create-form — transforms form_creator answers into a FormManifest
and registers it via the in-memory store.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import uuid, datetime, re

from models.form_schema import FormManifest
from routers.forms import _manifests, _meta

router = APIRouter(prefix="/api", tags=["create-form"])


class CreateFormPayload(BaseModel):
    """Shape of the JSON body submitted by the form_creator form."""
    form_id:          str
    manifest_id:      str
    form_title:       str
    form_description: Optional[str] = None
    layout_type:      str = "single-page"
    submit_label:     Optional[str] = "Submit"
    draft_label:      Optional[str] = "Save Draft"
    # Fields collection
    fields_section:   Optional[List[Dict[str, Any]]] = None
    # Wizard pages collection (optional)
    pages_section:    Optional[List[Dict[str, Any]]] = None
    # Submit config
    submit_type:      str = "none"
    submit_url:       Optional[str] = None
    success_message:  Optional[str] = "Form submitted successfully!"
    error_message:    Optional[str] = "Submission failed. Please try again."


def _parse_choices(raw: Optional[str]) -> List[Dict[str, Any]]:
    """Parse 'value|Label' lines into StaticChoice dicts."""
    if not raw or not raw.strip():
        return [{"value": "option_1", "label": "Option 1"}, {"value": "option_2", "label": "Option 2"}]
    choices = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        if "|" in line:
            value, label = line.split("|", 1)
            choices.append({"value": value.strip(), "label": label.strip()})
        else:
            choices.append({"value": line.lower().replace(" ", "_"), "label": line})
    return choices if choices else [{"value": "option_1", "label": "Option 1"}]


def _build_field(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Convert a form_creator fields_section item into a field definition dict."""
    field_id   = str(item.get("field_id") or "").strip()
    field_type = str(item.get("field_type") or "text").strip()
    field_label = str(item.get("field_label") or field_id).strip()

    if not field_id or not re.match(r'^[a-z][a-z0-9_]*$', field_id):
        return None

    field: Dict[str, Any] = {
        "id":    field_id,
        "type":  field_type,
        "label": field_label,
    }

    if item.get("field_required"):
        field["required"] = True
    if item.get("field_width") and item["field_width"] != "full":
        field["width"] = item["field_width"]
    if item.get("field_placeholder"):
        field["placeholder"] = str(item["field_placeholder"])
    if item.get("field_hint"):
        field["hint"] = str(item["field_hint"])
    if item.get("field_default") not in (None, ""):
        field["default"] = item["field_default"]

    # Type-specific
    if field_type == "text":
        if item.get("field_min_length"):
            field["min_length"] = int(item["field_min_length"])
        if item.get("field_max_length"):
            field["max_length"] = int(item["field_max_length"])
        if item.get("field_pattern"):
            field["pattern"] = str(item["field_pattern"])
            if item.get("field_pattern_message"):
                field["pattern_message"] = str(item["field_pattern_message"])

    elif field_type == "multiline":
        if item.get("field_max_length"):
            field["max_length"] = int(item["field_max_length"])

    elif field_type == "number":
        if item.get("field_min") not in (None, ""):
            field["min"] = float(item["field_min"])
        if item.get("field_max") not in (None, ""):
            field["max"] = float(item["field_max"])

    elif field_type in ("select", "multiselect"):
        field["choices"] = _parse_choices(item.get("field_choices"))
        if field_type == "select":
            field["display_as"] = "auto"
        else:
            field["display_as"] = "tag-input"

    return field


def _build_section(fields: List[Dict[str, Any]], section_id: str = "main", title: str = "") -> Dict[str, Any]:
    section: Dict[str, Any] = {"id": section_id, "fields": [f for f in fields if f]}
    if title:
        section["title"] = title
    return section


@router.post("/create-form")
async def create_form(body: Dict[str, Any]):
    """
    Accepts raw form_creator answers, constructs a FormManifest, validates it,
    and registers it. Returns the manifest_id and form_id for redirect.
    """
    # Normalise — the request body is the flat answers dict from the form engine
    payload = CreateFormPayload(
        form_id          = str(body.get("form_id", "my_form")).strip(),
        manifest_id      = str(body.get("manifest_id", "my_manifest")).strip(),
        form_title       = str(body.get("form_title", "My Form")).strip(),
        form_description = body.get("form_description"),
        layout_type      = str(body.get("layout_type", "single-page")),
        submit_label     = body.get("submit_label") or "Submit",
        draft_label      = body.get("draft_label") or "Save Draft",
        fields_section   = body.get("fields_section") or [],
        pages_section    = body.get("pages_section") or [],
        submit_type      = str(body.get("submit_type", "none")),
        submit_url       = body.get("submit_url"),
        success_message  = body.get("success_message") or "Form submitted successfully!",
        error_message    = body.get("error_message") or "Submission failed. Please try again.",
    )

    # Validate IDs
    for id_val, id_name in [(payload.form_id, "form_id"), (payload.manifest_id, "manifest_id")]:
        if not re.match(r'^[a-z][a-z0-9_]*$', id_val):
            raise HTTPException(status_code=422, detail=f"{id_name} must be lowercase letters, numbers, and underscores only")

    # Build fields
    raw_fields = payload.fields_section or []
    built_fields = [f for f in (_build_field(item) for item in raw_fields) if f]

    if not built_fields:
        raise HTTPException(status_code=422, detail="At least one valid field is required")

    field_map = {f["id"]: f for f in built_fields}

    # Build form structure
    on_submit: Dict[str, Any] = {"type": payload.submit_type}
    if payload.submit_type == "rest":
        if not payload.submit_url:
            raise HTTPException(status_code=422, detail="submit_url is required when submit_type is rest")
        on_submit["url"] = payload.submit_url
        on_submit["method"] = "POST"
    on_submit["success_message"] = payload.success_message
    on_submit["error_message"]   = payload.error_message

    form_def: Dict[str, Any] = {
        "title":        payload.form_title,
        "version":      "1.0.0",
        "form_state":   "active",
        "layout":       {"type": payload.layout_type},
        "submit_label": payload.submit_label,
        "draft_label":  payload.draft_label,
        "on_submit":    on_submit,
    }

    if payload.form_description:
        form_def["description"] = payload.form_description

    if payload.layout_type == "wizard" and payload.pages_section:
        pages = []
        assigned_ids: set = set()
        for page_item in payload.pages_section:
            pid   = str(page_item.get("page_id") or "").strip()
            ptitle = str(page_item.get("page_title") or pid).strip()
            if not pid or not re.match(r'^[a-z][a-z0-9_]*$', pid):
                continue
            # Parse field IDs for this page
            page_field_ids = [
                fid.strip() for fid in str(page_item.get("page_fields") or "").split(",")
                if fid.strip() in field_map
            ]
            assigned_ids.update(page_field_ids)
            page_fields = [field_map[fid] for fid in page_field_ids]
            section: Dict[str, Any] = {"id": f"section_{pid}", "fields": page_fields}
            page: Dict[str, Any] = {"id": pid, "title": ptitle, "sections": [section]}
            if page_item.get("page_description"):
                page["description"] = str(page_item["page_description"])
            if page_item.get("page_icon"):
                page["icon"] = str(page_item["page_icon"])
            pages.append(page)

        # Remaining unassigned fields go into a catch-all last page
        unassigned = [f for f in built_fields if f["id"] not in assigned_ids]
        if unassigned:
            pages.append({
                "id": "other_fields",
                "title": "Other",
                "sections": [{"id": "other_section", "fields": unassigned}]
            })

        if not pages:
            # Fallback: single page with all fields
            form_def["sections"] = [_build_section(built_fields, "main", "")]
        else:
            form_def["pages"] = pages
    else:
        form_def["sections"] = [_build_section(built_fields, "main", "")]

    # Assemble manifest
    manifest_dict: Dict[str, Any] = {
        "manifest_id":      payload.manifest_id,
        "manifest_version": "4.0.0",
        "forms":            {payload.form_id: form_def},
    }

    # Validate via Pydantic
    try:
        FormManifest.model_validate(manifest_dict)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Generated manifest is invalid: {e}")

    # Persist
    now = datetime.datetime.utcnow().isoformat()
    mid = payload.manifest_id
    if mid in _manifests:
        existing = _manifests[mid]
        # Merge forms (don't overwrite other forms in the manifest)
        existing.setdefault("forms", {})[payload.form_id] = form_def
        _meta[mid]["updated_at"] = now
    else:
        _manifests[mid] = manifest_dict
        _meta[mid] = {"created_at": now, "updated_at": now}

    return {
        "status":      "created",
        "manifest_id": mid,
        "form_id":     payload.form_id,
        "url":         f"/forms/{mid}/{payload.form_id}",
    }
