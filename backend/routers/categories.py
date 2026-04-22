"""
/api/categories — thin wrapper around manifests that speaks "Category" language.
Lets the UI create, rename, and list categories (manifests) without needing
to know YAML.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import datetime, re

from routers.forms import _manifests, _meta

router = APIRouter(prefix="/api/categories", tags=["categories"])


class CreateCategoryRequest(BaseModel):
    name: str           # human-readable display name, e.g. "HR Forms"
    category_id: str    # machine id = manifest_id, e.g. "hr_forms"
    description: Optional[str] = None


@router.get("/")
async def list_categories():
    """Return all categories with their display metadata."""
    result = []
    for mid, manifest in _manifests.items():
        meta = _meta.get(mid, {})
        result.append({
            "category_id":   mid,
            "name":          manifest.get("_category_name") or _id_to_name(mid),
            "description":   manifest.get("_category_description"),
            "form_count":    len(manifest.get("forms") or {}),
            "created_at":    meta.get("created_at"),
            "updated_at":    meta.get("updated_at"),
        })
    return result


@router.post("/", status_code=201)
async def create_category(body: CreateCategoryRequest):
    """Create a new empty category (manifest)."""
    cid = body.category_id.strip()

    if not re.match(r'^[a-z][a-z0-9_]*$', cid):
        raise HTTPException(
            status_code=422,
            detail="category_id must be lowercase letters, numbers, and underscores only"
        )
    if cid in _manifests:
        raise HTTPException(status_code=409, detail=f"Category '{cid}' already exists")

    now = datetime.datetime.utcnow().isoformat()
    _manifests[cid] = {
        "manifest_id":           cid,
        "manifest_version":      "4.0.0",
        "_category_name":        body.name.strip(),
        "_category_description": body.description,
        "forms":                 {},
    }
    _meta[cid] = {"created_at": now, "updated_at": now}

    return {
        "category_id": cid,
        "name":        body.name.strip(),
        "status":      "created",
    }


@router.patch("/{category_id}")
async def rename_category(category_id: str, body: CreateCategoryRequest):
    """Rename a category."""
    if category_id not in _manifests:
        raise HTTPException(status_code=404, detail="Category not found")
    _manifests[category_id]["_category_name"]        = body.name.strip()
    _manifests[category_id]["_category_description"] = body.description
    _meta[category_id]["updated_at"] = datetime.datetime.utcnow().isoformat()
    return {"category_id": category_id, "name": body.name.strip(), "status": "updated"}


def _id_to_name(id_: str) -> str:
    """Convert snake_case manifest ID to a readable name: hr_forms → HR Forms."""
    return " ".join(w.upper() if len(w) <= 2 else w.capitalize() for w in id_.split("_"))
