import type { Metadata } from 'next'
import ErrorPageClient from './error-client'

export const dynamic = 'force-static'
export const metadata: Metadata = { title: 'Something went wrong | Honic Store', robots: { index: false, follow: false } }

export default function ErrorPage() {
  return <ErrorPageClient />
}
