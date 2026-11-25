import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ConfirmPage } from './confirm-page'

export const metadata: Metadata = { title: 'Confirm subscription | Honic Store', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default function Page() {
  return <Suspense fallback={null}><ConfirmPage /></Suspense>
}
