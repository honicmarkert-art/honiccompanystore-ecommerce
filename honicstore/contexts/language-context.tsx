"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'en' | 'sw'

/** Site default; only this key is read/written (legacy `preferred-language` is ignored so English is the default for all pages). */
const LANGUAGE_STORAGE_KEY = 'honicstore-ui-language'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  // Load saved choice from storage; missing/invalid → English (default site-wide)
  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null
    const next: Language = saved === 'en' || saved === 'sw' ? saved : 'en'
    setLanguageState(next)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    document.documentElement.lang = next
  }, [])

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLanguage
    }
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}






