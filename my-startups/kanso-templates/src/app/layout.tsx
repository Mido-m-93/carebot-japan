import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanso Templates – Minimalist Japan Travel Planners",
  description:
    "Minimalist Japan travel planning templates. Clean, minimal PDF and Notion templates for your Japan journey. No fluff, just clarity.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-6 py-5 flex items-center">
            <a href="/" className="text-lg font-semibold tracking-wide text-gray-800 hover:text-gray-600 transition-colors">
              Kanso Templates
            </a>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
