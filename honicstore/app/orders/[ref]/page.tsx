import type { Metadata } from 'next'
import { OrderLinkView } from './order-link-view'

// Private page (the link is the key): never indexed, never shared with other sites via the referrer
export const metadata: Metadata = {
  title: 'Your order | Honic Store',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function Page({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  return <OrderLinkView reference={ref} />
}
