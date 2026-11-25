"use client"

/**
 * Double opt-in, step 2. Confirms with a POST from the page (mail-app link scanners only fetch the
 * page, they don't run it), so nobody is subscribed without opening the link themselves.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export function ConfirmPage() {
  const sp = useSearchParams()
  const [state, setState] = useState<'working' | 'done' | 'already' | 'error'>('working')
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    fetch('/api/email/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ e: sp.get('e'), t: sp.get('t') }) })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error); setState(d.already ? 'already' : 'done') })
      .catch((e) => { setError(e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.'); setState('error') })
  }, [sp])

  return (
    <div className="min-h-screen bg-stone-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
          {state === 'working' && <><Loader2 className="mx-auto h-10 w-10 animate-spin text-orange-500" /><p className="mt-4 font-semibold">Confirming your subscription…</p></>}
          {(state === 'done' || state === 'already') && (
            <>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"><CheckCircle2 className="h-9 w-9" /></span>
              <h1 className="mt-5 text-2xl font-black tracking-tight">{state === 'done' ? 'You are subscribed!' : 'You are already subscribed'}</h1>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">You will get offers, coupons and new arrivals a few times a month. Every email has a one-click unsubscribe link.</p>
              <Link href="/products" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600">Start shopping <ArrowRight className="h-4 w-4" /></Link>
            </>
          )}
          {state === 'error' && (
            <>
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <h1 className="mt-4 text-2xl font-black tracking-tight">We could not confirm</h1>
              <p className="mt-2 text-sm text-neutral-500">{error}</p>
              <Link href="/#newsletter" className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600">Subscribe again</Link>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
