# apps/api/services/sms.py
import os
from twilio.rest import Client


def send_sms(to: str, body: str) -> str | None:
    """
    Send an SMS via Twilio JP.
    Returns the Twilio message SID, or None in dev mode (no credentials set).
    """
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER")

    if not all([sid, token, from_number]):
        # Dev mode — print instead of sending
        print(f"[DEV SMS] To: {to}\n{body}\n")
        return "dev-mode-no-sid"

    client = Client(sid, token)
    message = client.messages.create(body=body, from_=from_number, to=to)
    return message.sid
