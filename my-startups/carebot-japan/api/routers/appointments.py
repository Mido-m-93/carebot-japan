# apps/api/routers/appointments.py
from fastapi import APIRouter, Query, HTTPException, Header, Request
from pydantic import BaseModel
from typing import Annotated
from services.db import get_db
from services.email import send_appointment_confirmation
from services.calendar import push_appointment_to_calendar
from services.auth import resolve_clinic, require_own_clinic
from services.quota import quota_exceeded, STARTER_MONTHLY_LIMIT
from services.limiter import limiter
from services.booking_time import is_past_datetime
from datetime import datetime, date, time, timedelta, timezone

router = APIRouter()


class BookingRequest(BaseModel):
    clinic_id: str
    patient_name: str
    patient_email: str | None = None
    patient_phone: str | None = None
    preferred_date: str | None = None   # YYYY-MM-DD
    preferred_time: str | None = None   # HH:MM
    visit_reason: str | None = None
    is_first_visit: bool | None = None
    lang: str = "en"                    # 'en' | 'ja'


@router.post("/book")
@limiter.limit("60/minute")
def book_appointment(request: Request, body: BookingRequest):
    """Patient-facing booking form — auto-confirms directly, no review queue needed."""
    db = get_db()

    clinic_rows = db.table("clinics").select("name, name_jp, tier").eq("id", body.clinic_id).limit(1).execute()
    clinic_row_data = clinic_rows.data[0] if clinic_rows.data else None
    if not clinic_row_data:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic_name = clinic_row_data.get("name_jp") or clinic_row_data.get("name")

    if quota_exceeded({"id": body.clinic_id, "tier": clinic_row_data.get("tier")}):
        raise HTTPException(
            status_code=402,
            detail={
                "error": "plan_limit_reached",
                "message": f"This clinic has reached its Starter plan limit of {STARTER_MONTHLY_LIMIT} appointments this month. Please contact the clinic directly to book.",
            },
        )

    # Check availability before booking
    if body.preferred_date and body.preferred_time:
        now_jst = datetime.now(tz=timezone(timedelta(hours=9)))
        if is_past_datetime(body.preferred_date, body.preferred_time, now_jst):
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "date_in_the_past",
                    "message": f"{body.preferred_date} at {body.preferred_time} has already passed. Please choose a future date and time.",
                },
            )

        availability = get_available_slots(db, body.clinic_id, body.preferred_date)
        if not availability["is_open"]:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "clinic_closed",
                    "message": f"The clinic is closed on {body.preferred_date}. Please choose a different date.",
                }
            )
        slot = next((s for s in availability["slots"] if s["time"] == body.preferred_time), None)
        if slot and not slot["available"]:
            next_slots = [s["time"] for s in availability["slots"] if s["available"]][:3]
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "slot_taken",
                    "message": f"{body.preferred_date} at {body.preferred_time} is already booked.",
                    "next_available": next_slots,
                }
            )

    raw_message = (
        f"Name: {body.patient_name}"
        + (f"\nEmail: {body.patient_email}" if body.patient_email else "")
        + (f"\nPhone: {body.patient_phone}" if body.patient_phone else "")
        + (f"\nDate: {body.preferred_date}" if body.preferred_date else "")
        + (f"\nTime: {body.preferred_time}" if body.preferred_time else "")
        + (f"\nReason: {body.visit_reason}" if body.visit_reason else "")
        + (f"\nFirst visit: {'Yes' if body.is_first_visit else 'No'}" if body.is_first_visit is not None else "")
    )

    # Create appointment directly — data is structured, no AI extraction needed
    appt = {
        "clinic_id": body.clinic_id,
        "patient_name": body.patient_name,
        "patient_phone": body.patient_phone,
        "scheduled_at": (
            f"{body.preferred_date}T{body.preferred_time}:00+09:00"
            if body.preferred_date and body.preferred_time else None
        ),
        "visit_reason": body.visit_reason,
        "is_first_visit": body.is_first_visit,
        "status": "confirmed",
        "source": "booking_form",
        "raw_message": raw_message,
    }
    result = db.table("appointments").insert(appt).execute()
    appointment_id = result.data[0]["id"] if result.data else None

    # Send confirmation email immediately
    email_sent = False
    if body.patient_email:
        email_id = send_appointment_confirmation(
            to_email=body.patient_email,
            patient_name=body.patient_name,
            clinic_name=clinic_name,
            preferred_date=body.preferred_date,
            preferred_time=body.preferred_time,
            visit_reason=body.visit_reason,
            is_first_visit=body.is_first_visit,
            lang=body.lang,
        )
        email_sent = email_id is not None

    # Push to calendar (simulated — see services/calendar.py)
    calendar_event_id = push_appointment_to_calendar(
        patient_name=body.patient_name,
        clinic_name=clinic_name,
        scheduled_at=appt["scheduled_at"],
        visit_reason=body.visit_reason,
    )

    return {
        "status": "confirmed",
        "appointment_id": appointment_id,
        "patient_name": body.patient_name,
        "preferred_date": body.preferred_date,
        "preferred_time": body.preferred_time,
        "email_sent": email_sent,
        "calendar_synced": calendar_event_id is not None,
    }


