import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About JapanUnlocked",
  description:
    "JapanUnlocked is written by an English speaker living in Tokyo — practical Japan travel guides with no fluff, no stock photos, and no AI-generated advice.",
  openGraph: {
    title: "About JapanUnlocked",
    description:
      "JapanUnlocked is written by an English speaker living in Tokyo — practical Japan travel guides with no fluff.",
    url: "https://japanunlocked.com/about",
  },
};

export default function AboutPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-14 sm:py-20">
      <div className="max-w-prose">
        <p className="text-[0.6875rem] font-sans uppercase tracking-[0.15em] text-[var(--accent)] mb-4">
          About this site
        </p>
        <h1
          className="font-serif font-bold text-[var(--text)] leading-[1.1] mb-6"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.02em" }}
        >
          Written by someone who actually lives here
        </h1>
        <div className="article-body">
          <p>
            JapanUnlocked is a Japan travel guide written by an English speaker based in Tokyo.
            Every guide on this site covers a question I either had before moving here, or watched
            dozens of tourists wrestle with after they arrived — the right Shinkansen to take,
            which eSIM actually works in rural areas, whether the JR Pass is worth it for your
            specific itinerary. The answers are based on real use, not aggregated forum opinions
            or press-trip experiences. Where this site links to a product or service, it is
            because that product is genuinely the one I would recommend to a friend visiting Japan
            for the first time — not because the commission rate is favorable.
          </p>
          <p>
            Some links on this site are affiliate links. If you buy something through one of them,
            JapanUnlocked earns a small commission at no extra cost to you. That revenue is what
            keeps the guides free, up to date, and unsponsored.
          </p>
          <p>
            If you have a question that is not covered here, or spot something that has changed
            since a guide was published, the contact email is on the footer. Japan updates things
            — transit rules, ticket prices, attraction hours — constantly. Getting the facts right
            matters more than publishing fast.
          </p>
        </div>

        <div className="mt-10 pt-8 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--muted)] mb-4">
            Looking for a place to start?
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/best-esim-japan-2026"
              className="text-sm font-medium text-[var(--accent)] hover:underline underline-offset-4"
            >
              Best eSIM for Japan →
            </a>
            <a
              href="/tokyo-to-kyoto-shinkansen-guide"
              className="text-sm font-medium text-[var(--accent)] hover:underline underline-offset-4"
            >
              Tokyo to Kyoto by Shinkansen →
            </a>
            <a
              href="/go/kanso-templates"
              className="text-sm font-medium text-[var(--accent)] hover:underline underline-offset-4"
            >
              Free Japan trip templates →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
