'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, KeyRound, Loader2, Mail, MailCheck } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { AuthShell, StatusIcon, authButton, authField, authIcon } from '../_components/auth-shell'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = email.trim().replace(/[<>]/g, '').slice(0, 255).toLowerCase()
    if (!EMAIL_RE.test(clean)) {
      setError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    setError('')
    const result = await resetPassword(clean)
    setLoading(false)
    if (result.success) setSentTo(clean)
    else setError(result.error || "Couldn't send the reset email. Please try again.")
  }

  if (sentTo) {
    return (
      <AuthShell
        icon={<StatusIcon tone="green"><MailCheck className="h-7 w-7" /></StatusIcon>}
        title="Check your email"
        subtitle={<>If an account exists for <b className="text-neutral-800">{sentTo}</b>, we&apos;ve sent a link to set a new password. It can take a minute; check spam too.</>}
      >
        <div className="space-y-3">
          <Link href="/auth/login" className={authButton}>Back to sign in</Link>
          <button type="button" onClick={() => setSentTo(null)} className="w-full text-center text-sm font-semibold text-orange-600 hover:text-orange-700">
            Use a different email
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      icon={<StatusIcon tone="orange"><KeyRound className="h-7 w-7" /></StatusIcon>}
      title="Forgot your password?"
      subtitle="Enter the email you signed up with and we'll send you a link to set a new one."
    >
      {error && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100" role="alert">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="reset-email" className="mb-1.5 block text-[13px] font-semibold text-neutral-700">Email</label>
          <div className="relative">
            <Mail className={authIcon} />
            <input id="reset-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} className={authField} required autoFocus />
          </div>
        </div>
        <button type="submit" disabled={loading} className={authButton}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <>Send reset link <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-neutral-500">
        Remembered it? <Link href="/auth/login" className="font-semibold text-orange-600 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  )
}
