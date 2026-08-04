"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API_URL, supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useClinicContext } from "@/contexts/ClinicContext";
import { type AuditLogEntry, ACTION_ICONS } from "@/lib/auditLog";

const NOTIFICATION_ACTIONS = ["appointment_created", "appointment_cancelled", "appointment_rescheduled"];
const POLL_INTERVAL_MS = 30_000;

function lastSeenKey(clinicId: string) {
  return `carebot_notif_last_seen:${clinicId}`;
}

export default function NotificationBell() {
  const { t, lang } = useLanguage();
  const { activeClinicId } = useClinicContext();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!activeClinicId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${API_URL}/audit-log?actions=${NOTIFICATION_ACTIONS.join(",")}&limit=20`,
        { headers: { Authorization: `Bearer ${session.access_token}`, "X-Clinic-Id": activeClinicId } },
      );
      if (!res.ok) return;
      const data = await res.json();
      const list: AuditLogEntry[] = Array.isArray(data) ? data : [];
      // Test Message tool rows have no place badging a real bell -- same
      // exclusion the Appointments/Review pages apply, just client-side
      // since audit_logs itself has no is_test column to filter on server.
      setEntries(list.filter((entry) => entry.metadata?.is_test !== true));
    } catch {
      // A failed poll just retries next interval -- not worth an error UI for a bell.
    }
  }, [activeClinicId]);

  useEffect(() => {
    if (!activeClinicId) return;
    setLastSeen(localStorage.getItem(lastSeenKey(activeClinicId)));
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeClinicId, load]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const unreadCount = lastSeen
    ? entries.filter((entry) => new Date(entry.created_at).getTime() > new Date(lastSeen).getTime()).length
    : entries.length;

  function handleToggle() {
    const next = !open;
    setOpen(next);
    // entries[0] is the newest (API returns desc order) -- storing its own
    // timestamp instead of Date.now() avoids client/server clock skew.
    if (next && activeClinicId && entries.length > 0) {
      const newest = entries[0].created_at;
      localStorage.setItem(lastSeenKey(activeClinicId), newest);
      setLastSeen(newest);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleToggle}
        aria-label={t.notif_bell_label}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 text-gray-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-50 max-h-96 overflow-auto">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t.notif_empty}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-base mt-0.5">{ACTION_ICONS[entry.action] ?? "•"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{actionLabel(entry.action)}</p>
                    {typeof entry.metadata?.patient_name === "string" && entry.metadata.patient_name && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{entry.metadata.patient_name}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
                    {formatDateTime(entry.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/dashboard/activity"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium text-teal-700 hover:bg-gray-50 py-2.5 border-t border-gray-100"
          >
            {t.notif_view_all}
          </Link>
        </div>
      )}
    </div>
  );
}
