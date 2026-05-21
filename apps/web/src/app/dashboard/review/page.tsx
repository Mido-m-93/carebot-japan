// apps/web/src/app/dashboard/review/page.tsx
"use client";
import { useEffect, useState } from "react";
import { API_URL, DEMO_CLINIC_ID } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface QueueItem {
  id: string;
  source: string;
  raw_input: string;
  intent: string | null;
  intent_confidence: number | null;
  extracted_data: Record<string, unknown> | null;
  field_confidences: Record<string, number> | null;
  status: string;
  created_at: string;
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "text-teal-700 bg-teal-50" :
    pct >= 60 ? "text-amber-700 bg-amber-50" :
    "text-red-600 bg-red-50";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {pct}%
    </span>
  );
}

export default function ReviewQueuePage() {
  const { t, lang } = useLanguage();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});

  async function load() {
    const data = await fetch(`${API_URL}/queue/${DEMO_CLINIC_ID}?status=pending`)
      .then((r) => r.ok ? r.json() : [])
      .catch(() => []);
    setItems(Array.isArray(data) ? data as QueueItem[] : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function getEdit(itemId: string, field: string, fallback: string) {
    return edits[itemId]?.[field] ?? fallback ?? "";
  }

  function setEdit(itemId: string, field: string, value: string) {
    setEdits((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] ?? {}), [field]: value } }));
  }

  async function resolve(item: QueueItem) {
    setResolving(item.id);
    const extracted = item.extracted_data ?? {};
    const resolution = {
      clinic_id: DEMO_CLINIC_ID,
      patient_name: getEdit(item.id, "patient_name", extracted.patient_name as string),
      patient_phone: getEdit(item.id, "patient_phone", extracted.patient_phone as string),
      preferred_date: getEdit(item.id, "preferred_date", extracted.preferred_date as string),
      preferred_time: getEdit(item.id, "preferred_time", extracted.preferred_time as string),
      visit_reason: getEdit(item.id, "visit_reason", extracted.visit_reason as string),
      is_first_visit: extracted.is_first_visit ?? null,
      raw_message: item.raw_input,
    };
    await fetch(`${API_URL}/queue/${item.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved_by: "00000000-0000-0000-0000-000000000000", resolution, create_appointment: true }),
    });
    await load();
    setResolving(null);
  }

  async function dismiss(itemId: string) {
    await fetch(`${API_URL}/queue/${itemId}/dismiss`, { method: "POST" });
    await load();
  }

  const fields = [
    { key: "patient_name", label: t.review_field_name },
    { key: "preferred_date", label: t.review_field_date },
    { key: "preferred_time", label: t.review_field_time },
    { key: "visit_reason", label: t.review_field_reason },
    { key: "patient_phone", label: t.review_field_phone },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t.review_title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.review_subtitle}</p>
        </div>
        <span className="text-sm text-gray-400">{t.items_pending(items.length)}</span>
      </div>

      {loading && <p className="text-sm text-gray-400">{t.loading}</p>}

      {!loading && items.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-3">
            <span className="text-teal-600 text-lg">✓</span>
          </div>
          <p className="text-gray-600 font-medium text-sm">{t.review_all_clear}</p>
          <p className="text-gray-400 text-xs mt-1">{t.review_all_clear_sub}</p>
        </div>
      )}

      <div className="space-y-5">
        {items.map((item) => {
          const ext = item.extracted_data ?? {};
          const conf = item.field_confidences ?? {};
          return (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {item.source.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">Intent: {item.intent ?? "unknown"}</span>
                <ConfidenceBadge value={item.intent_confidence} />
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(item.created_at).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", {
                    month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
                  })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-0 divide-x divide-gray-100">
                <div className="p-5">
                  <p className="text-xs font-medium text-gray-400 mb-2">{t.review_patient_msg}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3">
                    {item.raw_input}
                  </p>
                </div>

                <div className="p-5">
                  <p className="text-xs font-medium text-gray-400 mb-2">
                    {t.review_ai_result}
                    <span className="text-gray-300 ml-1">{t.review_editable}</span>
                  </p>
                  <div className="space-y-1">
                    {fields.map(({ key, label }) => {
                      const raw = ext[key] as string | null;
                      const fieldConf = conf[key];
                      const isLow = fieldConf !== undefined && fieldConf < 0.8;
                      return (
                        <div key={key} className={`rounded p-2 ${isLow ? "bg-amber-50" : ""}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <label className="text-xs text-gray-400">{label}</label>
                            {fieldConf !== undefined && <ConfidenceBadge value={fieldConf} />}
                          </div>
                          <input
                            type="text"
                            defaultValue={raw ?? ""}
                            onChange={(e) => setEdit(item.id, key, e.target.value)}
                            placeholder={raw ?? t.review_field_empty}
                            className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50">
                <button
                  onClick={() => resolve(item)}
                  disabled={resolving === item.id}
                  className="px-4 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {resolving === item.id ? t.review_processing : t.review_confirm}
                </button>
                <button
                  onClick={() => dismiss(item.id)}
                  className="px-4 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {t.review_dismiss}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
