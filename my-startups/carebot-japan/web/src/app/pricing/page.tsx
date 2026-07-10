"use client";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

const copy = {
  en: {
    title: "Simple, transparent pricing",
    subtitle: "Start free. Upgrade when you're ready.",
    plan_starter: "Starter",
    plan_pro: "Pro",
    plan_enterprise: "Enterprise",
    price_starter: "Free",
    price_pro: "$49",
    price_enterprise: "$99",
    price_pro_period: "/ month",
    desc_starter: "Everything you need to get started with AI-powered scheduling.",
    desc_pro: "For clinics ready to scale with full automation and integrations.",
    desc_enterprise: "For clinics that want dedicated, priority support.",
    cta_starter: "Get started free",
    cta_pro: "Upgrade to Pro",
    cta_enterprise: "Upgrade to Enterprise",
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
    popular: "Most popular",
    brand: "CareBot Japan",
    brand_sub: "Clinic Scheduling Dashboard",
    faq_title: "Frequently asked questions",
    faqs: [
      {
        q: "Can I cancel anytime?",
        a: "Yes. Cancel from the billing portal at any time. Your plan stays active until the end of the billing period.",
      },
      {
        q: "Is there a free trial?",
        a: "The Starter plan is free forever. You can try the full product before upgrading.",
      },
      {
        q: "What payment methods are accepted?",
        a: "All major credit and debit cards via Stripe. No setup fees.",
      },
    ],
    back: "← Back to dashboard",
  },
  ja: {
    title: "シンプルで透明な料金プラン",
    subtitle: "無料で始めて、準備ができたらアップグレード。",
    plan_starter: "スターター",
    plan_pro: "プロ",
    plan_enterprise: "エンタープライズ",
    price_starter: "無料",
    price_pro: "$49",
    price_enterprise: "$99",
    price_pro_period: " / 月",
    desc_starter: "AIスケジューリングを始めるのに必要なものがすべて揃っています。",
    desc_pro: "フルオートメーションと連携機能でクリニックをスケールアップ。",
    desc_enterprise: "専任の優先サポートをご希望のクリニック向け。",
    cta_starter: "無料で始める",
    cta_pro: "プロにアップグレード",
    cta_enterprise: "エンタープライズにアップグレード",
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
    popular: "人気",
    brand: "CareBot Japan",
    brand_sub: "クリニック予約管理ダッシュボード",
    faq_title: "よくある質問",
    faqs: [
      {
        q: "いつでもキャンセルできますか？",
        a: "はい。請求ポータルからいつでもキャンセルできます。プランは請求期間終了まで有効です。",
      },
      {
        q: "無料トライアルはありますか？",
        a: "スタータープランは永久無料です。アップグレード前に製品全体をお試しいただけます。",
      },
      {
        q: "どの支払い方法が使えますか？",
        a: "Stripe経由の主要なクレジット・デビットカード。初期費用なし。",
      },
    ],
    back: "← ダッシュボードに戻る",
  },
};

function CheckIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-4 w-4 flex-shrink-0 ${active ? "text-teal-500" : "text-gray-300"}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function PricingPage() {
  const { lang } = useLanguage();
  const c = copy[lang] ?? copy.en;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-teal-800 text-sm">{c.brand}</p>
          <p className="text-xs text-gray-400">{c.brand_sub}</p>
        </div>
        <Link href="/dashboard" className="text-xs text-teal-600 hover:underline">
          {c.back}
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{c.title}</h1>
          <p className="text-gray-500">{c.subtitle}</p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-20">
          {/* Starter */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              {c.plan_starter}
            </p>
            <div className="mb-2">
              <span className="text-4xl font-bold text-gray-900">{c.price_starter}</span>
            </div>
            <p className="text-sm text-gray-500 mb-6">{c.desc_starter}</p>

            <ul className="space-y-3 mb-8 flex-1">
              {c.features_starter.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-gray-600">
                  <CheckIcon active={false} />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="block text-center py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:border-teal-400 hover:text-teal-700 transition-colors"
            >
              {c.cta_starter}
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-teal-800 rounded-2xl p-8 flex flex-col relative">
            <span className="absolute top-5 right-5 text-xs bg-white text-teal-800 font-semibold px-2.5 py-1 rounded-full">
              {c.popular}
            </span>
            <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-4">
              {c.plan_pro}
            </p>
            <div className="mb-2 flex items-end gap-1">
              <span className="text-4xl font-bold text-white">{c.price_pro}</span>
              <span className="text-teal-300 text-sm mb-1">{c.price_pro_period}</span>
            </div>
            <p className="text-sm text-teal-300 mb-6">{c.desc_pro}</p>

            <ul className="space-y-3 mb-8 flex-1">
              {c.features_pro.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-teal-100">
                  <CheckIcon active={true} />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/dashboard/billing"
              className="block text-center py-2.5 bg-white text-teal-800 text-sm font-semibold rounded-lg hover:bg-teal-50 transition-colors"
            >
              {c.cta_pro}
            </Link>
          </div>

          {/* Enterprise */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              {c.plan_enterprise}
            </p>
            <div className="mb-2 flex items-end gap-1">
              <span className="text-4xl font-bold text-gray-900">{c.price_enterprise}</span>
              <span className="text-gray-400 text-sm mb-1">{c.price_pro_period}</span>
            </div>
            <p className="text-sm text-gray-500 mb-6">{c.desc_enterprise}</p>

            <ul className="space-y-3 mb-8 flex-1">
              {c.features_enterprise.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-gray-600">
                  <CheckIcon active={false} />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/dashboard/billing"
              className="block text-center py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:border-teal-400 hover:text-teal-700 transition-colors"
            >
              {c.cta_enterprise}
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-6 text-center">{c.faq_title}</h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {c.faqs.map(({ q, a }) => (
              <div key={q} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-medium text-gray-900 mb-2">{q}</p>
                <p className="text-sm text-gray-500">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
