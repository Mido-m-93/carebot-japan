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
import os
import base64
import re
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel
from services.scheduling import process_message
from services.email import send_appointment_confirmation
from services.line import send_line_reply
from services.ai import generate_confirmation

router = APIRouter()

# ── Line webhook ──────────────────────────────────────────────

def _verify_line_signature(body: bytes, signature: str) -> bool:
    """Verify Line webhook signature to prevent spoofing."""
    secret = os.getenv("LINE_CHANNEL_SECRET", "")
    if not secret:
        return True  # Skip verification in dev if no secret set

    expected = base64.b64encode(
        hmac.new(secret.encode(), body, hashlib.sha256).digest()
    ).decode()
    return hmac.compare_digest(expected, signature)


def _process_line_and_reply(clinic_id: str, text: str, user_id: str):
    """Run the scheduling pipeline, then push a reply back to the patient in LINE."""
    result = process_message(
        clinic_id=clinic_id,
        raw_message=text,
        source="line",
    )
    if not user_id:
        return

    status = result.get("status")
    if status == "confirmed":
        if result.get("scheduled_at"):
            reply = generate_confirmation(
                patient_name=result.get("patient_name"),
                date=result["scheduled_at"][:10],
                time=result["scheduled_at"][11:16],
                clinic_name_jp="新宿デモクリニック",
            )
        else:
            patient_name = result.get("patient_name")
            greeting = f"{patient_name}様" if patient_name else "お客様"
            reply = f"{greeting}、ご予約を承りました。日時の詳細はクリニックまでお問い合わせください。"
        if result.get("flagged_for_review"):
            reply += "\n\n※内容を確認の上、担当者よりご連絡する場合がございます。"
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

    for event in payload.get("events", []):
        if event.get("type") != "message":
            continue
        if event.get("message", {}).get("type") != "text":
            continue

        text = event["message"]["text"]
        user_id = event.get("source", {}).get("userId", "")
        # In MVP we use the demo clinic. Production: resolve from Line channel ID.
        clinic_id = "00000000-0000-0000-0000-000000000001"

        # Process in background so we return 200 immediately to Line
        background_tasks.add_task(_process_line_and_reply, clinic_id, text, user_id)

    return {"status": "ok"}


# ── Web form webhook ──────────────────────────────────────────

class WebBookingRequest(BaseModel):
    clinic_id: str
    message: str
    patient_phone: str | None = None


@router.post("/web")
async def web_booking(payload: WebBookingRequest):
    """
    Direct booking from the clinic's web widget or the dashboard test form.
    Processes synchronously and returns the result immediately.
    """
    result = process_message(
        clinic_id=payload.clinic_id,
        raw_message=payload.message,
        source="web",
        patient_phone=payload.patient_phone,
    )
    return result


# ── Inbound email webhook (Mailgun) ───────────────────────────

DEMO_CLINIC_ID = "00000000-0000-0000-0000-000000000001"


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
              <p>Dear {patient_name or 'Patient'},</p>
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

    from_raw   = str(form.get("From") or form.get("from") or "")
    sender     = str(form.get("sender") or "")
    subject    = str(form.get("subject") or form.get("Subject") or "")
    body_plain = str(form.get("body-plain") or "")
    body_html  = str(form.get("stripped-text") or form.get("body-plain") or "")

    patient_email = _extract_email(from_raw) or sender
    body = body_plain or body_html

    if not patient_email or not body.strip():
        return {"status": "ignored", "reason": "no sender or empty body"}

    # Build message text for the AI pipeline
    message_text = f"Subject: {subject}\n\n{body.strip()}" if subject else body.strip()

    # Extract patient name from From header if available (e.g. "Tanaka Yuki <tanaka@gmail.com>")
    name_match = re.match(r'^([^<]+)<', from_raw)
    patient_name = name_match.group(1).strip() if name_match else ""

    def process_and_reply():
        result = process_message(
            clinic_id=DEMO_CLINIC_ID,
            raw_message=message_text,
            source="email",
            patient_phone=None,
        )
        _send_ack(patient_email, patient_name, result)

    background_tasks.add_task(process_and_reply)
    return {"status": "ok", "message": "Email received, processing in background"}
