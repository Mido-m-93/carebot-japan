// apps/web/src/app/demo/page.tsx
//
// Sales-enablement page for founder-led cold outreach to English-speaking /
// international clinics in Japan. Linked directly from cold email / LINE
// messages -- must be understandable in under a minute, with zero signup
// friction. See CONTEXT: only claims features that exist in api/routers &
// api/services today (LINE webhook, web booking form, email intake, AI
// extraction with confidence scoring, review queue, dashboard).
"use client";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

const SALES_EMAIL = "Mohamada@roboco-op.org";

const copy = {
  en: {
    nav_back: "← CareBot Japan",

    hero_tag: "For clinics with English-speaking & international patients in Japan",
    hero_title: "They message you on LINE.\nCareBot books them — in English.",
    hero_sub:
      "Most scheduling tools assume every patient reads Japanese. CareBot reads booking requests in English or Japanese — over LINE, your website, or email — and confirms the appointment automatically. No phone tag, no Google Translate at the front desk.",
    hero_cta: "Email us to start your free trial",
    hero_cta_hint:
      "Got this link in an email or LINE message? Just reply there instead — that works too.",

    chat_label: "A real patient message, handled automatically",
    chat_badge: "LINE",
    chat_patient: "Hi! I'd like to book a check-up this Friday afternoon — I don't read Japanese well, is that OK?",
    chat_bot: "Of course! You're booked for Friday at 3:00 PM. We'll send a reminder here on LINE — see you then.",
    chat_tag: "✓ Booked automatically — zero staff time",

    dash_label: "Meanwhile, on your dashboard",
    dash_sub: "It just shows up — confirmed and ready for your staff to see at a glance.",
    dash_stats: [
      { label: "Today", value: "6" },
      { label: "This week", value: "29" },
      { label: "Pending", value: "1" },
      { label: "Confirmed", value: "118" },
    ],
    dash_rows: [
      { name: "Emily Carter", time: "15:00", reason: "Check-up", source: "LINE", tag: "EN" },
      { name: "Hanako Tanaka", time: "09:30", reason: "定期検診", source: "Web", tag: "JA" },
    ],
    status_confirmed: "Confirmed",

    why_title: "Why this matters more than generic scheduling",
    why_points: [
      "International and English-speaking residents in Japan already default to LINE — most clinics just can't respond there in their language.",
      "CareBot reads the request in whatever language it's written in and books it — no staff time, no translation app.",
      "Anything the AI isn't confident about is flagged for a human to check, not silently guessed at or missed.",
      "Confirmations go out in the patient's own language, automatically.",
    ],

    real_title: "What's actually live today — not a pitch deck",
    real_points: [
      "LINE Messaging API integration — patients message your clinic's own LINE account directly",
      "Public web booking form with real-time appointment slot availability",
      "Inbound email booking — patients can just email a request",
      "AI extraction of name, date, time and reason, in Japanese or English, with a confidence score on every read",
      "Low-confidence messages route to a staff review queue instead of auto-booking blind",
      "Live appointments dashboard for your team",
    ],

    pricing_title: "Pricing, plainly",
    pricing_note: "Free for design partners during the trial. After that, Pro is ¥7,500/month — no contract, cancel anytime.",

    cta_title: "See it running with your own clinic this week",
    cta_sub: "Reply and we'll set your LINE account and booking page up personally — about 15 minutes on our side, nothing on yours.",
    cta_button: "Email us to get started",
    cta_hint: "Already got this link in an email or LINE message? Just reply there — even faster.",
    cta_secondary_pre: "Want to poke around the live product first?",
    cta_secondary_link: "View CareBot Japan →",

    footer_copy: "© 2026 CareBot Japan",
  },
  ja: {
    nav_back: "← CareBot Japan",

    hero_tag: "海外出身・英語圏の患者様に対応するクリニック向け",
    hero_title: "患者様はLINEで連絡してきます。\nCareBotが英語で予約を確定します。",
    hero_sub:
      "多くの予約システムは「患者は日本語を読める」前提で作られています。CareBotはLINE・ウェブ・メールで届く英語・日本語のメッセージを読み取り、自動で予約を確定します。電話でのやり取りも、受付でのGoogle翻訳も不要です。",
    hero_cta: "メールで無料トライアルを申し込む",
    hero_cta_hint: "このリンクが届いたメールやLINEメッセージに、そのまま返信していただいても大丈夫です。",

    chat_label: "実際の患者メッセージを自動処理する例",
    chat_badge: "LINE",
    chat_patient: "Hi! I'd like to book a check-up this Friday afternoon — I don't read Japanese well, is that OK?",
    chat_bot: "Of course! You're booked for Friday at 3:00 PM. We'll send a reminder here on LINE — see you then.",
    chat_tag: "✓ 自動で予約確定 — スタッフの手間ゼロ",

    dash_label: "同時に、ダッシュボードにも自動反映",
    dash_sub: "確定済みの状態でそのまま表示。スタッフは一目で確認できます。",
    dash_stats: [
      { label: "本日", value: "6" },
      { label: "今週", value: "29" },
      { label: "要確認", value: "1" },
      { label: "確定済み", value: "118" },
    ],
    dash_rows: [
      { name: "Emily Carter", time: "15:00", reason: "Check-up", source: "LINE", tag: "EN" },
      { name: "田中 花子", time: "09:30", reason: "定期検診", source: "Web", tag: "JA" },
    ],
    status_confirmed: "確定",

    why_title: "なぜこれが「ただの予約管理」と違うのか",
    why_points: [
      "日本在住の海外出身者・英語話者は、すでにLINEを使っています。多くのクリニックは、そこで日本語以外の対応ができていません。",
      "CareBotはメッセージが書かれた言語のまま内容を読み取り、自動で予約を確定します。スタッフの手間も翻訳アプリも不要です。",
      "AIが自信を持てない内容は自動確定せず、スタッフの確認キューに回されます。見逃しも当て推量もありません。",
      "確認メッセージも患者様の言語で自動送信されます。",
    ],

    real_title: "今すぐ使える機能です（構想中ではありません）",
    real_points: [
      "LINE Messaging API連携 — 患者様は貴院のLINE公式アカウントに直接メッセージを送れます",
      "リアルタイムの空き枠表示付きウェブ予約フォーム",
      "メールでの予約受付にも対応",
      "氏名・日時・来院理由をAIが抽出 — 日本語・英語どちらにも対応し、抽出結果ごとに信頼度スコアを表示",
      "信頼度が低いメッセージは自動確定せず、スタッフの確認キューへ",
      "スタッフ用のリアルタイム予約ダッシュボード",
    ],

    pricing_title: "料金について、正直に",
    pricing_note: "デザインパートナー期間中は無料。その後はProプラン ¥7,500/月、契約期間の縛りなし。いつでも解約できます。",

    cta_title: "今週、貴院のアカウントで実際に動かしてみませんか",
    cta_sub: "ご返信いただければ、LINEアカウントと予約ページをこちらで設定いたします。所要時間は約15分、貴院側の作業は一切ありません。",
    cta_button: "メールでトライアルを申し込む",
    cta_hint: "このリンクが届いたメールやLINEメッセージに、そのまま返信いただいても構いません。",
    cta_secondary_pre: "まずは実際のプロダクトを見てみたい方は",
    cta_secondary_link: "CareBot Japanを見る →",

    footer_copy: "© 2026 CareBot Japan",
  },
};

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-gray-600">
      <span className="mt-0.5 text-teal-500">✓</span>
      <span>{children}</span>
    </li>
  );
}

