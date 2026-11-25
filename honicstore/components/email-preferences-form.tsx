"use client"

/**
 * Email preference toggles, used by /email-preferences (signed link from an email) and by
 * account Settings (signed in). Account and order emails are always sent and are listed as such.
 */
import { useCallback, useEffect, useState } from 'react'
import { BellRing, Check, Loader2, Mail, ShieldCheck } from 'lucide-react'

type Prefs = { marketing: boolean; price_alerts: boolean; back_in_stock: boolean; abandoned_cart: boolean; review_requests: boolean }
type Key = keyof Prefs

const ROWS: { key: Key; title: string; text: string }[] = [
  { key: 'marketing', title: 'Offers and news', text: 'Deals, coupons and new arrivals. A few emails a month.' },
  { key: 'price_alerts', title: 'Price drop alerts', text: 'When a product you set an alert for reaches your price.' },
  { key: 'back_in_stock', title: 'Back in stock', text: 'When a product you asked about is available again.' },
  { key: 'abandoned_cart', title: 'Cart reminders', text: 'One reminder if you leave items in your cart.' },
  { key: 'review_requests', title: 'Review requests', text: 'A short request to review what you bought.' },
]

export function EmailPreferencesForm({ e, t, highlight, compact = false }: { e?: string | null; t?: string | null; highlight?: string | null; compact?: boolean }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading')
  const [busy, setBusy] = useState<Key | 'all' | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const linkQuery = e && t ? `?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}` : ''

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/email/preferences${linkQuery}`, { cache: 'no-store', credentials: 'include' })
      if (res.status === 401) { setState('denied'); return }
      if (!res.ok) throw new Error()
      const d = await res.json()
      setPrefs(d.prefs); setEmail(d.email); setPending(!!d.pendingMarketing); setState('ready')
    } catch { setState('error') }
  }, [linkQuery])
  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect -- first load; state is set after the request

  const save = async (key: Key | 'all', body: Record<string, unknown>, okText: string) => {
    setBusy(key); setNotice(null)
    try {
      const res = await fetch('/api/email/preferences', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(e && t ? { e, t } : {}), ...body }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error)
      setPrefs(d.prefs); setPending(!!d.pendingMarketing)
      setNotice({ tone: 'ok', text: d.confirmSent ? 'We sent you an email. Click the link in it to confirm your subscription.' : okText })
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error && err.message ? err.message : 'Could not save. Please try again.' })
    } finally { setBusy(null) }
  }

  const toggle = (key: Key, on: boolean) => key === 'marketing'
    ? save(key, { marketing: on }, on ? 'Subscribed.' : 'You are unsubscribed from offers and news.')
    : save(key, { prefs: { [key]: on } }, 'Saved.')

  const stopAll = () => save('all', { marketing: false, prefs: { price_alerts: false, back_in_stock: false, abandoned_cart: false, review_requests: false } }, 'Done. You will only get emails about your account and orders.')

  if (state === 'loading') return <div className="h-64 animate-pulse rounded-2xl bg-stone-100 dark:bg-neutral-800" />
  if (state === 'denied') return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">This link is not valid. Use the link at the bottom of one of our emails, or sign in and open Settings.</p>
  if (state === 'error' || !prefs) return <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">Could not load your email preferences. <button onClick={load} className="font-semibold underline">Try again</button></p>

  return (
    <div className="space-y-4">
      {!compact && <p className="flex items-center gap-2 text-sm text-neutral-500"><Mail className="h-4 w-4" /> Preferences for <span className="font-semibold text-neutral-900 dark:text-white">{email}</span></p>}
      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl ring-1 ring-neutral-200 dark:divide-neutral-800 dark:ring-neutral-800">
        {ROWS.map((r) => {
          const on = prefs[r.key]
          const waiting = r.key === 'marketing' && !on && pending
          return (
            <li key={r.key} className={`flex items-center gap-4 bg-white px-4 py-4 sm:px-5 dark:bg-neutral-900 ${highlight === r.key ? 'bg-orange-50/60 dark:bg-orange-950/20' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-neutral-500">{waiting ? 'Waiting for you to confirm: check your inbox.' : r.text}</p>
              </div>
              <button
                role="switch" aria-checked={on} aria-label={r.title} onClick={() => toggle(r.key, !on)} disabled={busy !== null}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-orange-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`}>
                  {busy === r.key ? <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" /> : on ? <Check className="h-3.5 w-3.5 text-orange-600" /> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-sm ${notice.tone === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>{notice.text}</p>}

      <div className="flex flex-col gap-3 rounded-2xl bg-stone-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between dark:bg-neutral-800/50">
        <p className="flex items-start gap-2 text-neutral-600 dark:text-neutral-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Emails about your account, payments and orders are always sent. They are needed to serve you.</p>
        <button onClick={stopAll} disabled={busy !== null} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold ring-1 ring-neutral-200 hover:ring-red-300 disabled:opacity-60 dark:bg-neutral-900 dark:ring-neutral-700">
          {busy === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Stop all optional emails
        </button>
      </div>
    </div>
  )
}
