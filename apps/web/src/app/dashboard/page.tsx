"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL, DEMO_CLINIC_ID } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface Stats {
  todayCount: number;
  weekCount: number;
  pendingReview: number;
  totalConfirmed: number;
}

interface RecentAppointment {
  id: string;
  patient_name: string | null;
  scheduled_at: string | null;
  visit_reason: string | null;
  status: string;
  source: string;
}

function StatCard({ label, value, accent, href }: { label: string; value: number | string; accent?: string; href: string }) {
  return (
    <Link href={href} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-teal-400 hover:shadow-sm transition-all group block">
      <p className="text-xs text-gray-400 mb-3 group-hover:text-teal-600 transition-colors">{label}</p>
      <p className={`text-3xl font-semibold ${accent ?? "text-gray-900"}`}>{value}</p>
    </Link>
  );
}

export default function DashboardOverviewPage() {
  const { t, lang } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => setApiStatus(r.ok ? "ok" : "down"))
      .catch(() => setApiStatus("down"));
  }, []);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekStr = weekStart.toISOString().slice(0, 10);

      const [apptRes, queueRes] = await Promise.all([
        fetch(`${API_URL}/appointments/${DEMO_CLINIC_ID}`).then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_URL}/queue/${DEMO_CLINIC_ID}?status=pending`).then((r) => r.ok ? r.json() : []).catch(() => []),
      ]);

      const allAppts: RecentAppointment[] = Array.isArray(apptRes) ? apptRes : [];
      setStats({
        todayCount: allAppts.filter((a) => a.scheduled_at && a.scheduled_at >= todayStr).length,
        weekCount: allAppts.filter((a) => a.scheduled_at && a.scheduled_at >= weekStr).length,
        pendingReview: Array.isArray(queueRes) ? queueRes.length : 0,
        totalConfirmed: allAppts.filter((a) => a.status === "confirmed").length,
      });
      setRecent(allAppts.slice(-5).reverse());
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
    return status;
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t.overview_title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.overview_subtitle}</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
          apiStatus === "ok" ? "bg-teal-50 border-teal-200 text-teal-700" :
          apiStatus === "down" ? "bg-red-50 border-red-200 text-red-600" :
          "bg-gray-50 border-gray-200 text-gray-400"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            apiStatus === "ok" ? "bg-teal-500" :
            apiStatus === "down" ? "bg-red-500" : "bg-gray-300"
          }`} />
          {apiStatus === "ok" ? "API connected" : apiStatus === "down" ? "API offline" : "Checking…"}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">{t.loading}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
            <StatCard label={t.stat_today} value={stats?.todayCount ?? 0} accent="text-teal-700" href="/dashboard/appointments" />
            <StatCard label={t.stat_week} value={stats?.weekCount ?? 0} href="/dashboard/appointments" />
            <StatCard
              label={t.stat_pending}
              value={stats?.pendingReview ?? 0}
              accent={(stats?.pendingReview ?? 0) > 0 ? "text-amber-600" : "text-gray-900"}
              href="/dashboard/review"
            />
            <StatCard label={t.stat_confirmed} value={stats?.totalConfirmed ?? 0} href="/dashboard/appointments" />
          </div>

          {(stats?.pendingReview ?? 0) > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {t.alert_pending(stats!.pendingReview)}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">{t.alert_pending_sub}</p>
              </div>
              <Link
                href="/dashboard/review"
                className="text-xs font-medium text-amber-700 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap"
              >
                {t.alert_review_link}
              </Link>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-700">{t.recent_title}</h2>
              <Link href="/dashboard/appointments" className="text-xs text-teal-600 hover:underline">
                {t.recent_view_all}
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                <p className="text-sm text-gray-400">{t.empty_no_appts}</p>
                <p className="text-xs text-gray-300 mt-1">{t.empty_no_appts_sub}</p>
                <Link
                  href="/dashboard/test"
                  className="inline-block mt-4 text-xs text-teal-600 border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
                >
                  {t.empty_test_link}
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {[t.col_patient, t.col_datetime, t.col_reason, t.col_source, t.col_status].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((appt, i) => (
                      <tr key={appt.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === recent.length - 1 ? "border-0" : ""}`}>
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
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            appt.status === "confirmed" ? "bg-teal-50 text-teal-700" :
                            appt.status === "cancelled" ? "bg-red-50 text-red-600" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {statusLabel(appt.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-8 grid grid-cols-4 gap-4">
            {[
              { href: "/dashboard/test", title: t.quick_test_title, sub: t.quick_test_sub },
              { href: "/dashboard/appointments", title: t.quick_appts_title, sub: t.quick_appts_sub },
              { href: "/dashboard/review", title: t.quick_review_title, sub: t.quick_review_sub },
            ].map(({ href, title, sub }) => (
              <Link key={href} href={href} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-teal-300 hover:bg-teal-50 transition-colors group">
                <p className="text-sm font-medium text-gray-800 group-hover:text-teal-700">{title}</p>
                <p className="text-xs text-gray-400 mt-1">{sub}</p>
              </Link>
            ))}
            <Link href="/book" target="_blank" className="bg-teal-800 border border-teal-700 rounded-xl p-5 hover:bg-teal-700 transition-colors group">
              <p className="text-sm font-medium text-white">{lang === "ja" ? "予約フォーム" : "Booking Form"}</p>
              <p className="text-xs text-teal-400 mt-1">{lang === "ja" ? "患者向け予約ページを開く ↗" : "Open patient booking page ↗"}</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
