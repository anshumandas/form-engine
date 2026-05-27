"""
/api/uam/* — in-memory directory endpoints for relationship pickers used by
sample UAM forms. Returns the shape that DynamicChoicesConfig expects: an
array of plain objects, each carrying the `value_key` and `label_key` fields
declared in the manifest's `data_sources` entry.

Seed data lives in this module — it is deliberately small and replaceable.
"""
from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter(prefix="/api/uam", tags=["uam-directory"])


# ── In-memory seed data ──────────────────────────────────────────────────────
_USERS: List[Dict[str, Any]] = [
    {"userId": "u_alice",   "name": "Alice Chen",       "email": "alice@acme.example"},
    {"userId": "u_bob",     "name": "Bob Patel",        "email": "bob@acme.example"},
    {"userId": "u_carol",   "name": "Carol Nguyen",     "email": "carol@acme.example"},
    {"userId": "u_dave",    "name": "Dave Okafor",      "email": "dave@acme.example"},
    {"userId": "u_eve",     "name": "Eve Sokolov",      "email": "eve@acme.example"},
    {"userId": "u_frank",   "name": "Frank Yamamoto",   "email": "frank@acme.example"},
    {"userId": "u_grace",   "name": "Grace Mensah",     "email": "grace@acme.example"},
    {"userId": "u_henry",   "name": "Henry Kowalski",   "email": "henry@acme.example"},
]

_TEAMS: List[Dict[str, Any]] = [
    {"teamId": "t_platform",  "name": "Platform Engineering"},
    {"teamId": "t_product",   "name": "Product Engineering"},
    {"teamId": "t_design",    "name": "Design Guild"},
    {"teamId": "t_data",      "name": "Data & Analytics"},
    {"teamId": "t_security",  "name": "Security"},
    {"teamId": "t_support",   "name": "Customer Support"},
    {"teamId": "t_sales",     "name": "Sales"},
]

_ROLES: List[Dict[str, Any]] = [
    {"roleName": "admin",          "category": "Employee"},
    {"roleName": "sales_manager",  "category": "Employee"},
    {"roleName": "sales_rep",      "category": "Employee"},
    {"roleName": "support_agent",  "category": "Employee"},
    {"roleName": "support_lead",   "category": "Employee"},
    {"roleName": "engineer",       "category": "Employee"},
    {"roleName": "engineering_lead","category": "Employee"},
    {"roleName": "customer",       "category": "Customer"},
    {"roleName": "partner",        "category": "Partner"},
]

_PERMISSIONS: List[Dict[str, Any]] = [
    {"name": "view_invoices"},
    {"name": "create_invoice"},
    {"name": "approve_invoice"},
    {"name": "view_users"},
    {"name": "manage_users"},
    {"name": "manage_roles"},
    {"name": "view_reports"},
    {"name": "export_data"},
]

_FEATURES: List[Dict[str, Any]] = [
    {"name": "uam_user_management"},
    {"name": "uam_team_management"},
    {"name": "uam_role_management"},
    {"name": "uam_permission_management"},
    {"name": "uam_feature_management"},
    {"name": "uam_login_management"},
    {"name": "invoice_export"},
    {"name": "report_builder"},
]


# ── Helpers ──────────────────────────────────────────────────────────────────
def _filter(items: List[Dict[str, Any]], q: str | None, *keys: str) -> List[Dict[str, Any]]:
    if not q:
        return items
    needle = q.lower()
    return [r for r in items if any(needle in str(r.get(k, "")).lower() for k in keys)]


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(q: str | None = None):
    return _filter(_USERS, q, "name", "email", "userId")


@router.get("/teams")
async def list_teams(q: str | None = None):
    return _filter(_TEAMS, q, "name", "teamId")


@router.get("/roles")
async def list_roles(q: str | None = None):
    return _filter(_ROLES, q, "roleName", "category")


@router.get("/permissions")
async def list_permissions(q: str | None = None):
    return _filter(_PERMISSIONS, q, "name")


@router.get("/features")
async def list_features(q: str | None = None):
    return _filter(_FEATURES, q, "name")


@router.get("/principals")
async def list_principals(q: str | None = None):
    """
    Combined directory of Users + Teams, used by relationship pickers that
    accept either kind of member (e.g. team membership where a team can
    include both individual users and nested teams).

    Each row carries:
      principalId — namespaced id (user:<id> / team:<id>) — used as value_key
      label       — human label with kind suffix, e.g. "Alice Chen (User)"
      kind        — "user" | "team"
    """
    users = [
        {
            "principalId": f"user:{u['userId']}",
            "label": f"{u['name']} (User)",
            "kind": "user",
            "name": u["name"],
        }
        for u in _USERS
    ]
    teams = [
        {
            "principalId": f"team:{t['teamId']}",
            "label": f"{t['name']} (Team)",
            "kind": "team",
            "name": t["name"],
        }
        for t in _TEAMS
    ]
    combined = users + teams
    return _filter(combined, q, "label", "name", "principalId")
