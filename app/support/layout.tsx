import { ReactNode } from 'react'

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
