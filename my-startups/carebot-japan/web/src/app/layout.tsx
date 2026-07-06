import "./globals.css";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
