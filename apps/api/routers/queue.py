# apps/api/routers/queue.py
from fastapi import APIRouter
from pydantic import BaseModel
from services.db import get_db
from services.scheduling import process_message

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
    resolved_by: str        # user UUID
    resolution: dict        # corrected appointment data
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
        appt = {
            "clinic_id": r.get("clinic_id"),
            "patient_name": r.get("patient_name"),
            "patient_phone": r.get("patient_phone"),
            "scheduled_at": (
                f"{r['preferred_date']}T{r['preferred_time']}:00+09:00"
                if r.get("preferred_date") and r.get("preferred_time") else None
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

    return {
        "status": "resolved",
        "item_id": item_id,
        "appointment_id": appointment_id,
    }


@router.post("/{item_id}/dismiss")
def dismiss_queue_item(item_id: str):
    """Dismiss a review queue item without creating an appointment."""
    db = get_db()
    db.table("review_queue").update({"status": "dismissed"}).eq("id", item_id).execute()
    return {"status": "dismissed", "item_id": item_id}
