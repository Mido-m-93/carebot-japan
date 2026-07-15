# apps/api/services/scheduling.py
"""
Core scheduling pipeline.

For a given clinic + raw message:
1. Classify intent (Haiku)
2. If appointment_request: extract details (Sonnet). If date, time, or visit
   reason are still missing, ask the patient for them over LINE instead of
   booking blind -- see _missing_booking_fields / the "booking_details"
   clarification kind.
3. Once we have enough info, check clinic availability, write the
   appointment to Supabase, send SMS
4. If confidence was low, ALSO push to review_queue (status "auto_confirmed")
   as an after-the-fact spot-check -- this never blocks the booking
5. Write audit log

Cancellations, reschedules, and slot conflicts resolve automatically for LINE
patients via line_user_id correlation (see _handle_cancellation /
_handle_reschedule / the availability check below) rather than always
requiring a human -- but only when we can identify the right appointment
with certainty. A genuinely ambiguous case (multiple upcoming appointments,
a requested slot that's taken, or a reschedule with no new time given yet)
sends the patient an automated clarifying question over LINE and waits for
their reply, tracked via review_queue.status = "awaiting_reply"; only a
non-LINE source, or no identifiable match at all, falls back to human review.

small_talk and out_of_scope get a direct conversational reply with no review
queue involvement. general_inquiry is answered from the clinic's real
configured hours -- never guessed.

The chat is bilingual (English/Japanese): every message we send is picked
based on the language the patient is writing in, detected once per
conversation via _detect_lang and carried through the whole clarification
chain (a bare "1" reply has no language signal of its own, so it's stored
alongside "kind"/"options" in the pending review_queue row).

This runs synchronously for simplicity in MVP.
In production, steps 1-5 run inside a background job worker.
"""
import re
import uuid
from datetime import datetime, timezone, timedelta
from services.ai import (
    classify_intent,
    extract_appointment,
    generate_confirmation,
    generate_small_talk_reply,
    generate_inquiry_reply,
)
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

_JP_DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"]

_JAPANESE_SCRIPT_RE = re.compile("[぀-ヿ一-鿿]")


