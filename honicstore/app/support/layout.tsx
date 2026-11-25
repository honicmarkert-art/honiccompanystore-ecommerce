import { ReactNode } from 'react'
import type { Metadata } from 'next'

// Default for /support pages that are client components (server pages set their own title)
export const metadata: Metadata = {
  title: 'Help centre | Honic Company Store',
  description: 'Get help with orders, delivery, payments and returns on Honic Company Store.',
}

interface SupportLayoutProps {
  children: ReactNode
}

export default function SupportLayout({ children }: SupportLayoutProps) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  )
}
