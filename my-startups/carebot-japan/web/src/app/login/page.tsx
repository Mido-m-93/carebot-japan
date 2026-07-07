"use client";
import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, toggle, t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [view, setView] = useState<"login" | "forgot">("login");
  const [actionEmail, setActionEmail] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<"idle" | "success" | "error">("idle");

  // TEMPORARY debug panel for diagnosing the login freeze. Remove once resolved.
  const [debugSteps, setDebugSteps] = useState<string[]>([]);
  function logStep(msg: string) {
    setDebugSteps((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);
  }

  useEffect(() => {
    if (searchParams.get("error") === "confirmation_failed") {
      setError("Confirmation link is invalid or has expired. Please ask your admin to resend.");
    }
    if (searchParams.get("confirmed") === "1") {
      setNotice("Email confirmed! You can now sign in.");
    }
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    setDebugSteps([]);
    logStep("Form submitted");
    try {
      logStep("Calling supabase.auth.signInWithPassword...");
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timed out after 8s waiting for Supabase")), 8000)
      );
      const { error: signInError } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeout,
      ]) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
      logStep("Got a response back from Supabase");
      if (signInError) {
        logStep(`Error from Supabase: ${signInError.message}`);
        setError(signInError.message);
        setLoading(false);
      } else {
        logStep("Success — redirecting to /dashboard");
        router.push("/dashboard");
      }
    } catch (err) {
      logStep(`Caught exception: ${err instanceof Error ? err.message : String(err)}`);
      console.error("Login error:", err);
      setError("Unexpected error. Please try again.");
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setActionStatus("idle");
    const { error } = await supabase.auth.resetPasswordForEmail(actionEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setActionLoading(false);
    setActionStatus(error ? "error" : "success");
  }

  const langToggle = (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-teal-400 hover:text-teal-700 transition-colors mt-0.5"
    >
      <span className="text-sm leading-none">{lang === "en" ? "🇯🇵" : "🇬🇧"}</span>
      <span>{lang === "en" ? "日本語" : "English"}</span>
      <span className="text-gray-300">▾</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <p className="font-semibold text-teal-800 text-lg">CareBot Japan</p>
          <p className="text-xs text-gray-400 mt-1">Clinic Scheduling Dashboard</p>
        </div>

        {/* ── Sign in form ── */}
        {view === "login" && (
          <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-gray-200 p-7 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-base font-semibold text-gray-900 mb-1">{t.login_title}</h1>
                <p className="text-xs text-gray-400">{t.login_subtitle}</p>
              </div>
              {langToggle}
            </div>

            {notice && (
              <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
                <p className="text-xs text-teal-700">{notice}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t.login_email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="clinic@example.com"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              />
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-600">{t.login_password}</label>
                <button
                  type="button"
                  onClick={() => { setView("forgot"); setActionEmail(email); setActionStatus("idle"); }}
                  className="text-xs text-teal-600 hover:text-teal-800 transition-colors"
                >
                  {t.login_forgot_link}
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              />
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
              {loading ? t.login_loading : t.login_submit}
            </button>
          </form>
        )}

        {/* ── Forgot password form ── */}
        {view === "forgot" && (
          <form onSubmit={handleForgot} className="bg-white rounded-2xl border border-gray-200 p-7 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-base font-semibold text-gray-900 mb-1">{t.login_forgot_label}</h1>
                <p className="text-xs text-gray-400">{t.login_forgot_link}</p>
              </div>
              {langToggle}
            </div>

            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t.login_email}</label>
              <input
                type="email"
                value={actionEmail}
                onChange={(e) => setActionEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="clinic@example.com"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              />
            </div>

            {actionStatus === "success" && (
              <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
                <p className="text-xs text-teal-700">{t.login_forgot_success}</p>
              </div>
            )}
            {actionStatus === "error" && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-xs text-red-600">{t.login_forgot_error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={actionLoading || actionStatus === "success"}
              className="w-full py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? t.login_forgot_sending : t.login_forgot_submit}
            </button>

            <button
              type="button"
              onClick={() => { setView("login"); setActionStatus("idle"); }}
              className="w-full mt-3 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← {t.login_title}
            </button>
          </form>
        )}

        {/* Bottom links */}
        {view === "login" && (
          <p className="mt-4 text-center text-xs text-gray-400">
            {t.login_signup_link}{" "}
            <Link href="/signup" className="text-teal-600 hover:text-teal-800 transition-colors">
              {t.login_signup_cta}
            </Link>
          </p>
        )}

        {/* TEMPORARY debug panel — remove once the login freeze is diagnosed */}
        {debugSteps.length > 0 && (
          <pre className="mt-4 bg-gray-900 text-green-400 text-[11px] rounded-lg p-3 whitespace-pre-wrap break-words">
            {debugSteps.join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}
