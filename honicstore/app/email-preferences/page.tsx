import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PreferencesPage } from './preferences-page'

export const metadata: Metadata = { title: 'Email preferences | Honic Store', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default function Page() {
  return <Suspense fallback={null}><PreferencesPage /></Suspense>
}
