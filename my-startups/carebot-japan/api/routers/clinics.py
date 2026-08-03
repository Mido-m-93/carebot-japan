"""
Public and authenticated clinic info endpoints.

GET   /clinics/by-slug/{slug}  — public, returns clinic name + ID for booking form
POST  /clinics/onboard         — authenticated, creates a new clinic + owner membership (one-time)
GET   /clinics/me              — authenticated, returns current user's clinic + slug
PATCH /clinics/me              — authenticated, owner-only, updates name/name_jp/phone
GET   /clinics/locations       — authenticated, lists every clinic the caller can access
POST  /clinics/locations       — authenticated, Enterprise-only, creates a new location
"""

import re
from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel
from typing import Annotated

from services.db import get_db
from services.auth import resolve_clinic, _get_authenticated_user_id, _get_clinics_for_user
from services.limiter import limiter

router = APIRouter()


def slugify(name: str) -> str:
    """Convert a clinic name to a URL-safe slug. e.g. 'Sakura Clinic' → 'sakura-clinic'"""
    slug = name.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "clinic"


def _ensure_line_channel_id_available(db, channel_id: str, *, exclude_clinic_id: str | None = None) -> None:
    """
    Raise 409 if another clinic already has this LINE Channel ID.

    Two clinics silently sharing one destination ID used to be possible --
    inbound LINE webhooks would then route to whichever clinic's row the
    database happened to return first (see routers/webhooks.py's
    _resolve_clinic_by_line_channel), landing real patient messages/bookings
    on the wrong clinic with no error or warning to either owner.
    """
    if not channel_id:
        return
    rows = db.table("clinics").select("id").eq("line_channel_id", channel_id).execute()
    if any(row["id"] != exclude_clinic_id for row in (rows.data or [])):
        raise HTTPException(
            status_code=409,
            detail="This LINE Channel ID is already connected to another clinic.",
        )


def unique_slug(db, base: str) -> str:
    """Return base slug if free, otherwise append -2, -3, etc."""
    candidate = base
    n = 2
    while True:
        # Avoid .maybe_single() here — it raises rather than returning
        # data=None on some postgrest-py/PostgREST version combinations
        # when zero rows match. A plain list query + length check sidesteps
        # that entirely and matches the pattern used everywhere else in
        # this codebase.
        rows = db.table("clinics").select("id").eq("slug", candidate).limit(1).execute()
        if not rows.data:
            return candidate
        candidate = f"{base}-{n}"
        n += 1


# ── GET /clinics/by-slug/{slug} ───────────────────────────────────────────────

@router.get("/by-slug/{slug}")
@limiter.limit("60/minute")
def get_clinic_by_slug(request: Request, slug: str):
    """
    Public endpoint — called by the patient booking form to resolve
    a slug to a clinic ID and display name.
    """
    db = get_db()
    rows = db.table("clinics").select("id, name").eq("slug", slug).limit(1).execute()
    if not rows.data:
        raise HTTPException(status_code=404, detail="Clinic not found")
    row = rows.data[0]
    return {
        "clinic_id": row["id"],
        "name": row["name"],
    }


# ── POST /clinics/onboard ─────────────────────────────────────────────────────

class OnboardRequest(BaseModel):
    name: str
    line_channel_id: str | None = None
    phone: str | None = None


