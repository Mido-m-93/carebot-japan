# apps/api/services/ai.py
import os
import json
from datetime import datetime
from groq import Groq

INTENT_SYSTEM = """You are a Japanese medical clinic scheduling assistant.
Classify the intent of the incoming patient message. Messages may be in Japanese or English.

Return ONLY valid JSON matching this exact schema. No commentary, no markdown.

{
  "intent": "appointment_request" | "cancellation" | "reschedule" | "general_inquiry" | "small_talk" | "out_of_scope",
  "confidence": 0.0,
  "reason": "one sentence explanation in English"
}

Intent definitions:
- appointment_request: Patient wants to book a new appointment. Japanese signals: 予約したい、予約をお願い、診ていただきたい、受診したい、appointment、make a reservation
- cancellation: Patient wants to cancel an existing appointment. Japanese signals: キャンセル、取り消し、予約をキャンセル
- reschedule: Patient wants to move an existing appointment to a different time. Japanese signals: 変更したい、日程変更、時間を変えたい
- general_inquiry: Factual question about the clinic (hours, location, fees, what to bring, etc.). Japanese signals: 診療時間、場所、費用
- small_talk: Greetings, thanks, pleasantries, or casual chat with no scheduling/informational request. Japanese signals: こんにちは、ありがとう、お疲れ様
- out_of_scope: Anything else -- unrelated, spam, or a request this clinic assistant cannot help with (e.g. medical advice, emergencies, unrelated businesses)

Examples:
- "来週の水曜日に予約したいです" → appointment_request, confidence 0.95
- "明日の予約をキャンセルしたい" → cancellation, confidence 0.95
- "時間を3時に変更したい" → reschedule, confidence 0.95
- "診療時間を教えてください" → general_inquiry, confidence 0.95
- "I'd like to book an appointment" → appointment_request, confidence 0.95
- "ありがとうございます！" → small_talk, confidence 0.9
- "hi there" → small_talk, confidence 0.9
- "こんにちは" → small_talk, confidence 0.9

Use confidence < 0.75 only when the message is truly ambiguous."""

SMALL_TALK_SYSTEM = """You are the friendly front-desk chat assistant for a Japanese medical clinic,
speaking with a patient over LINE. Reply warmly and briefly (1-2 short sentences) to their greeting,
thanks, or casual remark. Match the language they wrote in (Japanese or English).

Stay strictly in the front-desk-receptionist register: warm and human, but never give medical
advice, never diagnose, never discuss symptoms or treatment. If they mention anything symptom-like
or medical, gently suggest they book an appointment or call the clinic directly instead of
responding to the medical content itself.

Return ONLY the reply text. No JSON, no commentary, no markdown."""

INQUIRY_SYSTEM = """You are the front-desk assistant for a Japanese medical clinic, answering a
patient's factual question over LINE. You will be given the clinic's real opening hours and name --
use ONLY that information. Match the language the patient wrote in (Japanese or English).

If the question asks something you were not given real information for (fees, specific doctors,
insurance, parking, etc.), say so honestly and suggest they call the clinic directly -- never
invent an answer.

Return ONLY the reply text. No JSON, no commentary, no markdown."""

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
    return _parse_json(response.choices[0].message.content)


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


def generate_small_talk_reply(message: str) -> str:
    response = _client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=128,
        messages=[
            {"role": "system", "content": SMALL_TALK_SYSTEM},
            {"role": "user", "content": message},
        ],
    )
    return response.choices[0].message.content.strip()


def generate_inquiry_reply(message: str, clinic_info: str) -> str:
    user_content = f"Clinic information:\n{clinic_info}\n\nPatient question:\n{message}"
    response = _client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=256,
        messages=[
            {"role": "system", "content": INQUIRY_SYSTEM},
            {"role": "user", "content": user_content},
        ],
    )
    return response.choices[0].message.content.strip()


def generate_confirmation(
    patient_name: str | None,
    date: str,
    time: str,
    clinic_name: str,
    lang: str = "ja",
) -> str:
    dt_str = f"{date}T{time}:00"

    if lang == "en":
        greeting = f"Dear {patient_name}" if patient_name else "Dear Customer"
        try:
            dt = datetime.fromisoformat(dt_str)
            date_en = f"{dt.strftime('%B')} {dt.day}, {dt.year} ({dt.strftime('%a')})"
            time_en = f"{dt.hour:02d}:{dt.minute:02d}"
        except ValueError:
            date_en = date
            time_en = time

        return (
            f"{greeting}, your appointment has been confirmed.\n\n"
            f"[{clinic_name}]\n"
            f"Date & time: {date_en} {time_en}\n"
            f"We look forward to seeing you.\n\n"
            f"Please contact us if you need to cancel."
        )

    greeting = f"{patient_name}様" if patient_name else "お客様"
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
        f"【{clinic_name}】\n"
        f"日時: {date_jp} {time_jp}\n"
        f"ご来院をお待ちしております。\n\n"
        f"当日のキャンセルはこちらまでご連絡ください。"
    )
