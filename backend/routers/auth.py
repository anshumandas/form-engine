"""
Auth router — /auth/signin, /auth/signup, /auth/me, /auth/users

Contract expected by page.tsx:
  POST /auth/signin  body: { email, password }
    → { token, access_token, name, email, role, user: { name, email, role } }
  POST /auth/signup  body: { full_name, email, password, confirm_password }
    → { token, access_token, name, email, role, user: { name, email, role } }
  GET  /auth/me      header: Authorization: Bearer <token>
    → { name, email, role }
  GET  /auth/users   header: Authorization: Bearer <token>  (admin only)
    → [{ name, email, role, created_at }, ...]

Storage: in-memory dict (swap for a real DB + bcrypt in production).
Admin seed: admin@formengine.io / Admin@1234
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, Dict, List
import hashlib, secrets, datetime

router = APIRouter(prefix="/auth", tags=["auth"])

# ── In-memory stores ──────────────────────────────────────────────────────────
# email → { name, password_hash, role, created_at }
_users: Dict[str, Dict] = {}
# token → email
_sessions: Dict[str, str] = {}


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def _make_token() -> str:
    return secrets.token_hex(32)

def _get_session_email(authorization: Optional[str]) -> Optional[str]:
    """Extract and validate Bearer token → email, or None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    return _sessions.get(token)

def _require_auth(authorization: Optional[str]) -> Dict:
    """Return user dict or raise 401."""
    email = _get_session_email(authorization)
    if not email or email not in _users:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {**_users[email], "email": email}

def _require_admin(authorization: Optional[str]) -> Dict:
    """Return user dict or raise 401/403."""
    user = _require_auth(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Seed admin user ───────────────────────────────────────────────────────────

ADMIN_EMAIL    = "admin@formengine.io"
ADMIN_PASSWORD = "Admin@1234"
ADMIN_NAME     = "System Admin"

def _seed_admin() -> None:
    if ADMIN_EMAIL not in _users:
        _users[ADMIN_EMAIL] = {
            "name": ADMIN_NAME,
            "password_hash": _hash(ADMIN_PASSWORD),
            "role": "admin",
            "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        }

_seed_admin()


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
    role: str = "user"

class AuthResponse(BaseModel):
    token: str
    access_token: str   # duplicate so page.tsx works with either key
    name: Optional[str] = None
    email: str
    role: str
    user: Optional[UserInfo] = None

class UserListItem(BaseModel):
    email: str
    name: Optional[str] = None
    role: str
    created_at: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/signin", response_model=AuthResponse)
async def signin(body: SigninRequest):
    """Authenticate an existing user and return a session token."""
    email = body.email.lower().strip()
    user  = _users.get(email)
    if not user or user["password_hash"] != _hash(body.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _make_token()
    _sessions[token] = email
    name  = user.get("name", "")
    role  = user.get("role", "user")

    return AuthResponse(
        token=token,
        access_token=token,
        name=name,
        email=email,
        role=role,
        user=UserInfo(name=name, email=email, role=role),
    )


@router.post("/signup", status_code=201, response_model=AuthResponse)
async def signup(body: SignupRequest):
    """Register a new user account and return a session token."""
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
    _users[email] = {
        "name": name,
        "password_hash": _hash(body.password),
        "role": "user",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
    }

    token = _make_token()
    _sessions[token] = email

    return AuthResponse(
        token=token,
        access_token=token,
        name=name,
        email=email,
        role="user",
        user=UserInfo(name=name, email=email, role="user"),
    )


@router.get("/me", response_model=UserInfo)
async def me(authorization: Optional[str] = Header(default=None)):
    """Return the currently authenticated user's profile."""
    user = _require_auth(authorization)
    return UserInfo(name=user.get("name"), email=user["email"], role=user.get("role", "user"))


@router.get("/users", response_model=List[UserListItem])
async def list_users(authorization: Optional[str] = Header(default=None)):
    """Return all registered users. Admin only."""
    _require_admin(authorization)
    return [
        UserListItem(
            email=email,
            name=info.get("name"),
            role=info.get("role", "user"),
            created_at=info.get("created_at"),
        )
        for email, info in _users.items()
    ]


@router.delete("/users/{email}", status_code=204)
async def delete_user(
    email: str,
    authorization: Optional[str] = Header(default=None),
):
    """Delete a user by email. Admin only. Cannot delete yourself."""
    admin = _require_admin(authorization)
    target = email.lower().strip()
    if target == admin["email"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if target not in _users:
        raise HTTPException(status_code=404, detail="User not found")
    _users.pop(target, None)
    # Invalidate all sessions for deleted user
    for tok, em in list(_sessions.items()):
        if em == target:
            del _sessions[tok]