def _detect_lang(text: str) -> str:
    # "ja" if the message contains any Japanese script, else "en".
    return "ja" if _JAPANESE_SCRIPT_RE.search(text or "") else "en"


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

    # ── Step 0: does this LINE patient have a pending clarifying question? ──
    # If so, THIS message is their answer -- resolve it and skip the normal
    # intent pipeline entirely, whatever they wrote.
    if line_user_id:
        pending = _get_pending_clarification(db, clinic_id, line_user_id)
        if pending:
            return _resolve_clarification(db, clinic_id, source, line_user_id, raw_message, pending, today_str)

    lang = _detect_lang(raw_message)

    # ── Step 1: Intent classification ─────────────────────────
    _log_audit(db, clinic_id, "claude_extraction_run", metadata={
        "step": "intent_classification",
        "model": "claude-haiku-4-5-20251001",
        "source": source,
    })

    try:
        intent_result = classify_intent(raw_message)
    except Exception as e:
        return {"status": "error", "reason": "ai_error", "message": str(e)[:200], "lang": lang}

    intent = intent_result.get("intent", "out_of_scope")
    intent_confidence = intent_result.get("confidence", 0.0)

    # ── Cancellations: resolve via LINE user correlation, not by asking the
    #    patient to re-type identifying info they never volunteer ──────────
    if intent == "cancellation":
        return _handle_cancellation(db, clinic_id, source, line_user_id, raw_message, intent_confidence, lang)

    # ── Reschedules: same "no human intervention" philosophy as cancellation ──
    if intent == "reschedule":
        return _handle_reschedule(
            db, clinic_id, source, line_user_id, raw_message,
            intent_confidence, today_str, lang,
        )

    # ── Small talk / out-of-scope: reply directly, no review queue needed ──
    if intent in ("small_talk", "out_of_scope"):
        return _handle_small_talk(raw_message, lang)

    # ── General inquiry: answer from the clinic's real schedule data ──────
    if intent == "general_inquiry":
        return _handle_inquiry(db, clinic_id, clinic, raw_message, lang)

    # ── Anything else the AI might return unexpectedly: fall back to human ──
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
            "lang": lang,
        }

    # ── Step 2: Appointment detail extraction ─────────────────
    _log_audit(db, clinic_id, "claude_extraction_run", metadata={
        "step": "appointment_extraction",
        "model": "claude-sonnet-4-20250514",
    })

    extraction = extract_appointment(raw_message, today_str)

    # ── Step 2b: do we have the minimum info to actually book? ────────────
    # A request missing date, time, or visit reason isn't a real booking yet
    # -- ask the patient for exactly what's missing over LINE rather than
    # creating a placeholder appointment or silently queuing it for a human
    # to fill in later.
    missing = _missing_booking_fields(extraction)
    if missing:
        if not line_user_id:
            # No channel to ask the patient directly (web/email) -- fall
            # back to review.
            _push_review_queue(
                db, clinic_id, source, raw_message,
                intent, intent_confidence,
                extracted_data=extraction, field_confidences=extraction.get("field_confidences", {}),
            )
            return {
                "status": "queued_for_review",
                "intent": intent,
                "confidence": extraction.get("confidence", 0.0),
                "reason": "missing_booking_details",
                "lang": lang,
            }

        _create_pending_clarification(
            db, clinic_id, line_user_id, kind="booking_details", options=[],
            source=source, raw_input=raw_message,
            intent=intent, intent_confidence=intent_confidence, lang=lang,
            extra={"extraction": extraction, "missing": missing},
        )
        return {"status": "awaiting_booking_details", "missing": missing, "lang": lang}

    return _book_appointment_flow(
        db, clinic_id, source, patient_phone, line_user_id,
        intent, intent_confidence, extraction, raw_message, clinic, today_str, lang,
    )


# ── Helpers ───────────────────────────────────────────────────

def _resolve_clinic_name(clinic: dict, lang: str) -> str:
    if lang == "en":
        return clinic.get("name") or clinic.get("name_jp") or ""
    return clinic.get("name_jp") or clinic.get("name") or ""


def _create_appointment(
    db, clinic_id, *, source, extraction, raw_message, patient_phone, line_user_id, clinic_name, lang,
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
            clinic_name=clinic_name,
            lang=lang,
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
        "lang": lang,
    }


def _missing_booking_fields(extraction: dict) -> list[str]:
    """Which of the fields we always need before actually booking are still unknown."""
    missing = []
    if not extraction.get("preferred_date"):
        missing.append("date")
    if not extraction.get("preferred_time"):
        missing.append("time")
    if not extraction.get("visit_reason"):
        missing.append("visit_reason")
    return missing


def _get_clinic(db, clinic_id) -> dict:
    rows = db.table("clinics").select("id, name, name_jp, tier").eq("id", clinic_id).limit(1).execute()
    return rows.data[0] if rows.data else {"id": clinic_id}


def _is_past_date(date_str: str, today_str: str) -> bool:
    # YYYY-MM-DD strings sort lexicographically, so a plain string compare works.
    return date_str < today_str


