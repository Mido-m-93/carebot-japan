# apps/api/services/scheduling.py
"""
Core scheduling pipeline.

For a given clinic + raw message:
1. Classify intent (Haiku)
2. If appointment_request: extract details (Sonnet)
3. If confident: write appointment to Supabase, send SMS
4. If not confident: push to review_queue
5. Write audit log

This runs synchronously for simplicity in MVP.
In production, steps 1-5 run inside a background job worker.
"""
import uuid
from datetime import datetime, timezone, timedelta
from services.ai import classify_intent, extract_appointment, generate_confirmation
from services.sms import send_sms
from services.db import get_db

# Thresholds for automatic processing vs human review
INTENT_CONFIDENCE_THRESHOLD = 0.75
EXTRACTION_CONFIDENCE_THRESHOLD = 0.80


def process_message(
    *,
    clinic_id: str,
    raw_message: str,
    source: str,  # 'line' | 'web' | 'email'
    patient_phone: str | None = None,
) -> dict:
    """
    Full scheduling pipeline. Returns a status dict describing the outcome.
    """
    db = get_db()
    now_jst = datetime.now(tz=timezone(timedelta(hours=9)))
    today_str = now_jst.strftime("%Y-%m-%d")

    # ── Fetch clinic info ─────────────────────────────────────
    clinic_row = (
        db.table("clinics")
        .select("id, name, name_jp, active")
        .eq("id", clinic_id)
        .single()
        .execute()
    )
    if not clinic_row.data or not clinic_row.data["active"]:
        return {"status": "error", "reason": "clinic_not_found_or_inactive"}

    clinic = clinic_row.data
    clinic_name_jp = clinic.get("name_jp") or clinic["name"]

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

    # ── Non-appointment intents: queue for human handling ─────
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

    # ── Low intent confidence: also queue for review ──────────
    if intent_confidence < INTENT_CONFIDENCE_THRESHOLD:
        _push_review_queue(
            db, clinic_id, source, raw_message,
            intent, intent_confidence, extracted_data=None,
            field_confidences=None,
        )
        return {
            "status": "queued_for_review",
            "intent": intent,
            "confidence": intent_confidence,
            "reason": "low_intent_confidence",
        }

    # ── Step 2: Appointment detail extraction ─────────────────
    _log_audit(db, clinic_id, "claude_extraction_run", metadata={
        "step": "appointment_extraction",
        "model": "claude-sonnet-4-20250514",
    })

    extraction = extract_appointment(raw_message, today_str)
    overall_confidence = extraction.get("confidence", 0.0)
    field_confidences = extraction.get("field_confidences", {})

    # ── Low extraction confidence: queue for review ───────────
    if overall_confidence < EXTRACTION_CONFIDENCE_THRESHOLD:
        _push_review_queue(
            db, clinic_id, source, raw_message,
            intent, intent_confidence,
            extracted_data=extraction,
            field_confidences=field_confidences,
        )
        return {
            "status": "queued_for_review",
            "intent": intent,
            "confidence": overall_confidence,
            "reason": "low_extraction_confidence",
            "extracted": extraction,
        }

    # ── Step 3: Write appointment to Supabase ─────────────────
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
    }

    db.table("appointments").insert(appt_row).execute()

    _log_audit(db, clinic_id, "appointment_created", record_id=appointment_id, metadata={
        "source": source,
        "confidence": overall_confidence,
    })

    # ── Step 4: Send SMS confirmation ─────────────────────────
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
                {"sms_sent_at": now_jst.isoformat()}
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
        "confidence": overall_confidence,
    }


# ── Helpers ───────────────────────────────────────────────────

def _push_review_queue(
    db, clinic_id, source, raw_input,
    intent, intent_confidence,
    extracted_data, field_confidences,
):
    item = {
        "clinic_id": clinic_id,
        "source": source,
        "raw_input": raw_input,
        "intent": intent,
        "intent_confidence": intent_confidence,
        "extracted_data": extracted_data,
        "field_confidences": field_confidences,
        "status": "pending",
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
