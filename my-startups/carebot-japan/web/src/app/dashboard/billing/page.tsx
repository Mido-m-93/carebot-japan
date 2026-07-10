"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, API_URL } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useClinicContext } from "@/contexts/ClinicContext";

interface SubscriptionStatus {
  clinic_id: string;
  tier: "starter" | "pro" | "enterprise";
  subscription_status: "inactive" | "active" | "past_due" | "cancelled";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  appointments_this_month: number | null;
  monthly_limit: number | null;
}

type Plan = "pro" | "enterprise";

const copy = {
  en: {
    title: "Billing & Subscription",
    subtitle: "Manage your plan and payment details",
    plan_starter: "Starter",
    plan_pro: "Pro",
    plan_enterprise: "Enterprise",
    plan_free: "Free forever",
    plan_price: "$49 / month",
    plan_price_enterprise: "$99 / month",
    status_active: "Active",
    status_inactive: "Inactive",
    status_past_due: "Payment past due",
    status_cancelled: "Cancelled",
    upgrade_title: "Upgrade to Pro",
    upgrade_desc: "Unlock all features for your clinic",
    upgrade_cta: "Upgrade — $49/month",
    upgrade_enterprise_title: "Upgrade to Enterprise",
    upgrade_enterprise_desc: "Everything in Pro, plus priority support",
    upgrade_enterprise_cta: "Upgrade — $99/month",
    upgrading: "Redirecting to checkout...",
    manage_title: "Your Subscription",
    manage_desc: "Full access to all CareBot Japan features",
    manage_cta: "Manage Subscription",
    managing: "Opening billing portal...",
    past_due_title: "Payment Required",
    past_due_desc: "Your last payment failed. Update your payment method to keep access.",
    past_due_cta: "Update Payment Method",
    features_starter: [
      "Up to 50 appointments / month",
      "AI appointment scheduling",
      "Web booking form",
      "Appointment dashboard",
    ],
    features_pro: [
      "Unlimited appointments",
      "AI appointment scheduling",
      "Web booking form",
      "Appointment dashboard",
      "Priority support",
    ],
    features_enterprise: [
      "Unlimited appointments",
      "AI appointment scheduling",
      "Web booking form",
      "Appointment dashboard",
      "Multiple clinic locations",
      "Dedicated priority support",
    ],
    banner_success: "Your plan is now active. Welcome aboard!",
    banner_cancelled: "Checkout was cancelled. Your plan was not changed.",
    error: "Could not load billing status. Please try again.",
    loading: "Loading billing info...",
    current_plan: "Current Plan",
    compare: "Compare plans →",
    usage_label: (used: number, limit: number) => `${used} / ${limit} appointments this month`,
    usage_near_limit: "You're close to your monthly limit — new bookings will be paused until you upgrade or next month starts.",
  },
  ja: {
    title: "お支払いとプラン",
    subtitle: "プランとお支払い情報を管理する",
    plan_starter: "スターター",
    plan_pro: "プロ",
    plan_enterprise: "エンタープライズ",
    plan_free: "無料",
    plan_price: "$49 / 月",
    plan_price_enterprise: "$99 / 月",
    status_active: "有効",
    status_inactive: "無効",
    status_past_due: "支払い期限超過",
    status_cancelled: "キャンセル済み",
    upgrade_title: "プロプランにアップグレード",
    upgrade_desc: "クリニックのすべての機能をご利用いただけます",
    upgrade_cta: "アップグレード — $49/月",
    upgrade_enterprise_title: "エンタープライズにアップグレード",
    upgrade_enterprise_desc: "プロの全機能 + 優先サポート",
    upgrade_enterprise_cta: "アップグレード — $99/月",
    upgrading: "チェックアウトに移動中...",
    manage_title: "サブスクリプション",
    manage_desc: "CareBot Japan のすべての機能にアクセスできます",
    manage_cta: "サブスクリプションを管理",
    managing: "請求ポータルを開いています...",
    past_due_title: "お支払いが必要です",
    past_due_desc:
      "最後のお支払いに失敗しました。引き続きご利用いただくには、支払い方法を更新してください。",
    past_due_cta: "支払い方法を更新",
    features_starter: [
      "月50件まで予約",
      "AI予約スケジューリング",
      "Web予約フォーム",
      "予約ダッシュボード",
    ],
    features_pro: [
      "予約無制限",
      "AI予約スケジューリング",
      "Web予約フォーム",
      "予約ダッシュボード",
      "優先サポート",
    ],
    features_enterprise: [
      "予約無制限",
      "AI予約スケジューリング",
      "Web予約フォーム",
      "予約ダッシュボード",
      "複数拠点管理",
      "専任優先サポート",
    ],
    banner_success: "プランが有効になりました。ありがとうございます！",
    banner_cancelled: "チェックアウトがキャンセルされました。プランは変更されていません。",
    error: "請求情報を読み込めませんでした。もう一度お試しください。",
    loading: "請求情報を読み込み中...",
    current_plan: "現在のプラン",
    compare: "プランを比較 →",
    usage_label: (used: number, limit: number) => `今月の予約 ${used} / ${limit} 件`,
    usage_near_limit: "月間の上限に近づいています。アップグレードするか、来月まで新規予約が一時停止されます。",
  },
};

