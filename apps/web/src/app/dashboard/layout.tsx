"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
    { href: "/dashboard/fax", label: t.nav_fax },
    { href: "/dashboard/claims", label: t.nav_claims },
    { href: "/dashboard/test", label: t.nav_test },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (checking) return null;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-teal-800 text-teal-50 flex flex-col">
        <div className="px-5 py-5 border-b border-teal-600">
          <p className="font-semibold text-sm tracking-wide">CareBot Japan</p>
          <p className="text-xs text-teal-200 mt-0.5">{t.nav_clinic}</p>
        </div>
        <nav className="flex-1 py-4">
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
          <p className="text-xs text-teal-400">MVP v0.1</p>
          {/* Language toggle */}
          <button
            onClick={toggle}
            className="w-full text-left text-xs text-teal-300 hover:text-white transition-colors py-1 flex items-center gap-2"
          >
            <span className="text-base leading-none">{lang === "en" ? "🇯🇵" : "🇬🇧"}</span>
            <span>{lang === "en" ? "日本語に切替" : "Switch to English"}</span>
          </button>
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