def _book_appointment_flow(
    db, clinic_id, source, patient_phone, line_user_id,
    intent, intent_confidence, extraction, raw_message, clinic, today_str, lang,
) -> dict:
    """
    Shared "we now have date + time + visit reason, actually book it" logic:
    availability check (with an alternative-time clarification on conflict),
    the plan quota check, appointment creation, and the low-confidence
    after-the-fact spot-check flag. Used both by the main booking path and by
    the booking-details clarification once the patient has filled in what
    was missing.
    """
    if _is_past_date(extraction["preferred_date"], today_str):
        # A date that's already gone isn't "fully booked" -- say so plainly
        # instead of running the normal availability check against it.
        return {"status": "date_in_the_past", "date": extraction["preferred_date"], "lang": lang}

    overall_confidence = extraction.get("confidence", 0.0)
    field_confidences = extraction.get("field_confidences", {})
    needs_spot_check = (
        intent_confidence < INTENT_CONFIDENCE_THRESHOLD
        or overall_confidence < EXTRACTION_CONFIDENCE_THRESHOLD
    )

    availability = get_available_slots(db, clinic_id, extraction["preferred_date"])
    requested_slot = next(
        (s for s in availability["slots"] if s["time"] == extraction["preferred_time"]),
        None,
    )
    slot_ok = availability["is_open"] and requested_slot is not None and requested_slot["available"]

    if not slot_ok:
        alternatives = [s["time"] for s in availability["slots"] if s["available"]][:3]

        if not line_user_id:
            # No channel to ask the patient directly (web/email) -- fall
            # back to review.
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
                "lang": lang,
            }

        if not alternatives:
            # Fully booked/closed that day -- tell the patient directly;
            # a human couldn't offer anything different either.
            return {"status": "no_alternatives_that_day", "date": extraction["preferred_date"], "lang": lang}

        options = [{"time": t} for t in alternatives]
        _create_pending_clarification(
            db, clinic_id, line_user_id, kind="alternative_time",
            options=options, source=source, raw_input=raw_message,
            intent=intent, intent_confidence=intent_confidence, lang=lang,
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
            "lang": lang,
        }

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
            "lang": lang,
        }

    clinic_name = _resolve_clinic_name(clinic, lang)
    result = _create_appointment(
        db, clinic_id, source=source, extraction=extraction, raw_message=raw_message,
        patient_phone=patient_phone, line_user_id=line_user_id,
        clinic_name=clinic_name, lang=lang,
    )

    # Low confidence → flag for after-the-fact spot-check. The appointment
    # above is already booked; this never blocks it.
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


def _handle_cancellation(db, clinic_id, source, line_user_id, raw_message, intent_confidence, lang):
    if not line_user_id:
        # No channel to identify the patient (web/email cancellation with no
        # account system) -- this genuinely needs a human.
        _push_review_queue(
            db, clinic_id, source, raw_message, "cancellation", intent_confidence,
            extracted_data=None, field_confidences=None,
        )
        return {
            "status": "queued_for_review", "intent": "cancellation",
            "confidence": intent_confidence, "reason": "no_line_user_id", "lang": lang,
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
            "lang": lang,
        }

    if len(matches) == 0:
        return {"status": "cancellation_no_match", "lang": lang}

    # Ambiguous: this LINE user has more than one upcoming appointment. Ask
    # which one, rather than guessing.
    options = [
        {"appointment_id": a["id"], "scheduled_at": a["scheduled_at"]}
        for a in matches[:MAX_CLARIFICATION_OPTIONS]
    ]
    _create_pending_clarification(
        db, clinic_id, line_user_id, kind="cancel_choice", options=options,
        source=source, raw_input=raw_message, intent="cancellation",
        intent_confidence=intent_confidence, lang=lang,
    )
    return {"status": "awaiting_cancel_choice", "options": options, "lang": lang}


