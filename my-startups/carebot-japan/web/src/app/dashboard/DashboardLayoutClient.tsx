"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DashboardLayoutClient({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, toggle, t } = useLanguage();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  const navItems = [
    { href: "/dashboard", label: t.nav_overview },
    { href: "/dashboard/appointments", label: t.nav_appointments },
    { href: "/dashboard/review", label: t.nav_review },
    { href: "/dashboard/claims", label: t.nav_claims },
    { href: "/dashboard/test", label: t.nav_test },
    { href: "/dashboard/billing", label: t.nav_billing },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (checking) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-teal-800 text-teal-50 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-teal-600">
          <p className="font-semibold text-sm tracking-wide">CareBot Japan</p>
          <p className="text-xs text-teal-200 mt-0.5">{t.nav_clinic}</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          {navItems.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-5 py-3 text-sm transition-colors ${
                  active
                    ? "bg-teal-700 border-l-2 border-teal-300"
                    : "hover:bg-teal-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="mx-4 mt-3 border-t border-teal-700 pt-3">
            <Link
              href="/book"
              target="_blank"
              className="flex items-center justify-between px-3 py-2 text-xs text-teal-300 bg-teal-700 rounded-lg hover:bg-teal-600 transition-colors"
            >
              <span>{lang === "ja" ? "予約フォームを開く" : "Patient Booking Form"}</span>
              <span className="text-teal-400">↗</span>
            </Link>
          </div>
        </nav>
        <div className="px-5 py-4 border-t border-teal-600 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-teal-400">MVP v0.1</p>
            {/* Language toggle */}
            <button
              onClick={toggle}
              className="text-xs font-semibold text-teal-200 hover:text-white border border-teal-600 hover:border-teal-400 rounded px-1.5 py-0.5 transition-colors"
              title={lang === "en" ? "日本語に切替" : "Switch to English"}
            >
              {lang === "en" ? "日本語" : "EN"}
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-teal-300 hover:text-white transition-colors py-1"
          >
            {t.nav_signout}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
