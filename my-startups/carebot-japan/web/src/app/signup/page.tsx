// Force dynamic rendering: see login/page.tsx for why this route can't be
// statically cached without leaking one visitor's auth redirect to another.
export const dynamic = "force-dynamic";

import SignupClient from "./SignupClient";

export default function SignupPage() {
  return <SignupClient />;
}
