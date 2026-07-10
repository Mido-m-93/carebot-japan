"""
Public and authenticated clinic info endpoints.

GET  /clinics/by-slug/{slug}  — public, returns clinic name + ID for booking form
GET  /clinics/me              — authenticated, returns current user's clinic + slug
GET  /clinics/locations       — authenticated, lists every clinic the caller can access
POST /clinics/locations       — authenticated, Enterprise-only, creates a new location
"""

import re
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Annotated

from services.db import get_db
from services.auth import resolve_clinic, _get_authenticated_user_id, _get_clinics_for_user

router = APIRouter()


def slugify(name: str) -> str:
    """Convert a clinic name to a URL-safe slug. e.g. 'Sakura Clinic' → 'sakura-clinic'"""
    slug = name.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "clinic"


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
def get_clinic_by_slug(slug: str):
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


# ── GET /clinics/me ───────────────────────────────────────────────────────────

@router.get("/me")
def get_my_clinic(
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
):
    """
    Authenticated endpoint — returns the current user's clinic info
    including slug (used to build the shareable booking URL).
    """
    clinic_id, clinic = resolve_clinic(authorization, x_clinic_id)

    return {
        "clinic_id": clinic_id,
        "name": clinic.get("name"),
        "slug": clinic.get("slug"),
    }


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
