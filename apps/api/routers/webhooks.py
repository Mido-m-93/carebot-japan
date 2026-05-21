# apps/api/routers/webhooks.py
"""
Webhook intake endpoints.

POST /webhooks/line   — Line Messaging API webhook
POST /webhooks/web    — Web booking form (from Next.js frontend)

Line requires a 200 response within 500ms, so we process
synchronously for MVP. In production, push to a job queue immediately
and process async, then send the reply via the Line reply API.
"""
import hashlib
import hmac
import os
import base64
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel
from services.scheduling import process_message

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
        # In MVP we use the demo clinic. Production: resolve from Line channel ID.
        clinic_id = "00000000-0000-0000-0000-000000000001"

        # Process in background so we return 200 immediately to Line
        background_tasks.add_task(
            process_message,
            clinic_id=clinic_id,
            raw_message=text,
            source="line",
        )

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
