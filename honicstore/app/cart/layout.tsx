import type { Metadata } from 'next'

// The page is a client component, so its title is set here
export const metadata: Metadata = {
  title: 'Your cart | Honic Company Store',
  description: 'Review the items in your cart and check out with mobile money.',
  robots: { index: false, follow: true },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
