import type { Metadata } from 'next'

// The page is a client component, so its title is set here
export const metadata: Metadata = {
  title: 'Checkout | Honic Company Store',
  description: 'Enter your delivery details and pay with mobile money.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
