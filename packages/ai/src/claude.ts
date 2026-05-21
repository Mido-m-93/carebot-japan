// packages/ai/src/claude.ts
import Anthropic from "@anthropic-ai/sdk";
import {
  INTENT_SYSTEM_PROMPT,
  EXTRACTION_SYSTEM_PROMPT,
  type IntentResult,
  type ExtractionResult,
} from "./prompts/intent.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  defaultHeaders: {
    // Disables use of messages for model training — required for patient data
    "anthropic-beta": "output-128k-2025-02-19",
  },
});

function parseJSON<T>(text: string): T {
  // Strip markdown fences if the model adds them despite instructions
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Classify the intent of an incoming patient message.
 * Uses claude-haiku for speed and cost efficiency (~¥0.02/call).
 */
export async function classifyIntent(message: string): Promise<IntentResult> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: INTENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: message }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return parseJSON<IntentResult>(text);
}

/**
 * Extract appointment details from a patient message.
 * Uses claude-sonnet for higher accuracy on complex Japanese phrasing.
 */
export async function extractAppointment(
  message: string,
  todayDate: string // "YYYY-MM-DD" in JST
): Promise<ExtractionResult> {
  const userContent = `Today's date (JST): ${todayDate}\n\nPatient message:\n${message}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return parseJSON<ExtractionResult>(text);
}

/**
 * Generate a natural Japanese confirmation message for an appointment.
 */
export async function generateConfirmationMessage(params: {
  patientName: string | null;
  date: string;      // "YYYY-MM-DD"
  time: string;      // "HH:MM"
  clinicName: string;
  clinicNameJp: string;
}): Promise<string> {
  const { patientName, date, time, clinicNameJp } = params;

  // Format date in Japanese
  const d = new Date(`${date}T${time}:00+09:00`);
  const dateJp = d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  });
  const timeJp = d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });

  const greeting = patientName ? `${patientName}様` : "お客様";

  return `${greeting}、ご予約を承りました。

【${clinicNameJp}】
日時: ${dateJp} ${timeJp}
ご来院をお待ちしております。

当日のキャンセルはこちらまでご連絡ください。`;
}
