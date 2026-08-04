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


@router.get("")
def list_audit_log(
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
    limit: int = Query(default=50, le=200),
    actions: str | None = Query(default=None, description="Comma-separated action types, e.g. 'appointment_created,appointment_cancelled'"),
):
    """List recent activity for the caller's clinic, most recent first."""
    clinic_id, _clinic = resolve_clinic(authorization, x_clinic_id)
    db = get_db()
    query = db.table("audit_logs").select("*").eq("clinic_id", clinic_id)

    if actions:
        action_list = [a.strip() for a in actions.split(",") if a.strip()]
        if action_list:
            query = query.in_("action", action_list)

    return query.order("created_at", desc=True).limit(limit).execute().data
