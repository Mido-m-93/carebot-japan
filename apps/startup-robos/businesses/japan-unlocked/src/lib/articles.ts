import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkHtml from "remark-html";

const contentDir = path.join(process.cwd(), "content");

export interface ArticleFrontmatter {
  title: string;
  slug: string;
  description: string;
  keywords?: string[];
  category?: string;
  affiliate?: string[];
  wordCount?: number;
  status?: string;
  publishDate?: string;
}

export interface Article extends ArticleFrontmatter {
  contentHtml: string;
  excerpt: string;
  faqItems: { question: string; answer: string }[];
}

export interface ArticleStub extends ArticleFrontmatter {
  excerpt: string;
}

function extractExcerpt(rawContent: string, maxLen = 160): string {
  // Strip markdown syntax, get first paragraph text
  const plain = rawContent
    .replace(/^#{1,6}\s+.+$/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\|.+\|$/gm, "")
    .replace(/^---$/gm, "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30)[0] ?? "";

  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + "…" : plain;
}

function extractFaqItems(
  rawContent: string
): { question: string; answer: string }[] {
  const items: { question: string; answer: string }[] = [];

  // Look for ## Frequently Asked Questions or ## FAQ section
  const faqSectionMatch = rawContent.match(
    /##\s+(?:Frequently Asked Questions|FAQ)\s*\n([\s\S]*?)(?=\n##\s|\n---|\s*$)/i
  );
  if (!faqSectionMatch) return items;

  const faqSection = faqSectionMatch[1];
  // Bold questions followed by paragraph answers
  const qaPairRegex = /\*\*(.+?)\*\*\s*\n([\s\S]+?)(?=\n\*\*|\n##|\n---|\s*$)/g;
  let match;
  while ((match = qaPairRegex.exec(faqSection)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim().replace(/\n/g, " ");
    if (question && answer) {
      items.push({ question, answer });
    }
  }
  return items;
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(contentDir)) return [];
  return fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export function getArticleStubs(): ArticleStub[] {
  return getAllSlugs()
    .map((slug) => {
      const filePath = path.join(contentDir, `${slug}.md`);
      const fileContents = fs.readFileSync(filePath, "utf8");
      const { data, content } = matter(fileContents);
      // gray-matter parses YAML dates as JS Date objects; normalize to ISO string
      const publishDate = data.publishDate
        ? data.publishDate instanceof Date
          ? data.publishDate.toISOString().slice(0, 10)
          : String(data.publishDate)
        : undefined;
      return {
        ...(data as ArticleFrontmatter),
        slug: data.slug ?? slug,
        publishDate,
        excerpt: data.description ?? extractExcerpt(content),
      };
    })
    .sort((a, b) => {
      const da = a.publishDate ?? "";
      const db = b.publishDate ?? "";
      return db > da ? 1 : db < da ? -1 : 0;
    });
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const filePath = path.join(contentDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const fileContents = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(fileContents);

  const processed = await remark().use(remarkHtml).process(content);
  const contentHtml = processed.toString();

  const publishDate = data.publishDate
    ? data.publishDate instanceof Date
      ? data.publishDate.toISOString().slice(0, 10)
      : String(data.publishDate)
    : undefined;

  return {
    ...(data as ArticleFrontmatter),
    slug: data.slug ?? slug,
    publishDate,
    excerpt: data.description ?? extractExcerpt(content),
    contentHtml,
    faqItems: extractFaqItems(content),
  };
}

export const AFFILIATE_LINKS: Record<string, string> = {
  airalo: "https://www.airalo.com/?referral_code=JAPANUNLOCKED",
  saily: "https://saily.com/?ref=japanunlocked",
  holafly: "https://esim.holafly.com/?referral=JAPANUNLOCKED",
  klook: "https://www.klook.com/?aid=japanunlocked",
  "jr-pass": "https://www.jrpass.com/?affiliate=japanunlocked",
  "jr-pass-resellers": "https://www.jrpass.com/?affiliate=japanunlocked",
  "kanso-templates": "https://kanso.gumroad.com/",
};

export const CATEGORIES: Record<string, string> = {
  connectivity: "Connectivity",
  transportation: "Transportation",
  accommodation: "Accommodation",
  attractions: "Attractions",
  planning: "Planning",
};