def _handle_reschedule(
    db, clinic_id, source, line_user_id, raw_message,
    intent_confidence, today_str, lang,
):
    if not line_user_id:
        # No channel to identify the patient (web/email reschedule with no
        # account system) -- this genuinely needs a human.
        _push_review_queue(
            db, clinic_id, source, raw_message, "reschedule", intent_confidence,
            extracted_data=None, field_confidences=None,
        )
        return {
            "status": "queued_for_review", "intent": "reschedule",
            "confidence": intent_confidence, "reason": "no_line_user_id", "lang": lang,
        }

    matches = _find_upcoming_appointments(db, clinic_id, line_user_id)

    if len(matches) == 0:
        return {"status": "reschedule_no_match", "lang": lang}

    try:
        extraction = extract_appointment(raw_message, today_str)
    except Exception:
        extraction = {}
    new_date = extraction.get("preferred_date")
    new_time = extraction.get("preferred_time")

    if len(matches) == 1:
        appt = matches[0]
        if new_date and new_time:
            return _apply_reschedule(
                db, clinic_id, source, line_user_id, appt, new_date, new_time,
                raw_message, today_str, lang,
            )

        # They said "reschedule" but didn't say to when in the same message --
        # ask for a new day/time (free text, no numbered options).
        _create_pending_clarification(
            db, clinic_id, line_user_id, kind="reschedule_new_time", options=[],
            source=source, raw_input=raw_message,
            intent="reschedule", intent_confidence=intent_confidence, lang=lang,
            extra={"appointment_id": appt["id"], "old_scheduled_at": appt["scheduled_at"]},
        )
        return {"status": "awaiting_reschedule_time", "scheduled_at": appt["scheduled_at"], "lang": lang}

    # Ambiguous: more than one upcoming appointment -- ask which one, rather
    # than guessing which the patient means.
    options = [
        {"appointment_id": a["id"], "scheduled_at": a["scheduled_at"]}
        for a in matches[:MAX_CLARIFICATION_OPTIONS]
    ]
    _create_pending_clarification(
        db, clinic_id, line_user_id, kind="reschedule_choice", options=options,
        source=source, raw_input=raw_message,
        intent="reschedule", intent_confidence=intent_confidence, lang=lang,
        extra={"new_date": new_date, "new_time": new_time},
    )
    return {"status": "awaiting_reschedule_choice", "options": options, "lang": lang}


def _apply_reschedule(db, clinic_id, source, line_user_id, appt, new_date, new_time, raw_message, today_str, lang):
    if _is_past_date(new_date, today_str):
        # A date that's already gone isn't "fully booked" -- say so plainly
        # instead of running the normal availability check against it.
        return {"status": "date_in_the_past", "date": new_date, "lang": lang}

    availability = get_available_slots(db, clinic_id, new_date)
    requested_slot = next(
        (s for s in availability["slots"] if s["time"] == new_time),
        None,
    )
    slot_ok = availability["is_open"] and requested_slot is not None and requested_slot["available"]

    if not slot_ok:
        alternatives = [s["time"] for s in availability["slots"] if s["available"]][:3]

        if not alternatives:
            return {"status": "no_alternatives_that_day", "date": new_date, "lang": lang}

        options = [{"time": t} for t in alternatives]
        _create_pending_clarification(
            db, clinic_id, line_user_id, kind="reschedule_alternative_time", options=options,
            source=source, raw_input=raw_message, intent="reschedule", intent_confidence=1.0, lang=lang,
            extra={
                "appointment_id": appt["id"],
                "old_scheduled_at": appt["scheduled_at"],
                "date": new_date,
            },
        )
        return {
            "status": "awaiting_reschedule_alternative",
            "date": new_date,
            "alternatives": alternatives,
            "lang": lang,
        }

    old_scheduled_at = appt["scheduled_at"]
    new_scheduled_at = f"{new_date}T{new_time}:00+09:00"
    db.table("appointments").update({"scheduled_at": new_scheduled_at}).eq("id", appt["id"]).execute()
    _log_audit(db, clinic_id, "appointment_rescheduled", record_id=appt["id"], metadata={
        "source": source, "auto": True,
        "old_scheduled_at": old_scheduled_at, "new_scheduled_at": new_scheduled_at,
    })
    return {
        "status": "rescheduled",
        "appointment_id": appt["id"],
        "old_scheduled_at": old_scheduled_at,
        "new_scheduled_at": new_scheduled_at,
        "lang": lang,
    }


