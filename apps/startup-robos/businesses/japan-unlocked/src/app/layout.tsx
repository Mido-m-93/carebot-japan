import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://japanunlocked.com"),
  title: {
    default: "JapanUnlocked — Practical Travel Guides for Japan",
    template: "%s | JapanUnlocked",
  },
  description:
    "Honest, practical guides for traveling Japan — transit passes, eSIMs, day trips, and more. Written by an English speaker living in Japan.",
  keywords: ["japan travel", "japan guide", "shinkansen", "jr pass", "esim japan", "japan tips"],
  authors: [{ name: "JapanUnlocked" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://japanunlocked.com",
    siteName: "JapanUnlocked",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "JapanUnlocked — Practical Travel Guides for Japan",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@japanunlocked",
  },
  robots: {
    index: true,
    follow: true,
  },
};

function Header() {
  return (
    <header className="border-b border-[var(--border)] bg-white sticky top-0 z-40">
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 flex items-center justify-between h-14">
        <a href="/" className="flex items-center gap-2 group">
          <span
            className="text-[var(--accent)] font-serif font-bold text-xl tracking-tight"
            aria-hidden="true"
          >
            日
          </span>
          <span className="font-serif font-bold text-[1.0625rem] tracking-tight text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
            JapanUnlocked
          </span>
        </a>
        <nav aria-label="Main navigation">
          <ul className="flex items-center gap-6 text-sm font-medium text-[var(--muted)]">
            <li>
              <a href="/" className="hover:text-[var(--text)] transition-colors">
                Guides
              </a>
            </li>
            <li>
              <a href="/about" className="hover:text-[var(--text)] transition-colors">
                About
              </a>
            </li>
            <li>
              <a
                href="/go/kanso-templates"
                className="bg-[var(--accent)] text-white px-3.5 py-1.5 rounded text-[0.8125rem] font-semibold hover:bg-[#c44e1a] transition-colors"
              >
                Free Japan Templates
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--border)] mt-20 py-10 bg-[var(--surface-warm)]">
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[var(--accent)] font-serif font-bold text-lg" aria-hidden="true">日</span>
              <span className="font-serif font-bold text-[var(--text)]">JapanUnlocked</span>
            </div>
            <p className="text-xs text-[var(--muted)] max-w-xs">
              Practical guides for Japan travel, written by an English speaker living in Tokyo.
              Some links are affiliate links — they cost you nothing extra.
            </p>
          </div>
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
              <li><a href="/" className="hover:text-[var(--text)] transition-colors">Guides</a></li>
              <li><a href="/about" className="hover:text-[var(--text)] transition-colors">About</a></li>
              <li><a href="/go/kanso-templates" className="hover:text-[var(--text)] transition-colors">Kanso Templates</a></li>
            </ul>
          </nav>
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--border)] text-xs text-[var(--muted)]">
          &copy; {year} JapanUnlocked. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
