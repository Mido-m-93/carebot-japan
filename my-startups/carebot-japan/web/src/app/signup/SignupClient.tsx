"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SignupClient() {
  const router = useRouter();
  const { lang, toggle, t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t.signup_error_weak);
      return;
    }
    if (password !== confirm) {
      setError(t.signup_error_mismatch);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Sign in immediately after signup (works whether email confirmation is on or off)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      // Signup worked but confirmation is required — tell the user clearly
      setError("Account created! Please check your email to confirm before signing in.");
      setLoading(false);
    } else {
      router.refresh();
      router.push("/onboarding");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <p className="font-semibold text-teal-800 text-lg">CareBot Japan</p>
          <p className="text-xs text-gray-400 mt-1">Clinic Scheduling Dashboard</p>
        </div>

        <form
          onSubmit={handleSignup}
          className="bg-white rounded-2xl border border-gray-200 p-7 shadow-sm"
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-base font-semibold text-gray-900 mb-1">{t.signup_title}</h1>
              <p className="text-xs text-gray-400">{t.signup_subtitle}</p>
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

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t.signup_email}
            </label>
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

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t.signup_password}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t.signup_confirm}
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
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
            {loading ? t.signup_loading : t.signup_submit}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          {t.signup_signin_link}{" "}
          <Link href="/login" className="text-teal-600 hover:text-teal-800 transition-colors">
            {t.signup_signin_cta}
          </Link>
        </p>
      </div>
    </div>
  );
}
