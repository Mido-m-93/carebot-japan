// packages/ai/src/prompts/intent.ts
// Haiku-based intent classification for incoming patient messages

export const INTENT_SYSTEM_PROMPT = `You are a Japanese medical clinic scheduling assistant.
Classify the intent of the incoming patient message.

Return ONLY valid JSON matching this exact schema. No commentary, no markdown.

{
  "intent": "appointment_request" | "cancellation" | "reschedule" | "general_inquiry" | "out_of_scope",
  "confidence": 0.0-1.0,
  "reason": "one sentence explanation in English"
}

Intent definitions:
- appointment_request: Patient wants to book a new appointment
- cancellation: Patient wants to cancel an existing appointment
- reschedule: Patient wants to move an existing appointment
- general_inquiry: Question about the clinic (hours, location, fees, etc.)
- out_of_scope: Unrelated message or cannot be determined

Use confidence < 0.75 when the message is ambiguous.`;

export const EXTRACTION_SYSTEM_PROMPT = `You are a Japanese medical clinic scheduling assistant.
Extract appointment booking details from the patient message.

The clinic is in Japan. Dates and times may be expressed in Japanese or relative terms.
Today's date will be provided in the user message.

Return ONLY valid JSON matching this exact schema. No commentary, no markdown.
Use null for fields you cannot determine. Never guess — use null if uncertain.

{
  "patient_name": string | null,
  "patient_phone": string | null,
  "preferred_date": "YYYY-MM-DD" | null,
  "preferred_time": "HH:MM" | null,
  "visit_reason": string | null,
  "is_first_visit": boolean | null,
  "confidence": 0.0-1.0,
  "field_confidences": {
    "patient_name": 0.0-1.0,
    "preferred_date": 0.0-1.0,
    "preferred_time": 0.0-1.0,
    "visit_reason": 0.0-1.0
  },
  "ambiguities": string[]
}

Japanese date/time resolution examples:
- "来週の月曜" → next Monday's date
- "明日の午後" → tomorrow afternoon → preferred_time: "14:00"
- "今週中" → ambiguity: ["no specific day given"]
- "10時" → "10:00"
- "午後3時" → "15:00"`;

export type Intent =
  | "appointment_request"
  | "cancellation"
  | "reschedule"
  | "general_inquiry"
  | "out_of_scope";

export interface IntentResult {
  intent: Intent;
  confidence: number;
  reason: string;
}

export interface ExtractionResult {
  patient_name: string | null;
  patient_phone: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  visit_reason: string | null;
  is_first_visit: boolean | null;
  confidence: number;
  field_confidences: Record<string, number>;
  ambiguities: string[];
}
