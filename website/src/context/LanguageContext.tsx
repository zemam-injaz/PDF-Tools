import { createContext, useContext, useState, useEffect } from "react";
import { Language, translations } from "@/data/translations";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;
  isRtl: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("ar");

  const t = translations[language];
  const isRtl = language === "ar";

  useEffect(() => {
    const savedLang = localStorage.getItem("warraq_language") as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = language;
    localStorage.setItem("warraq_language", language);
  }, [isRtl, language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