def get_available_slots(db, clinic_id: str, date_str: str) -> dict:
    """
    Shared helper: returns clinic schedule + available time slots for a given date.
    Used by the /slots endpoint and the resolve availability check.
    """
    target = datetime.strptime(date_str, "%Y-%m-%d").date()
    day_of_week = target.weekday() + 1  # Python: Mon=0 → DB: Mon=1 (0=Sun)
    if target.weekday() == 6:
        day_of_week = 0  # Sunday

    schedule_row = (
        db.table("clinic_schedules")
        .select("open_time, close_time, slot_minutes")
        .eq("clinic_id", clinic_id)
        .eq("day_of_week", day_of_week)
        .execute()
    )

    if not schedule_row.data:
        return {"date": date_str, "is_open": False, "slots": []}

    sched = schedule_row.data[0]
    open_h, open_m = map(int, sched["open_time"].split(":")[:2])
    close_h, close_m = map(int, sched["close_time"].split(":")[:2])
    slot_min = sched.get("slot_minutes", 15)

    # Fetch booked slots for that day
    day_start = f"{date_str}T00:00:00+09:00"
    day_end   = f"{date_str}T23:59:59+09:00"
    booked_rows = (
        db.table("appointments")
        .select("scheduled_at")
        .eq("clinic_id", clinic_id)
        .eq("status", "confirmed")
        .gte("scheduled_at", day_start)
        .lte("scheduled_at", day_end)
        .execute()
    )
    booked_times = set()
    for row in (booked_rows.data or []):
        if row["scheduled_at"]:
            t = row["scheduled_at"][11:16]  # "HH:MM"
            booked_times.add(t)

    # Generate all slots. A slot already booked OR already passed (for
    # today's date) is not available -- otherwise a same-day request late in
    # the day gets offered its own morning as an "available alternative".
    now_jst = datetime.now(tz=timezone(timedelta(hours=9)))
    slots = []
    current = datetime.combine(target, time(open_h, open_m))
    end     = datetime.combine(target, time(close_h, close_m))
    while current < end:
        slot_str = current.strftime("%H:%M")
        is_free = slot_str not in booked_times and not is_past_datetime(date_str, slot_str, now_jst)
        slots.append({"time": slot_str, "available": is_free})
        current += timedelta(minutes=slot_min)

    return {
        "date": date_str,
        "is_open": True,
        "open_time": sched["open_time"][:5],
        "close_time": sched["close_time"][:5],
        "slot_minutes": slot_min,
        "slots": slots,
    }


@router.get("/slots")
@limiter.limit("60/minute")
def available_slots(
    request: Request,
    clinic_id: str = Query(...),
    date: str = Query(..., description="YYYY-MM-DD"),
):
    """Return available appointment slots for a given clinic and date."""
    db = get_db()
    return get_available_slots(db, clinic_id, date)


@router.get("")
def list_appointments(
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
    from_date: str = Query(default=None, description="YYYY-MM-DD"),
    to_date: str = Query(default=None, description="YYYY-MM-DD"),
    include_test: bool = Query(default=False, description="Include rows created by the Test Message tool"),
):
    """
    List appointments for the caller's clinic, optionally filtered by date
    range. Excludes Test Message tool rows (is_test) by default so they
    never pollute the real dashboard/stats -- pass include_test=true to see
    them (e.g. for cleanup).
    """
    clinic_id, _clinic = resolve_clinic(authorization, x_clinic_id)
    db = get_db()
    query = (
        db.table("appointments")
        .select("*")
        .eq("clinic_id", clinic_id)
        .order("created_at", desc=True)
    )
    if not include_test:
        query = query.eq("is_test", False)
    if from_date:
        query = query.gte("scheduled_at", f"{from_date}T00:00:00+09:00")
    if to_date:
        query = query.lte("scheduled_at", f"{to_date}T23:59:59+09:00")

    return query.execute().data


@router.patch("/{appointment_id}/cancel")
def cancel_appointment(
    appointment_id: str,
    authorization: Annotated[str | None, Header()] = None,
    x_clinic_id: Annotated[str | None, Header(alias="X-Clinic-Id")] = None,
):
    """Cancel an appointment. Caller must be staff at the appointment's own clinic."""
    clinic_id, _clinic = resolve_clinic(authorization, x_clinic_id)
    db = get_db()

    existing = db.table("appointments").select("clinic_id").eq("id", appointment_id).limit(1).execute()
    require_own_clinic(existing.data[0]["clinic_id"] if existing.data else None, clinic_id, "Appointment not found")

    db.table("appointments").update({"status": "cancelled"}).eq("id", appointment_id).execute()
    return {"status": "cancelled", "appointment_id": appointment_id}
