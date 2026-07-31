# apps/api/tests/test_scheduling.py
"""
Tests for services/scheduling.py's autonomous cancellation/availability
handling -- the part that lets a LINE patient's "cancel my appointment" or
a slot conflict resolve without a human, by correlating against their LINE
user ID and asking a clarifying question (reply with a number) when genuinely
ambiguous, instead of guessing or always falling back to a human.
"""
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

import pytest

import services.scheduling as scheduling


JST = timezone(timedelta(hours=9))


def _frozen_now(fixed):
    """A datetime subclass whose .now() always returns `fixed`, everything else (strptime, etc.) unchanged."""
    class _Frozen(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed.astimezone(tz) if tz else fixed
    return _Frozen


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
                 "visit_reason": "checkup", "confidence": 0.95, "field_confidences": {},
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
                 "visit_reason": "checkup", "confidence": 0.95, "field_confidences": {},
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
                 "visit_reason": "checkup", "confidence": 0.95, "field_confidences": {},
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

    def test_choosing_an_alternative_that_has_since_passed_is_rejected(self, clinic, monkeypatch):
        # Regression test: the alternatives are computed once, when the
        # clarification is first created. If the patient takes long enough to
        # reply that the offered time itself has now passed, picking it must
        # NOT silently book a past appointment.
        #
        # get_available_slots (which computes the alternatives) lives in
        # routers.appointments, a separate module with its own `datetime`
        # import -- it must be frozen too, not just services.scheduling's,
        # or the offered alternatives are computed against the real
        # wall-clock instead of the fixed "now" this test assumes.
        import routers.appointments as appointments_module

        clinic.rows["appointments"] = [
            {"id": "existing", "clinic_id": CLINIC_ID, "line_user_id": "U999",
             "status": "confirmed", "scheduled_at": "2026-07-30T09:00:00+09:00", "patient_name": "Someone Else"},
        ]
        monkeypatch.setattr(scheduling, "datetime", _frozen_now(datetime(2026, 7, 30, 8, 50, tzinfo=JST)))
        monkeypatch.setattr(appointments_module, "datetime", _frozen_now(datetime(2026, 7, 30, 8, 50, tzinfo=JST)))
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Test Patient", "preferred_date": "2026-07-30", "preferred_time": "09:00",
                 "visit_reason": "checkup", "confidence": 0.95, "field_confidences": {},
             }):
            offered = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="book me for today at 9am",
                source="line", line_user_id="U123",
            )
        assert offered["status"] == "awaiting_alternative_time"
        first_alternative = offered["alternatives"][0]
        assert first_alternative == "09:15"  # sanity check the fixture math, not just the assertion below

        # Time has now moved past the offered alternative before the patient replies.
        monkeypatch.setattr(scheduling, "datetime", _frozen_now(datetime(2026, 7, 30, 9, 20, tzinfo=JST)))
        result = scheduling.process_message(
            clinic_id=CLINIC_ID, raw_message="1", source="line", line_user_id="U123",
        )

        assert result["status"] == "date_in_the_past"
        scheduled_times = [a["scheduled_at"] for a in clinic.rows["appointments"]]
        assert f"2026-07-30T{first_alternative}:00+09:00" not in scheduled_times

    def test_rejecting_all_alternatives_with_a_new_time_rebooks_instead_of_looping(self, clinic):
        # Regression test: a non-numeric reply to an "alternative_time"
        # clarification used to always loop the same "reply with a number"
        # question forever, even when the reply was actually a fresh,
        # parseable date/time ("none of them, how about the 2nd at 11am?").
        clinic.rows["appointments"] = [
            {"id": "existing", "clinic_id": CLINIC_ID, "line_user_id": "U999",
             "status": "confirmed", "scheduled_at": "2099-01-01T10:00:00+09:00", "patient_name": "Someone Else"},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Test Patient", "preferred_date": "2099-01-01", "preferred_time": "10:00",
                 "visit_reason": "checkup", "confidence": 0.95, "field_confidences": {},
             }):
            offered = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="book me for Jan 1 at 10am",
                source="line", line_user_id="U123",
            )
        assert offered["status"] == "awaiting_alternative_time"

        with patch.object(scheduling, "extract_appointment", return_value={
            "patient_name": "Test Patient", "preferred_date": "2099-01-02", "preferred_time": "11:00",
            "visit_reason": "checkup", "confidence": 0.9, "field_confidences": {},
        }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="none of them, how about the 2nd at 11am?",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "confirmed"
        assert result["scheduled_at"] == "2099-01-02T11:00:00+09:00"

    def test_unparseable_alternative_reply_escalates_after_retry_cap(self, clinic):
        # Regression test: a patient who truly can't answer ("none of them"
        # with no re-parseable new time) must not be stuck in an infinite
        # "please reply with a number" loop -- after a couple of unclear
        # replies it should hand off to a human instead.
        clinic.rows["appointments"] = [
            {"id": "existing", "clinic_id": CLINIC_ID, "line_user_id": "U999",
             "status": "confirmed", "scheduled_at": "2099-01-01T10:00:00+09:00", "patient_name": "Someone Else"},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Test Patient", "preferred_date": "2099-01-01", "preferred_time": "10:00",
                 "visit_reason": "checkup", "confidence": 0.95, "field_confidences": {},
             }):
            offered = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="book me for Jan 1 at 10am",
                source="line", line_user_id="U123",
            )
        assert offered["status"] == "awaiting_alternative_time"

        with patch.object(scheduling, "extract_appointment", return_value={
            "patient_name": None, "preferred_date": None, "preferred_time": None,
            "visit_reason": None, "confidence": 0.0, "field_confidences": {},
        }):
            first = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="none of them", source="line", line_user_id="U123",
            )
            assert first["status"] == "clarification_unclear"

            second = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="still none of them", source="line", line_user_id="U123",
            )
            assert second["status"] == "clarification_unclear"

            third = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="seriously, none of them", source="line", line_user_id="U123",
            )

        assert third["status"] == "queued_for_review"
        # The clarification row was resolved (no longer awaiting reply) --
        # a fourth identical message would start a fresh conversation, not
        # keep re-asking the same question.
        pending = [r for r in clinic.rows["review_queue"] if r["status"] == "awaiting_reply"]
        assert pending == []
        assert clinic.rows["appointments"][0]["status"] == "confirmed"  # untouched

        # Regression test: the escalated review_queue row must carry the
        # already-known patient/date/time -- not the raw clarification
        # context (kind/options/nested extraction), which the dashboard
        # can't render and would show as "Not extracted" for every field.
        escalated = [r for r in clinic.rows["review_queue"] if r["status"] == "pending"]
        assert len(escalated) == 1
        assert escalated[0]["extracted_data"]["patient_name"] == "Test Patient"
        assert escalated[0]["extracted_data"]["preferred_date"] == "2099-01-01"
        # The last patient reply is preserved, with context on why it's queued.
        assert "seriously, none of them" in escalated[0]["raw_input"]
        assert "alternative_time" in escalated[0]["raw_input"]


