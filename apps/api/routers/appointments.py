# apps/api/routers/appointments.py
from fastapi import APIRouter, Query
from services.db import get_db

router = APIRouter()


@router.get("/{clinic_id}")
def list_appointments(
    clinic_id: str,
    from_date: str = Query(default=None, description="YYYY-MM-DD"),
    to_date: str = Query(default=None, description="YYYY-MM-DD"),
):
    """List appointments for a clinic, optionally filtered by date range."""
    db = get_db()
    query = (
        db.table("appointments")
        .select("*")
        .eq("clinic_id", clinic_id)
        .order("scheduled_at", desc=False)
    )
    if from_date:
        query = query.gte("scheduled_at", f"{from_date}T00:00:00+09:00")
    if to_date:
        query = query.lte("scheduled_at", f"{to_date}T23:59:59+09:00")

    return query.execute().data


@router.patch("/{appointment_id}/cancel")
def cancel_appointment(appointment_id: str):
    """Cancel an appointment."""
    db = get_db()
    result = (
        db.table("appointments")
        .update({"status": "cancelled"})
        .eq("id", appointment_id)
        .execute()
    )
    return {"status": "cancelled", "appointment_id": appointment_id}
