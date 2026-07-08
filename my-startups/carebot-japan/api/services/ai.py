# apps/api/services/ai.py
import os
import json
from datetime import datetime
from groq import Groq

INTENT_SYSTEM = """You are a Japanese medical clinic scheduling assistant.
Classify the intent of the incoming patient message. Messages may be in Japanese or English.

Return ONLY valid JSON matching this exact schema. No commentary, no markdown.

{
  "intent": "appointment_request" | "cancellation" | "reschedule" | "general_inquiry" | "out_of_scope",
  "confidence": 0.0,
  "reason": "one sentence explanation in English"
}

Intent definitions:
- appointment_request: Patient wants to book a new appointment. Japanese signals: 予約したい、予約をお願い、診ていただきたい、受診したい、appointment、make a reservation
- cancellation: Patient wants to cancel an existing appointment. Japanese signals: キャンセル、取り消し、予約をキャンセル
- reschedule: Patient wants to move an existing appointment. Japanese signals: 変更したい、日程変更
- general_inquiry: Question about the clinic (hours, location, fees). Japanese signals: 診療時間、場所、費用
- out_of_scope: Unrelated message or cannot be determined

Examples:
- "来週の水曜日に予約したいです" → appointment_request, confidence 0.95
- "明日の予約をキャンセルしたい" → cancellation, confidence 0.95
- "診療時間を教えてください" → general_inquiry, confidence 0.95
- "I'd like to book an appointment" → appointment_request, confidence 0.95

Use confidence < 0.75 only when the message is truly ambiguous."""

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


def _client() -> Groq:
    return Groq(api_key=os.environ["GROQ_API_KEY"])


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    return json.loads(cleaned.strip())


def classify_intent(message: str) -> dict:
    response = _client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=256,
        messages=[
            {"role": "system", "content": INTENT_SYSTEM},
            {"role": "user", "content": message},
        ],
    )
    raw = response.choices[0].message.content
    print(f"[debug classify_intent] input={message!r} raw_output={raw!r}")
    return _parse_json(raw)


def extract_appointment(message: str, today_jst: str) -> dict:
    user_content = f"Today's date (JST): {today_jst}\n\nPatient message:\n{message}"
    response = _client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=512,
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM},
            {"role": "user", "content": user_content},
        ],
    )
    return _parse_json(response.choices[0].message.content)


def generate_confirmation(
    patient_name: str | None,
    date: str,
    time: str,
    clinic_name_jp: str,
) -> str:
    greeting = f"{patient_name}様" if patient_name else "お客様"

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