export default function DemoPage() {
  const { lang, toggle } = useLanguage();
  const c = copy[lang] ?? copy.en;

  const mailHref = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(
    "CareBot Japan — free trial"
  )}&body=${encodeURIComponent(
    "Hi, I'd like to set up a free CareBot Japan trial for our clinic.\n\nClinic name:\nBest time to reach us:\n"
  )}`;

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 shadow-sm" />
            <span className="font-semibold text-teal-800 text-sm">{c.nav_back}</span>
          </Link>
          <button
            onClick={toggle}
            className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:border-teal-400 hover:text-teal-700 transition-colors"
          >
            {lang === "en" ? "🇯🇵 日本語" : "🇬🇧 English"}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-teal-50 via-white to-white" />
        <div className="absolute -top-24 -left-24 -z-10 w-96 h-96 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="absolute -top-10 right-0 -z-10 w-80 h-80 rounded-full bg-teal-100/50 blur-3xl" />

        <div className="max-w-3xl mx-auto px-6 pt-16 pb-14 text-center">
          <span className="inline-block text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full mb-6 shadow-sm">
            {c.hero_tag}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-6 whitespace-pre-line">
            {c.hero_title.split("\n").map((line, i) => (
              <span
                key={i}
                className={i === 1 ? "block bg-gradient-to-r from-teal-600 to-teal-400 bg-clip-text text-transparent" : "block"}
              >
                {line}
              </span>
            ))}
          </h1>
          <p className="text-base text-gray-500 max-w-xl mx-auto mb-8 leading-relaxed">
            {c.hero_sub}
          </p>
          <a
            href={mailHref}
            className="inline-block px-7 py-3 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800 transition-all hover:shadow-lg hover:shadow-teal-800/20 hover:-translate-y-0.5 shadow-sm"
          >
            {c.hero_cta}
          </a>
          <p className="mt-3 text-xs text-gray-400 max-w-sm mx-auto">{c.hero_cta_hint}</p>
        </div>
      </section>

      {/* LINE chat mock */}
      <section className="pb-16">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-center text-xs font-medium text-gray-400 uppercase tracking-widest mb-5">
            {c.chat_label}
          </p>
          <div className="mx-auto max-w-sm bg-white rounded-[1.75rem] border border-gray-200 shadow-xl shadow-teal-900/10 ring-1 ring-black/5 p-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                C
              </span>
              <div>
                <p className="text-xs font-semibold text-gray-800">CareBot Japan</p>
                <p className="text-[10px] text-gray-400">{c.chat_badge}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-teal-600 text-white text-xs leading-relaxed rounded-2xl rounded-br-sm px-3.5 py-2.5 max-w-[85%] shadow-sm">
                  {c.chat_patient}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 text-xs leading-relaxed rounded-2xl rounded-bl-sm px-3.5 py-2.5 max-w-[85%]">
                  {c.chat_bot}
                </div>
              </div>
            </div>
            <p className="text-center text-[11px] font-medium text-teal-700 bg-teal-50 border border-teal-100 rounded-lg mt-4 py-1.5">
              {c.chat_tag}
            </p>
          </div>
        </div>
      </section>

      {/* Dashboard mock */}
      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-center text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">
            {c.dash_label}
          </p>
          <p className="text-center text-sm text-gray-500 mb-6">{c.dash_sub}</p>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="grid grid-cols-4 gap-2.5 mb-4">
              {c.dash_stats.map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                  <p className="text-[11px] text-gray-400 mb-1">{label}</p>
                  <p className="text-lg font-semibold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {c.dash_rows.map((row, i) => (
                <div
                  key={row.name}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 text-xs ${
                    i < c.dash_rows.length - 1 ? "border-b border-gray-50" : ""
                  }`}
                >
                  <span className="font-medium text-gray-800 w-28 truncate">{row.name}</span>
                  <span className="text-gray-400 w-12 shrink-0">{row.time}</span>
                  <span className="text-gray-500 flex-1 truncate">{row.reason}</span>
                  <span className="px-2 py-0.5 rounded-full font-medium bg-gray-50 text-gray-500 border border-gray-100 shrink-0">
                    {row.source}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full font-semibold bg-teal-50 text-teal-700 shrink-0">
                    {row.tag}
                  </span>
                  <span className="px-2 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700 shrink-0">
                    {c.status_confirmed}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why it matters */}
      <section className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-8">{c.why_title}</h2>
          <ul className="space-y-4">
            {c.why_points.map((p) => (
              <Check key={p}>{p}</Check>
            ))}
          </ul>
        </div>
      </section>

      {/* What's real today */}
      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-8">{c.real_title}</h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <ul className="space-y-3.5">
              {c.real_points.map((p) => (
                <Check key={p}>{p}</Check>
              ))}
            </ul>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
              {c.pricing_title}
            </p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">{c.pricing_note}</p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-teal-700 to-teal-900" />
        <div className="absolute -bottom-32 -right-16 -z-10 w-96 h-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">{c.cta_title}</h2>
          <p className="text-sm text-teal-200 mb-8">{c.cta_sub}</p>
          <a
            href={mailHref}
            className="inline-block px-8 py-3 bg-white text-teal-800 text-sm font-semibold rounded-xl hover:bg-teal-50 transition-all hover:shadow-lg hover:-translate-y-0.5 shadow-lg shadow-teal-900/30"
          >
            {c.cta_button}
          </a>
          <p className="mt-3 text-xs text-teal-200/80">{c.cta_hint}</p>

          <p className="mt-10 text-xs text-teal-300/80">
            {c.cta_secondary_pre}{" "}
            <Link href="/" className="underline hover:text-white transition-colors">
              {c.cta_secondary_link}
            </Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-center">
          <span className="text-xs text-gray-300">{c.footer_copy}</span>
        </div>
      </footer>
    </div>
  );
}
