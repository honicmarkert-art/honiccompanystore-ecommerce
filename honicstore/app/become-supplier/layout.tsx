import type { Metadata } from 'next'

// The page is a client component, so its title is set here
export const metadata: Metadata = {
  title: 'Sell on Honic | Honic Company Store',
  description: 'Open your shop on Honic Company Store and sell to shoppers across Tanzania. We handle checkout and mobile money payments.',
  alternates: { canonical: '/become-supplier' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
