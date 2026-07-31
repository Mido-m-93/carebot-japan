"use client";
import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Reveal } from "@/components/Reveal";

const copy = {
  en: {
    nav_signin: "Sign in",
    nav_start: "Get started free",

    hero_tag: "AI Appointment Scheduling for Clinics in Japan",
    hero_title: "Your reception desk,\non autopilot.",
    hero_sub:
      "Patients book online. AI reads the request, extracts the details, and confirms the appointment automatically. No phone calls. No manual entry.",
    hero_cta: "Start for free",
    hero_sub_cta: "No credit card required",

    how_title: "How it works",
    how_steps: [
      {
        n: "1",
        title: "Patient fills the booking form",
        sub: "You share a simple link. Patients open it on any device and submit their request in seconds.",
      },
      {
        n: "2",
        title: "AI processes it instantly",
        sub: "CareBot reads the request, extracts name, date, time, and visit reason, and books it automatically.",
      },
      {
        n: "3",
        title: "You see it on the dashboard",
        sub: "All appointments appear in real time. Anything the AI isn't sure about goes to the review queue for you to confirm.",
      },
    ],

    features_title: "Everything your clinic needs",
    features: [
      {
        icon: "🤖",
        title: "AI Scheduling",
        sub: "Understands natural language requests in Japanese and English. Books appointments without staff involvement.",
      },
      {
        icon: "📋",
        title: "Review Queue",
        sub: "Ambiguous messages go to a queue. Staff review and confirm with one click. No data entry needed.",
      },
      {
        icon: "📊",
        title: "Live Dashboard",
        sub: "See today's appointments, this week's bookings, and pending reviews at a glance.",
      },
      {
        icon: "🌐",
        title: "Bilingual",
        sub: "Full Japanese and English support. Patients and staff can use whichever language they prefer.",
      },
    ],

    pricing_title: "Simple pricing",
    pricing_sub: "Start free. Upgrade when you grow.",
    plan_starter: "Starter",
    plan_pro: "Pro",
    plan_enterprise: "Enterprise",
    price_free: "Free",
    price_pro: "¥7,500",
    price_enterprise: "¥15,000",
    price_mo: "/ month",
    starter_features: [
      "Up to 50 appointments / month",
      "AI appointment scheduling",
      "Web booking form",
      "Appointment dashboard",
    ],
    pro_features: [
      "Unlimited appointments",
      "AI appointment scheduling",
      "Web booking form",
      "Appointment dashboard",
      "Priority support",
    ],
    enterprise_features: [
      "Unlimited appointments",
      "AI appointment scheduling",
      "Web booking form",
      "Appointment dashboard",
      "Multiple clinic locations",
      "Dedicated priority support",
    ],
    cta_starter: "Get started free",
    cta_pro: "Start with Pro",
    cta_enterprise: "Start with Enterprise",
    popular: "Most popular",

    bottom_title: "Ready to automate your bookings?",
    bottom_sub: "Set up takes less than 5 minutes. Free to start.",
    bottom_cta: "Create your free account",

    footer_product: "Product",
    footer_pricing: "Pricing",
    footer_login: "Sign in",
    footer_signup: "Sign up",
    footer_copy: "© 2026 CareBot Japan",
  },
  ja: {
    nav_signin: "ログイン",
    nav_start: "無料で始める",

    hero_tag: "日本のクリニック向けAI予約管理",
    hero_title: "受付業務を、\nAIに任せましょう。",
    hero_sub:
      "患者がオンラインで予約 → AIが内容を読み取り → 自動で予約確定。電話対応も手入力も不要です。",
    hero_cta: "無料で始める",
    hero_sub_cta: "クレジットカード不要",

    how_title: "使い方",
    how_steps: [
      {
        n: "1",
        title: "患者が予約フォームに入力",
        sub: "専用リンクをシェアするだけ。患者はスマホやPCから数秒で予約リクエストを送れます。",
      },
      {
        n: "2",
        title: "AIが自動で処理",
        sub: "CareBotがリクエストを読み取り、氏名・日時・来院理由を抽出して予約を自動確定します。",
      },
      {
        n: "3",
        title: "ダッシュボードで確認",
        sub: "全予約がリアルタイムで表示。AIが判断できなかった内容は要確認キューに入り、1クリックで処理できます。",
      },
    ],

    features_title: "クリニックに必要な機能がすべて揃っています",
    features: [
      {
        icon: "🤖",
        title: "AI予約処理",
        sub: "日本語・英語の自然な文章を理解。スタッフの手を借りずに予約を自動確定します。",
      },
      {
        icon: "📋",
        title: "要確認キュー",
        sub: "AIが判断できない曖昧なメッセージはキューへ。スタッフがワンクリックで確認・修正できます。",
      },
      {
        icon: "📊",
        title: "ライブダッシュボード",
        sub: "本日の予約・今週の状況・確認待ち件数を一画面で把握。",
      },
      {
        icon: "🌐",
        title: "日英バイリンガル",
        sub: "日本語・英語に完全対応。患者もスタッフも使いやすい言語で利用できます。",
      },
    ],

    pricing_title: "シンプルな料金プラン",
    pricing_sub: "無料で始めて、成長に合わせてアップグレード。",
    plan_starter: "スターター",
    plan_pro: "プロ",
    plan_enterprise: "エンタープライズ",
    price_free: "無料",
    price_pro: "¥7,500",
    price_enterprise: "¥15,000",
    price_mo: " / 月",
    starter_features: [
      "月50件まで予約",
      "AI予約スケジューリング",
      "Web予約フォーム",
      "予約ダッシュボード",
    ],
    pro_features: [
      "予約無制限",
      "AI予約スケジューリング",
      "Web予約フォーム",
      "予約ダッシュボード",
      "優先サポート",
    ],
    enterprise_features: [
      "予約無制限",
      "AI予約スケジューリング",
      "Web予約フォーム",
      "予約ダッシュボード",
      "複数拠点管理",
      "専任優先サポート",
    ],
    cta_starter: "無料で始める",
    cta_pro: "プロプランで始める",
    cta_enterprise: "エンタープライズで始める",
    popular: "人気",

    bottom_title: "予約管理を自動化する準備はできましたか？",
    bottom_sub: "設定は5分以内。無料でスタートできます。",
    bottom_cta: "無料アカウントを作成",

    footer_product: "プロダクト",
    footer_pricing: "料金",
    footer_login: "ログイン",
    footer_signup: "新規登録",
    footer_copy: "© 2026 CareBot Japan",
  },
};

