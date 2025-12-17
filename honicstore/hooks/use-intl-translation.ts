'use client'

import { useTranslations } from 'next-intl'
import { useLanguage } from '@/contexts/language-context'

/**
 * Universal translation hook that works with next-intl
 * Usage: const t = useIntlTranslation(); t('navigation.dashboard')
 * 
 * This hook automatically uses the current language from LanguageContext
 */
export function useIntlTranslation() {
  const { language } = useLanguage()
  const t = useTranslations()
  
  return t
}

/**
 * Get translation for a specific namespace
 * Usage: const t = useIntlTranslation('navigation'); t('dashboard')
 */
export function useIntlTranslationNamespace(namespace: string) {
  return useTranslations(namespace)
}

