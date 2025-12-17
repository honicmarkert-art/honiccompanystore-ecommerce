import { useLanguage } from '@/contexts/language-context'
import { getTranslation, type Language } from '@/lib/translations'
import { useMemo } from 'react'

/**
 * Universal translation hook that works in all components
 * Usage: const t = useTranslation(); t('dashboard')
 */
export function useTranslation() {
  const { language } = useLanguage()
  
  return useMemo(() => {
    return (key: string, fallback?: string): string => {
      const translation = getTranslation(language, key)
      // If translation not found and key is returned, use fallback or key
      if (translation === key && fallback) {
        return fallback
      }
      return translation
    }
  }, [language])
}

/**
 * Server-side translation function
 * Usage: const t = getServerTranslation('en'); t('dashboard')
 */
export function getServerTranslation(language: Language = 'en') {
  return (key: string, fallback?: string): string => {
    const translation = getTranslation(language, key)
    if (translation === key && fallback) {
      return fallback
    }
    return translation
  }
}

