# apps/api/routers/webhooks.py
"""
Webhook intake endpoints.

POST /webhooks/line   — Line Messaging API webhook
POST /webhooks/web    — Web booking form (from Next.js frontend)
POST /webhooks/email  — Inbound email via Mailgun

Line requires a 200 response within 500ms, so we process
synchronously for MVP. In production, push to a job queue immediately
and process async, then send the reply via the Line reply API.
"""
import hashlib
import hmac
import html
import os
import base64
import re
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel
from services.db import get_db
from services.scheduling import process_message
from services.email import send_appointment_confirmation
from services.line import send_line_reply
from services.ai import generate_confirmation
from services.limiter import limiter

router = APIRouter()


def _resolve_clinic_by_line_channel(channel_id: str) -> str | None:
    """
    Look up the clinic whose `line_channel_id` matches the LINE bot channel
    that received this webhook (LINE's `destination` field). Returns None if
    no clinic is registered for it -- callers must NOT fall back to a default
    clinic in that case.
    """
    if not channel_id:
        return None
    db = get_db()
    rows = db.table("clinics").select("id").eq("line_channel_id", channel_id).limit(1).execute()
    return rows.data[0]["id"] if rows.data else None


def _resolve_clinic_by_inbound_email(address: str) -> str | None:
    """
    Look up the clinic whose `inbound_email` matches the Mailgun recipient
    address this message was sent to. Returns None if no clinic is
    registered for it -- callers must NOT fall back to a default clinic.
    """
    if not address:
        return None
    db = get_db()
    rows = db.table("clinics").select("id").eq("inbound_email", address.lower()).limit(1).execute()
    return rows.data[0]["id"] if rows.data else None


# ── Line webhook ──────────────────────────────────────────────

def _verify_line_signature(body: bytes, signature: str) -> bool:
    """Verify Line webhook signature to prevent spoofing."""
    secret = os.getenv("LINE_CHANNEL_SECRET", "")
    if not secret:
        # Fail closed: an unconfigured secret must never be treated as "verification passed".
        return False

    expected = base64.b64encode(
        hmac.new(secret.encode(), body, hashlib.sha256).digest()
    ).decode()
    return hmac.compare_digest(expected, signature)