class TestParseChoiceIndex:
    """
    Unit tests for the menu-selection digit parser used by clarification
    resolution. Ordinal ("2nd"), time-of-day ("11am", "15:00", "3時"), and
    date ("1月2日") mentions must not be mistaken for the patient picking
    option N from a numbered menu.
    """

    def test_bare_number_is_a_choice(self):
        assert scheduling._parse_choice_index("2") == 1

    def test_number_with_minor_decoration_is_a_choice(self):
        assert scheduling._parse_choice_index("no. 2 please") == 1

    def test_ordinal_date_is_not_a_choice(self):
        assert scheduling._parse_choice_index("how about the 2nd?") == -1

    def test_time_of_day_is_not_a_choice(self):
        assert scheduling._parse_choice_index("how about 11am instead") == -1
        assert scheduling._parse_choice_index("how about 15:00 instead") == -1

    def test_japanese_time_and_date_markers_are_not_a_choice(self):
        assert scheduling._parse_choice_index("15時からでお願いします") == -1
        assert scheduling._parse_choice_index("1月2日はどうですか") == -1

    def test_ordinal_and_time_together_falls_back_to_no_choice(self):
        assert scheduling._parse_choice_index("none of them, how about the 2nd at 11am?") == -1


class TestBookingDetails:
    def test_vague_request_asks_for_missing_details_instead_of_booking_blank(self, clinic):
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": None, "preferred_date": None, "preferred_time": None,
                 "visit_reason": None, "confidence": 0.0, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I would like to book an appointment please",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "awaiting_booking_details"
        assert set(result["missing"]) == {"name", "date", "time", "visit_reason"}
        assert clinic.rows.get("appointments", []) == []
        pending = [r for r in clinic.rows["review_queue"] if r["status"] == "awaiting_reply"]
        assert len(pending) == 1
        assert pending[0]["extracted_data"]["kind"] == "booking_details"

    def test_partial_details_asks_only_for_whats_still_missing(self, clinic):
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Test Patient", "preferred_date": "2099-01-01", "preferred_time": None,
                 "visit_reason": None, "confidence": 0.5, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="book me for Jan 1st",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "awaiting_booking_details"
        assert set(result["missing"]) == {"time", "visit_reason"}

    def test_missing_only_name_asks_for_name_and_then_books(self, clinic):
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": None, "preferred_date": "2099-01-01", "preferred_time": "10:00",
                 "visit_reason": "checkup", "confidence": 0.9, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="book me for Jan 1st at 10am for a checkup",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "awaiting_booking_details"
        assert result["missing"] == ["name"]
        assert clinic.rows.get("appointments", []) == []

        with patch.object(scheduling, "classify_intent", side_effect=AssertionError("should not be called")), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Yamada", "confidence": 0.9, "field_confidences": {},
             }):
            final = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="My name is Yamada", source="line", line_user_id="U123",
            )

        assert final["status"] == "confirmed"
        assert final["patient_name"] == "Yamada"
        assert clinic.rows["appointments"][0]["scheduled_at"] == "2099-01-01T10:00:00+09:00"

    def test_follow_up_reply_fills_in_missing_details_and_books(self, clinic):
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": None, "preferred_date": None, "preferred_time": None,
                 "visit_reason": None, "confidence": 0.0, "field_confidences": {},
             }):
            scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I would like to book an appointment please",
                source="line", line_user_id="U123",
            )

        # Follow-up reply -- no numbers, so intent classification must NOT be re-run.
        with patch.object(scheduling, "classify_intent", side_effect=AssertionError("should not be called")), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Tanaka", "preferred_date": "2099-01-02", "preferred_time": "11:00",
                 "visit_reason": "check-up", "confidence": 0.9, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="My name is Tanaka, Jan 2nd at 11am, just a check-up",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "confirmed"
        assert result["scheduled_at"] == "2099-01-02T11:00:00+09:00"
        assert clinic.rows["appointments"][0]["visit_reason"] == "check-up"
        assert clinic.rows["appointments"][0]["patient_name"] == "Tanaka"

    def test_still_incomplete_follow_up_reasks_for_remaining_fields(self, clinic):
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": None, "preferred_date": None, "preferred_time": None,
                 "visit_reason": None, "confidence": 0.0, "field_confidences": {},
             }):
            scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I would like to book an appointment please",
                source="line", line_user_id="U123",
            )

        with patch.object(scheduling, "extract_appointment", return_value={
            "preferred_date": "2099-01-02", "preferred_time": None,
            "visit_reason": None, "confidence": 0.3, "field_confidences": {},
        }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="how about Jan 2nd", source="line", line_user_id="U123",
            )

        assert result["status"] == "awaiting_booking_details"
        assert set(result["missing"]) == {"name", "time", "visit_reason"}
        assert clinic.rows.get("appointments", []) == []

        # A second follow-up filling in the rest completes the booking.
        with patch.object(scheduling, "extract_appointment", return_value={
            "patient_name": "Suzuki", "preferred_time": "14:00", "visit_reason": "flu symptoms",
            "confidence": 0.9, "field_confidences": {},
        }):
            final = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="My name is Suzuki, 2pm, flu symptoms",
                source="line", line_user_id="U123",
            )

        assert final["status"] == "confirmed"
        assert final["scheduled_at"] == "2099-01-02T14:00:00+09:00"
        assert clinic.rows["appointments"][0]["patient_name"] == "Suzuki"

    def test_missing_details_with_no_line_user_id_falls_back_to_human_review(self, clinic):
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": None, "preferred_date": None, "preferred_time": None,
                 "visit_reason": None, "confidence": 0.0, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I'd like to book an appointment",
                source="web", line_user_id=None,
            )

        assert result["status"] == "queued_for_review"
        assert result["reason"] == "missing_booking_details"
        assert clinic.rows["review_queue"][0]["status"] == "pending"


class TestPastDateGuard:
    def test_booking_a_past_date_is_rejected_instead_of_reported_as_fully_booked(self, clinic):
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Test Patient", "preferred_date": "2020-01-05", "preferred_time": "10:00",
                 "visit_reason": "checkup", "confidence": 0.95, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="book me for Jan 5 2020 at 10am",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "date_in_the_past"
        assert result["date"] == "2020-01-05"
        assert clinic.rows.get("appointments", []) == []

    def test_rescheduling_to_a_past_date_is_rejected(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": "Test Patient"},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "preferred_date": "2020-01-05", "preferred_time": "11:00", "confidence": 0.9, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="move it to Jan 5 2020 at 11am",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "date_in_the_past"
        assert result["date"] == "2020-01-05"
        assert clinic.rows["appointments"][0]["scheduled_at"] == "2099-01-01T14:00:00+09:00"  # untouched

    def test_booking_todays_date_at_an_already_passed_time_is_rejected(self, clinic, monkeypatch):
        # Regression test: it's 16:00 JST today, patient asks for 10:00 today.
        # The date itself isn't "in the past" (it's today), but the time is.
        fixed_now = datetime(2026, 7, 30, 16, 0, tzinfo=JST)
        monkeypatch.setattr(scheduling, "datetime", _frozen_now(fixed_now))
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Test Patient", "preferred_date": "2026-07-30", "preferred_time": "10:00",
                 "visit_reason": "checkup", "confidence": 0.95, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="book me for today at 10am",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "date_in_the_past"
        assert result["date"] == "2026-07-30"
        assert clinic.rows.get("appointments", []) == []

    def test_booking_todays_date_at_a_still_upcoming_time_is_not_rejected(self, clinic, monkeypatch):
        # Same day as above, but the requested time (17:00) hasn't happened yet
        # relative to the fixed "now" of 16:00 -- must NOT be treated as past.
        fixed_now = datetime(2026, 7, 30, 16, 0, tzinfo=JST)
        monkeypatch.setattr(scheduling, "datetime", _frozen_now(fixed_now))
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Test Patient", "preferred_date": "2026-07-30", "preferred_time": "17:00",
                 "visit_reason": "checkup", "confidence": 0.95, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="book me for today at 5pm",
                source="line", line_user_id="U123",
            )

        assert result["status"] != "date_in_the_past"


class TestSmallTalk:
    def test_small_talk_replies_directly_without_queueing(self, clinic):
        with patch.object(scheduling, "classify_intent", return_value={"intent": "small_talk", "confidence": 0.9}), \
             patch.object(scheduling, "generate_small_talk_reply", return_value="Hello! How can I help?"):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="hi there", source="line", line_user_id="U123",
            )
        assert result == {"status": "small_talk", "reply_text": "Hello! How can I help?", "lang": "en"}
        assert clinic.rows.get("review_queue", []) == []

    def test_out_of_scope_also_gets_a_direct_reply_not_a_human_queue(self, clinic):
        with patch.object(scheduling, "classify_intent", return_value={"intent": "out_of_scope", "confidence": 0.9}), \
             patch.object(scheduling, "generate_small_talk_reply", return_value="I can only help with clinic scheduling."):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="what's the weather like", source="line", line_user_id="U123",
            )
        assert result["status"] == "small_talk"
        assert clinic.rows.get("review_queue", []) == []

    def test_ai_failure_returns_none_reply_instead_of_raising(self, clinic):
        with patch.object(scheduling, "classify_intent", return_value={"intent": "small_talk", "confidence": 0.9}), \
             patch.object(scheduling, "generate_small_talk_reply", side_effect=Exception("groq down")):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="hi", source="line", line_user_id="U123",
            )
        assert result == {"status": "small_talk", "reply_text": None, "lang": "en"}


