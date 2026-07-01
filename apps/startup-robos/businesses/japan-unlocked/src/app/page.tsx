import type { Metadata } from "next";
import { getArticleStubs, CATEGORIES } from "@/lib/articles";
import type { ArticleStub } from "@/lib/articles";

export const metadata: Metadata = {
  title: "JapanUnlocked — Practical Travel Guides for Japan",
  description:
    "Transit passes, eSIMs, day trips, and accommodation — honest guides for traveling Japan, written by someone who lives there.",
  openGraph: {
    title: "JapanUnlocked — Practical Travel Guides for Japan",
    description:
      "Transit passes, eSIMs, day trips, and accommodation — honest guides for traveling Japan, written by someone who lives there.",
    url: "https://japanunlocked.com",
  },
};

function CategoryBadge({ category }: { category?: string }) {
  if (!category) return null;
  return (
    <span className="inline-block text-[0.6875rem] font-medium font-sans uppercase tracking-widest text-[var(--accent)] border border-[var(--accent)] px-2 py-0.5 rounded-sm">
      {CATEGORIES[category] ?? category}
    </span>
  );
}

function ArticleCard({ article, featured = false }: { article: ArticleStub; featured?: boolean }) {
  return (
    <a
      href={`/${article.slug}`}
      className={`group block border border-[var(--border)] bg-white hover:border-[var(--accent)] transition-colors duration-200 ${
        featured ? "p-7 sm:p-8" : "p-5 sm:p-6"
      }`}
    >
      <div className="flex flex-col gap-3">
        <CategoryBadge category={article.category} />
        <h2
          className={`font-serif font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors leading-snug ${
            featured ? "text-[1.625rem]" : "text-[1.1875rem]"
          }`}
          style={{ letterSpacing: "-0.015em" }}
        >
          {article.title}
        </h2>
        <p className="text-[var(--muted)] text-sm leading-relaxed">{article.excerpt}</p>
        {article.publishDate && (
          <time
            className="text-[0.75rem] text-[var(--muted)] font-sans mt-1"
            dateTime={article.publishDate}
          >
            {new Date(article.publishDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        )}
        <span className="text-[0.8125rem] font-medium text-[var(--accent)] flex items-center gap-1 mt-1">
          Read guide
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </a>
  );
}

function KansoCTA() {
  return (
    <section className="my-16 bg-[var(--accent-navy)] text-white px-8 py-10 sm:py-12 sm:px-12 max-w-[1200px] mx-auto relative overflow-hidden">
      {/* Decorative vertical Japanese text — aesthetic risk element */}
      <span
        className="jp-accent-text absolute right-6 top-1/2 -translate-y-1/2 text-white"
        aria-hidden="true"
      >
        旅の計画を立てよう
      </span>
      <div className="max-w-xl relative">
        <p className="text-[0.6875rem] font-sans uppercase tracking-[0.15em] text-blue-300 mb-3">
          Free resource from Kanso Templates
        </p>
        <h2 className="font-serif text-[1.75rem] font-bold leading-snug mb-3" style={{ letterSpacing: "-0.015em" }}>
          Japan travel templates that actually save time
        </h2>
        <p className="text-blue-100 text-sm leading-relaxed mb-6">
          Packing checklists, itinerary planners, and a JR Pass cost calculator —
          Notion templates built for people planning a Japan trip, not people who like fiddling with Notion.
        </p>
        <a
          href="/go/kanso-templates"
          className="inline-flex items-center gap-2 bg-[var(--accent)] text-white font-semibold text-sm px-5 py-2.5 rounded hover:bg-[#c44e1a] transition-colors"
        >
          Get the free templates
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </section>
  );
}

export default function HomePage() {
  const articles = getArticleStubs();
  const featured = articles.slice(0, 2);
  const rest = articles.slice(2);

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-[var(--border)] bg-white">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-14 sm:py-20">
          <div className="flex flex-col gap-5 max-w-2xl">
            <p className="text-[0.6875rem] font-sans uppercase tracking-[0.15em] text-[var(--accent)]">
              Japan travel guides
            </p>
            <h1
              className="font-serif font-bold text-[var(--text)] leading-[1.08]"
              style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", letterSpacing: "-0.025em" }}
            >
              Japan, explained for people who actually want to go.
            </h1>
            <p className="text-[var(--muted)] text-lg leading-relaxed max-w-xl">
              No fluff, no stock photography captions. Transit passes, connectivity,
              day trips — practical answers from someone who took the same trips
              you are planning, and lives here now.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <a
                href="#guides"
                className="bg-[var(--text)] text-white font-semibold text-sm px-5 py-2.5 rounded hover:bg-[#333] transition-colors"
              >
                Browse all guides
              </a>
              <a
                href="/go/airalo"
                className="text-sm font-medium text-[var(--accent)] hover:underline underline-offset-4"
              >
                Best eSIM for Japan →
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
        {/* Featured articles */}
        {featured.length > 0 && (
          <section className="mt-12" aria-label="Featured guides">
            <p className="text-[0.6875rem] font-sans uppercase tracking-[0.15em] text-[var(--muted)] mb-4">
              Most read this month
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {featured.map((article) => (
                <ArticleCard key={article.slug} article={article} featured />
              ))}
            </div>
          </section>
        )}

        {/* All guides grid */}
        {rest.length > 0 && (
          <section id="guides" className="mt-12" aria-label="All guides">
            <p className="text-[0.6875rem] font-sans uppercase tracking-[0.15em] text-[var(--muted)] mb-4">
              All guides
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {rest.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Kanso CTA */}
      <div className="px-5 sm:px-8">
        <KansoCTA />
      </div>
    </div>
  );
}
