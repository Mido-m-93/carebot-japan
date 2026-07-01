"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { Lang, T, translations } from "@/lib/i18n";

interface LanguageContextValue {
  lang: Lang;
  toggle: () => void;
  t: T;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  toggle: () => {},
  t: translations.en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("carebot_lang") as Lang | null;
    if (saved === "en" || saved === "ja") setLang(saved);
  }, []);

  function toggle() {
    setLang((prev) => {
      const next = prev === "en" ? "ja" : "en";
      localStorage.setItem("carebot_lang", next);
      return next;
    });
  }

  return (
    <LanguageContext.Provider value={{ lang, toggle, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
