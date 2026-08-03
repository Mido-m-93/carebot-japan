// apps/web/src/app/dashboard/test/page.tsx
"use client";
import { useState } from "react";
import { API_URL, supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useClinicContext } from "@/contexts/ClinicContext";

interface Result {
  status: string;
  intent?: string;
  confidence?: number;
  reason?: string;
  message?: string;
  appointment_id?: string;
  scheduled_at?: string;
  patient_name?: string;
  sms_sent?: boolean;
  extracted?: Record<string, unknown>;
}

export default function TestPage() {
  const { t, lang } = useLanguage();
  const { activeClinicId } = useClinicContext();
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const EXAMPLE_MESSAGES = [
    { label: t.test_sample_clear, text: "来週の水曜日の午前10時に予約したいです。田中花子です。風邪の症状があります。初めての受診です。" },
    { label: t.test_sample_ambiguous, text: "今週中に診てもらえますか？山田です。腰が痛くて。" },
    { label: t.test_sample_cancel, text: "明日の予約をキャンセルしたいのですが、よろしくお願いします。" },
    { label: t.test_sample_inquiry, text: "診療時間を教えてください。" },
    { label: t.test_sample_english, text: "I would like to make an appointment for next Monday at 2pm. My name is Smith." },
  ];

  async function send() {
    if (!message.trim() || !activeClinicId) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/webhooks/web`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
          "X-Clinic-Id": activeClinicId,
        },
        body: JSON.stringify({
          clinic_id: activeClinicId,
          message: message.trim(),
          patient_phone: phone.trim() || null,
          is_test: true,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function formatJST(iso: string) {
    return new Date(iso).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", {
      month: "long", day: "numeric", weekday: "short",
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
    });
  }

  const statusColors: Record<string, string> = {
    confirmed: "bg-teal-50 border-teal-200 text-teal-800",
    queued_for_review: "bg-amber-50 border-amber-200 text-amber-800",
    error: "hidden",
  };

  function statusLabel(status: string) {
    if (status === "confirmed") return t.result_confirmed;
    if (status === "queued_for_review") return t.result_queued;
    if (status === "error") return t.result_error;
    return status;
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t.test_title}</h1>
        <p className="text-sm text-gray-500 mt-1">{t.test_subtitle}</p>
      </div>

      <div className="mb-5">
        <p className="text-xs font-medium text-gray-400 mb-2">{t.test_samples_label}</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_MESSAGES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => setMessage(ex.text)}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">{t.test_msg_label}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder={t.test_msg_placeholder}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400 resize-none"
          />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">{t.test_phone_label}</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+81-90-xxxx-xxxx"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
        </div>
        <button
          onClick={send}
          disabled={loading || !message.trim() || !activeClinicId}
          className="w-full py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-40 transition-colors"
        >
          {loading ? t.test_sending : t.test_send}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-5">
          <p className="font-medium mb-1">{t.error_title}</p>
          <p className="font-mono text-xs">{error}</p>
          {error.includes("fetch") && (
            <p className="mt-2 text-xs text-red-500">{t.error_api_down}</p>
          )}
        </div>
      )}

      {result?.status === "error" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-5">
          <p className="font-medium mb-1">
            {result.reason === "anthropic_no_credits" ? t.error_no_credits : t.error_processing}
          </p>
          <p className="text-xs">{result.message}</p>
          {result.reason === "anthropic_no_credits" && (
            <a
              href="https://console.anthropic.com/settings/billing"
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-2 text-xs text-amber-700 underline"
            >
              console.anthropic.com →
            </a>
          )}
        </div>
      )}

      {result && (
        <div className={`rounded-xl border p-5 ${statusColors[result.status] ?? "bg-gray-50 border-gray-200"}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="font-semibold text-sm">{statusLabel(result.status)}</span>
            {result.confidence !== undefined && (
              <span className="text-xs opacity-70">
                {t.confidence_label(Math.round(result.confidence * 100))}
              </span>
            )}
          </div>

          <div className="space-y-2 text-sm">
            {result.status === "confirmed" && (
              <>
                {result.patient_name && (
                  <div className="flex gap-3">
                    <span className="text-xs opacity-60 w-24">{t.result_patient}</span>
                    <span className="font-medium">{result.patient_name}</span>
                  </div>
                )}
                {result.scheduled_at && (
                  <div className="flex gap-3">
                    <span className="text-xs opacity-60 w-24">{t.result_datetime}</span>
                    <span className="font-medium">{formatJST(result.scheduled_at)}</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <span className="text-xs opacity-60 w-24">{t.result_sms}</span>
                  <span>{result.sms_sent ? t.result_sms_sent : t.result_sms_dev}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-xs opacity-60 w-24">{t.result_appt_id}</span>
                  <span className="font-mono text-xs opacity-70">{result.appointment_id}</span>
                </div>
              </>
            )}

            {result.status === "queued_for_review" && (
              <>
                <div className="flex gap-3">
                  <span className="text-xs opacity-60 w-24">{t.result_intent}</span>
                  <span>{result.intent}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-xs opacity-60 w-24">{t.result_reason}</span>
                  <span className="text-xs">{result.reason}</span>
                </div>
                {result.extracted && (
                  <div className="mt-3">
                    <p className="text-xs opacity-60 mb-1">{t.result_ai_extracted}</p>
                    <pre className="text-xs font-mono bg-white/50 rounded p-2 overflow-auto">
                      {JSON.stringify(result.extracted, null, 2)}
                    </pre>
                  </div>
                )}
                <p className="text-xs mt-2 opacity-70">{t.result_review_hint}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
