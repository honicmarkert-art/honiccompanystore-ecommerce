'use client'

import { NextIntlClientProvider } from 'next-intl'
import { useLanguage } from '@/contexts/language-context'
import { ReactNode, useMemo } from 'react'

// Import messages statically
import enMessages from '@/messages/en.json'
import swMessages from '@/messages/sw.json'

interface NextIntlProviderProps {
  children: ReactNode
}

export function NextIntlProvider({ children }: NextIntlProviderProps) {
  const { language } = useLanguage()
  
  // Use useMemo to select messages based on language
  const messages = useMemo(() => {
    return language === 'sw' ? swMessages : enMessages
  }, [language])

  return (
    <NextIntlClientProvider locale={language} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  )
}

