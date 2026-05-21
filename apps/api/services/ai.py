# apps/api/services/ai.py
import os
import json
from datetime import datetime
import anthropic

INTENT_SYSTEM = """You are a Japanese medical clinic scheduling assistant.
Classify the intent of the incoming patient message.

Return ONLY valid JSON matching this exact schema. No commentary, no markdown.

{
  "intent": "appointment_request" | "cancellation" | "reschedule" | "general_inquiry" | "out_of_scope",
  "confidence": 0.0,
  "reason": "one sentence explanation in English"
}

Intent definitions:
- appointment_request: Patient wants to book a new appointment
- cancellation: Patient wants to cancel an existing appointment
- reschedule: Patient wants to move an existing appointment
- general_inquiry: Question about the clinic (hours, location, fees, etc.)
- out_of_scope: Unrelated message or cannot be determined

Use confidence < 0.75 when the message is ambiguous."""

EXTRACTION_SYSTEM = """You are a Japanese medical clinic scheduling assistant.
Extract appointment booking details from the patient message.

The clinic is in Japan. Dates and times may be expressed in Japanese or relative terms.
Today's date (JST) will be provided in the user message.

Return ONLY valid JSON. No commentary, no markdown. Use null for unknown fields.

{
  "patient_name": null,
  "patient_phone": null,
  "preferred_date": null,
  "preferred_time": null,
  "visit_reason": null,
  "is_first_visit": null,
  "confidence": 0.0,
  "field_confidences": {
    "patient_name": 0.0,
    "preferred_date": 0.0,
    "preferred_time": 0.0,
    "visit_reason": 0.0
  },
  "ambiguities": []
}

preferred_date format: "YYYY-MM-DD"
preferred_time format: "HH:MM" (24-hour)

Japanese date/time resolution:
- "来週の月曜" → next Monday's date
- "明日の午後" → tomorrow, preferred_time: "14:00"
- "午後3時" → "15:00"
- "10時" → "10:00"
- "今週中" → ambiguities: ["no specific day given"]"""


def _parse_json(text: str) -> dict:
    """Strip markdown fences and parse JSON."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    return json.loads(cleaned.strip())


def classify_intent(message: str) -> dict:
    """
    Classify patient message intent using Claude Haiku.
    Fast and cheap (~¥0.02/call). Returns intent + confidence.
    """
    client = anthropic.Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        default_headers={
            # Prevent patient data from being used for training
            "anthropic-beta": "output-128k-2025-02-19",
        },
    )

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=INTENT_SYSTEM,
        messages=[{"role": "user", "content": message}],
    )

    text = response.content[0].text
    return _parse_json(text)


def extract_appointment(message: str, today_jst: str) -> dict:
    """
    Extract appointment details from patient message using Claude Sonnet.
    today_jst: "YYYY-MM-DD" — needed for relative date resolution.
    """
    client = anthropic.Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        default_headers={
            "anthropic-beta": "output-128k-2025-02-19",
        },
    )

    user_content = f"Today's date (JST): {today_jst}\n\nPatient message:\n{message}"

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system=EXTRACTION_SYSTEM,
        messages=[{"role": "user", "content": user_content}],
    )

    text = response.content[0].text
    return _parse_json(text)


def generate_confirmation(
    patient_name: str | None,
    date: str,
    time: str,
    clinic_name_jp: str,
) -> str:
    """Generate a natural Japanese SMS confirmation message."""
    from datetime import datetime
    import locale

    greeting = f"{patient_name}様" if patient_name else "お客様"

    # Parse and format in Japanese style
    dt_str = f"{date}T{time}:00"
    try:
        dt = datetime.fromisoformat(dt_str)
        weekdays = ["月", "火", "水", "木", "金", "土", "日"]
        weekday = weekdays[dt.weekday()]
        date_jp = f"{dt.year}年{dt.month}月{dt.day}日({weekday})"
        time_jp = f"{dt.hour:02d}:{dt.minute:02d}"
    except ValueError:
        date_jp = date
        time_jp = time

    return (
        f"{greeting}、ご予約を承りました。\n\n"
        f"【{clinic_name_jp}】\n"
        f"日時: {date_jp} {time_jp}\n"
        f"ご来院をお待ちしております。\n\n"
        f"当日のキャンセルはこちらまでご連絡ください。"
    )
