import type { Metadata } from 'next'

// The page is a client component, so its title and canonical URL are set here
export const metadata: Metadata = {
  title: 'Terms of service | Honic Company Store',
  description: 'The terms for shopping and selling on Honic Company Store: orders, payment, delivery, returns and refunds.',
  alternates: { canonical: '/terms' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
