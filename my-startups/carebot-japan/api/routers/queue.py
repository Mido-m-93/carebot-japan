# apps/api/routers/queue.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.db import get_db
from services.scheduling import process_message
from services.email import send_appointment_confirmation
from services.calendar import push_appointment_to_calendar
from routers.appointments import get_available_slots

router = APIRouter()


@router.get("/{clinic_id}")
def list_queue(clinic_id: str, status: str = "pending"):
    """List review queue items for a clinic."""
    db = get_db()
    return (
        db.table("review_queue")
        .select("*")
        .eq("clinic_id", clinic_id)
        .eq("status", status)
        .order("created_at", desc=True)
        .execute()
        .data
    )


class ResolveRequest(BaseModel):
    resolved_by: str | None = None  # user UUID, nullable for backward compat
    resolution: dict                # corrected appointment data
    create_appointment: bool = True


@router.post("/{item_id}/resolve")
def resolve_queue_item(item_id: str, body: ResolveRequest):
    """
    Human resolves a review queue item.
    Optionally creates the appointment from the corrected data.
    """
    db = get_db()

    # Mark resolved
    db.table("review_queue").update({
        "status": "resolved",
        "resolved_by": body.resolved_by,
        "resolution": body.resolution,
    }).eq("id", item_id).execute()

    # Optionally book the appointment from corrected data
    appointment_id = None
    if body.create_appointment:
        r = body.resolution

        # ── Availability check ────────────────────────────────
        preferred_date = r.get("preferred_date")
        preferred_time = r.get("preferred_time")
        clinic_id_r    = r.get("clinic_id")

        if preferred_date and preferred_time and clinic_id_r:
            availability = get_available_slots(db, clinic_id_r, preferred_date)
            if not availability["is_open"]:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": "clinic_closed",
                        "message": f"The clinic is closed on {preferred_date}. Please choose a different date.",
                        "date": preferred_date,
                    }
                )
            slot = next((s for s in availability["slots"] if s["time"] == preferred_time), None)
            if slot and not slot["available"]:
                next_slots = [s["time"] for s in availability["slots"] if s["available"]][:3]
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": "slot_taken",
                        "message": f"{preferred_date} at {preferred_time} is already booked.",
                        "date": preferred_date,
                        "requested_time": preferred_time,
                        "next_available": next_slots,
                    }
                )

        appt = {
            "clinic_id": clinic_id_r,
            "patient_name": r.get("patient_name"),
            "patient_phone": r.get("patient_phone"),
            "scheduled_at": (
                f"{preferred_date}T{preferred_time}:00+09:00"
                if preferred_date and preferred_time else None
            ),
            "visit_reason": r.get("visit_reason"),
            "is_first_visit": r.get("is_first_visit"),
            "status": "confirmed",
            "source": "manual_review",
            "raw_message": r.get("raw_message"),
        }
        result = db.table("appointments").insert(appt).execute()
        if result.data:
            appointment_id = result.data[0]["id"]

    # Send confirmation email if patient email is available
    email_id = None
    calendar_event_id = None
    patient_email = r.get("patient_email") if body.create_appointment else None
    if body.create_appointment and appointment_id:
        clinic_row = db.table("clinics").select("name, name_jp").eq("id", r.get("clinic_id")).single().execute()
        clinic_name = (clinic_row.data.get("name_jp") or clinic_row.data.get("name")) if clinic_row.data else "クリニック"

        if patient_email:
            email_id = send_appointment_confirmation(
                to_email=patient_email,
                patient_name=r.get("patient_name") or "患者様",
                clinic_name=clinic_name,
                preferred_date=r.get("preferred_date"),
                preferred_time=r.get("preferred_time"),
                visit_reason=r.get("visit_reason"),
                is_first_visit=r.get("is_first_visit"),
                lang=r.get("lang", "en"),
            )

        # Push to calendar (simulated — see services/calendar.py)
        calendar_event_id = push_appointment_to_calendar(
            patient_name=r.get("patient_name") or "患者様",
            clinic_name=clinic_name,
            scheduled_at=appt["scheduled_at"],
            visit_reason=r.get("visit_reason"),
        )

    return {
        "status": "resolved",
        "item_id": item_id,
        "appointment_id": appointment_id,
        "email_sent": email_id is not None,
        "email_error": "No patient email provided" if not patient_email else (None if email_id else "Email send failed — check RESEND_API_KEY"),
        "calendar_synced": calendar_event_id is not None,
    }


@router.post("/{item_id}/dismiss")
def dismiss_queue_item(item_id: str):
    """Dismiss a review queue item without creating an appointment."""
    db = get_db()
    db.table("review_queue").update({"status": "dismissed"}).eq("id", item_id).execute()
    return {"status": "dismissed", "item_id": item_id}
