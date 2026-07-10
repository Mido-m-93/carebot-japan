# apps/api/routers/audit.py
"""
Activity log — read-only view of audit_logs for the caller's clinic.
Every AI processing run, appointment, SMS, and claims action is already
written to audit_logs (see services/scheduling.py, routers/claims.py) as
the APPI compliance trail; this just exposes it to the dashboard.
"""
from fastapi import APIRouter, Header, Query
from typing import Annotated
from services.db import get_db
from services.auth import resolve_clinic

router = APIRouter()


@router.get("/")
def list_audit_log(
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
    limit: int = Query(default=50, le=200),
):
    """List recent activity for the caller's clinic, most recent first."""
    clinic_id, _clinic = resolve_clinic(authorization, x_clinic_id)
    db = get_db()
    return (
        db.table("audit_logs")
        .select("*")
        .eq("clinic_id", clinic_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )
