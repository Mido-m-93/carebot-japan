# apps/api/services/scheduling.py
"""
Core scheduling pipeline.

For a given clinic + raw message:
1. Classify intent (Haiku)
2. If appointment_request: check clinic availability, extract details (Sonnet)
3. Write appointment to Supabase, send SMS -- always, regardless of confidence
4. If confidence was low, ALSO push to review_queue (status "auto_confirmed")
   as an after-the-fact spot-check -- this never blocks the booking
5. Write audit log

Non-appointment intents (general_inquiry, out_of_scope) still go to the
review_queue as "pending" -- there's no appointment to auto-confirm there.

Cancellations and slot conflicts resolve automatically for LINE patients via
line_user_id correlation (see _handle_cancellation / the availability check
below) rather than always requiring a human -- but only when we can identify
the right appointment with certainty. A genuinely ambiguous case (multiple
upcoming appointments, or a requested slot that's taken) sends the patient an
automated clarifying question over LINE and waits for their reply, tracked
via review_queue.status = "awaiting_reply"; only a non-LINE source, or no
identifiable match at all, falls back to human review.

This runs synchronously for simplicity in MVP.
In production, steps 1-5 run inside a background job worker.
"""
import re
import uuid
from datetime import datetime, timezone, timedelta
from services.ai import classify_intent, extract_appointment, generate_confirmation
from services.sms import send_sms
from services.db import get_db
from services.quota import quota_exceeded, STARTER_MONTHLY_LIMIT
from routers.appointments import get_available_slots

# Thresholds for automatic processing vs human review
INTENT_CONFIDENCE_THRESHOLD = 0.75
EXTRACTION_CONFIDENCE_THRESHOLD = 0.80

# Cap on how many alternatives/candidates we'll ever ask a patient to choose
# from in one clarifying message -- keeps the LINE message short and the
# "reply with a number" scheme unambiguous.
MAX_CLARIFICATION_OPTIONS = 5


def process_message(
    *,
    clinic_id: str,
    raw_message: str,
    source: str,  # 'line' | 'web' | 'email'
    patient_phone: str | None = None,
    line_user_id: str | None = None,
) -> dict:
    """
    Full scheduling pipeline. Returns a status dict describing the outcome.
    """
    db = get_db()
    now_jst = datetime.now(tz=timezone(timedelta(hours=9)))
    today_str = now_jst.strftime("%Y-%m-%d")

    # ── Fetch clinic info ─────────────────────────────────────
    # .limit(1), not .single() — a nonexistent clinic_id must return the
    # "not found" error below, not raise an unhandled exception.
    clinic_rows = (
        db.table("clinics")
        .select("id, name, name_jp, active, tier")
        .eq("id", clinic_id)
        .limit(1)
        .execute()
    )
    if not clinic_rows.data or not clinic_rows.data[0]["active"]:
        return {"status": "error", "reason": "clinic_not_found_or_inactive"}

    clinic = clinic_rows.data[0]
    clinic_name_jp = clinic.get("name_jp") or clinic["name"]

    # ── Step 0: does this LINE patient have a pending clarifying question? ──
    # If so, THIS message is their answer -- resolve it and skip the normal
    # intent pipeline entirely, whatever they wrote.
    if line_user_id:
        pending = _get_pending_clarification(db, clinic_id, line_user_id)
        if pending:
            return _resolve_clarification(db, clinic_id, source, line_user_id, raw_message, pending)

    # ── Step 1: Intent classification ─────────────────────────
    _log_audit(db, clinic_id, "claude_extraction_run", metadata={
        "step": "intent_classification",
        "model": "claude-haiku-4-5-20251001",
        "source": source,
    })

    try:
        intent_result = classify_intent(raw_message)
    except Exception as e:
        return {"status": "error", "reason": "ai_error", "message": str(e)[:200]}

    intent = intent_result.get("intent", "out_of_scope")
    intent_confidence = intent_result.get("confidence", 0.0)

    # ── Cancellations: resolve via LINE user correlation, not by asking the
    #    patient to re-type identifying info they never volunteer ──────────
    if intent == "cancellation":
        return _handle_cancellation(db, clinic_id, source, line_user_id, raw_message, intent_confidence)

    # ── Other non-appointment intents: queue for human handling ───────────
    if intent != "appointment_request":
        _push_review_queue(
            db, clinic_id, source, raw_message,
            intent, intent_confidence, extracted_data=None,
            field_confidences=None,
        )
        return {
            "status": "queued_for_review",
            "intent": intent,
            "confidence": intent_confidence,
            "reason": "non_appointment_intent",
        }

    # ── Step 2: Appointment detail extraction ─────────────────
    _log_audit(db, clinic_id, "claude_extraction_run", metadata={
        "step": "appointment_extraction",
        "model": "claude-sonnet-4-20250514",
    })

    extraction = extract_appointment(raw_message, today_str)
    overall_confidence = extraction.get("confidence", 0.0)
    field_confidences = extraction.get("field_confidences", {})

    # Low confidence (intent OR extraction) no longer blocks the booking —
    # it's flagged for after-the-fact staff review instead, see Step 3b.
    needs_spot_check = (
        intent_confidence < INTENT_CONFIDENCE_THRESHOLD
        or overall_confidence < EXTRACTION_CONFIDENCE_THRESHOLD
    )

    # ── Step 2b: does the clinic actually have this slot open? ────────────
    # Only meaningful when the patient gave a specific date+time -- a vague
    # request ("I'd like to come in sometime next week") still books
    # unscheduled, as before, for staff to follow up on.
    if extraction.get("preferred_date") and extraction.get("preferred_time"):
        availability = get_available_slots(db, clinic_id, extraction["preferred_date"])
        requested_slot = next(
            (s for s in availability["slots"] if s["time"] == extraction["preferred_time"]),
            None,
        )
        slot_ok = availability["is_open"] and requested_slot is not None and requested_slot["available"]

        if not slot_ok:
            alternatives = [s["time"] for s in availability["slots"] if s["available"]][:3]

            if not alternatives or not line_user_id:
                # Fully booked/closed that day, or we have no channel to ask
                # the patient directly (web/email) -- fall back to review.
                _push_review_queue(
                    db, clinic_id, source, raw_message,
                    intent, intent_confidence,
                    extracted_data=extraction, field_confidences=field_confidences,
                )
                return {
                    "status": "queued_for_review",
                    "intent": intent,
                    "confidence": overall_confidence,
                    "reason": "requested_slot_unavailable",
                }

            options = [{"time": t} for t in alternatives]
            _create_pending_clarification(
                db, clinic_id, line_user_id, kind="alternative_time",
                options=options, source=source, raw_input=raw_message,
                intent=intent, intent_confidence=intent_confidence,
                extra={
                    "date": extraction["preferred_date"],
                    "extraction": extraction,
                    "original_raw_message": raw_message,
                },
            )
            return {
                "status": "awaiting_alternative_time",
                "date": extraction["preferred_date"],
                "alternatives": alternatives,
            }

    # ── Step 3: Write appointment to Supabase (always, unless plan limit hit) ──
    if quota_exceeded(clinic):
        _push_review_queue(
            db, clinic_id, source, raw_message,
            intent, intent_confidence,
            extracted_data=extraction,
            field_confidences=field_confidences,
        )
        return {
            "status": "plan_limit_reached",
            "intent": intent,
            "confidence": overall_confidence,
            "reason": f"Starter plan limit of {STARTER_MONTHLY_LIMIT} appointments/month reached — flagged for manual booking or upgrade.",
        }

    result = _create_appointment(
        db, clinic_id, source=source, extraction=extraction, raw_message=raw_message,
        patient_phone=patient_phone, line_user_id=line_user_id,
        clinic_name_jp=clinic_name_jp,
    )

    # ── Step 3b: Low confidence → flag for after-the-fact spot-check ──
    # The appointment above is already booked; this never blocks it.
    if needs_spot_check:
        _push_review_queue(
            db, clinic_id, source, raw_message,
            intent, intent_confidence,
            extracted_data={**extraction, "appointment_id": result["appointment_id"]},
            field_confidences=field_confidences,
            status="auto_confirmed",
        )

    result["flagged_for_review"] = needs_spot_check
    return result


# ── Helpers ───────────────────────────────────────────────────

def _create_appointment(
    db, clinic_id, *, source, extraction, raw_message, patient_phone, line_user_id, clinic_name_jp,
) -> dict:
    """
    Insert an appointment row and send the SMS confirmation. Shared by the
    main booking path and by resolving an "alternative time" clarification,
    so both go through identical booking logic.
    """
    appointment_id = str(uuid.uuid4())
    scheduled_at = None
    if extraction.get("preferred_date") and extraction.get("preferred_time"):
        scheduled_at = f"{extraction['preferred_date']}T{extraction['preferred_time']}:00+09:00"

    appt_row = {
        "id": appointment_id,
        "clinic_id": clinic_id,
        "patient_name": extraction.get("patient_name"),
        "patient_phone": patient_phone or extraction.get("patient_phone"),
        "scheduled_at": scheduled_at,
        "visit_reason": extraction.get("visit_reason"),
        "is_first_visit": extraction.get("is_first_visit"),
        "status": "confirmed",
        "source": source,
        "raw_message": raw_message,
        "line_user_id": line_user_id,
    }
    db.table("appointments").insert(appt_row).execute()

    _log_audit(db, clinic_id, "appointment_created", record_id=appointment_id, metadata={
        "source": source,
        "confidence": extraction.get("confidence", 0.0),
    })

    sms_phone = patient_phone or extraction.get("patient_phone")
    sms_sid = None

    if sms_phone and scheduled_at:
        confirmation = generate_confirmation(
            patient_name=extraction.get("patient_name"),
            date=extraction["preferred_date"],
            time=extraction["preferred_time"],
            clinic_name_jp=clinic_name_jp,
        )
        sms_sid = send_sms(sms_phone, confirmation)

        if sms_sid:
            db.table("appointments").update(
                {"sms_sent_at": datetime.now(tz=timezone(timedelta(hours=9))).isoformat()}
            ).eq("id", appointment_id).execute()

            _log_audit(db, clinic_id, "sms_sent", record_id=appointment_id, metadata={
                "to": sms_phone[:6] + "****",  # partial log only — no full phone in audit
                "twilio_sid": sms_sid,
            })

    return {
        "status": "confirmed",
        "appointment_id": appointment_id,
        "scheduled_at": scheduled_at,
        "patient_name": extraction.get("patient_name"),
        "sms_sent": sms_sid is not None,
        "confidence": extraction.get("confidence", 0.0),
    }


def _find_upcoming_appointments(db, clinic_id, line_user_id):
    """Confirmed, not-yet-happened appointments booked by this LINE user."""
    now_iso = datetime.now(tz=timezone(timedelta(hours=9))).isoformat()
    rows = (
        db.table("appointments")
        .select("id, patient_name, scheduled_at")
        .eq("clinic_id", clinic_id)
        .eq("line_user_id", line_user_id)
        .eq("status", "confirmed")
        .gte("scheduled_at", now_iso)
        .order("scheduled_at")
        .execute()
    )
    return rows.data or []


def _handle_cancellation(db, clinic_id, source, line_user_id, raw_message, intent_confidence):
    if not line_user_id:
        # No channel to identify the patient (web/email cancellation with no
        # account system) -- this genuinely needs a human.
        _push_review_queue(
            db, clinic_id, source, raw_message, "cancellation", intent_confidence,
            extracted_data=None, field_confidences=None,
        )
        return {
            "status": "queued_for_review", "intent": "cancellation",
            "confidence": intent_confidence, "reason": "no_line_user_id",
        }

    matches = _find_upcoming_appointments(db, clinic_id, line_user_id)

    if len(matches) == 1:
        appt = matches[0]
        db.table("appointments").update({"status": "cancelled"}).eq("id", appt["id"]).execute()
        _log_audit(db, clinic_id, "appointment_cancelled", record_id=appt["id"], metadata={
            "source": source, "auto": True,
        })
        return {
            "status": "auto_cancelled",
            "appointment_id": appt["id"],
            "scheduled_at": appt["scheduled_at"],
            "patient_name": appt.get("patient_name"),
        }

    if len(matches) == 0:
        return {"status": "cancellation_no_match"}

    # Ambiguous: this LINE user has more than one upcoming appointment. Ask
    # which one, rather than guessing.
    options = [
        {"appointment_id": a["id"], "scheduled_at": a["scheduled_at"]}
        for a in matches[:MAX_CLARIFICATION_OPTIONS]
    ]
    _create_pending_clarification(
        db, clinic_id, line_user_id, kind="cancel_choice", options=options,
        source=source, raw_input=raw_message, intent="cancellation",
        intent_confidence=intent_confidence,
    )
    return {"status": "awaiting_cancel_choice", "options": options}


def _create_pending_clarification(
    db, clinic_id, line_user_id, *, kind, options, source, raw_input,
    intent, intent_confidence, extra=None,
):
    context = {"kind": kind, "options": options}
    if extra:
        context.update(extra)
    item = {
        "clinic_id": clinic_id,
        "source": source,
        "raw_input": raw_input,
        "intent": intent,
        "intent_confidence": intent_confidence,
        "extracted_data": context,
        "field_confidences": None,
        "status": "awaiting_reply",
        "line_user_id": line_user_id,
    }
    db.table("review_queue").insert(item).execute()
    _log_audit(db, clinic_id, "review_item_created", metadata={
        "source": source, "intent": intent, "kind": kind,
    })


def _get_pending_clarification(db, clinic_id, line_user_id):
    rows = (
        db.table("review_queue")
        .select("id, extracted_data")
        .eq("clinic_id", clinic_id)
        .eq("line_user_id", line_user_id)
        .eq("status", "awaiting_reply")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return rows.data[0] if rows.data else None


def _resolve_clarification(db, clinic_id, source, line_user_id, raw_message, pending):
    """
    The patient's reply to a clarifying question. Expects a plain number
    ("1", "2", ...) picking one of the options they were offered -- far more
    reliable to parse than free-text date references in mixed JP/EN input.
    """
    context = pending.get("extracted_data") or {}
    options = context.get("options", [])
    kind = context.get("kind")

    match = re.search(r"\d+", raw_message)
    choice_idx = int(match.group()) - 1 if match else -1

    if choice_idx < 0 or choice_idx >= len(options):
        # Didn't understand the reply -- re-ask the same question rather
        # than silently dropping it or guessing.
        return {"status": "clarification_unclear", "kind": kind, "options": options}

    chosen = options[choice_idx]
    db.table("review_queue").update({
        "status": "resolved",
        "resolved_at": datetime.now(timezone.utc).isoformat(),
        "resolution": {"chosen_index": choice_idx},
    }).eq("id", pending["id"]).execute()

    if kind == "cancel_choice":
        appt_id = chosen["appointment_id"]
        db.table("appointments").update({"status": "cancelled"}).eq("id", appt_id).execute()
        _log_audit(db, clinic_id, "appointment_cancelled", record_id=appt_id, metadata={
            "source": source, "auto": True, "via": "clarification",
        })
        return {
            "status": "auto_cancelled",
            "appointment_id": appt_id,
            "scheduled_at": chosen["scheduled_at"],
        }

    if kind == "alternative_time":
        clinic_rows = db.table("clinics").select("name, name_jp").eq("id", clinic_id).limit(1).execute()
        clinic_row = clinic_rows.data[0] if clinic_rows.data else {}
        clinic_name_jp = clinic_row.get("name_jp") or clinic_row.get("name", "")

        extraction = {**context.get("extraction", {}), "preferred_time": chosen["time"]}
        original_raw_message = context.get("original_raw_message", raw_message)
        return _create_appointment(
            db, clinic_id, source=source, extraction=extraction, raw_message=original_raw_message,
            patient_phone=None, line_user_id=line_user_id, clinic_name_jp=clinic_name_jp,
        )

    return {"status": "clarification_unclear", "kind": kind, "options": options}


def _push_review_queue(
    db, clinic_id, source, raw_input,
    intent, intent_confidence,
    extracted_data, field_confidences,
    status="pending",
):
    item = {
        "clinic_id": clinic_id,
        "source": source,
        "raw_input": raw_input,
        "intent": intent,
        "intent_confidence": intent_confidence,
        "extracted_data": extracted_data,
        "field_confidences": field_confidences,
        "status": status,
    }
    result = db.table("review_queue").insert(item).execute()
    _log_audit(db, clinic_id, "review_item_created", metadata={
        "source": source,
        "intent": intent,
        "intent_confidence": intent_confidence,
    })
    return result


def _log_audit(db, clinic_id, action, record_id=None, metadata=None):
    db.table("audit_logs").insert({
        "clinic_id": clinic_id,
        "action": action,
        "actor": "scheduling_service",
        "record_id": str(record_id) if record_id else None,
        "metadata": metadata or {},
    }).execute()
