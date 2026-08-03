"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, API_URL } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

const copy = {
  en: {
    title: "Set up your clinic",
    subtitle: "Tell us about your clinic to get started",
    clinic_name: "Clinic name",
    clinic_name_placeholder: "e.g. Sakura Family Clinic",
    line_channel_id: "LINE Channel ID",
    line_channel_id_placeholder: "e.g. 1234567890",
    line_channel_id_hint: "Found in LINE Developers Console (optional)",
    line_setup_later_hint: "You'll add your Channel secret & access token later, from Settings.",
    phone: "Phone number",
    phone_placeholder: "e.g. 03-1234-5678",
    phone_hint: "Optional — shown to patients on the booking form",
    submit: "Continue to payment",
    submit_free: "Get started",
    submitting: "Setting up...",
    error_required: "Clinic name is required.",
    error_api: "Something went wrong. Please try again.",
    brand: "CareBot Japan",
    brand_sub: "Clinic Scheduling Dashboard",
  },
  ja: {
    title: "クリニックを設定する",
    subtitle: "クリニックの情報を入力してください",
    clinic_name: "クリニック名",
    clinic_name_placeholder: "例：さくら家族クリニック",
    line_channel_id: "LINE チャンネルID",
    line_channel_id_placeholder: "例：1234567890",
    line_channel_id_hint: "LINE Developers コンソールで確認できます（任意）",
    line_setup_later_hint: "チャンネルシークレットとアクセストークンは、後で設定画面から追加できます。",
    phone: "電話番号",
    phone_placeholder: "例：03-1234-5678",
    phone_hint: "任意 — 予約フォームに表示されます",
    submit: "お支払いへ進む",
    submit_free: "無料で始める",
    submitting: "設定中...",
    error_required: "クリニック名は必須です。",
    error_api: "エラーが発生しました。もう一度お試しください。",
    brand: "CareBot Japan",
    brand_sub: "クリニック予約管理ダッシュボード",
  },
};

export default function OnboardingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const plan = planParam === "enterprise" ? "enterprise" : planParam === "pro" ? "pro" : "starter";
  const { lang, toggle } = useLanguage();
  const c = copy[lang] ?? copy.en;

  const [clinicName, setClinicName] = useState("");
  const [lineChannelId, setLineChannelId] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-side auth guard (middleware handles server-side, this handles hydration edge cases)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/login");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clinicName.trim()) {
      setError(c.error_required);
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token || !session) {
        router.replace("/login");
        return;
      }

      // 1. Create the clinic and link this user as its owner, atomically,
      // via the authenticated backend (never a client-trusted write).
      const onboardRes = await fetch(`${API_URL}/clinics/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: clinicName.trim(),
          line_channel_id: lineChannelId.trim() || null,
          phone: phone.trim() || null,
        }),
      });

      if (!onboardRes.ok) {
        const body = await onboardRes.json().catch(() => ({}));
        throw new Error(body?.detail ?? body?.message ?? "API error");
      }

      // Starter is free -- no Stripe checkout involved, straight to the dashboard.
      if (plan === "starter") {
        router.push("/dashboard");
        return;
      }

      // 2. Create Stripe Checkout session
      const res = await fetch("/api-proxy/billing/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan,
          clinic_name: clinicName.trim(),
          success_url: `${window.location.origin}/onboarding/success`,
          cancel_url: `${window.location.origin}/onboarding`,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? body?.message ?? "API error");
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        // No Stripe URL returned — go straight to dashboard
        router.push("/dashboard");
      }
    } catch (err) {
      console.error(err);
      setError(c.error_api);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <p className="font-semibold text-teal-800 text-lg">{c.brand}</p>
          <p className="text-xs text-gray-400 mt-1">{c.brand_sub}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-gray-200 p-7 shadow-sm"
        >
          {/* Header row */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-base font-semibold text-gray-900">{c.title}</h1>
                <span className="text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                  {plan === "enterprise"
                    ? (lang === "ja" ? "エンタープライズ" : "Enterprise")
                    : plan === "pro"
                    ? (lang === "ja" ? "プロ" : "Pro")
                    : (lang === "ja" ? "スターター" : "Starter")}
                </span>
              </div>
              <p className="text-xs text-gray-400">{c.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={toggle}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-teal-400 hover:text-teal-700 transition-colors mt-0.5"
            >
              <span className="text-sm leading-none">{lang === "en" ? "🇯🇵" : "🇬🇧"}</span>
              <span>{lang === "en" ? "日本語" : "English"}</span>
              <span className="text-gray-300">▾</span>
            </button>
          </div>

          {/* Clinic name */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {c.clinic_name}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              required
              placeholder={c.clinic_name_placeholder}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>

          {/* LINE Channel ID */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {c.line_channel_id}
            </label>
            <input
              type="text"
              value={lineChannelId}
              onChange={(e) => setLineChannelId(e.target.value)}
              placeholder={c.line_channel_id_placeholder}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
            <p className="mt-1.5 text-xs text-gray-400">{c.line_channel_id_hint}</p>
            <p className="text-xs text-gray-400">{c.line_setup_later_hint}</p>
          </div>

          {/* Phone */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {c.phone}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={c.phone_placeholder}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
            <p className="mt-1.5 text-xs text-gray-400">{c.phone_hint}</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {loading ? c.submitting : plan === "starter" ? c.submit_free : c.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
