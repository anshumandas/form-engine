"""Submission tests: submit is public, validation runs, listing requires auth."""
import pytest


@pytest.fixture()
def manifest_id(client, auth_headers, sample_manifest):
    res = client.post("/api/forms/", json=sample_manifest, headers=auth_headers)
    assert res.status_code == 201, res.text
    return res.json()["manifest_id"]


def test_submit_is_public_and_validates(client, manifest_id):
    # Missing required "name" -> rejected with field errors
    res = client.post("/api/submissions/", json={
        "manifest_id": manifest_id, "form_id": "contact", "answers": {"email": "a@b.com"},
    })
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "rejected"
    assert "name" in body["errors"]


def test_submit_accepts_valid(client, manifest_id):
    res = client.post("/api/submissions/", json={
        "manifest_id": manifest_id, "form_id": "contact",
        "answers": {"name": "Jane", "email": "jane@example.com", "age": 30},
    })
    assert res.status_code == 201
    assert res.json()["status"] == "accepted"


def test_submit_rejects_bad_pattern(client, manifest_id):
    res = client.post("/api/submissions/", json={
        "manifest_id": manifest_id, "form_id": "contact",
        "answers": {"name": "Jane", "email": "not-an-email"},
    })
    assert res.json()["status"] == "rejected"
    assert "email" in res.json()["errors"]


def test_submit_rejects_out_of_range_number(client, manifest_id):
    res = client.post("/api/submissions/", json={
        "manifest_id": manifest_id, "form_id": "contact",
        "answers": {"name": "Jane", "age": 999},
    })
    assert res.json()["status"] == "rejected"
    assert "age" in res.json()["errors"]


def test_draft_save_is_public(client, manifest_id):
    res = client.post("/api/submissions/", json={
        "manifest_id": manifest_id, "form_id": "contact",
        "answers": {"name": ""}, "draft": True,
    })
    assert res.status_code == 201
    assert res.json()["status"] == "draft_saved"


def test_list_submissions_requires_auth(client, manifest_id):
    # Public submit first
    client.post("/api/submissions/", json={
        "manifest_id": manifest_id, "form_id": "contact",
        "answers": {"name": "Jane", "email": "jane@example.com"},
    })
    # Listing is protected (was a data leak before)
    assert client.get("/api/submissions/").status_code == 401


def test_list_submissions_with_auth(client, auth_headers, manifest_id):
    client.post("/api/submissions/", json={
        "manifest_id": manifest_id, "form_id": "contact",
        "answers": {"name": "Jane", "email": "jane@example.com"},
    })
    res = client.get("/api/submissions/", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_required_validation_rule_fires_on_empty(client, auth_headers):
    """Regression: a rule-based `required` must fire even when field.required is unset."""
    manifest = {
        "manifest_id": "ruletest_mid",
        "manifest_version": "4.0.0",
        "forms": {"f": {
            "title": "F", "version": "1.0.0", "layout": {"type": "single-page"},
            "on_submit": {"type": "none"},
            "sections": [{"id": "s", "fields": [
                {"id": "nick", "type": "text", "label": "Nick",
                 "validation": {"rules": [{"type": "required", "message": "Nick is required"}]}},
            ]}],
        }},
    }
    client.post("/api/forms/", json=manifest, headers=auth_headers)
    res = client.post("/api/submissions/", json={
        "manifest_id": "ruletest_mid", "form_id": "f", "answers": {},
    })
    assert res.json()["status"] == "rejected"
    assert "nick" in res.json()["errors"]