def _verify_mailgun_signature(timestamp: str, token: str, signature: str) -> bool:
    """Verify Mailgun's inbound webhook signature to prevent spoofed requests."""
    signing_key = os.getenv("MAILGUN_SIGNING_KEY", "")
    if not signing_key or not timestamp or not token or not signature:
        return False

    expected = hmac.new(
        key=signing_key.encode(),
        msg=f"{timestamp}{token}".encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def _format_jp_datetime(iso_str: str) -> str:
    """'2026-07-20T14:00:00+09:00' -> '7月20日(月) 14:00'"""
    from datetime import datetime as _dt
    try:
        dt = _dt.fromisoformat(iso_str)
        weekday = ["月", "火", "水", "木", "金", "土", "日"][dt.weekday()]
        return f"{dt.month}月{dt.day}日({weekday}) {dt.hour:02d}:{dt.minute:02d}"
    except ValueError:
        return iso_str


def _numbered_appointment_options(options: list[dict]) -> str:
    return "\n".join(
        f"{i}. {_format_jp_datetime(o['scheduled_at'])}"
        for i, o in enumerate(options, start=1)
    )


def _numbered_time_options(date: str, options: list[dict]) -> str:
    date_label = _format_jp_datetime(f"{date}T00:00:00+09:00").split(" ")[0]
    lines = "\n".join(f"{i}. {o['time']}" for i, o in enumerate(options, start=1))
    return f"{date_label}\n{lines}"


def _process_line_and_reply(clinic_id: str, text: str, user_id: str):
    """Run the scheduling pipeline, then push a reply back to the patient in LINE."""
    result = process_message(
        clinic_id=clinic_id,
        raw_message=text,
        source="line",
        line_user_id=user_id or None,
    )
    if not user_id:
        return

    db = get_db()
    clinic_rows = db.table("clinics").select("name, name_jp").eq("id", clinic_id).limit(1).execute()
    clinic_row = clinic_rows.data[0] if clinic_rows.data else {}
    clinic_name_jp = clinic_row.get("name_jp") or clinic_row.get("name", "")

    status = result.get("status")

    if status == "confirmed":
        if result.get("scheduled_at"):
            reply = generate_confirmation(
                patient_name=result.get("patient_name"),
                date=result["scheduled_at"][:10],
                time=result["scheduled_at"][11:16],
                clinic_name_jp=clinic_name_jp,
            )
        else:
            patient_name = result.get("patient_name")
            greeting = f"{patient_name}様" if patient_name else "お客様"
            reply = f"{greeting}、ご予約を承りました。日時の詳細はクリニックまでお問い合わせください。"
        if result.get("flagged_for_review"):
            reply += "\n\n※内容を確認の上、担当者よりご連絡する場合がございます。"

    elif status == "auto_cancelled":
        when = _format_jp_datetime(result["scheduled_at"]) if result.get("scheduled_at") else ""
        reply = f"ご予約（{when}）をキャンセルいたしました。またのご利用をお待ちしております。"

    elif status == "cancellation_no_match":
        reply = "現在確認できるご予約が見つかりませんでした。恐れ入りますが、クリニックまで直接お問い合わせください。"

    elif status == "awaiting_cancel_choice":
        options_text = _numbered_appointment_options(result["options"])
        reply = f"複数のご予約が見つかりました。キャンセルするものの番号を返信してください。\n\n{options_text}"

    elif status == "awaiting_alternative_time":
        options_text = _numbered_time_options(result["date"], [{"time": t} for t in result["alternatives"]])
        reply = f"ご希望の時間は既にご予約が入っております。以下よりご希望の時間の番号を返信してください。\n\n{options_text}"

    elif status == "rescheduled":
        old_when = _format_jp_datetime(result["old_scheduled_at"])
        new_when = _format_jp_datetime(result["new_scheduled_at"])
        reply = f"ご予約を変更いたしました。\n変更前: {old_when}\n変更後: {new_when}"

    elif status == "reschedule_no_match":
        reply = "現在確認できるご予約が見つかりませんでした。恐れ入りますが、クリニックまで直接お問い合わせください。"

    elif status == "awaiting_reschedule_choice":
        options_text = _numbered_appointment_options(result["options"])
        reply = f"複数のご予約が見つかりました。変更するものの番号を返信してください。\n\n{options_text}"

    elif status == "awaiting_reschedule_time":
        when = _format_jp_datetime(result["scheduled_at"]) if result.get("scheduled_at") else ""
        reply = f"ご予約（{when}）の変更を承ります。ご希望の新しい日時を教えてください。"

    elif status == "awaiting_reschedule_alternative":
        options_text = _numbered_time_options(result["date"], [{"time": t} for t in result["alternatives"]])
        reply = f"ご希望の時間は既にご予約が入っております。以下よりご希望の時間の番号を返信してください。\n\n{options_text}"

    elif status == "no_alternatives_that_day":
        date_label = _format_jp_datetime(f"{result['date']}T00:00:00+09:00").split(" ")[0]
        reply = f"{date_label}は空きがございません。恐れ入りますが、別の日をお知らせください。"

    elif status == "clarification_unclear":
        if result.get("kind") in ("cancel_choice", "reschedule_choice"):
            options_text = _numbered_appointment_options(result["options"])
            reply = f"番号でお答えください。\n\n{options_text}"
        elif result.get("kind") in ("alternative_time", "reschedule_alternative_time"):
            options_text = "\n".join(f"{i}. {o['time']}" for i, o in enumerate(result["options"], start=1))
            reply = f"番号でお答えください。\n\n{options_text}"
        elif result.get("kind") == "reschedule_new_time":
            reply = "日時がわかりませんでした。ご希望の日時を教えてください（例：7月20日の15時）。"
        else:
            reply = "申し訳ございません、もう一度お試しください。"

    elif status == "plan_limit_reached":
        reply = "現在、月間のご予約上限に達しております。恐れ入りますが、クリニックまで直接お問い合わせください。"

    elif status in ("small_talk", "inquiry_answered"):
        reply = result.get("reply_text") or "申し訳ございません。処理中にエラーが発生しました。お手数ですがクリニックまでお電話ください。"

    elif status == "queued_for_review":
        reply = "ご連絡ありがとうございます。内容を確認の上、担当者よりご連絡いたします。"

    else:
        reply = "申し訳ございません。処理中にエラーが発生しました。お手数ですがクリニックまでお電話ください。"

    send_line_reply(user_id, reply)


@router.post("/line")
async def line_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receives events from the Line Messaging API.
    Must return 200 within 500ms — processing happens in background.
    """
    body = await request.body()
    signature = request.headers.get("X-Line-Signature", "")

    if not _verify_line_signature(body, signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    import json
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # All events in a single Line webhook call originate from the same bot
    # channel, identified by `destination` (the bot's own channel/user ID).
    # Resolve the clinic once for the whole payload.
    destination = payload.get("destination", "")
    clinic_id = _resolve_clinic_by_line_channel(destination)
    if not clinic_id:
        event_count = len(payload.get("events", []))
        print(
            f"[webhooks] No clinic registered for Line channel destination={destination!r} "
            f"— skipping {event_count} event(s) instead of misattributing them"
        )
        return {"status": "ok"}

    for event in payload.get("events", []):
        if event.get("type") != "message":
            continue
        if event.get("message", {}).get("type") != "text":
            continue

        text = event["message"]["text"]
        user_id = event.get("source", {}).get("userId", "")

        # Process in background so we return 200 immediately to Line
        background_tasks.add_task(_process_line_and_reply, clinic_id, text, user_id)

    return {"status": "ok"}


# ── Web form webhook ──────────────────────────────────────────

class WebBookingRequest(BaseModel):
    clinic_id: str
    message: str
    patient_phone: str | None = None


@router.post("/web")
@limiter.limit("10/minute")
async def web_booking(request: Request, payload: WebBookingRequest):
    """
    Direct booking from the clinic's web widget or the dashboard test form.
    Processes synchronously and returns the result immediately.

    Unauthenticated and public, and every call triggers paid LLM calls
    (see services/ai.py), so it's rate limited per-IP to keep a scripted
    flood from running up the AI bill.
    """
    result = process_message(
        clinic_id=payload.clinic_id,
        raw_message=payload.message,
        source="web",
        patient_phone=payload.patient_phone,
    )
    return result


# ── Inbound email webhook (Mailgun) ───────────────────────────

def _extract_email(raw: str) -> str:
    """Extract plain email from 'Name <email@example.com>' format."""
    match = re.search(r'<([^>]+)>', raw)
    return match.group(1).strip() if match else raw.strip()


def _send_ack(patient_email: str, patient_name: str, result: dict):
    """Send an acknowledgment email back to the patient."""
    status = result.get("status", "")

    if status == "confirmed":
        send_appointment_confirmation(
            to_email=patient_email,
            patient_name=patient_name or "Dear patient",
            clinic_name="新宿デモクリニック",
            preferred_date=result.get("scheduled_at", "")[:10] if result.get("scheduled_at") else None,
            preferred_time=result.get("scheduled_at", "")[11:16] if result.get("scheduled_at") else None,
            visit_reason=None,
            is_first_visit=None,
            lang="en",
        )
    else:
        # Queued for review — send a "we received it" reply
        import resend, os
        resend.api_key = os.getenv("RESEND_API_KEY", "")
        if not resend.api_key or "your_api_key" in resend.api_key:
            return
        resend.Emails.send({
            "from": os.getenv("EMAIL_FROM", "onboarding@resend.dev"),
            "to": [patient_email.lower().strip()],
            "subject": "We received your appointment request — 新宿デモクリニック",
            "html": f"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
              <h2 style="color:#0f766e">新宿デモクリニック</h2>
              <p>Dear {html.escape(patient_name) if patient_name else 'Patient'},</p>
              <p>Thank you for your email. We have received your appointment request and will confirm the details shortly.</p>
              <p style="color:#6b7280;font-size:13px">ご連絡ありがとうございます。予約リクエストを受け付けました。確認後にご連絡いたします。</p>
              <p style="font-size:12px;color:#9ca3af;margin-top:24px">Powered by CareBot Japan</p>
            </div>
            """,
        })


