# apps/api/services/calendar.py
"""
Google Calendar push — SIMULATED.
No real Google API calls are made yet (no OAuth wiring exists). This logs
exactly what would be sent to Google Calendar and always returns None, so
callers correctly report that no sync happened. Kept as a no-op so the
booking flow can be exercised end-to-end before real integration is built.
"""
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
    Always returns None — no real Google API call is made, so callers must not
    report a calendar sync as having happened. Kept as a no-op (rather than
    removed) so the booking flow still logs what *would* be sent once real
    OAuth integration exists.
    """
    if not scheduled_at:
        print("[calendar] No scheduled_at — skipping calendar push")
        return None

    start = datetime.fromisoformat(scheduled_at)
    end = start + timedelta(minutes=duration_minutes)
    title = f"{patient_name} - {visit_reason}" if visit_reason else patient_name

    print(
        "[calendar] Would create event (not sent — no real Google Calendar integration yet):\n"
        f"    calendar: {clinic_name}\n"
        f'    title: "{title}"\n'
        f"    start: {start.isoformat()}\n"
        f"    end:   {end.isoformat()}"
    )
    return None
