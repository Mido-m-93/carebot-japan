export interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  record_type: string | null;
  record_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const ACTION_ICONS: Record<string, string> = {
  claude_extraction_run: "🤖",
  appointment_created: "📅",
  appointment_cancelled: "🚫",
  appointment_rescheduled: "🔁",
  sms_sent: "💬",
  review_item_created: "🔍",
  claim_created: "📄",
  claim_submitted: "📤",
  claim_status_updated: "✅",
};
