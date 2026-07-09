# apps/api/services/auth.py
"""
Shared auth helper — validates a Supabase JWT and resolves the caller's clinic.

Used by every staff-only endpoint so that clinic_id is always derived from the
authenticated user, never trusted from a client-supplied path/body parameter.
"""
from fastapi import HTTPException
from services.db import get_db


def _get_clinic_id_for_user(user_id: str) -> str:
    """
    Look up the clinic that this Supabase user belongs to.
    Expects a `clinic_users` table with (clinic_id, user_id) columns.
    Raises HTTP 404 if no mapping exists.
    """
    db = get_db()
    # Avoid .single()/.maybe_single() — on this postgrest/PostgREST version
    # combo, a zero-row result raises APIError instead of returning
    # data=None, which would surface as an unhandled 500 instead of a
    # clean 404. A plain list query + length check sidesteps that.
    rows = (
        db.table("clinic_users")
        .select("clinic_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not rows.data:
        raise HTTPException(status_code=404, detail="No clinic found for this user")
    return rows.data[0]["clinic_id"]


def resolve_clinic(authorization: str | None) -> tuple[str, dict]:
    """
    Parse the Bearer token from the Authorization header, validate it against
    Supabase Auth, and return (clinic_id, clinic_row).

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

    clinic_id = _get_clinic_id_for_user(user.id)

    rows = db.table("clinics").select("*").eq("id", clinic_id).limit(1).execute()
    if not rows.data:
        raise HTTPException(status_code=404, detail="Clinic not found")

    return clinic_id, rows.data[0]


def require_own_clinic(record_clinic_id: str | None, caller_clinic_id: str, not_found_detail: str = "Not found") -> None:
    """
    Raise 404 if a fetched record doesn't belong to the caller's clinic.
    (404, not 403 — avoids confirming a record's existence to an unauthorized caller.)
    """
    if record_clinic_id != caller_clinic_id:
        raise HTTPException(status_code=404, detail=not_found_detail)
