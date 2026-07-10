# apps/api/services/auth.py
"""
Shared auth helper — validates a Supabase JWT and resolves the caller's clinic.

Used by every staff-only endpoint so that clinic_id is always derived from the
authenticated user, never trusted from a client-supplied path/body parameter.

Multi-location: a user's "primary" clinic (parent_clinic_id IS NULL) can have
child "location" clinics (parent_clinic_id = primary's id). A user's role on
their primary clinic implicitly grants the same role on every one of its
locations -- there's no separate clinic_users row per location, so new staff
added to the primary automatically see its locations with no extra sync step.
"""
from fastapi import HTTPException
from services.db import get_db


def _get_authenticated_user_id(authorization: str | None) -> str:
    """
    Parse the Bearer token from the Authorization header and validate it
    against Supabase Auth. Returns the authenticated user's ID.

    Validation is delegated to Supabase's own Auth server (via `auth.get_user`)
    rather than decoded locally — Supabase issues tokens signed with per-project
    keys (including asymmetric ES256 keys on newer projects), so there's no
    single static secret we could verify against locally.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    db = get_db()

    try:
        user = db.auth.get_user(token).user
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user.id


def _get_clinics_for_user(user_id: str) -> list[dict]:
    """
    Every clinic this user can access: clinics they have a direct clinic_users
    row for, plus any locations (child clinics) belonging to a primary clinic
    they directly belong to. Ordered primary-first, then by created_at, so
    "first in list" is a stable, deterministic default.

    Each returned clinic row is annotated with `role` (the user's effective
    role — inherited from the primary for locations) and `is_primary`.
    """
    db = get_db()

    # Avoid .single()/.maybe_single() — on this postgrest/PostgREST version
    # combo, a zero-row result raises APIError instead of returning
    # data=None, which would surface as an unhandled 500 instead of a
    # clean 404. A plain list query + length check sidesteps that.
    memberships = (
        db.table("clinic_users")
        .select("clinic_id, role")
        .eq("user_id", user_id)
        .execute()
    )
    if not memberships.data:
        raise HTTPException(status_code=404, detail="No clinic found for this user")

    role_by_clinic_id = {m["clinic_id"]: m["role"] for m in memberships.data}
    direct_ids = list(role_by_clinic_id.keys())

    direct_rows = (
        db.table("clinics")
        .select("*")
        .in_("id", direct_ids)
        .execute()
    ).data or []

    primary_ids = [row["id"] for row in direct_rows if row.get("parent_clinic_id") is None]

    location_rows: list[dict] = []
    if primary_ids:
        location_rows = (
            db.table("clinics")
            .select("*")
            .in_("parent_clinic_id", primary_ids)
            .execute()
        ).data or []

    clinics: list[dict] = []
    for row in direct_rows:
        is_primary = row.get("parent_clinic_id") is None
        clinics.append({**row, "role": role_by_clinic_id[row["id"]], "is_primary": is_primary})
    for row in location_rows:
        parent_role = role_by_clinic_id.get(row["parent_clinic_id"], "staff")
        clinics.append({**row, "role": parent_role, "is_primary": False})

    clinics.sort(key=lambda c: (not c["is_primary"], c.get("created_at") or ""))
    return clinics


def resolve_clinic(authorization: str | None, x_clinic_id: str | None = None) -> tuple[str, dict]:
    """
    Resolve the caller's JWT to a specific clinic.

    If x_clinic_id is supplied (the frontend's active-location selection), it
    must be one of the clinics this user can access — otherwise 403. If
    omitted, defaults to the first clinic in the user's list (primary-first),
    which is identical to the behavior every existing single-location account
    already gets.
    """
    user_id = _get_authenticated_user_id(authorization)
    clinics = _get_clinics_for_user(user_id)

    if x_clinic_id:
        match = next((c for c in clinics if c["id"] == x_clinic_id), None)
        if not match:
            raise HTTPException(status_code=403, detail="You don't have access to that clinic")
        return match["id"], match

    primary = clinics[0]
    return primary["id"], primary


def require_own_clinic(record_clinic_id: str | None, caller_clinic_id: str, not_found_detail: str = "Not found") -> None:
    """
    Raise 404 if a fetched record doesn't belong to the caller's clinic.
    (404, not 403 — avoids confirming a record's existence to an unauthorized caller.)
    """
    if record_clinic_id != caller_clinic_id:
        raise HTTPException(status_code=404, detail=not_found_detail)
