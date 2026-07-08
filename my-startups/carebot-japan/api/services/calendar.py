# apps/api/services/calendar.py
"""
Google Calendar push — SIMULATED.
No real Google API calls are made yet (no OAuth wiring exists). This logs
exactly what would be sent to Google Calendar and returns a fake event ID,
so the booking flow can be exercised end-to-end before real integration
is built.
"""
import uuid
from datetime import datetime, timedelta


def push_appointment_to_calendar(
    *,
    patient_name: str,
    clinic_name: str,
    scheduled_at: str | None,  # ISO datetime, e.g. "2026-07-09T10:00:00+09:00"
    duration_minutes: int = 15,
    visit_reason: str | None = None,
) -> str | None:
    """
    Simulates pushing a confirmed appointment to Google Calendar.
    Returns a fake event ID, or None if there's no date/time to push.
    """
    if not scheduled_at:
        print("[calendar] No scheduled_at — skipping calendar push")
        return None

    start = datetime.fromisoformat(scheduled_at)
    end = start + timedelta(minutes=duration_minutes)
    title = f"{patient_name} - {visit_reason}" if visit_reason else patient_name
    event_id = f"mock-evt-{uuid.uuid4().hex[:8]}"

    print(
        "[calendar] Would create event:\n"
        f"    calendar: {clinic_name}\n"
        f'    title: "{title}"\n'
        f"    start: {start.isoformat()}\n"
        f"    end:   {end.isoformat()}\n"
        f'[calendar] event_id: "{event_id}" (mock — no real Google Calendar API call made)'
    )
    return event_id
