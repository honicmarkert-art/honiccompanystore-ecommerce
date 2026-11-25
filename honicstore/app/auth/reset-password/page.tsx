'use client'

/**
 * Set a new password after clicking the reset link in the email.
 * The link signs the user in with a short-lived recovery session (tokens in the URL, or ?code=);
 * after the password is changed that session is ended and the user signs in with the new password.
 */

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, XCircle } from 'lucide-react'
import { supabaseClient } from '@/lib/supabase-client'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { cn } from '@/lib/utils'
import { AuthShell, StatusIcon, authButton, authField, authIcon } from '../_components/auth-shell'

function ResetPasswordInner() {
  const router = useRouter()
  const [ready, setReady] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const ran = useRef(false)

  // Establish the recovery session from the link (runs once)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    let settled = false
    const finish = (ok: boolean) => { if (!settled) { settled = true; setReady(ok) } }

    const { data: sub } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session?.user && event === 'SIGNED_IN')) finish(true)
    })

    ;(async () => {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
      if (hash.get('error_description') || url.searchParams.get('error_description')) return finish(false)
      if (code) {
        const { error } = await supabaseClient.auth.exchangeCodeForSession(code)
        if (error && !/already|used|verifier/i.test(error.message)) return finish(false)
      } else if (hash.get('access_token')) {
        await supabaseClient.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token') || '' })
      }
      const { data } = await supabaseClient.auth.getSession()
      if (data.session?.user) {
        window.history.replaceState(null, '', url.pathname)
        return finish(true)
      }
      // give the Supabase client a moment in case it is still reading the link
      setTimeout(async () => {
        const again = await supabaseClient.auth.getSession()
        finish(!!again.data.session?.user)
      }, 1500)
    })()

    return () => sub.subscription.unsubscribe()
  }, [])

  const checks = [
    { ok: password.length >= 8, label: '8+ characters' },
    { ok: /[A-Z]/.test(password) && /[a-z]/.test(password), label: 'Upper & lower case' },
    { ok: /\d/.test(password), label: 'A number' },
  ]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length > 128) return setError('Password is too long (maximum 128 characters).')
    if (!checks.every((c) => c.ok)) return setError('Use at least 8 characters with upper and lower case letters and a number.')
    if (password !== confirm) return setError('The passwords don’t match.')
    setLoading(true)
    const { error: updateError } = await supabaseClient.auth.updateUser({ password })
    if (updateError) {
      setLoading(false)
      setError(getFriendlyErrorMessage(updateError, 'Something went wrong. Please try again.'))
      return
    }
    // End the recovery session; sign in fresh with the new password
    await supabaseClient.auth.signOut().catch(() => {})
    try { (await import('@/lib/device-fingerprint')).clearDeviceVerification() } catch { /* ignore */ }
    setLoading(false)
    setDone(true)
    setTimeout(() => router.push('/auth/login'), 2500)
  }

  if (ready === null) {
    return (
      <AuthShell back={null} icon={<StatusIcon tone="orange"><Loader2 className="h-7 w-7 animate-spin" /></StatusIcon>} title="Checking your link…" subtitle="This only takes a moment.">
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-orange-400" /></div>
      </AuthShell>
    )
  }

  if (!ready) {
    return (
      <AuthShell icon={<StatusIcon tone="red"><XCircle className="h-7 w-7" /></StatusIcon>} title="This link has expired" subtitle="Reset links work once and expire after a while. Request a new one; it only takes a minute.">
        <div className="space-y-3">
          <Link href="/auth/forgot-password" className={authButton}>Send a new link</Link>
          <Link href="/auth/login" className="block text-center text-sm font-semibold text-orange-600 hover:text-orange-700">Back to sign in</Link>
        </div>
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell back={null} icon={<StatusIcon tone="green"><CheckCircle2 className="h-7 w-7" /></StatusIcon>} title="Password updated" subtitle="You can now sign in with your new password. Taking you to sign in…">
        <Link href="/auth/login" className={authButton}>Sign in</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell icon={<StatusIcon tone="orange"><KeyRound className="h-7 w-7" /></StatusIcon>} title="Set a new password" subtitle="Choose a strong password you don't use anywhere else.">
      {error && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100" role="alert">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-[13px] font-semibold text-neutral-700">New password</label>
          <div className="relative">
            <Lock className={authIcon} />
            <input id="new-password" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={cn(authField, 'pr-11')} required autoFocus />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 hover:text-neutral-700">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-[13px] font-semibold text-neutral-700">Confirm new password</label>
          <div className="relative">
            <Lock className={authIcon} />
            <input id="confirm-password" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={cn(authField, confirm && confirm !== password && 'border-red-400')} required />
          </div>
        </div>
        {password && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Password requirements">
            {checks.map((c) => (
              <li key={c.label} className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', c.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500')}>
                <Check className={cn('h-3 w-3', !c.ok && 'opacity-30')} />{c.label}
              </li>
            ))}
          </ul>
        )}
        <button type="submit" disabled={loading} className={authButton}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <>Save new password <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ResetPasswordInner />
    </Suspense>
  )
}
