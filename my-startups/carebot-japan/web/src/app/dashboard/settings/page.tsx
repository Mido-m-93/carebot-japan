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
    saved_lookup_failed: "Saved your secret and access token, but couldn't confirm your Bot User ID automatically. Double-check the access token is correct and save again.",
    error: "Could not load clinic settings. Please try again.",
    save_error: "Something went wrong. Please try again.",
    name_required: "Clinic name cannot be empty.",
    staff_notice: "Only the clinic owner can change these settings.",
    loading: "Loading settings...",
    line_section_title: "LINE integration",
    line_section_hint: "Connect your clinic's own LINE Official Account so patients can book through LINE.",
    line_steps_title: "How to connect",
    line_steps: [
      "Open the LINE Developers Console and create (or select) a Messaging API channel for your clinic.",
      "Copy the Channel secret from that channel's \"Basic settings\" tab.",
      "On the \"Messaging API\" tab, issue a channel access token (long-lived) and copy it.",
      "Paste both values below and save -- we'll detect your Bot User ID automatically.",
    ],
    line_webhook_step: "Still on the \"Messaging API\" tab, set the Webhook URL to the address below and turn on \"Use webhook\".",
    line_webhook_url_label: "Webhook URL",
    line_copy: "Copy",
    line_copied: "Copied!",
    line_channel_id_label: "Bot User ID (auto-detected)",
    line_channel_id_not_detected: "Not detected yet — save your Channel secret and access token above",
    line_channel_secret_label: "Channel secret",
    line_channel_token_label: "Channel access token",
    line_placeholder_configured: "Already set — leave blank to keep it",
    line_placeholder_empty: "Not set",
    line_configured_badge: "Connected",
    line_not_configured_badge: "Not connected",
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
    saved_lookup_failed: "チャンネルシークレットとアクセストークンは保存しましたが、Bot User IDを自動検出できませんでした。アクセストークンが正しいか確認し、もう一度保存してください。",
    error: "設定を読み込めませんでした。もう一度お試しください。",
    save_error: "エラーが発生しました。もう一度お試しください。",
    name_required: "クリニック名を入力してください。",
    staff_notice: "この設定はクリニックのオーナーのみ変更できます。",
    loading: "設定を読み込み中...",
    line_section_title: "LINE連携",
    line_section_hint: "貴院独自のLINE公式アカウントを連携すると、患者様がLINEから予約できるようになります。",
    line_steps_title: "連携方法",
    line_steps: [
      "LINE Developers コンソールを開き、貴院用のMessaging APIチャネルを作成（または選択）します。",
      "チャネルの「チャネル基本設定」タブから チャンネルシークレット をコピーします。",
      "「Messaging API設定」タブで チャンネルアクセストークン（長期）を発行し、コピーします。",
      "両方の値を下記に貼り付けて保存します — Bot User IDは自動的に検出されます。",
    ],
    line_webhook_step: "同じ「Messaging API設定」タブで、Webhook URLを下記のアドレスに設定し、「Webhookの利用」をオンにします。",
    line_webhook_url_label: "Webhook URL",
    line_copy: "コピー",
    line_copied: "コピーしました！",
    line_channel_id_label: "Bot User ID（自動検出）",
    line_channel_id_not_detected: "まだ検出されていません — 上記のチャンネルシークレットとアクセストークンを保存してください",
    line_channel_secret_label: "チャンネルシークレット",
    line_channel_token_label: "チャンネルアクセストークン",
    line_placeholder_configured: "設定済み — 変更しない場合は空欄のままにしてください",
    line_placeholder_empty: "未設定",
    line_configured_badge: "連携済み",
    line_not_configured_badge: "未連携",
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
  const [lineChannelSecret, setLineChannelSecret] = useState("");
  const [lineChannelAccessToken, setLineChannelAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  // API_URL ("/api-proxy") is a relative path meant only for this page's own
  // browser fetches -- LINE's servers call this URL directly over the
  // internet, so it needs the real absolute origin in front of it, same
  // pattern as the booking-link widget on the dashboard overview page.
  const webhookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api-proxy/webhooks/line`;

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
      // Secret/token are never sent back from the API -- these fields
      // always start blank; the placeholder communicates whether a value
      // is already configured (see line_channel_configured). Bot User ID
      // is no longer manually entered -- it's auto-detected from the
      // access token and shown read-only below (see line_channel_id).
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
    setLookupFailed(false);

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
          // Blank means "leave unchanged" -- the API only overwrites these
          // when a non-empty value is submitted. Submitting a new access
          // token also auto-detects and saves the Bot User ID server-side.
          line_channel_secret: lineChannelSecret.trim(),
          line_channel_access_token: lineChannelAccessToken.trim(),
        }),
      });

      if (!res.ok) {
        setSaveError(c.save_error);
        return;
      }

      const body = await res.json();
      setSaved(true);
      setLookupFailed(Boolean(body.line_channel_id_lookup_failed));
      await refresh(); // updates the sidebar clinic name/selector immediately
      await load(); // re-fetch so the "configured" badge / Bot User ID reflect what was just saved
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

            <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 mb-4">
              <p className="text-xs font-medium text-gray-600 mb-2">{c.line_steps_title}</p>
              <ol className="list-decimal list-inside space-y-1.5">
                {c.line_steps.map((step) => (
                  <li key={step} className="text-xs text-gray-500 leading-relaxed">{step}</li>
                ))}
              </ol>
              <p className="text-xs text-gray-500 leading-relaxed mt-1.5">
                <span className="inline-block w-4">5.</span>
                {c.line_webhook_step}
              </p>
              <div className="mt-2 ml-4 flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate text-xs bg-white border border-gray-200 rounded px-2 py-1.5 text-gray-700">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    setWebhookCopied(true);
                    setTimeout(() => setWebhookCopied(false), 2000);
                  }}
                  className="flex-shrink-0 text-xs font-medium text-teal-700 border border-teal-300 px-2.5 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
                >
                  {webhookCopied ? c.line_copied : c.line_copy}
                </button>
              </div>
            </div>

            <div className="space-y-3">
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

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{c.line_channel_id_label}</label>
                {clinic?.line_channel_id ? (
                  <code className="block text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate">
                    {clinic.line_channel_id}
                  </code>
                ) : (
                  <p className="text-xs text-gray-400 italic">{c.line_channel_id_not_detected}</p>
                )}
              </div>
            </div>
          </div>

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          {saved && !lookupFailed && <p className="text-sm text-teal-600">{c.saved}</p>}
          {saved && lookupFailed && <p className="text-sm text-amber-600">{c.saved_lookup_failed}</p>}

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
