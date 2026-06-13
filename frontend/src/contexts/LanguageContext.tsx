import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Language } from '@/types';
import { translations, type TranslationKey } from '@/constants/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (l: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageFn] = useState<Language>(() => {
    const saved = localStorage.getItem('mostajir_lang');
    return (saved as Language) || 'ar';
  });

  const setLanguage = useCallback((l: Language) => {
    setLanguageFn(l);
    localStorage.setItem('mostajir_lang', l);
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = l;
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[language][key] ?? translations.en[key] ?? key;
  }, [language]);

  const isRTL = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL, dir: isRTL ? 'rtl' : 'ltr' }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
