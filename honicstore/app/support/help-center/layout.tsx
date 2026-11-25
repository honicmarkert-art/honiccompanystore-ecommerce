import type { Metadata } from 'next'

// The page is a client component, so its title and canonical URL are set here
export const metadata: Metadata = {
  title: 'Help centre: questions & answers | Honic Company Store',
  description: 'Answers to common questions about ordering, delivery, payment and returns on Honic.',
  alternates: { canonical: '/support/help-center' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
