# apps/api/services/line.py
"""
LINE Messaging API — push a reply back to the patient after their
message has been processed by the scheduling pipeline.
"""
import os
import httpx

LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"


def send_line_reply(user_id: str, text: str, access_token: str | None = None) -> bool:
    """
    Send a push message to a LINE user.

    `access_token` should be the clinic's own LINE channel access token
    (clinics.line_channel_access_token). Falls back to the global
    LINE_CHANNEL_ACCESS_TOKEN env var when the clinic hasn't configured its
    own -- keeps the original single-tenant clinic working unchanged.

    Returns True if sent, False if not configured or the request failed.
    """
    token = access_token or os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")
    if not token:
        print(f"[line] No LINE channel access token configured — skipping reply to {user_id}")
        return False

    try:
        resp = httpx.post(
            LINE_PUSH_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"to": user_id, "messages": [{"type": "text", "text": text}]},
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f"[line] Failed to send reply to {user_id}: {e}")
        return False
