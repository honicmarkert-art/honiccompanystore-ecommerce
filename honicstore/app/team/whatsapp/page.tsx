import type { Metadata } from 'next'
import { WhatsAppBoard } from './whatsapp-board'

export const metadata: Metadata = { title: 'WhatsApp | Honic team', robots: { index: false, follow: false } }

export default function Page() {
  return <WhatsAppBoard />
}
