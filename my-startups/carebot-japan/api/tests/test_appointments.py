# apps/api/tests/test_appointments.py
"""
Tests for routers/appointments.py's POST /book -- the patient-facing web
booking form. Unlike the LINE/email conversational pipeline
(services/scheduling.py), this endpoint takes structured fields directly, so
it needs its own past-date/time guard rather than inheriting scheduling.py's.
"""
from datetime import datetime, timezone, timedelta

import pytest


CLINIC_ID = "clinic-1"
JST = timezone(timedelta(hours=9))


def _frozen_now(fixed):
    """A datetime subclass whose .now() always returns `fixed`, everything else unchanged."""
    class _Frozen(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed.astimezone(tz) if tz else fixed
    return _Frozen


@pytest.fixture
def clinic(fake_db):
    fake_db.rows["clinics"] = [
        {"id": CLINIC_ID, "name": "Test Clinic", "name_jp": "テストクリニック", "tier": "pro"},
    ]
    fake_db.rows["clinic_schedules"] = [
        {"clinic_id": CLINIC_ID, "day_of_week": d, "open_time": "09:00", "close_time": "18:00", "slot_minutes": 15}
        for d in range(7)
    ]
    return fake_db


class TestBookPastDatetimeGuard:
    def test_booking_todays_date_at_an_already_passed_time_is_rejected(self, appointments_client, appointments_app, clinic, monkeypatch):
        _app, appointments_module = appointments_app
        # It's 16:00 JST today; requesting 10:00 today is already in the past.
        monkeypatch.setattr(appointments_module, "datetime", _frozen_now(datetime(2026, 7, 30, 16, 0, tzinfo=JST)))

        res = appointments_client.post("/appointments/book", json={
            "clinic_id": CLINIC_ID,
            "patient_name": "Test Patient",
            "preferred_date": "2026-07-30",
            "preferred_time": "10:00",
            "visit_reason": "checkup",
        })

        assert res.status_code == 409
        assert res.json()["detail"]["error"] == "date_in_the_past"
        assert clinic.rows.get("appointments", []) == []

    def test_booking_a_past_date_entirely_is_rejected(self, appointments_client, appointments_app, clinic, monkeypatch):
        _app, appointments_module = appointments_app
        monkeypatch.setattr(appointments_module, "datetime", _frozen_now(datetime(2026, 7, 30, 16, 0, tzinfo=JST)))

        res = appointments_client.post("/appointments/book", json={
            "clinic_id": CLINIC_ID,
            "patient_name": "Test Patient",
            "preferred_date": "2020-01-05",
            "preferred_time": "10:00",
            "visit_reason": "checkup",
        })

        assert res.status_code == 409
        assert res.json()["detail"]["error"] == "date_in_the_past"
        assert clinic.rows.get("appointments", []) == []

    def test_booking_todays_date_at_a_still_upcoming_time_succeeds(self, appointments_client, appointments_app, clinic, monkeypatch):
        _app, appointments_module = appointments_app
        # Same "now" as above, but 17:00 hasn't happened yet -- must NOT be rejected.
        monkeypatch.setattr(appointments_module, "datetime", _frozen_now(datetime(2026, 7, 30, 16, 0, tzinfo=JST)))

        res = appointments_client.post("/appointments/book", json={
            "clinic_id": CLINIC_ID,
            "patient_name": "Test Patient",
            "preferred_date": "2026-07-30",
            "preferred_time": "17:00",
            "visit_reason": "checkup",
        })

        assert res.status_code == 200
        assert res.json()["status"] == "confirmed"
        assert len(clinic.rows.get("appointments", [])) == 1
