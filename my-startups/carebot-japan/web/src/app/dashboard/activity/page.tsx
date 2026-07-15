"use client";
import { useEffect, useState } from "react";
import { API_URL, supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useClinicContext } from "@/contexts/ClinicContext";

interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  record_type: string | null;
  record_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, string> = {
  claude_extraction_run: "🤖",
  appointment_created: "📅",
  sms_sent: "💬",
  review_item_created: "🔍",
  claim_created: "📄",
  claim_submitted: "📤",
  claim_status_updated: "✅",
};

export default function ActivityPage() {
  const { t, lang } = useLanguage();
  const { activeClinicId } = useClinicContext();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        const res = await fetch(`${API_URL}/audit-log?limit=100`, {
          headers: { Authorization: `Bearer ${session.access_token}`, "X-Clinic-Id": activeClinicId ?? "" },
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = await res.json();
        setEntries(Array.isArray(data) ? data : []);
      } catch {
        setError(t.activity_error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t.activity_error, activeClinicId]);

  function actionLabel(action: string): string {
    const key = `activity_action_${action}` as keyof typeof t;
    const label = t[key];
    return typeof label === "string" ? label : action;
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", {
      month: "short", day: "numeric", weekday: "short",
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t.activity_title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.activity_subtitle}</p>
        </div>
        <span className="text-sm text-gray-400">{t.items_count(entries.length)}</span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">{t.loading}</p>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">{t.activity_empty}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className="text-base mt-0.5">{ACTION_ICONS[entry.action] ?? "•"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{actionLabel(entry.action)}</p>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {Object.entries(entry.metadata)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
                {formatDateTime(entry.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
