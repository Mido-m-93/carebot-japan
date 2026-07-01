import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JapanUnlocked – Your English Guide to Japan",
  description:
    "JapanUnlocked helps English speakers navigate Japan with confidence. Practical guides on transport, connectivity, accommodation, and travel planning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <header className="bg-gray-900 text-white">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-bold tracking-tight hover:text-gray-200 transition-colors">
              JapanUnlocked
            </a>
            <nav className="flex gap-6 text-sm font-medium">
              <a href="/" className="hover:text-gray-200 transition-colors">
                Home
              </a>
              <a href="/blog" className="hover:text-gray-200 transition-colors">
                Blog
              </a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