export default function BillingPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const { activeClinicId } = useClinicContext();
  const c = copy[lang] ?? copy.en;

  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradingPlan, setUpgradingPlan] = useState<Plan | null>(null);
  const [managing, setManaging] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState(false);
  const [billingCancelled, setBillingCancelled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setBillingSuccess(params.get("billing") === "success");
    setBillingCancelled(params.get("billing") === "cancelled");
  }, []);

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

        const res = await fetch(`${API_URL}/billing/subscription`, {
          headers: { Authorization: `Bearer ${session.access_token}`, "X-Clinic-Id": activeClinicId ?? "" },
        });

        if (!res.ok) throw new Error(`${res.status}`);
        setSub(await res.json());
      } catch {
        setError(c.error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, c.error, activeClinicId]);

  async function handleUpgrade(plan: Plan) {
    setUpgradingPlan(plan);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const res = await fetch(`${API_URL}/billing/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-Clinic-Id": activeClinicId ?? "",
        },
        body: JSON.stringify({ plan }),
      });

      const body = await res.json();
      if (body.url) window.location.href = body.url;
    } catch {
      setUpgradingPlan(null);
    }
  }

  async function handleManage() {
    setManaging(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const res = await fetch(`${API_URL}/billing/create-portal-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "X-Clinic-Id": activeClinicId ?? "" },
      });

      const body = await res.json();
      if (body.url) window.location.href = body.url;
    } catch {
      setManaging(false);
    }
  }

  const tier = sub?.tier ?? "starter";
  const status = sub?.subscription_status ?? "inactive";
  const isStarter = tier === "starter";
  const isPro = tier === "pro";
  const isEnterprise = tier === "enterprise";
  const isPaid = isPro || isEnterprise;
  const isPastDue = status === "past_due";

  const planLabel = isEnterprise ? c.plan_enterprise : isPro ? c.plan_pro : c.plan_starter;
  const planPrice = isEnterprise ? c.plan_price_enterprise : isPro ? c.plan_price : c.plan_free;
  const planFeatures = isEnterprise ? c.features_enterprise : isPro ? c.features_pro : c.features_starter;

  function statusChip(s: string) {
    const base = "text-xs px-2 py-0.5 rounded-full font-medium border";
    if (s === "active") return `${base} bg-teal-50 text-teal-700 border-teal-200`;
    if (s === "past_due") return `${base} bg-amber-50 text-amber-700 border-amber-200`;
    return `${base} bg-gray-100 text-gray-500 border-gray-200`;
  }

  function statusLabel(s: string) {
    if (s === "active") return c.status_active;
    if (s === "past_due") return c.status_past_due;
    if (s === "cancelled") return c.status_cancelled;
    return c.status_inactive;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{c.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{c.subtitle}</p>
      </div>

      {/* Banners */}
      {billingSuccess && (
        <div className="mb-6 bg-teal-50 border border-teal-200 rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-teal-800">{c.banner_success}</p>
        </div>
      )}
      {billingCancelled && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-amber-800">{c.banner_cancelled}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">{c.loading}</p>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <div className="space-y-4 max-w-lg">
          {/* Current plan card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-xs text-gray-400 mb-4">{c.current_plan}</p>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl font-semibold text-gray-900">{planLabel}</span>
                  <span className={statusChip(status)}>{statusLabel(status)}</span>
                </div>
                <p className="text-sm text-gray-500">{planPrice}</p>
              </div>
              {!isEnterprise && (
                <Link href="/pricing" className="text-xs text-teal-600 hover:underline">
                  {c.compare}
                </Link>
              )}
            </div>

            <ul className="space-y-2">
              {planFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className={isPaid ? "text-teal-500" : "text-gray-300"}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Usage bar — Starter only, Pro/enterprise are unlimited */}
            {isStarter && sub?.monthly_limit != null && sub.appointments_this_month != null && (
              <div className="mt-5 pt-5 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">
                    {c.usage_label(sub.appointments_this_month, sub.monthly_limit)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      sub.appointments_this_month >= sub.monthly_limit ? "bg-red-400" : "bg-teal-500"
                    }`}
                    style={{ width: `${Math.min(100, (sub.appointments_this_month / sub.monthly_limit) * 100)}%` }}
                  />
                </div>
                {sub.appointments_this_month >= sub.monthly_limit * 0.8 && (
                  <p className="text-xs text-amber-600 mt-2">{c.usage_near_limit}</p>
                )}
              </div>
            )}
          </div>

          {/* Upgrade to Pro — Starter only */}
          {isStarter && !isPastDue && (
            <div className="bg-teal-800 rounded-xl p-6 text-white">
              <h2 className="text-sm font-semibold mb-1">{c.upgrade_title}</h2>
              <p className="text-xs text-teal-300 mb-4">{c.upgrade_desc}</p>
              <ul className="space-y-1.5 mb-5">
                {c.features_pro.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-teal-200">
                    <span className="text-teal-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade("pro")}
                disabled={upgradingPlan !== null}
                className="w-full py-2.5 bg-white text-teal-800 text-sm font-semibold rounded-lg hover:bg-teal-50 disabled:opacity-50 transition-colors"
              >
                {upgradingPlan === "pro" ? c.upgrading : c.upgrade_cta}
              </button>
            </div>
          )}

          {/* Upgrade to Enterprise — Starter or Pro */}
          {!isEnterprise && !isPastDue && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">{c.upgrade_enterprise_title}</h2>
              <p className="text-xs text-gray-400 mb-4">{c.upgrade_enterprise_desc}</p>
              <button
                onClick={() => handleUpgrade("enterprise")}
                disabled={upgradingPlan !== null}
                className="px-4 py-2 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 disabled:opacity-50 transition-colors"
              >
                {upgradingPlan === "enterprise" ? c.upgrading : c.upgrade_enterprise_cta}
              </button>
            </div>
          )}

          {/* Manage subscription — any paid tier */}
          {isPaid && !isPastDue && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">{c.manage_title}</h2>
              <p className="text-xs text-gray-400 mb-4">{c.manage_desc}</p>
              <button
                onClick={handleManage}
                disabled={managing}
                className="px-4 py-2 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 disabled:opacity-50 transition-colors"
              >
                {managing ? c.managing : c.manage_cta}
              </button>
            </div>
          )}

          {/* Past-due warning */}
          {isPastDue && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-amber-800 mb-1">{c.past_due_title}</h2>
              <p className="text-xs text-amber-600 mb-4">{c.past_due_desc}</p>
              <button
                onClick={handleManage}
                disabled={managing}
                className="px-4 py-2 text-sm font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
              >
                {managing ? c.managing : c.past_due_cta}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