export default function LandingPage() {
  const { lang, toggle } = useLanguage();
  const c = copy[lang] ?? copy.en;

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 shadow-sm" />
            <span className="font-semibold text-teal-800">CareBot Japan</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:border-teal-400 hover:text-teal-700 transition-colors"
            >
              {lang === "en" ? "🇯🇵 日本語" : "🇬🇧 English"}
            </button>
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {c.nav_signin}
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-teal-700 text-white px-4 py-1.5 rounded-lg hover:bg-teal-800 transition-colors font-medium"
            >
              {c.nav_start}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Decorative gradient backdrop */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-teal-50 via-white to-white" />
        <div className="absolute -top-24 -left-24 -z-10 w-96 h-96 rounded-full bg-teal-200/40 blur-3xl animate-float-slow" />
        <div className="absolute -top-10 right-0 -z-10 w-80 h-80 rounded-full bg-teal-100/50 blur-3xl animate-float" />

        <div className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
          <span className="inline-block text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full mb-6 shadow-sm animate-fade-in-up [animation-delay:0ms]">
            {c.hero_tag}
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-gray-900 leading-[0.95] mb-6 whitespace-pre-line animate-fade-in-up [animation-delay:100ms]">
            {c.hero_title.split("\n").map((line, i) => (
              <span key={i} className={i === 1 ? "bg-gradient-to-r from-teal-600 to-teal-400 bg-clip-text text-transparent" : undefined}>
                {line}
                {i === 0 && <br />}
              </span>
            ))}
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8 leading-relaxed animate-fade-in-up [animation-delay:200ms]">
            {c.hero_sub}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up [animation-delay:300ms]">
            <Link
              href="/signup"
              className="px-7 py-3 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800 transition-all hover:shadow-lg hover:shadow-teal-800/20 hover:-translate-y-0.5 shadow-sm"
            >
              {c.hero_cta}
            </Link>
            <Link
              href="/login"
              className="px-7 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-teal-400 hover:bg-teal-50/50 transition-colors"
            >
              {c.nav_signin}
            </Link>
          </div>
          <p className="mt-3 text-xs text-gray-400 animate-fade-in-up [animation-delay:350ms]">{c.hero_sub_cta}</p>

          {/* Mock dashboard preview */}
          <div className="mt-14 bg-gray-50 border border-gray-200 rounded-2xl p-6 text-left shadow-xl shadow-teal-900/5 ring-1 ring-black/5 animate-fade-in-up [animation-delay:450ms] transition-shadow hover:shadow-2xl hover:shadow-teal-900/10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse-soft" />
            <span className="ml-2 text-xs text-gray-400">CareBot Japan Dashboard</span>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: lang === "ja" ? "本日の予約" : "Today", value: "8" },
              { label: lang === "ja" ? "今週" : "This week", value: "34" },
              { label: lang === "ja" ? "要確認" : "Pending", value: "2" },
              { label: lang === "ja" ? "確定済み" : "Confirmed", value: "127" },
            ].map(({ label, value }, i) => (
              <div
                key={label}
                className="bg-white rounded-xl border border-gray-100 p-3 transition-transform hover:-translate-y-0.5 hover:shadow-sm animate-fade-in-up"
                style={{ animationDelay: `${550 + i * 80}ms` }}
              >
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="text-xl font-semibold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {[
              { name: lang === "ja" ? "田中 花子" : "Hanako Tanaka", time: "09:30", reason: lang === "ja" ? "定期検診" : "Checkup", status: "confirmed" },
              { name: lang === "ja" ? "山田 太郎" : "Taro Yamada", time: "11:00", reason: lang === "ja" ? "腰痛" : "Back pain", status: "confirmed" },
              { name: lang === "ja" ? "鈴木 美咲" : "Misaki Suzuki", time: "14:30", reason: lang === "ja" ? "風邪" : "Cold", status: "pending" },
            ].map((row, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-4 py-2.5 text-xs transition-colors hover:bg-gray-50 animate-fade-in-up ${i < 2 ? "border-b border-gray-50" : ""}`}
                style={{ animationDelay: `${900 + i * 80}ms` }}
              >
                <span className="font-medium text-gray-800 w-28">{row.name}</span>
                <span className="text-gray-400">{row.time}</span>
                <span className="text-gray-500 flex-1 px-4">{row.reason}</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  row.status === "confirmed"
                    ? "bg-teal-50 text-teal-700"
                    : "bg-amber-50 text-amber-700"
                }`}>
                  {row.status === "confirmed"
                    ? lang === "ja" ? "確定" : "Confirmed"
                    : lang === "ja" ? "要確認" : "Review"}
                </span>
              </div>
            ))}
          </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 text-center mb-12">{c.how_title}</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 relative">
            {/* Connecting line behind the steps, desktop only */}
            <div className="hidden md:block absolute top-[18px] left-[8%] right-[8%] h-px bg-gradient-to-r from-teal-200 via-teal-300 to-teal-200" />
            {c.how_steps.map((step, i) => (
              <Reveal key={step.n} delay={i * 120} className="flex flex-col relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-600 to-teal-800 text-white text-sm font-bold flex items-center justify-center mb-4 shadow-md shadow-teal-800/20 ring-4 ring-gray-50">
                  {step.n}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.sub}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 text-center mb-12">{c.features_title}</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {c.features.map((f, i) => (
              <Reveal
                key={f.title}
                delay={i * 100}
                className="bg-gray-50 rounded-2xl border border-gray-100 p-6 transition-all hover:border-teal-200 hover:shadow-md hover:shadow-teal-900/5 hover:-translate-y-0.5"
              >
                <span className="w-11 h-11 rounded-xl bg-white border border-gray-100 shadow-sm text-xl mb-4 flex items-center justify-center">
                  {f.icon}
                </span>
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.sub}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-2">{c.pricing_title}</h2>
              <p className="text-gray-500 text-sm">{c.pricing_sub}</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {/* Starter */}
            <Reveal delay={0} className="bg-white rounded-2xl border border-gray-200 p-7 flex flex-col transition-shadow hover:shadow-md hover:shadow-gray-900/5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                {c.plan_starter}
              </p>
              <p className="text-3xl font-bold text-gray-900 mb-5">{c.price_free}</p>
              <ul className="space-y-2.5 flex-1 mb-6">
                {c.starter_features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-gray-300">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block text-center py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-xl hover:border-teal-400 hover:text-teal-700 transition-colors"
              >
                {c.cta_starter}
              </Link>
            </Reveal>

            {/* Pro */}
            <Reveal delay={120} className="bg-gradient-to-br from-teal-700 to-teal-900 rounded-2xl p-7 flex flex-col relative shadow-xl shadow-teal-900/20 ring-1 ring-teal-900/10 transition-transform hover:-translate-y-1">
              <span className="absolute top-5 right-5 text-xs bg-white text-teal-800 font-semibold px-2.5 py-1 rounded-full shadow-sm">
                {c.popular}
              </span>
              <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-4">
                {c.plan_pro}
              </p>
              <div className="flex items-end gap-1 mb-5">
                <span className="text-3xl font-bold text-white">{c.price_pro}</span>
                <span className="text-teal-300 text-sm mb-0.5">{c.price_mo}</span>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {c.pro_features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-teal-100">
                    <span className="text-teal-400">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block text-center py-2.5 bg-white text-teal-800 text-sm font-semibold rounded-xl hover:bg-teal-50 transition-colors"
              >
                {c.cta_pro}
              </Link>
            </Reveal>

            {/* Enterprise */}
            <Reveal delay={240} className="bg-white rounded-2xl border border-gray-200 p-7 flex flex-col transition-shadow hover:shadow-md hover:shadow-gray-900/5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                {c.plan_enterprise}
              </p>
              <div className="flex items-end gap-1 mb-5">
                <span className="text-3xl font-bold text-gray-900">{c.price_enterprise}</span>
                <span className="text-gray-400 text-sm mb-0.5">{c.price_mo}</span>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {c.enterprise_features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-gray-300">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup?plan=enterprise"
                className="block text-center py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-xl hover:border-teal-400 hover:text-teal-700 transition-colors"
              >
                {c.cta_enterprise}
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-teal-700 to-teal-900" />
        <div className="absolute -bottom-32 -right-16 -z-10 w-96 h-96 rounded-full bg-teal-500/20 blur-3xl animate-float-slow" />
        <Reveal className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">{c.bottom_title}</h2>
          <p className="text-sm text-teal-200 mb-8">{c.bottom_sub}</p>
          <Link
            href="/signup"
            className="inline-block px-8 py-3 bg-white text-teal-800 text-sm font-semibold rounded-xl hover:bg-teal-50 transition-all hover:shadow-lg hover:-translate-y-0.5 shadow-lg shadow-teal-900/30"
          >
            {c.bottom_cta}
          </Link>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-teal-800">CareBot Japan</span>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <Link href="/pricing" className="hover:text-gray-600 transition-colors">{c.footer_pricing}</Link>
            <Link href="/login" className="hover:text-gray-600 transition-colors">{c.footer_login}</Link>
            <Link href="/signup" className="hover:text-gray-600 transition-colors">{c.footer_signup}</Link>
          </div>
          <span className="text-xs text-gray-300">{c.footer_copy}</span>
        </div>
      </footer>
    </div>
  );
}