class TestGeneralInquiry:
    def test_answers_from_real_clinic_hours(self, clinic):
        captured = {}

        def fake_inquiry(message, clinic_info):
            captured["clinic_info"] = clinic_info
            return "We're open 9am-6pm every day."

        with patch.object(scheduling, "classify_intent", return_value={"intent": "general_inquiry", "confidence": 0.9}), \
             patch.object(scheduling, "generate_inquiry_reply", side_effect=fake_inquiry):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="what are your hours?", source="line", line_user_id="U123",
            )

        assert result == {"status": "inquiry_answered", "reply_text": "We're open 9am-6pm every day.", "lang": "en"}
        assert "09:00-18:00" in captured["clinic_info"]
        assert clinic.rows.get("review_queue", []) == []

    def test_no_schedule_configured_tells_ai_not_to_guess(self, clinic):
        clinic.rows["clinic_schedules"] = []
        captured = {}

        def fake_inquiry(message, clinic_info):
            captured["clinic_info"] = clinic_info
            return "Please call the clinic for hours."

        with patch.object(scheduling, "classify_intent", return_value={"intent": "general_inquiry", "confidence": 0.9}), \
             patch.object(scheduling, "generate_inquiry_reply", side_effect=fake_inquiry):
            scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="what are your hours?", source="line", line_user_id="U123",
            )

        assert "not configured" in captured["clinic_info"]


