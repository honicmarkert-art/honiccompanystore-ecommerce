import type { Metadata } from 'next'
import { OffersBoard } from './offers-board'

export const metadata: Metadata = { title: 'Price offers | Honic team', robots: { index: false, follow: false } }

export default function Page() {
  return <OffersBoard />
}
