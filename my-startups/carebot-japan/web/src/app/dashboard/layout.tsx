import type { ReactNode } from "react";
import DashboardLayoutClient from "./DashboardLayoutClient";

// Force dynamic rendering for this whole segment: see login/page.tsx for why
// these auth-gated routes can't be statically cached without leaking one
// visitor's session-guarded content to another.
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
