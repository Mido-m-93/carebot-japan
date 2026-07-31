"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, API_URL } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useClinicContext } from "@/contexts/ClinicContext";

interface ClinicInfo {
  clinic_id: string;
  name: string;
  name_jp: string | null;
  phone: string | null;
  slug: string | null;
  role: "owner" | "staff";
}

const copy = {
  en: {
    title: "Settings",
    subtitle: "Manage your clinic's details",
    name_label: "Clinic name",
    name_jp_label: "Clinic name (Japanese)",
    phone_label: "Phone",
    phone_placeholder: "Optional",
    save: "Save changes",
    saving: "Saving...",
    saved: "Saved.",
    error: "Could not load clinic settings. Please try again.",
    save_error: "Something went wrong. Please try again.",
    name_required: "Clinic name cannot be empty.",
    staff_notice: "Only the clinic owner can change these settings.",
    loading: "Loading settings...",
  },
  ja: {
    title: "設定",
    subtitle: "クリニックの情報を管理する",
    name_label: "クリニック名",
    name_jp_label: "クリニック名（日本語）",
    phone_label: "電話番号",
    phone_placeholder: "任意",
    save: "変更を保存",
    saving: "保存中...",
    saved: "保存しました。",
    error: "設定を読み込めませんでした。もう一度お試しください。",
    save_error: "エラーが発生しました。もう一度お試しください。",
    name_required: "クリニック名を入力してください。",
    staff_notice: "この設定はクリニックのオーナーのみ変更できます。",
    loading: "設定を読み込み中...",
  },
};

export default function SettingsPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const { activeClinicId, refresh } = useClinicContext();
  const c = copy[lang] ?? copy.en;

  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [name, setName] = useState("");
  const [nameJp, setNameJp] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          router.replace("/login");
          return;
        }

        const res = await fetch(`${API_URL}/clinics/me`, {
          headers: { Authorization: `Bearer ${session.access_token}`, "X-Clinic-Id": activeClinicId ?? "" },
        });

        if (!res.ok) throw new Error(`${res.status}`);
        const data: ClinicInfo = await res.json();
        setClinic(data);
        setName(data.name ?? "");
        setNameJp(data.name_jp ?? "");
        setPhone(data.phone ?? "");
      } catch {
        setError(c.error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, c.error, activeClinicId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);

    if (!name.trim()) {
      setSaveError(c.name_required);
      return;
    }

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const res = await fetch(`${API_URL}/clinics/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-Clinic-Id": activeClinicId ?? "",
        },
        body: JSON.stringify({
          name: name.trim(),
          name_jp: nameJp.trim() || null,
          phone: phone.trim() || null,
        }),
      });

      if (!res.ok) {
        setSaveError(c.save_error);
        return;
      }

      setSaved(true);
      await refresh(); // updates the sidebar clinic name/selector immediately
    } catch {
      setSaveError(c.save_error);
    } finally {
      setSaving(false);
    }
  }

  const isStaff = clinic?.role === "staff";

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{c.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{c.subtitle}</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">{c.loading}</p>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="max-w-lg bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {isStaff && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-xs text-amber-700">{c.staff_notice}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{c.name_label}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isStaff}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{c.name_jp_label}</label>
            <input
              type="text"
              value={nameJp}
              onChange={(e) => setNameJp(e.target.value)}
              disabled={isStaff}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{c.phone_label}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={c.phone_placeholder}
              disabled={isStaff}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          {saved && <p className="text-sm text-teal-600">{c.saved}</p>}

          {!isStaff && (
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors"
            >
              {saving ? c.saving : c.save}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
