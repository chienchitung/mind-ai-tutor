'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'zh-TW';

const LANGUAGE_STORAGE_KEY = 'mind-ai-tutor-language';

function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'zh-TW';
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('zh-TW');

  // Restore the saved preference after mount (not during initial render) so the
  // server-rendered markup and the first client render still match, avoiding a
  // hydration mismatch.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isLanguage(stored)) {
        setLanguageState(stored);
      }
    } catch {
      // localStorage can throw (e.g. private browsing) - just keep the default.
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore write failures; the in-memory language still updates for this session.
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
} 