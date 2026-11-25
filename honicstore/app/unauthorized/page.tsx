import type { Metadata } from 'next'
import Link from 'next/link'
import { Home, LogIn, ShieldAlert } from 'lucide-react'
import { StatusScreen, primaryBtn, secondaryBtn } from '@/components/status-screen'

export const dynamic = 'force-static'
export const metadata: Metadata = { title: 'No access | Honic Store', robots: { index: false, follow: false } }

export default function UnauthorizedPage() {
  return (
    <StatusScreen
      code="No access"
      icon={<ShieldAlert className="h-8 w-8" />}
      title="You can't open this page"
      text="It needs a different account (for example a seller or admin account). Sign in with the right account, or go back to shopping."
      footnote={<>Think this is a mistake? Email <a href="mailto:support@honiccompanystore.com" className="font-semibold text-orange-600 hover:underline">support@honiccompanystore.com</a>.</>}
    >
      <Link href="/auth/login" className={primaryBtn}><LogIn className="h-4 w-4" /> Sign in with another account</Link>
      <Link href="/" className={secondaryBtn}><Home className="h-4 w-4" /> Home</Link>
    </StatusScreen>
  )
}
