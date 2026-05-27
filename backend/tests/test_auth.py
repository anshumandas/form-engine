"""Auth router tests: signup/signin, password hashing, sessions, admin gating."""
import pytest

from backend.routers.auth import _hash_password, _verify_password
from .conftest import ADMIN_EMAIL, ADMIN_PASSWORD


# ─── Password hashing (unit) ────────────────────────────────────────────────
def test_password_hash_is_salted_pbkdf2():
    h1 = _hash_password("hunter2")
    h2 = _hash_password("hunter2")
    assert h1.startswith("pbkdf2_sha256$")
    assert h1 != h2, "salt must make identical passwords hash differently"
    assert "hunter2" not in h1


def test_password_verify():
    h = _hash_password("correct horse")
    assert _verify_password("correct horse", h) is True
    assert _verify_password("wrong", h) is False
    assert _verify_password("correct horse", "garbage") is False


# ─── Signup / signin flow ───────────────────────────────────────────────────
def test_signup_then_signin(client):
    res = client.post("/auth/signup", json={
        "email": "jane@example.com", "password": "password123",
        "full_name": "Jane Doe", "confirm_password": "password123",
    })
    assert res.status_code == 201, res.text
    assert res.json()["token"]

    res = client.post("/auth/signin", json={"email": "jane@example.com", "password": "password123"})
    assert res.status_code == 200
    assert res.json()["email"] == "jane@example.com"


def test_signup_rejects_short_password(client):
    res = client.post("/auth/signup", json={"email": "x@y.com", "password": "short"})
    assert res.status_code == 422


def test_signup_rejects_mismatched_confirm(client):
    res = client.post("/auth/signup", json={
        "email": "z@y.com", "password": "password123", "confirm_password": "different1",
    })
    assert res.status_code == 422


def test_signin_wrong_password(client):
    res = client.post("/auth/signin", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert res.status_code == 401


def test_me_requires_token(client, auth_headers):
    assert client.get("/auth/me").status_code == 401
    res = client.get("/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["role"] == "admin"


def test_users_list_admin_only(client, new_user):
    _, _, user_token = new_user
    # Non-admin user is forbidden
    res = client.get("/auth/users", headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 403


def test_users_list_for_admin(client, auth_headers):
    res = client.get("/auth/users", headers=auth_headers)
    assert res.status_code == 200
    assert any(u["email"] == ADMIN_EMAIL for u in res.json())
