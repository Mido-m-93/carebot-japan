"use client";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

const copy = {
  en: {
    title: "Payment successful!",
    body: "Your clinic is now active. You can start managing appointments from the dashboard.",
    cta: "Go to Dashboard",
    brand: "CareBot Japan",
    brand_sub: "Clinic Scheduling Dashboard",
  },
  ja: {
    title: "お支払いが完了しました！",
    body: "クリニックが有効になりました。ダッシュボードから予約の管理を開始できます。",
    cta: "ダッシュボードへ",
    brand: "CareBot Japan",
    brand_sub: "クリニック予約管理ダッシュボード",
  },
};

export default function OnboardingSuccessClient() {
  const { lang } = useLanguage();
  const c = copy[lang] ?? copy.en;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <p className="font-semibold text-teal-800 text-lg">{c.brand}</p>
          <p className="text-xs text-gray-400 mt-1">{c.brand_sub}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-7 shadow-sm text-center">
          {/* Checkmark icon */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 border border-teal-200">
            <svg
              className="h-7 w-7 text-teal-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-base font-semibold text-gray-900 mb-2">{c.title}</h1>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">{c.body}</p>

          <Link
            href="/dashboard"
            className="block w-full py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors text-center"
          >
            {c.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
