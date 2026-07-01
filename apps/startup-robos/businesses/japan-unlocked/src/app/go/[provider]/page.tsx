import { redirect } from "next/navigation";
import { AFFILIATE_LINKS } from "@/lib/articles";

interface Props {
  params: { provider: string };
}

export async function generateStaticParams() {
  return Object.keys(AFFILIATE_LINKS).map((provider) => ({ provider }));
}

export default function GoPage({ params }: Props) {
  const url = AFFILIATE_LINKS[params.provider];
  if (url) {
    redirect(url);
  }

  // Fallback for unknown providers — shown briefly before redirect
  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-20 text-center">
      <p className="text-[var(--muted)] text-sm">
        Redirecting... if nothing happens,{" "}
        <a href="/" className="text-[var(--accent)] underline underline-offset-4">
          return to the guides
        </a>
        .
      </p>
    </div>
  );
}
