"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, API_URL } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useClinicContext } from "@/contexts/ClinicContext";

export default function LocationsPage() {
  const { t, lang } = useLanguage();
  const { locations, activeClinicId, refresh } = useClinicContext();

  const [tier, setTier] = useState<"starter" | "pro" | "enterprise" | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", name_jp: "", phone: "", line_channel_id: "" });

  const activeRole = locations.find((l) => l.clinic_id === activeClinicId)?.role;
  const canManage = tier === "enterprise" && activeRole === "owner";

  useEffect(() => {
    async function loadTier() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      try {
        const res = await fetch(`${API_URL}/billing/subscription`, {
          headers: { Authorization: `Bearer ${session.access_token}`, "X-Clinic-Id": activeClinicId ?? "" },
        });
        if (res.ok) {
          const data = await res.json();
          setTier(data.tier ?? "starter");
        }
      } finally {
        setLoading(false);
      }
    }
    loadTier();
  }, [activeClinicId]);

  async function createLocation() {
    setCreating(true);
    setCreateError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setCreateError("Not signed in"); setCreating(false); return; }

      const res = await fetch(`${API_URL}/clinics/locations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-Clinic-Id": activeClinicId ?? "",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          name_jp: form.name_jp.trim() || null,
          phone: form.phone.trim() || null,
          line_channel_id: form.line_channel_id.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `API error ${res.status}`);
      }
      setForm({ name: "", name_jp: "", phone: "", line_channel_id: "" });
      setShowForm(false);
      await refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t.locations_error_create);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t.locations_title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.locations_subtitle}</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
          >
            {showForm ? t.locations_cancel : t.locations_new}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">{t.loading}</p>
      ) : !canManage && tier !== "enterprise" ? (
        <div className="bg-teal-800 rounded-xl p-6 text-white max-w-lg">
          <h2 className="text-sm font-semibold mb-1">{t.locations_upgrade_title}</h2>
          <p className="text-xs text-teal-300 mb-4">{t.locations_upgrade_desc}</p>
          <Link
            href="/dashboard/billing"
            className="inline-block px-4 py-2 bg-white text-teal-800 text-sm font-semibold rounded-lg hover:bg-teal-50 transition-colors"
          >
            {t.locations_upgrade_cta}
          </Link>
        </div>
      ) : (
        <>
          {showForm && canManage && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-w-lg">
              <h2 className="text-sm font-medium text-gray-800 mb-4">{t.locations_new_title}</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.locations_field_name}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.locations_field_name_jp}</label>
                  <input
                    type="text"
                    value={form.name_jp}
                    onChange={(e) => setForm((prev) => ({ ...prev, name_jp: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.locations_field_phone}</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.locations_field_line}</label>
                  <input
                    type="text"
                    value={form.line_channel_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, line_channel_id: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                </div>
              </div>

              {createError && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-xs text-red-500 font-mono">{createError}</p>
                </div>
              )}

              <button
                onClick={createLocation}
                disabled={creating || !form.name.trim()}
                className="mt-4 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {creating ? t.locations_saving : t.locations_save}
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {[t.locations_col_name, t.locations_col_slug, t.locations_col_role].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {locations.map((loc, i) => (
                  <tr key={loc.clinic_id} className={`border-b border-gray-50 ${i === locations.length - 1 ? "border-0" : ""}`}>
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {lang === "ja" ? loc.name_jp || loc.name : loc.name}
                      {loc.is_primary && (
                        <span className="ml-2 text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
                          {t.locations_primary_badge}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{loc.slug ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-600">{loc.role === "owner" ? t.locations_role_owner : t.locations_role_staff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
