// Force dynamic rendering: this route is gated by middleware's per-request
// session check, and a statically-cached page would let Vercel's CDN serve
// one visitor's auth redirect to every other visitor (see middleware.ts).
export const dynamic = "force-dynamic";

import LoginClient from "./LoginClient";

export default function LoginPage() {
  return <LoginClient />;
}
