"""
Forms CRUD router — stores manifests in SQLite via SQLAlchemy.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, List, Any, Optional
import json, yaml, uuid, datetime
from ..models.form_schema import FormManifest, CreateFormRequest

router = APIRouter(prefix="/api/forms", tags=["forms"])

# ── In-memory store (swap for DB in production) ──────────────────────────────
_manifests: Dict[str, Dict[str, Any]] = {}  # manifest_id → raw dict
_meta: Dict[str, Dict[str, Any]] = {}       # manifest_id → metadata


def _manifest_key(manifest_id: str) -> str:
    return manifest_id


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_forms():
    """Return a summary list of all registered manifests and their forms."""
    result = []
    for mid, manifest_dict in _manifests.items():
        forms_summary = []
        for fid, form in (manifest_dict.get("forms") or {}).items():
            forms_summary.append({
                "form_id": fid,
                "title": form.get("title", fid),
                "version": form.get("version", "0.0.0"),
                "form_state": form.get("form_state", "active"),
                "layout_type": form.get("layout", {}).get("type", "single-page"),
            })
        meta = _meta.get(mid, {})
        result.append({
            "manifest_id": mid,
            "manifest_version": manifest_dict.get("manifest_version", "4.0.0"),
            "forms": forms_summary,
            "created_at": meta.get("created_at"),
            "updated_at": meta.get("updated_at"),
        })
    return result


@router.get("/{manifest_id}")
async def get_manifest(manifest_id: str):
    """Return a full manifest by ID."""
    if manifest_id not in _manifests:
        raise HTTPException(status_code=404, detail=f"Manifest '{manifest_id}' not found")
    return _manifests[manifest_id]


@router.get("/{manifest_id}/forms/{form_id}")
async def get_form(manifest_id: str, form_id: str):
    """Return a single form definition with its manifest context."""
    if manifest_id not in _manifests:
        raise HTTPException(status_code=404, detail=f"Manifest '{manifest_id}' not found")
    manifest = _manifests[manifest_id]
    forms = manifest.get("forms") or {}
    if form_id not in forms:
        raise HTTPException(status_code=404, detail=f"Form '{form_id}' not found in manifest '{manifest_id}'")
    return {
        "manifest_id": manifest_id,
        "form_id": form_id,
        "manifest": manifest,
        "form": forms[form_id],
    }


@router.post("/", status_code=201)
async def create_or_update_manifest(body: Dict[str, Any]):
    """
    Create or update a manifest from a raw JSON/YAML-parsed dict.
    The dict must conform to FormManifest.
    """
    try:
        manifest = FormManifest.model_validate(body)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    mid = manifest.manifest_id or str(uuid.uuid4())
    now = datetime.datetime.utcnow().isoformat()
    if mid in _manifests:
        _meta[mid]["updated_at"] = now
    else:
        _meta[mid] = {"created_at": now, "updated_at": now}

    body["manifest_id"] = mid
    _manifests[mid] = body
    return {"manifest_id": mid, "status": "ok"}


@router.put("/{manifest_id}")
async def update_manifest(manifest_id: str, body: Dict[str, Any]):
    """Replace an existing manifest."""
    if manifest_id not in _manifests:
        raise HTTPException(status_code=404, detail="Manifest not found")
    try:
        FormManifest.model_validate(body)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    body["manifest_id"] = manifest_id
    _manifests[manifest_id] = body
    _meta[manifest_id]["updated_at"] = datetime.datetime.utcnow().isoformat()
    return {"manifest_id": manifest_id, "status": "updated"}


@router.delete("/{manifest_id}", status_code=204)
async def delete_manifest(manifest_id: str):
    if manifest_id not in _manifests:
        raise HTTPException(status_code=404, detail="Manifest not found")
    del _manifests[manifest_id]
    del _meta[manifest_id]


@router.post("/upload")
async def upload_manifest(file: UploadFile = File(...)):
    """
    Upload a YAML or JSON manifest file.
    Accepts .yaml, .yml, or .json files.
    """
    raw = await file.read()
    content = raw.decode("utf-8")
    filename = file.filename or ""

    try:
        if filename.endswith((".yaml", ".yml")):
            body = yaml.safe_load(content)
        elif filename.endswith(".json"):
            body = json.loads(content)
        else:
            # Try YAML first, then JSON
            try:
                body = yaml.safe_load(content)
            except Exception:
                body = json.loads(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")

    try:
        manifest = FormManifest.model_validate(body)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Schema validation failed: {e}")

    mid = manifest.manifest_id or str(uuid.uuid4())
    now = datetime.datetime.utcnow().isoformat()
    _meta[mid] = {"created_at": now, "updated_at": now}
    body["manifest_id"] = mid
    _manifests[mid] = body
    return {"manifest_id": mid, "status": "uploaded", "forms": list((body.get("forms") or {}).keys())}


@router.post("/validate")
async def validate_manifest(body: Dict[str, Any]):
    """Validate a manifest without persisting it."""
    try:
        manifest = FormManifest.model_validate(body)
        forms = list((manifest.forms or {}).keys())
        return {"valid": True, "manifest_id": manifest.manifest_id, "forms": forms}
    except Exception as e:
        return {"valid": False, "error": str(e)}