@router.post("/onboard")
def onboard_clinic(
    body: OnboardRequest,
    authorization: Annotated[str | None, Header()] = None,
):
    """
    Create a new clinic and add the caller as its owner.

    Called once, right after signup, from the onboarding form. This replaces
    what used to be two separate client-side Supabase inserts (clinics, then
    clinic_users) made with the anon-key client -- that was neither atomic
    (a failure between the two left an orphaned clinic with no owner) nor
    architecturally sound (tenant-membership writes must never be a
    client-trusted operation). Both inserts now happen here, server-side,
    via the service-role DB client.

    A user who already belongs to a clinic gets a 409 -- onboarding is a
    one-time bootstrap, not a way to spin up additional clinics (see
    POST /clinics/locations, Enterprise-only, for that).
    """
    user_id = _get_authenticated_user_id(authorization)

    # _get_clinics_for_user raises 404 (not an empty list) when the user has
    # no clinic yet -- that's the expected, non-error path for a fresh
    # signup going through onboarding for the first time, so swallow it.
    try:
        existing = _get_clinics_for_user(user_id)
    except HTTPException as exc:
        if exc.status_code == 404:
            existing = []
        else:
            raise

    if existing:
        raise HTTPException(status_code=409, detail="This account is already linked to a clinic")

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Clinic name is required")

    db = get_db()
    line_channel_id = (body.line_channel_id or "").strip() or None
    _ensure_line_channel_id_available(db, line_channel_id)

    slug = unique_slug(db, slugify(name))

    clinic_row = {
        "name": name,
        "slug": slug,
        "line_channel_id": line_channel_id,
        "phone": (body.phone or "").strip() or None,
    }
    result = db.table("clinics").insert(clinic_row).execute()
    new_clinic = result.data[0] if result.data else None
    if not new_clinic:
        raise HTTPException(status_code=500, detail="Failed to create clinic")

    clinic_id = new_clinic["id"]

    try:
        db.table("clinic_users").insert({
            "user_id": user_id,
            "clinic_id": clinic_id,
            "role": "owner",
        }).execute()
    except Exception:
        # Compensating rollback -- there's no cross-table transaction
        # available via the Supabase client, so undo the clinic insert
        # rather than leave an orphaned clinic with no owner.
        db.table("clinics").delete().eq("id", clinic_id).execute()
        raise HTTPException(status_code=500, detail="Failed to link owner to clinic")

    return {
        "clinic_id": clinic_id,
        "name": new_clinic.get("name"),
        "slug": new_clinic.get("slug"),
    }


# ── GET /clinics/me ───────────────────────────────────────────────────────────

@router.get("/me")
def get_my_clinic(
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
):
    """
    Authenticated endpoint — returns the current user's clinic info
    including slug (used to build the shareable booking URL) and the
    fields the settings page lets an owner edit (name_jp, phone, role).
    """
    clinic_id, clinic = resolve_clinic(authorization, x_clinic_id)

    return {
        "clinic_id": clinic_id,
        "name": clinic.get("name"),
        "name_jp": clinic.get("name_jp"),
        "phone": clinic.get("phone"),
        "slug": clinic.get("slug"),
        "role": clinic.get("role"),
        "line_channel_id": clinic.get("line_channel_id"),
        # Never return the actual secret/access token to the client -- just
        # whether both are set, so the settings page can show "configured"
        # without ever re-exposing the values themselves.
        "line_channel_configured": bool(clinic.get("line_channel_secret")) and bool(clinic.get("line_channel_access_token")),
    }


# ── PATCH /clinics/me ─────────────────────────────────────────────────────────

class UpdateClinicRequest(BaseModel):
    name: str | None = None
    name_jp: str | None = None
    phone: str | None = None
    line_channel_id: str | None = None
    line_channel_secret: str | None = None
    line_channel_access_token: str | None = None


@router.patch("/me")
def update_my_clinic(
    body: UpdateClinicRequest,
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
):
    """
    Update the caller's active clinic's display name / phone. Owner-only --
    staff shouldn't be able to rename the clinic they work at. Applies to
    whichever clinic is active (not redirected to a parent like billing),
    since each location has its own name.
    """
    clinic_id, clinic = resolve_clinic(authorization, x_clinic_id)
    if clinic.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Only the clinic owner can update clinic settings")

    db = get_db()

    updates: dict = {}
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Clinic name cannot be empty")
        updates["name"] = name
    if body.name_jp is not None:
        updates["name_jp"] = body.name_jp.strip() or None
    if body.phone is not None:
        updates["phone"] = body.phone.strip() or None
    if body.line_channel_id is not None:
        new_channel_id = body.line_channel_id.strip() or None
        _ensure_line_channel_id_available(db, new_channel_id, exclude_clinic_id=clinic_id)
        updates["line_channel_id"] = new_channel_id
    # line_channel_secret / line_channel_access_token are masked on the
    # settings page (never sent back to the client -- see GET /clinics/me),
    # so only overwrite them when a real value is submitted. An empty string
    # means "left blank", not "clear it" -- otherwise re-saving the form
    # without touching these fields would wipe an already-configured
    # credential.
    if body.line_channel_secret is not None and body.line_channel_secret.strip():
        updates["line_channel_secret"] = body.line_channel_secret.strip()
    if body.line_channel_access_token is not None and body.line_channel_access_token.strip():
        updates["line_channel_access_token"] = body.line_channel_access_token.strip()

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    db.table("clinics").update(updates).eq("id", clinic_id).execute()

    # Never echo the secret/access token back, even right after the caller
    # themselves just set them -- same rule as GET /clinics/me.
    response = {"clinic_id": clinic_id, **updates}
    response.pop("line_channel_secret", None)
    response.pop("line_channel_access_token", None)
    return response


