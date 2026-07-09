"""
Public and authenticated clinic info endpoints.

GET  /clinics/by-slug/{slug}  — public, returns clinic name + ID for booking form
GET  /clinics/me              — authenticated, returns current user's clinic + slug
"""

import re
from fastapi import APIRouter, HTTPException, Header
from typing import Annotated

from services.db import get_db
from services.auth import resolve_clinic

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
):
    """
    Authenticated endpoint — returns the current user's clinic info
    including slug (used to build the shareable booking URL).
    """
    clinic_id, clinic = resolve_clinic(authorization)

    return {
        "clinic_id": clinic_id,
        "name": clinic.get("name"),
        "slug": clinic.get("slug"),
    }
