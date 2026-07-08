# apps/api/services/line.py
"""
LINE Messaging API — push a reply back to the patient after their
message has been processed by the scheduling pipeline.
"""
import os
import httpx

LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"


def send_line_reply(user_id: str, text: str) -> bool:
    """
    Send a push message to a LINE user.
    Returns True if sent, False if not configured or the request failed.
    """
    token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")
    if not token:
        print(f"[line] LINE_CHANNEL_ACCESS_TOKEN not set — skipping reply to {user_id}")
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
