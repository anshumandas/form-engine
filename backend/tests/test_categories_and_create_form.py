"""Tests for /api/categories and /api/create-form (both require auth for writes)."""
import uuid


# ─── Categories ─────────────────────────────────────────────────────────────
def test_list_categories_public(client):
    assert client.get("/api/categories/").status_code == 200


def test_create_category_requires_auth(client):
    res = client.post("/api/categories/", json={"name": "HR", "category_id": "hr_x"})
    assert res.status_code == 401


def test_create_category(client, auth_headers):
    cid = f"cat_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/categories/", json={"name": "My Cat", "category_id": cid},
                      headers=auth_headers)
    assert res.status_code == 201, res.text
    assert res.json()["category_id"] == cid


def test_create_category_rejects_bad_id(client, auth_headers):
    res = client.post("/api/categories/", json={"name": "Bad", "category_id": "Bad Id"},
                      headers=auth_headers)
    assert res.status_code == 422


# ─── create-form ────────────────────────────────────────────────────────────
def test_create_form_requires_auth(client):
    res = client.post("/api/create-form", json={
        "form_id": "f1", "manifest_id": "m1", "form_title": "T",
        "fields_section": [{"field_id": "name", "field_type": "text", "field_label": "Name"}],
    })
    assert res.status_code == 401


def test_create_form_builds_manifest(client, auth_headers):
    res = client.post("/api/create-form", json={
        "form_id": "signup_f", "manifest_id": "mk_test", "form_title": "Signup",
        "layout_type": "single-page",
        "fields_section": [
            {"field_id": "email", "field_type": "text", "field_label": "Email", "field_required": True},
            {"field_id": "plan", "field_type": "select", "field_label": "Plan",
             "field_choices": "free|Free\npro|Pro"},
        ],
        "submit_type": "none",
    }, headers=auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["form_id"] == "signup_f"
    # Fetch the generated form back
    got = client.get(f"/api/forms/{body['manifest_id']}")
    assert got.status_code == 200
    assert "signup_f" in got.json()["forms"]


def test_create_form_rejects_bad_ids(client, auth_headers):
    res = client.post("/api/create-form", json={
        "form_id": "Bad Id", "manifest_id": "ok_mid", "form_title": "T",
        "fields_section": [{"field_id": "x", "field_type": "text", "field_label": "X"}],
    }, headers=auth_headers)
    assert res.status_code == 422
