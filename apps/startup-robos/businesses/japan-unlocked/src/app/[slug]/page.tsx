import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllSlugs,
  getArticleBySlug,
  AFFILIATE_LINKS,
  CATEGORIES,
} from "@/lib/articles";

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    openGraph: {
      title: article.title,
      description: article.description,
      url: `https://japanunlocked.com/${article.slug}`,
      type: "article",
      publishedTime: article.publishDate,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
    },
  };
}

function FaqSchema({ items }: { items: { question: string; answer: string }[] }) {
  if (!items.length) return null;
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function ArticleSchema({ article }: { article: Awaited<ReturnType<typeof getArticleBySlug>> }) {
  if (!article) return null;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.publishDate,
    author: { "@type": "Organization", name: "JapanUnlocked" },
    publisher: {
      "@type": "Organization",
      name: "JapanUnlocked",
      url: "https://japanunlocked.com",
    },
    url: `https://japanunlocked.com/${article.slug}`,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function AffiliateCTA({ providers }: { providers: string[] }) {
  if (!providers.length) return null;
  const links = providers.filter((p) => AFFILIATE_LINKS[p]);
  if (!links.length) return null;

  const labelMap: Record<string, string> = {
    airalo: "Get Airalo Japan eSIM",
    saily: "Browse Saily Japan plans",
    holafly: "See Holafly unlimited plans",
    klook: "Book on Klook",
    "jr-pass": "Buy a JR Pass",
    "jr-pass-resellers": "Buy a JR Pass",
    "kanso-templates": "Get free Japan templates",
  };

  return (
    <aside className="my-10 border border-[var(--accent)] bg-[#fff8f5] px-6 py-6 rounded-sm">
      <p className="text-[0.6875rem] font-sans uppercase tracking-[0.15em] text-[var(--accent)] mb-3">
        Recommended resources
      </p>
      <div className="flex flex-wrap gap-3">
        {links.map((provider) => (
          <a
            key={provider}
            href={`/go/${provider}`}
            className="inline-flex items-center gap-1.5 bg-[var(--accent)] text-white font-semibold text-sm px-4 py-2 rounded hover:bg-[#c44e1a] transition-colors"
          >
            {labelMap[provider] ?? provider}
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M3 6.5h7M7.5 4l2.5 2.5-2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ))}
      </div>
      <p className="text-xs text-[var(--muted)] mt-3">
        Affiliate links — they cost you nothing extra, and help keep this site running.
      </p>
    </aside>
  );
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticleBySlug(params.slug);
  if (!article) notFound();

  return (
    <>
      <FaqSchema items={article.faqItems} />
      <ArticleSchema article={article} />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <div className="flex gap-12">
          {/* Aesthetic risk: vertical Japanese text in the margin */}
          <div className="hidden lg:flex flex-col items-center pt-2 select-none" aria-hidden="true">
            <div
              className="jp-accent-text"
              style={{ height: "200px", color: "var(--border)" }}
            >
              {article.category === "connectivity"
                ? "通信接続"
                : article.category === "transportation"
                ? "交通移動"
                : article.category === "accommodation"
                ? "宿泊施設"
                : article.category === "attractions"
                ? "観光名所"
                : "旅行案内"}
            </div>
            <div
              style={{
                width: "1px",
                flex: 1,
                background: "var(--border)",
                marginTop: "8px",
              }}
            />
          </div>

          {/* Article content */}
          <article className="flex-1 min-w-0 max-w-prose">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <li>
                  <a href="/" className="hover:text-[var(--text)] transition-colors">
                    Guides
                  </a>
                </li>
                <li aria-hidden="true">/</li>
                {article.category && (
                  <>
                    <li>{CATEGORIES[article.category] ?? article.category}</li>
                    <li aria-hidden="true">/</li>
                  </>
                )}
                <li className="text-[var(--text)] font-medium truncate max-w-[200px]">
                  {article.title}
                </li>
              </ol>
            </nav>

            {/* Header */}
            <header className="mb-8 pb-8 border-b border-[var(--border)]">
              {article.category && (
                <span className="inline-block text-[0.6875rem] font-medium font-sans uppercase tracking-widest text-[var(--accent)] border border-[var(--accent)] px-2 py-0.5 rounded-sm mb-4">
                  {CATEGORIES[article.category] ?? article.category}
                </span>
              )}
              <h1
                className="font-serif font-bold text-[var(--text)] leading-[1.1] mb-4"
                style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.02em" }}
              >
                {article.title}
              </h1>
              <p className="text-[var(--muted)] text-lg leading-relaxed mb-4">
                {article.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
                {article.publishDate && (
                  <time dateTime={article.publishDate}>
                    {new Date(article.publishDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                )}
                {article.wordCount && (
                  <span>{Math.ceil(article.wordCount / 200)} min read</span>
                )}
              </div>
            </header>

            {/* Affiliate CTA — above the fold */}
            {article.affiliate && article.affiliate.length > 0 && (
              <AffiliateCTA providers={article.affiliate} />
            )}

            {/* Body */}
            <div
              className="article-body fade-in"
              dangerouslySetInnerHTML={{ __html: article.contentHtml }}
            />

            {/* Affiliate CTA — below article */}
            {article.affiliate && article.affiliate.length > 0 && (
              <AffiliateCTA providers={article.affiliate} />
            )}

            {/* FAQ summary (visible) */}
            {article.faqItems.length > 0 && (
              <section className="mt-10 border-t border-[var(--border)] pt-8">
                <h2 className="font-serif font-bold text-xl mb-6" style={{ letterSpacing: "-0.015em" }}>
                  Quick answers
                </h2>
                <dl className="flex flex-col gap-5">
                  {article.faqItems.map((item, i) => (
                    <div key={i} className="border-l-2 border-[var(--accent)] pl-4">
                      <dt className="font-semibold text-[var(--text)] mb-1 font-sans text-sm">
                        {item.question}
                      </dt>
                      <dd className="text-[var(--muted)] text-sm leading-relaxed">
                        {item.answer}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {/* Kanso Templates crosslink */}
            <div className="mt-12 bg-[var(--surface-warm)] border border-[var(--border)] px-6 py-6">
              <p className="text-[0.6875rem] font-sans uppercase tracking-[0.15em] text-[var(--muted)] mb-2">
                Planning your trip
              </p>
              <p className="font-serif font-semibold text-[var(--text)] mb-2">
                Use our free Notion templates to plan this trip
              </p>
              <p className="text-sm text-[var(--muted)] mb-4">
                Itinerary planner, packing list, and JR Pass calculator — ready to use, no setup required.
              </p>
              <a
                href="/go/kanso-templates"
                className="inline-flex items-center gap-1.5 text-[var(--accent)] font-semibold text-sm hover:underline underline-offset-4"
              >
                Get the free templates →
              </a>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