class TestReschedule:
    def test_single_match_with_new_time_in_same_message_reschedules_immediately(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": "Test Patient"},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "preferred_date": "2099-01-02", "preferred_time": "11:00", "confidence": 0.9, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="move it to Jan 2 at 11am",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "rescheduled"
        assert result["appointment_id"] == "appt-1"
        assert result["old_scheduled_at"] == "2099-01-01T14:00:00+09:00"
        assert result["new_scheduled_at"] == "2099-01-02T11:00:00+09:00"
        assert clinic.rows["appointments"][0]["scheduled_at"] == "2099-01-02T11:00:00+09:00"
        assert clinic.rows.get("review_queue", []) == []

    def test_single_match_without_new_time_asks_for_one(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": "Test Patient"},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "preferred_date": None, "preferred_time": None, "confidence": 0.5, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I need to reschedule",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "awaiting_reschedule_time"
        assert result["scheduled_at"] == "2099-01-01T14:00:00+09:00"
        pending = [r for r in clinic.rows["review_queue"] if r["status"] == "awaiting_reply"]
        assert len(pending) == 1
        assert pending[0]["extracted_data"]["kind"] == "reschedule_new_time"

    def test_awaiting_reschedule_time_then_free_text_reply_completes_it(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": "Test Patient"},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "preferred_date": None, "preferred_time": None, "confidence": 0.5, "field_confidences": {},
             }):
            scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I need to reschedule",
                source="line", line_user_id="U123",
            )

        # Free-text reply giving the new day/time -- no numbers, so intent
        # classification must NOT be re-run.
        with patch.object(scheduling, "classify_intent", side_effect=AssertionError("should not be called")), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "preferred_date": "2099-01-03", "preferred_time": "15:00", "confidence": 0.9, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="how about Jan 3rd at 3pm",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "rescheduled"
        assert result["new_scheduled_at"] == "2099-01-03T15:00:00+09:00"
        assert clinic.rows["appointments"][0]["scheduled_at"] == "2099-01-03T15:00:00+09:00"

    def test_unparseable_free_text_reasks_instead_of_guessing(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": "Test Patient"},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "preferred_date": None, "preferred_time": None, "confidence": 0.5, "field_confidences": {},
             }):
            scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I need to reschedule",
                source="line", line_user_id="U123",
            )

        with patch.object(scheduling, "extract_appointment", return_value={
            "preferred_date": None, "preferred_time": None, "confidence": 0.3, "field_confidences": {},
        }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="whenever works", source="line", line_user_id="U123",
            )

        assert result["status"] == "clarification_unclear"
        assert result["kind"] == "reschedule_new_time"
        assert clinic.rows["appointments"][0]["scheduled_at"] == "2099-01-01T14:00:00+09:00"  # untouched

    def test_unparseable_free_text_escalates_after_retry_cap(self, clinic):
        # Regression test: same "don't loop forever" gap as the numbered-
        # choice clarifications -- a patient whose new-time reply never
        # parses must eventually reach a human, not loop indefinitely.
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": "Test Patient"},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "preferred_date": None, "preferred_time": None, "confidence": 0.5, "field_confidences": {},
             }):
            scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I need to reschedule",
                source="line", line_user_id="U123",
            )

        with patch.object(scheduling, "extract_appointment", return_value={
            "preferred_date": None, "preferred_time": None, "confidence": 0.3, "field_confidences": {},
        }):
            first = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="whenever works", source="line", line_user_id="U123",
            )
            assert first["status"] == "clarification_unclear"

            second = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="still whenever works", source="line", line_user_id="U123",
            )
            assert second["status"] == "clarification_unclear"

            third = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="seriously, whenever works", source="line", line_user_id="U123",
            )

        assert third["status"] == "queued_for_review"
        pending = [r for r in clinic.rows["review_queue"] if r["status"] == "awaiting_reply"]
        assert pending == []
        assert clinic.rows["appointments"][0]["scheduled_at"] == "2099-01-01T14:00:00+09:00"  # untouched

        escalated = [r for r in clinic.rows["review_queue"] if r["status"] == "pending"]
        assert len(escalated) == 1
        assert escalated[0]["extracted_data"]["patient_name"] == "Test Patient"
        assert escalated[0]["extracted_data"]["preferred_date"] == "2099-01-01"
        assert "seriously, whenever works" in escalated[0]["raw_input"]
        assert "reschedule_new_time" in escalated[0]["raw_input"]

    def test_multiple_matches_asks_which_one(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": None},
            {"id": "appt-2", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-05T10:00:00+09:00", "patient_name": None},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "preferred_date": None, "preferred_time": None, "confidence": 0.5, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I need to reschedule", source="line", line_user_id="U123",
            )

        assert result["status"] == "awaiting_reschedule_choice"
        assert len(result["options"]) == 2

    def test_choosing_which_appointment_then_asks_for_new_time(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": None},
            {"id": "appt-2", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-05T10:00:00+09:00", "patient_name": None},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "preferred_date": None, "preferred_time": None, "confidence": 0.5, "field_confidences": {},
             }):
            scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I need to reschedule", source="line", line_user_id="U123",
            )

        with patch.object(scheduling, "classify_intent", side_effect=AssertionError("should not be called")):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="2", source="line", line_user_id="U123",
            )

        assert result["status"] == "awaiting_reschedule_time"
        assert result["scheduled_at"] == "2099-01-05T10:00:00+09:00"

    def test_choosing_appointment_with_new_time_already_known_reschedules_directly(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": None},
            {"id": "appt-2", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-05T10:00:00+09:00", "patient_name": None},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "preferred_date": "2099-01-06", "preferred_time": "11:00", "confidence": 0.9, "field_confidences": {},
             }):
            scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="move one of them to Jan 6 at 11am",
                source="line", line_user_id="U123",
            )

        result = scheduling.process_message(
            clinic_id=CLINIC_ID, raw_message="1", source="line", line_user_id="U123",
        )

        assert result["status"] == "rescheduled"
        assert result["appointment_id"] == "appt-1"
        assert result["new_scheduled_at"] == "2099-01-06T11:00:00+09:00"

    def test_new_time_conflicts_offers_alternatives(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": None},
            {"id": "existing", "clinic_id": CLINIC_ID, "line_user_id": "U999",
             "status": "confirmed", "scheduled_at": "2099-01-02T11:00:00+09:00", "patient_name": "Someone Else"},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "preferred_date": "2099-01-02", "preferred_time": "11:00", "confidence": 0.9, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="move it to Jan 2 at 11am",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "awaiting_reschedule_alternative"
        assert "11:00" not in result["alternatives"]

        follow_up = scheduling.process_message(
            clinic_id=CLINIC_ID, raw_message="1", source="line", line_user_id="U123",
        )

        assert follow_up["status"] == "rescheduled"
        assert follow_up["appointment_id"] == "appt-1"
        assert clinic.rows["appointments"][0]["scheduled_at"] == f"2099-01-02T{result['alternatives'][0]}:00+09:00"

    def test_no_match_reports_cleanly_no_human_queue(self, clinic):
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="reschedule please", source="line", line_user_id="U999",
            )
        assert result["status"] == "reschedule_no_match"

    def test_no_line_user_id_falls_back_to_human_review(self, clinic):
        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="reschedule please", source="web", line_user_id=None,
            )
        assert result["status"] == "queued_for_review"
        assert clinic.rows["review_queue"][0]["status"] == "pending"

    def test_fully_booked_day_reports_directly_without_queueing(self, clinic):
        # Book every slot on 2099-01-02 (09:00-17:45 in 15-min steps) so the
        # day has zero alternatives left to offer.
        filler = []
        hour, minute, i = 9, 0, 0
        while hour < 18:
            filler.append({
                "id": f"filler-{i}", "clinic_id": CLINIC_ID, "line_user_id": f"Ufiller{i}",
                "status": "confirmed", "scheduled_at": f"2099-01-02T{hour:02d}:{minute:02d}:00+09:00",
                "patient_name": None,
            })
            i += 1
            minute += 15
            if minute >= 60:
                minute = 0
                hour += 1
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": None},
        ] + filler

        with patch.object(scheduling, "classify_intent", return_value={"intent": "reschedule", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "preferred_date": "2099-01-02", "preferred_time": "10:00", "confidence": 0.9, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="move it to Jan 2 at 10am",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "no_alternatives_that_day"
        assert result["date"] == "2099-01-02"
        assert clinic.rows.get("review_queue", []) == []


class TestBilingualLanguageDetection:
    def test_english_message_is_tagged_en(self, clinic):
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "cancellation", "confidence": 0.95}):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I want to cancel my appointment",
                source="line", line_user_id="U999",
            )
        assert result["lang"] == "en"

    def test_japanese_message_is_tagged_ja(self, clinic):
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "cancellation", "confidence": 0.95}):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="予約をキャンセルしたいです",
                source="line", line_user_id="U999",
            )
        assert result["lang"] == "ja"

    def test_japanese_language_persists_through_a_bare_numeric_reply(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": None},
            {"id": "appt-2", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-05T10:00:00+09:00", "patient_name": None},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "cancellation", "confidence": 0.95}):
            scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="予約をキャンセルしたいです", source="line", line_user_id="U123",
            )

        # A bare "2" carries no language signal of its own -- must resolve
        # using the language the clarification was originally asked in, not
        # default back to English just because the reply itself has no kana/kanji.
        result = scheduling.process_message(
            clinic_id=CLINIC_ID, raw_message="2", source="line", line_user_id="U123",
        )

        assert result["status"] == "auto_cancelled"
        assert result["lang"] == "ja"

    def test_english_language_persists_through_a_bare_numeric_reply(self, clinic):
        clinic.rows["appointments"] = [
            {"id": "appt-1", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-01T14:00:00+09:00", "patient_name": None},
            {"id": "appt-2", "clinic_id": CLINIC_ID, "line_user_id": "U123",
             "status": "confirmed", "scheduled_at": "2099-01-05T10:00:00+09:00", "patient_name": None},
        ]
        with patch.object(scheduling, "classify_intent", return_value={"intent": "cancellation", "confidence": 0.95}):
            scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="I need to cancel one of my appointments",
                source="line", line_user_id="U123",
            )

        result = scheduling.process_message(
            clinic_id=CLINIC_ID, raw_message="2", source="line", line_user_id="U123",
        )

        assert result["status"] == "auto_cancelled"
        assert result["lang"] == "en"

    def test_free_text_reply_switches_language_if_the_patient_does(self, clinic):
        clinic.rows["appointments"] = []
        with patch.object(scheduling, "classify_intent", return_value={"intent": "appointment_request", "confidence": 0.95}), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": None, "preferred_date": None, "preferred_time": None,
                 "visit_reason": None, "confidence": 0.0, "field_confidences": {},
             }):
            first = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="予約をお願いします",
                source="line", line_user_id="U123",
            )
        assert first["status"] == "awaiting_booking_details"
        assert first["lang"] == "ja"

        # Unlike a bare number, this reply is real text -- it carries its own
        # language signal and should win over the clarification's stored "ja".
        with patch.object(scheduling, "classify_intent", side_effect=AssertionError("should not be called")), \
             patch.object(scheduling, "extract_appointment", return_value={
                 "patient_name": "Smith", "preferred_date": "2099-01-02", "preferred_time": "11:00",
                 "visit_reason": "check-up", "confidence": 0.9, "field_confidences": {},
             }):
            result = scheduling.process_message(
                clinic_id=CLINIC_ID, raw_message="My name is Smith, Jan 2nd at 11am, a check-up",
                source="line", line_user_id="U123",
            )

        assert result["status"] == "confirmed"
        assert result["lang"] == "en"
