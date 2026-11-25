"use client"

/**
 * Newsletter signup (footer). Double opt-in: we send a confirmation email and only add the address
 * after the person clicks it. Consent text says exactly what they get and how to stop.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Loader2, MailCheck, Send } from 'lucide-react'

export function NewsletterSignup({ source = 'footer' }: { source?: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('busy'); setMessage('')
    try {
      const res = await fetch('/api/newsletter/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, source }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.success === false) throw new Error(d.error)
      setState('sent'); setMessage(d.message || 'Check your inbox and click the link to confirm.')
    } catch (err) {
      setState('error'); setMessage(err instanceof Error && err.message ? err.message : 'Could not subscribe. Please try again.')
    }
  }

  if (state === 'sent') {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p><span className="font-bold">Almost done.</span> {message} Not there? Check spam or promotions.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Email address</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="Your email address" className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-neutral-700 dark:bg-neutral-900" />
        </label>
        <button disabled={state === 'busy'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60">
          {state === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Subscribe
        </button>
      </div>
      {state === 'error' && <p role="alert" className="mt-2 text-sm text-red-600">{message}</p>}
      <p className="mt-2 text-xs text-neutral-500">Offers, coupons and new arrivals, a few emails a month. We email you a link to confirm first. Unsubscribe any time. See our <Link href="/privacy" className="underline hover:text-orange-600">privacy policy</Link>.</p>
    </form>
  )
}
