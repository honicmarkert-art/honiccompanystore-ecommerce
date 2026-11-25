'use client'

/**
 * Landing page for links that come back from Supabase:
 *  - Google sign-in            (#access_token=…  or ?code=…)
 *  - "Confirm your email" link (#access_token=…&type=signup)
 *  - Password recovery link    (type=recovery  -> forwarded to /auth/reset-password)
 *
 * Runs exactly once (the old page re-ran on every state change and could use a one-time code twice,
 * turning a successful verification into "Authentication failed"). On success it stores the session
 * in the server cookies, remembers this device, refreshes the account and returns the shopper to
 * where they started (or the supplier dashboard for suppliers).
 */

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, MailCheck, XCircle } from 'lucide-react'
import { supabaseClient } from '@/lib/supabase-client'
import { useAuth } from '@/contexts/auth-context'
import { AuthShell, StatusIcon, authButton } from '../_components/auth-shell'

type State =
  | { kind: 'working'; text: string }
  | { kind: 'signed-in'; verified: boolean; to: string }
  | { kind: 'error'; text: string }

const safePath = (p: string | null) => (p && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/auth') ? p : null)

function CallbackInner() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [state, setState] = useState<State>({ kind: 'working', text: 'Signing you in…' })
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const run = async () => {
      const url = new URL(window.location.href)
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
      const q = url.searchParams
      const type = hash.get('type') || q.get('type')
      const err = hash.get('error_description') || hash.get('error') || q.get('error_description') || q.get('error')

      if (err) {
        setState({ kind: 'error', text: decodeURIComponent(err.replace(/\+/g, ' ')) })
        return
      }

      // 1. Get the session from whichever form the link used
      let session = null
      const code = q.get('code')
      const accessToken = hash.get('access_token')
      if (code) {
        const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code)
        if (error && !/already|used|verifier/i.test(error.message)) {
          setState({ kind: 'error', text: error.message })
          return
        }
        session = data?.session ?? null
      } else if (accessToken) {
        const { data, error } = await supabaseClient.auth.setSession({ access_token: accessToken, refresh_token: hash.get('refresh_token') || '' })
        if (error) {
          setState({ kind: 'error', text: error.message })
          return
        }
        session = data.session
      }
      // The Supabase client may already have read the tokens from the URL itself
      if (!session) session = (await supabaseClient.auth.getSession()).data.session

      // clean the tokens out of the address bar
      window.history.replaceState(null, '', url.pathname)

      if (!session?.user) {
        setState({ kind: 'error', text: 'This link has expired or was already used. Sign in, or request a new link.' })
        return
      }

      // 2. Password recovery -> set a new password
      if (type === 'recovery') {
        router.replace('/auth/reset-password')
        return
      }

      // 3. Store the session in server cookies so the API (orders, account) sees the shopper
      try {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }),
        })
      } catch { /* the browser session still works */ }
      try { (await import('@/lib/device-fingerprint')).markDeviceVerified() } catch { /* not critical */ }

      // 4. Where to go next
      const user = session.user
      const supplierFlag = sessionStorage.getItem('supplier_registration') === 'true'
      let isSupplier = supplierFlag
      try {
        const { data: profile } = await supabaseClient.from('profiles').select('is_supplier').eq('id', user.id).single()
        isSupplier = !!profile?.is_supplier || supplierFlag
      } catch { /* default: buyer */ }
      const to = isSupplier ? '/supplier/dashboard' : safePath(sessionStorage.getItem('oauth_redirect')) || '/'
      sessionStorage.removeItem('oauth_redirect')
      sessionStorage.removeItem('supplier_registration')
      sessionStorage.removeItem('pending_verification_email')

      // 5. New email-verified accounts get the welcome email once (fire and forget)
      const verifiedEmail = type === 'signup' || type === 'email'
      const isNew = user.created_at && Date.now() - new Date(user.created_at).getTime() < 24 * 60 * 60 * 1000
      if (verifiedEmail && isNew && user.email && !user.user_metadata?.account_notice_sent) {
        fetch('/api/auth/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, name: user.user_metadata?.full_name || user.email.split('@')[0], isSupplier }),
        }).catch(() => {})
        if (supplierFlag) {
          fetch('/api/notifications/welcome-supplier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ supplierId: user.id, companyName: user.user_metadata?.full_name || user.email, planSlug: null }),
          }).catch(() => {})
        }
      }

      await refreshUser().catch(() => {})
      setState({ kind: 'signed-in', verified: verifiedEmail, to })
      setTimeout(() => router.replace(to), verifiedEmail ? 2200 : 900)
    }

    run().catch((e) => setState({ kind: 'error', text: e?.message || 'Something went wrong. Please try again.' }))
  }, [refreshUser, router])

  if (state.kind === 'working') {
    return (
      <AuthShell back={null} icon={<StatusIcon tone="orange"><Loader2 className="h-7 w-7 animate-spin" /></StatusIcon>} title="One moment…" subtitle={state.text}>
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-orange-400" /></div>
      </AuthShell>
    )
  }

  if (state.kind === 'signed-in') {
    return (
      <AuthShell
        back={null}
        icon={<StatusIcon tone="green">{state.verified ? <MailCheck className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}</StatusIcon>}
        title={state.verified ? 'Email verified, welcome!' : 'You’re signed in'}
        subtitle={state.verified ? 'Your account is active. Taking you to the store…' : 'Taking you back…'}
      >
        <Link href={state.to} className={authButton}>Continue</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell icon={<StatusIcon tone="red"><XCircle className="h-7 w-7" /></StatusIcon>} title="That link didn’t work" subtitle={state.text}>
      <div className="space-y-3">
        <Link href="/auth/login" className={authButton}>Sign in</Link>
        <p className="text-center text-xs text-neutral-500">
          Need a new verification email? Sign in with your email and password; the form offers to resend it.
          Forgot your password? <Link href="/auth/forgot-password" className="font-semibold text-orange-600 hover:underline">Reset it</Link>.
        </p>
      </div>
    </AuthShell>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <CallbackInner />
    </Suspense>
  )
}