def _handle_small_talk(raw_message: str, lang: str) -> dict:
    try:
        reply = generate_small_talk_reply(raw_message)
    except Exception:
        reply = None
    return {"status": "small_talk", "reply_text": reply, "lang": lang}


def _handle_inquiry(db, clinic_id, clinic, raw_message: str, lang: str) -> dict:
    clinic_info = _format_clinic_info(db, clinic_id, clinic)
    try:
        reply = generate_inquiry_reply(raw_message, clinic_info)
    except Exception:
        reply = None
    return {"status": "inquiry_answered", "reply_text": reply, "lang": lang}


def _format_clinic_info(db, clinic_id, clinic) -> str:
    name = clinic.get("name_jp") or clinic["name"]
    rows = (
        db.table("clinic_schedules")
        .select("day_of_week, open_time, close_time")
        .eq("clinic_id", clinic_id)
        .order("day_of_week")
        .execute()
    )
    schedules = rows.data or []
    if not schedules:
        return (
            f"Clinic name: {name}\n"
            "Opening hours: not configured -- do not guess, tell the patient to call the clinic."
        )

    lines = [f"Clinic name: {name}", "Opening hours:"]
    for s in schedules:
        day_name = _JP_DAY_NAMES[s["day_of_week"]]
        lines.append(f"  {day_name}: {s['open_time']}-{s['close_time']}")
    return "\n".join(lines)


def _create_pending_clarification(
    db, clinic_id, line_user_id, *, kind, options, source, raw_input,
    intent, intent_confidence, lang, extra=None,
):
    context = {"kind": kind, "options": options, "lang": lang}
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


def _mark_clarification_resolved(db, pending_id, choice_idx=None):
    resolution = {"chosen_index": choice_idx} if choice_idx is not None else {}
    db.table("review_queue").update({
        "status": "resolved",
        "resolved_at": datetime.now(timezone.utc).isoformat(),
        "resolution": resolution,
    }).eq("id", pending_id).execute()


