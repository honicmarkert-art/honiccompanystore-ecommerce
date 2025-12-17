import { Locale } from '@/i18n/request'

export const i18n = {
  defaultLocale: 'en' as Locale,
  locales: ['en', 'sw'] as const,
} as const

export type Locale = (typeof i18n.locales)[number]

