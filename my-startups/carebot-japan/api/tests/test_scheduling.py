# apps/api/tests/test_scheduling.py
"""
Tests for services/scheduling.py's autonomous cancellation/availability
handling -- the part that lets a LINE patient's "cancel my appointment" or
a slot conflict resolve without a human, by correlating against their LINE
user ID and asking a clarifying question (reply with a number) when genuinely
ambiguous, instead of guessing or always falling back to a human.
"""
from unittest.mock import patch

import pytest

import services.scheduling as scheduling


CLINIC_ID = "clinic-1"


@pytest.fixture
def clinic(fake_db):
    fake_db.rows["clinics"] = [
        {"id": CLINIC_ID, "name": "Test Clinic", "name_jp": "テストクリニック", "active": True, "tier": "pro"},
    ]
    fake_db.rows["clinic_schedules"] = [
        {"clinic_id": CLINIC_ID, "day_of_week": d, "open_time": "09:00", "close_time": "18:00", "slot_minutes": 15}
        for d in range(7)
    ]
    return fake_db


@pytest.fixture(autouse=True)
def patch_db(monkeypatch, clinic):
    monkeypatch.setattr(scheduling, "get_db", lambda: clinic)
    import routers.appointments as appointments_module
    monkeypatch.setattr(appointments_module, "get_db", lambda: clinic)


class TestCancellation:
    def test_single_match_auto_cancels_without_human(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": None},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "cancellation", "confidence": 0.95}):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I wanna cancel the appointment",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "auto_cancelled"
        assert result["appointment_id"] == "appt-1"
        assert clinic.rows["appointments"][0]["status"] == "cancelled"
        # No review_queue entry should have been created -- no human involved.
        assert clinic.rows.get("review_queue", []) == []

    def test_no_match_reports_cleanly_no_human_queue(self, clinic):
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "cancellation", "confidence": 0.95}):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="cancel please", source="line", line_user_id="U999",
            )
        assert result["status"] == "cancellation_no_match"

    def test_multiple_matches_asks_clarifying_question(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": None},
            {"id": "appt-2", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-05T10:00:00+09:00", "patient_name": None},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "cancellation", "confidence": 0.95}):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="cancel my appointment", source="line", line_user_id="U123",
            )

        assert result["status"] == "awaiting_cancel_choice"
        assert len(result["options"]) == 2
        # A pending clarification row should exist so the next message resolves against it.
        pending = [r for r in clinic.rows["review_queue"] if r["status"] == "awaiting_reply"]
        assert len(pending) == 1
        assert pending[0]["line_user_id"] == "U123"

    def test_no_line_user_id_falls_back_to_human_review(self, clinic):
        with patch.object(scheduling, "classify_intent", return_value={"intent": "cancellation", "confidence": 0.95}):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="cancel please", source="web", line_user_id=None,
            )
        assert result["status"] == "queued_for_review"
        assert clinic.rows["review_queue"][0]["status"] == "pending"

    def test_reply_with_number_resolves_the_ambiguous_cancellation(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": None},
            {"id": "appt-2", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-05T10:00:00+09:00", "patient_name": None},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "cancellation", "confidence": 0.95}):
            scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="cancel my appointment", source="line", line_user_id="U123",
            )

        # Patient replies "2" -- should resolve to the second appointment,
        # WITHOUT re-running intent classification (a bare "2" would
        # otherwise misclassify as out_of_scope).
        with patch.object(scheduling, "classify_intent", side_effect=AssertionError("should not be called")):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="2", source="line", line_user_id="U123",
            )

        assert result["status"] == "auto_cancelled"
        assert result["appointment_id"] == "appt-2"
        assert clinic.rows["appointments"][1]["status"] == "cancelled"
        assert clinic.rows["appointments"][0]["status"] == "confirmed"  # untouched

    def test_unparseable_reply_reasks_instead_of_guessing(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": None},
            {"id": "appt-2", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-05T10:00:00+09:00", "patient_name": None},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "cancellation", "confidence": 0.95}):
            scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="cancel", source="line", line_user_id="U123",
            )

        result = scheduling.process_message(
            clinic_id=CLINIC_ID, raw_message="whichever is fine", source="line", line_user_id="U123",
        )

        assert result["status"] == "clarification_unclear"
        assert clinic.rows["appointments"][0]["status"] == "confirmed"
        assert clinic.rows["appointments"][1]["status"] == "confirmed"


class TestAvailabilityCheck:
    def test_available_slot_books_normally(self, clinic):
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Test Patient", "preferred_date": "2099-01-01", "preferred_time": "10:00",
                 "confidence": 0.95, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="book me for Jan 1 at 10am",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "confirmed"
        assert result["scheduled_at"] == "2099-01-01T10:00:00+09:00"

    def test_conflicting_slot_offers_alternatives_instead_of_double_booking(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "existing", "clinic_id": CLINIC_ID, "line_user_id": "U999",
             "status": "confirmed", "scheduled_at": "2099-01-01T10:00:00+09:00", "patient_name": "Someone Else"},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Test Patient", "preferred_date": "2099-01-01", "preferred_time": "10:00",
                 "confidence": 0.95, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="book me for Jan 1 at 10am",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "awaiting_alternative_time"
        assert "10:00" not in result["alternatives"]
        # No duplicate booking at the conflicting time was created.
        scheduled_times = [a["scheduled_at"] for a in clinic.rows["appointments"]]
        assert scheduled_times.count("2099-01-01T10:00:00+09:00") == 1

    def test_choosing_an_alternative_time_books_it(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "existing", "clinic_id": CLINIC_ID, "line_user_id": "U999",
             "status": "confirmed", "scheduled_at": "2099-01-01T10:00:00+09:00", "patient_name": "Someone Else"},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Test Patient", "preferred_date": "2099-01-01", "preferred_time": "10:00",
                 "confidence": 0.95, "field_confidences": {},
             }):
            offered = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="book me for Jan 1 at 10am",
                source="line", line_user_id="U123",
            )
        assert offered["status"] == "awaiting_alternative_time"

        result = scheduling.process_message(
            clinic_id=CLINIC_ID, raw_message="1", source="line", line_user_id="U123",
        )

        assert result["status"] == "confirmed"
        assert result["scheduled_at"] == f"2099-01-01T{offered['alternatives'][0]}:00+09:00"
