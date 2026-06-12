// apps/web/src/app/dashboard/appointments/page.tsx
"use client";
import { useEffect, useState } from "react";
import { API_URL, DEMO_CLINIC_ID } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface Appointment {
  id: string;
  patient_name: string | null;
  patient_phone: string | null;
  scheduled_at: string | null;
  visit_reason: string | null;
  is_first_visit: boolean | null;
  status: string;
  source: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-teal-50 text-teal-700",
  cancelled: "bg-red-50 text-red-600",
  completed: "bg-gray-100 text-gray-500",
  rescheduled: "bg-amber-50 text-amber-700",
};

type VisitFilter = "all" | "first" | "return";

export default function AppointmentsPage() {
  const { t, lang } = useLanguage();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [visitFilter, setVisitFilter] = useState<VisitFilter>("all");

  useEffect(() => {
    async function load() {
      const data = await fetch(`${API_URL}/appointments/${DEMO_CLINIC_ID}`)
        .then((r) => r.ok ? r.json() : [])
        .catch(() => []);
      setAppointments((Array.isArray(data) ? data as Appointment[] : []).slice(0, 50));
      setLoading(false);
    }
    load();
  }, []);

  function formatDateTime(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", {
      month: "short", day: "numeric", weekday: "short",
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
    });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
    });
  }

  function sourceLabel(source: string) {
    if (source === "line") return "LINE";
    if (source === "web") return "Web";
    if (source === "booking_form") return t.source_booking_form;
    if (source === "email") return t.source_email;
    if (source === "manual_review") return t.source_manual_review;
    if (source === "manual") return t.source_manual;
    return source;
  }

  function statusLabel(status: string) {
    if (status === "confirmed") return t.status_confirmed;
    if (status === "cancelled") return t.status_cancelled;
    if (status === "completed") return t.status_completed;
    if (status === "rescheduled") return t.status_rescheduled;
    return status;
  }

  const firstCount = appointments.filter(a => a.is_first_visit === true).length;
  const returnCount = appointments.filter(a => a.is_first_visit === false).length;

  const filtered = appointments.filter(a => {
    if (visitFilter === "first") return a.is_first_visit === true;
    if (visitFilter === "return") return a.is_first_visit === false;
    return true;
  });

  const tabs: { key: VisitFilter; label: string; count: number }[] = [
    { key: "all",    label: lang === "ja" ? "すべて"  : "All",          count: appointments.length },
    { key: "first",  label: lang === "ja" ? "初診"    : "First Visit",  count: firstCount },
    { key: "return", label: lang === "ja" ? "再診"    : "Return Visit", count: returnCount },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">{t.appts_title}</h1>
        <span className="text-sm text-gray-400">{t.items_count(filtered.length)}</span>
      </div>

      {/* Visit type tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setVisitFilter(tab.key)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors flex items-center gap-2 ${
              visitFilter === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              visitFilter === tab.key ? "bg-teal-100 text-teal-700" : "bg-gray-200 text-gray-500"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">{t.loading}</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">
            {visitFilter === "all" ? t.appts_empty : lang === "ja" ? "該当する予約はありません" : "No appointments in this category"}
          </p>
          <p className="text-gray-300 text-xs mt-1">{visitFilter === "all" ? t.appts_empty_sub : ""}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[t.col_patient, t.col_datetime, t.col_reason, t.col_source, t.col_status, t.col_first_visit].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((appt, i) => (
                <tr key={appt.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}>
                  <td className="px-5 py-3 font-medium text-gray-800">
                    {appt.patient_name ?? <span className="text-gray-300">{t.unknown}</span>}
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-gray-600">{formatDateTime(appt.scheduled_at)}</p>
                    <p className="text-xs text-gray-300 mt-0.5">Booked {formatDate(appt.created_at)}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-600 max-w-xs truncate">
                    {appt.visit_reason ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {sourceLabel(appt.source)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[appt.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {statusLabel(appt.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {appt.is_first_visit === true ? t.first_visit :
                     appt.is_first_visit === false ? t.return_visit : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
