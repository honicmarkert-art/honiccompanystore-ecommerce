import type { Metadata } from 'next'

// The page is a client component, so its title and canonical URL are set here
export const metadata: Metadata = {
  title: 'Contact us | Honic Company Store',
  description: 'Contact Honic Company Store on WhatsApp, by email or with the contact form.',
  alternates: { canonical: '/contact' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
