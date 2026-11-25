import type { Metadata } from 'next'

// The page is a client component, so its title is set here
export const metadata: Metadata = {
  title: 'Forgot password | Honic Company Store',
  description: 'Reset the password for your Honic account.',
  robots: { index: false, follow: true },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