@router.post("/email")
async def email_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Inbound email webhook from Mailgun.
    Mailgun POSTs parsed email fields as form data.
    Returns 200 immediately; processing runs in background.
    """
    form = await request.form()

    if not _verify_mailgun_signature(
        timestamp=str(form.get("timestamp") or ""),
        token=str(form.get("token") or ""),
        signature=str(form.get("signature") or ""),
    ):
        raise HTTPException(status_code=403, detail="Invalid Mailgun signature")

    from_raw    = str(form.get("From") or form.get("from") or "")
    sender      = str(form.get("sender") or "")
    recipient_raw = str(form.get("recipient") or form.get("To") or form.get("to") or "")
    subject     = str(form.get("subject") or form.get("Subject") or "")
    body_plain  = str(form.get("body-plain") or "")
    body_html   = str(form.get("stripped-text") or form.get("body-plain") or "")

    patient_email = _extract_email(from_raw) or sender
    recipient_email = _extract_email(recipient_raw)
    body = body_plain or body_html

    if not patient_email or not body.strip():
        return {"status": "ignored", "reason": "no sender or empty body"}

    # Resolve which clinic this message was sent to via the recipient
    # address. Never fall back to a default clinic on a miss — log and skip.
    clinic_id = _resolve_clinic_by_inbound_email(recipient_email)
    if not clinic_id:
        print(
            f"[webhooks] No clinic registered for inbound email recipient={recipient_email!r} "
            f"— skipping message from {patient_email!r} instead of misattributing it"
        )
        return {"status": "ignored", "reason": "no clinic registered for recipient address"}

    # Build message text for the AI pipeline
    message_text = f"Subject: {subject}\n\n{body.strip()}" if subject else body.strip()

    # Extract patient name from From header if available (e.g. "Tanaka Yuki <tanaka@gmail.com>")
    name_match = re.match(r'^([^<]+)<', from_raw)
    patient_name = name_match.group(1).strip() if name_match else ""

    def process_and_reply():
        result = process_message(
            clinic_id=clinic_id,
            raw_message=message_text,
            source="email",
            patient_phone=None,
        )
        _send_ack(patient_email, patient_name, result)

    background_tasks.add_task(process_and_reply)
    return {"status": "ok", "message": "Email received, processing in background"}
