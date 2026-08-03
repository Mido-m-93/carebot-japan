"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { ClinicProvider, useClinicContext } from "@/contexts/ClinicContext";

export default function DashboardLayoutClient({ children }: { children: ReactNode }) {
  const router = useRouter();
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

  if (checking) return null;

  return (
    <ClinicProvider>
      <DashboardShell>{children}</DashboardShell>
    </ClinicProvider>
  );
}

function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, toggle, t } = useLanguage();
  const { locations, activeClinicId, setActiveClinicId, loading: clinicLoading } = useClinicContext();
  const activeClinic = locations.find((loc) => loc.clinic_id === activeClinicId);
  const bookingSlug = activeClinic?.slug ?? null;
  const brandName = activeClinic
    ? (lang === "ja" ? activeClinic.name_jp || activeClinic.name : activeClinic.name)
    : "CareBot Japan";

  const navItems = [
    { href: "/dashboard", label: t.nav_overview },
    { href: "/dashboard/appointments", label: t.nav_appointments },
    { href: "/dashboard/review", label: t.nav_review },
    { href: "/dashboard/claims", label: t.nav_claims },
    { href: "/dashboard/activity", label: t.nav_activity },
    { href: "/dashboard/locations", label: t.nav_locations },
    { href: "/dashboard/test", label: t.nav_test },
    { href: "/dashboard/billing", label: t.nav_billing },
    { href: "/dashboard/settings", label: t.nav_settings },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Wait for the clinic context's first fetch so every page under it sends
  // the right X-Clinic-Id from the very first render, instead of racing ahead
  // with no location selected.
  if (clinicLoading) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-teal-800 text-teal-50 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-teal-600">
          <p className="font-semibold text-sm tracking-wide">{brandName}</p>
          {locations.length > 1 ? (
            <select
              value={activeClinicId ?? ""}
              onChange={(e) => setActiveClinicId(e.target.value)}
              className="mt-1.5 w-full text-xs bg-teal-700 text-teal-100 border border-teal-600 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400"
            >
              {locations.map((loc) => (
                <option key={loc.clinic_id} value={loc.clinic_id}>
                  {lang === "ja" ? loc.name_jp || loc.name : loc.name}
                </option>
              ))}
            </select>
          ) : null}
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
          {bookingSlug && (
            <div className="mx-4 mt-3 border-t border-teal-700 pt-3">
              <Link
                href={`/book/${bookingSlug}`}
                target="_blank"
                className="flex items-center justify-between px-3 py-2 text-xs text-teal-300 bg-teal-700 rounded-lg hover:bg-teal-600 transition-colors"
              >
                <span>{lang === "ja" ? "予約フォームを開く" : "Patient Booking Form"}</span>
                <span className="text-teal-400">↗</span>
              </Link>
            </div>
          )}
        </nav>
        <div className="px-5 py-4 border-t border-teal-600 flex items-center justify-between">
          <button
            onClick={handleLogout}
            className="text-xs text-teal-300 hover:text-white transition-colors"
          >
            {t.nav_signout}
          </button>
          {/* Language toggle */}
          <button
            onClick={toggle}
            className="text-xs font-semibold text-teal-200 hover:text-white border border-teal-600 hover:border-teal-400 rounded px-1.5 py-0.5 transition-colors"
            title={lang === "en" ? "日本語に切替" : "Switch to English"}
          >
            {lang === "en" ? "日本語" : "EN"}
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
