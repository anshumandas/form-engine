"""
Shared pytest fixtures for the Form Engine backend test suite.

Run from the repository root:

    pip install -r backend/requirements-dev.txt
    pytest backend/tests -v

The app uses in-memory stores seeded on startup, so we use a TestClient as a
context manager (which fires FastAPI startup events) and authenticate as the
seeded admin for endpoints that now require auth.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

# Seeded admin credentials (see backend/routers/auth.py)
ADMIN_EMAIL = "admin@formengine.io"
ADMIN_PASSWORD = "Admin@1234"


@pytest.fixture()
def client():
    """A TestClient with startup events fired (seeds sample manifests + admin)."""
    from backend.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def admin_token(client):
    res = client.post("/auth/signin", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert res.status_code == 200, res.text
    body = res.json()
    return body["token"]


@pytest.fixture()
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture()
def new_user(client):
    """Register a fresh non-admin user; returns (email, password, token)."""
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    password = "Sup3rSecret!"
    res = client.post("/auth/signup", json={
        "email": email, "password": password,
        "full_name": "Test User", "confirm_password": password,
    })
    assert res.status_code == 201, res.text
    return email, password, res.json()["token"]


@pytest.fixture()
def sample_manifest():
    """A minimal valid manifest with one single-page form."""
    return {
        "manifest_id": f"test_{uuid.uuid4().hex[:8]}",
        "manifest_version": "4.0.0",
        "forms": {
            "contact": {
                "title": "Contact",
                "version": "1.0.0",
                "layout": {"type": "single-page"},
                "on_submit": {"type": "none"},
                "sections": [
                    {"id": "s1", "fields": [
                        {"id": "name", "type": "text", "label": "Name", "required": True},
                        {"id": "email", "type": "text", "label": "Email",
                         "pattern": r"^[^@]+@[^@]+\.[^@]+$", "pattern_message": "bad email"},
                        {"id": "age", "type": "number", "label": "Age", "min": 0, "max": 120},
                    ]},
                ],
            }
        },
    }
