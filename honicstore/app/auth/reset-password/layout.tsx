import type { Metadata } from 'next'

// The page is a client component, so its title is set here
export const metadata: Metadata = {
  title: 'Choose a new password | Honic Company Store',
  description: 'Set a new password for your Honic account.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
