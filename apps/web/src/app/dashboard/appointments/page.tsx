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

export default function AppointmentsPage() {
  const { t, lang } = useLanguage();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await fetch(`${API_URL}/appointments/${DEMO_CLINIC_ID}`)
        .then((r) => r.ok ? r.json() : [])
        .catch(() => []);
      setAppointments((Array.isArray(data) ? data as Appointment[] : []).reverse().slice(0, 50));
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

  function sourceLabel(source: string) {
    if (source === "line") return "LINE";
    if (source === "web") return "Web";
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t.appts_title}</h1>
        </div>
        <span className="text-sm text-gray-400">{t.items_count(appointments.length)}</span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">{t.loading}</p>
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">{t.appts_empty}</p>
          <p className="text-gray-300 text-xs mt-1">{t.appts_empty_sub}</p>
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
              {appointments.map((appt, i) => (
                <tr key={appt.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === appointments.length - 1 ? "border-0" : ""}`}>
                  <td className="px-5 py-3 font-medium text-gray-800">
                    {appt.patient_name ?? <span className="text-gray-300">{t.unknown}</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{formatDateTime(appt.scheduled_at)}</td>
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
