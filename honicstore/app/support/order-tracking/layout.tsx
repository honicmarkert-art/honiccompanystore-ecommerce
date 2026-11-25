import type { Metadata } from 'next'

// The page is a client component, so its title and canonical URL are set here
export const metadata: Metadata = {
  title: 'Track your order | Honic Company Store',
  description: 'Check the status of your Honic order with your order number and the phone number or email you used at checkout.',
  alternates: { canonical: '/support/order-tracking' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