# ── GET /clinics/locations ─────────────────────────────────────────────────────

@router.get("/locations")
def list_locations(
    authorization: Annotated[str | None, Header()] = None,
):
    """
    List every clinic the caller can access — their primary clinic plus any
    locations belonging to it. Single-location accounts get back a 1-item list.
    """
    user_id = _get_authenticated_user_id(authorization)
    clinics = _get_clinics_for_user(user_id)

    return [
        {
            "clinic_id": c["id"],
            "name": c.get("name"),
            "name_jp": c.get("name_jp"),
            "slug": c.get("slug"),
            "is_primary": c["is_primary"],
            "role": c["role"],
            "active": c.get("active", True),
        }
        for c in clinics
    ]


# ── POST /clinics/locations ────────────────────────────────────────────────────

class CreateLocationRequest(BaseModel):
    name: str
    name_jp: str | None = None
    phone: str | None = None
    line_channel_id: str | None = None


@router.post("/locations")
def create_location(
    body: CreateLocationRequest,
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
):
    """
    Create a new location under the caller's active clinic.
    Enterprise-only, owner-only, and the active clinic must itself be a
    primary clinic (no nested locations).
    """
    clinic_id, clinic = resolve_clinic(authorization, x_clinic_id)

    if clinic.get("parent_clinic_id"):
        raise HTTPException(status_code=400, detail="A location can't have its own sub-locations")
    if clinic.get("tier") != "enterprise":
        raise HTTPException(status_code=403, detail="Adding locations requires the Enterprise plan")
    if clinic.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Only the clinic owner can add locations")

    db = get_db()
    _ensure_line_channel_id_available(db, body.line_channel_id)

    slug = unique_slug(db, slugify(body.name))

    row = {
        "name": body.name,
        "name_jp": body.name_jp,
        "phone": body.phone,
        "line_channel_id": body.line_channel_id,
        "slug": slug,
        "timezone": clinic.get("timezone", "Asia/Tokyo"),
        "tier": "enterprise",
        "parent_clinic_id": clinic_id,
    }
    result = db.table("clinics").insert(row).execute()
    new_clinic = result.data[0] if result.data else None

    return {
        "clinic_id": new_clinic["id"] if new_clinic else None,
        "name": body.name,
        "slug": slug,
    }


# ── PATCH /clinics/locations/{location_id} ─────────────────────────────────────

class UpdateLocationStatusRequest(BaseModel):
    active: bool


@router.patch("/locations/{location_id}")
def update_location_status(
    location_id: str,
    body: UpdateLocationStatusRequest,
    authorization: Annotated[str | None, Header()] = None,
):
    """
    Activate/deactivate a location. Owner-only, soft -- flips the same
    `active` flag services.scheduling already checks before processing a
    booking, so a deactivated location just stops accepting new
    appointments. Its row and all appointment history are untouched; this
    never deletes anything. Can't target the primary clinic itself here --
    deactivating your account's home clinic is a separate, bigger decision
    than removing one location.
    """
    user_id = _get_authenticated_user_id(authorization)
    clinics = _get_clinics_for_user(user_id)
    match = next((c for c in clinics if c["id"] == location_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Location not found")
    if match.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Only the clinic owner can change a location's status")
    if not match.get("parent_clinic_id"):
        raise HTTPException(status_code=400, detail="The primary clinic can't be deactivated from here")

    db = get_db()
    db.table("clinics").update({"active": body.active}).eq("id", location_id).execute()

    return {"clinic_id": location_id, "active": body.active}
