'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { XCircle } from 'lucide-react'
import { AuthShell, StatusIcon, authButton } from '../_components/auth-shell'

function AuthCodeErrorInner() {
  const sp = useSearchParams()
  const detail = sp.get('error_description') || sp.get('error')
  return (
    <AuthShell
      icon={<StatusIcon tone="red"><XCircle className="h-7 w-7" /></StatusIcon>}
      title="We couldn’t sign you in"
      subtitle={detail ? decodeURIComponent(detail.replace(/\+/g, ' ')) : 'The sign-in link expired or was already used.'}
    >
      <div className="space-y-3">
        <Link href="/auth/login" className={authButton}>Try signing in again</Link>
        <Link href="/auth/forgot-password" className="block text-center text-sm font-semibold text-orange-600 hover:text-orange-700">Forgot your password?</Link>
      </div>
    </AuthShell>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <AuthCodeErrorInner />
    </Suspense>
  )
}
