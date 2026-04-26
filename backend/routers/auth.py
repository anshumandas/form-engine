"""
Auth router — /auth/signin and /auth/signup endpoints.

Matches the contract expected by page.tsx:
  POST /auth/signin  body: { email, password }
    → { token, access_token, name, email, user: { name, email } }
  POST /auth/signup  body: { full_name, email, password, confirm_password }
    → { token, access_token, name, email, user: { name, email } }

Storage: in-memory dict (swap for a real DB + bcrypt in production).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
import hashlib, secrets

router = APIRouter(prefix="/auth", tags=["auth"])

# ── In-memory stores ──────────────────────────────────────────────────────────
_users: Dict[str, Dict] = {}      # email → { name, password_hash }
_sessions: Dict[str, str] = {}    # token → email


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def _make_token() -> str:
    return secrets.token_hex(32)


# ── Request / Response models ─────────────────────────────────────────────────

class SigninRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    confirm_password: Optional[str] = None

class UserInfo(BaseModel):
    name: Optional[str] = None
    email: str

class AuthResponse(BaseModel):
    token: str
    access_token: str   # duplicate so page.tsx works with either key
    name: Optional[str] = None
    email: str
    user: Optional[UserInfo] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/signin", response_model=AuthResponse)
async def signin(body: SigninRequest):
    """
    Authenticate an existing user and return a session token.

    page.tsx sends:  { email, password }
    page.tsx reads:  data.token | data.access_token, data.user?.name | data.name
    """
    email = body.email.lower().strip()
    user = _users.get(email)
    if not user or user["password_hash"] != _hash(body.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _make_token()
    _sessions[token] = email
    name = user.get("name", "")

    return AuthResponse(
        token=token,
        access_token=token,
        name=name,
        email=email,
        user=UserInfo(name=name, email=email),
    )


@router.post("/signup", status_code=201, response_model=AuthResponse)
async def signup(body: SignupRequest):
    """
    Register a new user account and return a session token.

    page.tsx sends:  { full_name, email, password, confirm_password }
    page.tsx reads:  data.token | data.access_token, data.name
    """
    email = body.email.lower().strip()

    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="Invalid email address")

    if len(body.password) < 8:
        raise HTTPException(
            status_code=422, detail="Password must be at least 8 characters"
        )

    if body.confirm_password is not None and body.password != body.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match")

    if email in _users:
        raise HTTPException(
            status_code=409, detail="An account with this email already exists"
        )

    name = (body.full_name or "").strip() or email.split("@")[0]
    _users[email] = {"name": name, "password_hash": _hash(body.password)}

    token = _make_token()
    _sessions[token] = email

    return AuthResponse(
        token=token,
        access_token=token,
        name=name,
        email=email,
        user=UserInfo(name=name, email=email),
    )


@router.get("/me")
async def me():
    """Stub — returns 401. Implement Bearer token lookup when needed."""
    raise HTTPException(status_code=401, detail="No active session")
