"""Forms CRUD tests: read is open, writes require auth + valid manifest_id."""


def test_list_forms_is_public(client):
    res = client.get("/api/forms/")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_create_requires_auth(client, sample_manifest):
    # No auth header -> 401
    res = client.post("/api/forms/", json=sample_manifest)
    assert res.status_code == 401


def test_create_and_get(client, auth_headers, sample_manifest):
    res = client.post("/api/forms/", json=sample_manifest, headers=auth_headers)
    assert res.status_code == 201, res.text
    mid = res.json()["manifest_id"]

    # Read back without auth (reads are public)
    res = client.get(f"/api/forms/{mid}")
    assert res.status_code == 200
    assert "contact" in res.json()["forms"]


def test_create_rejects_bad_manifest_id(client, auth_headers, sample_manifest):
    sample_manifest["manifest_id"] = "Bad-ID With Spaces"
    res = client.post("/api/forms/", json=sample_manifest, headers=auth_headers)
    assert res.status_code == 422


def test_update_requires_auth(client, auth_headers, sample_manifest):
    res = client.post("/api/forms/", json=sample_manifest, headers=auth_headers)
    mid = res.json()["manifest_id"]
    # Unauthenticated PUT -> 401
    assert client.put(f"/api/forms/{mid}", json=sample_manifest).status_code == 401
    # Authenticated PUT -> ok
    assert client.put(f"/api/forms/{mid}", json=sample_manifest, headers=auth_headers).status_code == 200


def test_delete_requires_auth(client, auth_headers, sample_manifest):
    res = client.post("/api/forms/", json=sample_manifest, headers=auth_headers)
    mid = res.json()["manifest_id"]
    assert client.delete(f"/api/forms/{mid}").status_code == 401
    assert client.delete(f"/api/forms/{mid}", headers=auth_headers).status_code == 204
    assert client.get(f"/api/forms/{mid}").status_code == 404


def test_validate_endpoint(client, sample_manifest):
    res = client.post("/api/forms/validate", json=sample_manifest)
    assert res.status_code == 200
    assert res.json()["valid"] is True


def test_validate_rejects_garbage(client):
    res = client.post("/api/forms/validate", json={"forms": {"x": {"title": "no version/layout"}}})
    assert res.status_code == 200
    assert res.json()["valid"] is False