def _resolve_clarification(db, clinic_id, source, line_user_id, raw_message, pending, today_str):
    """
    The patient's reply to a clarifying question. Most kinds expect a plain
    number ("1", "2", ...) picking one of the options they were offered --
    far more reliable to parse than free-text date references in mixed
    JP/EN input. "reschedule_new_time" and "booking_details" are the
    exception: there are no numbered options, it's free-text giving a new
    day/time (or the missing booking details).

    The language of the reply itself isn't a reliable signal (a bare "1"
    carries none), so we use whatever language the clarification was
    originally asked in, stored on the pending row.
    """
    context = pending.get("extracted_data") or {}
    options = context.get("options", [])
    kind = context.get("kind")
    lang = context.get("lang") or _detect_lang(raw_message)

    if kind == "booking_details":
        try:
            new_extraction = extract_appointment(raw_message, today_str)
        except Exception:
            new_extraction = {}

        merged = dict(context.get("extraction") or {})
        for field in (
            "preferred_date", "preferred_time", "visit_reason",
            "patient_name", "patient_phone", "is_first_visit",
        ):
            if new_extraction.get(field):
                merged[field] = new_extraction[field]
        # Don't let a short follow-up reply ("胃が痛いです") drag down an
        # already-solid earlier read.
        merged["confidence"] = max(merged.get("confidence", 0.0), new_extraction.get("confidence", 0.0))
        merged.setdefault("field_confidences", {})

        _mark_clarification_resolved(db, pending["id"])

        missing = _missing_booking_fields(merged)
        if missing:
            # Still not enough -- ask again for whatever's still missing.
            _create_pending_clarification(
                db, clinic_id, line_user_id, kind="booking_details", options=[],
                source=source, raw_input=raw_message,
                intent="appointment_request", intent_confidence=1.0, lang=lang,
                extra={"extraction": merged, "missing": missing},
            )
            return {"status": "awaiting_booking_details", "missing": missing, "lang": lang}

        clinic = _get_clinic(db, clinic_id)
        return _book_appointment_flow(
            db, clinic_id, source, None, line_user_id,
            "appointment_request", 1.0, merged, raw_message, clinic, today_str, lang,
        )

    if kind == "reschedule_new_time":
        try:
            extraction = extract_appointment(raw_message, today_str)
        except Exception:
            extraction = {}
        new_date = extraction.get("preferred_date")
        new_time = extraction.get("preferred_time")
        if not (new_date and new_time):
            # Still couldn't understand -- leave the row open and re-ask.
            return {"status": "clarification_unclear", "kind": kind, "options": [], "lang": lang}

        _mark_clarification_resolved(db, pending["id"])
        appt = {"id": context["appointment_id"], "scheduled_at": context["old_scheduled_at"]}
        return _apply_reschedule(
            db, clinic_id, source, line_user_id, appt, new_date, new_time,
            raw_message, today_str, lang,
        )

    match = re.search(r"\d+", raw_message)
    choice_idx = int(match.group()) - 1 if match else -1

    if choice_idx < 0 or choice_idx >= len(options):
        # Didn't understand the reply -- re-ask the same question rather
        # than silently dropping it or guessing.
        return {"status": "clarification_unclear", "kind": kind, "options": options, "lang": lang}

    chosen = options[choice_idx]

    if kind == "cancel_choice":
        _mark_clarification_resolved(db, pending["id"], choice_idx)
        appt_id = chosen["appointment_id"]
        db.table("appointments").update({"status": "cancelled"}).eq("id", appt_id).execute()
        _log_audit(db, clinic_id, "appointment_cancelled", record_id=appt_id, metadata={
            "source": source, "auto": True, "via": "clarification",
        })
        return {
            "status": "auto_cancelled",
            "appointment_id": appt_id,
            "scheduled_at": chosen["scheduled_at"],
            "lang": lang,
        }

    if kind == "alternative_time":
        _mark_clarification_resolved(db, pending["id"], choice_idx)
        clinic = _get_clinic(db, clinic_id)
        clinic_name = _resolve_clinic_name(clinic, lang)
        extraction = {**context.get("extraction", {}), "preferred_time": chosen["time"]}
        original_raw_message = context.get("original_raw_message", raw_message)
        return _create_appointment(
            db, clinic_id, source=source, extraction=extraction, raw_message=original_raw_message,
            patient_phone=None, line_user_id=line_user_id, clinic_name=clinic_name, lang=lang,
        )

    if kind == "reschedule_choice":
        _mark_clarification_resolved(db, pending["id"], choice_idx)
        appt = {"id": chosen["appointment_id"], "scheduled_at": chosen["scheduled_at"]}
        new_date = context.get("new_date")
        new_time = context.get("new_time")

        if new_date and new_time:
            return _apply_reschedule(
                db, clinic_id, source, line_user_id, appt, new_date, new_time,
                raw_message, today_str, lang,
            )

        _create_pending_clarification(
            db, clinic_id, line_user_id, kind="reschedule_new_time", options=[],
            source=source, raw_input=raw_message,
            intent="reschedule", intent_confidence=1.0, lang=lang,
            extra={"appointment_id": appt["id"], "old_scheduled_at": appt["scheduled_at"]},
        )
        return {"status": "awaiting_reschedule_time", "scheduled_at": appt["scheduled_at"], "lang": lang}

    if kind == "reschedule_alternative_time":
        _mark_clarification_resolved(db, pending["id"], choice_idx)
        appt = {"id": context["appointment_id"], "scheduled_at": context.get("old_scheduled_at")}
        new_date = context["date"]
        new_time = chosen["time"]
        return _apply_reschedule(
            db, clinic_id, source, line_user_id, appt, new_date, new_time,
            raw_message, today_str, lang,
        )

    return {"status": "clarification_unclear", "kind": kind, "options": options, "lang": lang}


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
