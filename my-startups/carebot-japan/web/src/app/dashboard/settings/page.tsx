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
  line_channel_id: string | null;
  line_channel_configured: boolean;
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
    line_section_title: "LINE integration",
    line_section_hint: "Connect your clinic's own LINE Official Account so patients can book through LINE.",
    line_channel_id_label: "LINE Channel ID",
    line_channel_id_placeholder: "e.g. 1234567890",
    line_channel_secret_label: "Channel secret",
    line_channel_token_label: "Channel access token",
    line_placeholder_configured: "Already set — leave blank to keep it",
    line_placeholder_empty: "Not set",
    line_configured_badge: "Connected",
    line_not_configured_badge: "Not connected",
    line_find_hint: "Found in the LINE Developers Console, under your channel's Basic settings / Messaging API tabs.",
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
    line_section_title: "LINE連携",
    line_section_hint: "貴院独自のLINE公式アカウントを連携すると、患者様がLINEから予約できるようになります。",
    line_channel_id_label: "LINE チャンネルID",
    line_channel_id_placeholder: "例：1234567890",
    line_channel_secret_label: "チャンネルシークレット",
    line_channel_token_label: "チャンネルアクセストークン",
    line_placeholder_configured: "設定済み — 変更しない場合は空欄のままにしてください",
    line_placeholder_empty: "未設定",
    line_configured_badge: "連携済み",
    line_not_configured_badge: "未連携",
    line_find_hint: "LINE Developers コンソールの「チャネル基本設定」「Messaging API設定」タブで確認できます。",
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
  const [lineChannelId, setLineChannelId] = useState("");
  const [lineChannelSecret, setLineChannelSecret] = useState("");
  const [lineChannelAccessToken, setLineChannelAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
      setLineChannelId(data.line_channel_id ?? "");
      // Secret/token are never sent back from the API -- these fields
      // always start blank; the placeholder communicates whether a value
      // is already configured (see line_channel_configured).
      setLineChannelSecret("");
      setLineChannelAccessToken("");
    } catch {
      setError(c.error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, activeClinicId]);

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
          line_channel_id: lineChannelId.trim() || null,
          // Blank means "leave unchanged" -- the API only overwrites these
          // when a non-empty value is submitted.
          line_channel_secret: lineChannelSecret.trim(),
          line_channel_access_token: lineChannelAccessToken.trim(),
        }),
      });

      if (!res.ok) {
        setSaveError(c.save_error);
        return;
      }

      setSaved(true);
      await refresh(); // updates the sidebar clinic name/selector immediately
      await load(); // re-fetch so the "configured" badge reflects what was just saved
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

          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1 mt-4">
              <h2 className="text-sm font-medium text-gray-800">{c.line_section_title}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                clinic?.line_channel_configured ? "bg-teal-50 text-teal-700" : "bg-gray-100 text-gray-500"
              }`}>
                {clinic?.line_channel_configured ? c.line_configured_badge : c.line_not_configured_badge}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">{c.line_section_hint}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{c.line_channel_id_label}</label>
                <input
                  type="text"
                  value={lineChannelId}
                  onChange={(e) => setLineChannelId(e.target.value)}
                  placeholder={c.line_channel_id_placeholder}
                  disabled={isStaff}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{c.line_channel_secret_label}</label>
                <input
                  type="password"
                  value={lineChannelSecret}
                  onChange={(e) => setLineChannelSecret(e.target.value)}
                  placeholder={clinic?.line_channel_configured ? c.line_placeholder_configured : c.line_placeholder_empty}
                  disabled={isStaff}
                  autoComplete="off"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{c.line_channel_token_label}</label>
                <input
                  type="password"
                  value={lineChannelAccessToken}
                  onChange={(e) => setLineChannelAccessToken(e.target.value)}
                  placeholder={clinic?.line_channel_configured ? c.line_placeholder_configured : c.line_placeholder_empty}
                  disabled={isStaff}
                  autoComplete="off"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <p className="text-xs text-gray-400">{c.line_find_hint}</p>
            </div>
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
