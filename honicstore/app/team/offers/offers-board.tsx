"use client"

/**
 * Team page: answer "Make an offer" requests. Accept / counter creates a one-time code (48 h) and opens
 * WhatsApp to the customer with the reply ready; decline opens a polite reply. Admins only (API checks).
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, HandCoins, Loader2, MessageCircle, RefreshCw, X } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { useCurrency } from '@/contexts/currency-context'

type Offer = {
  id: string; ref: string; product_id: number; product_name: string; list_price: number; offer_price: number; quantity: number
  name: string | null; phone: string; region: string | null; note: string | null; status: 'new' | 'accepted' | 'countered' | 'declined'
  agreed_price: number | null; coupon_code: string | null; created_at: string
}
const card = 'rounded-2xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800'
const ago = (iso: string, now: number) => {
  const m = Math.floor((now - new Date(iso).getTime()) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function OffersBoard() {
  const { formatPrice } = useCurrency()
  const [tab, setTab] = useState<'new' | 'all'>('new')
  const [offers, setOffers] = useState<Offer[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading')
  const [now, setNow] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [counter, setCounter] = useState<Record<string, string>>({})
  const [result, setResult] = useState<Record<string, { code?: string; whatsapp: string; error?: string; sentByApi?: boolean }>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/offers?status=${tab}`, { cache: 'no-store', credentials: 'include' })
      if (res.status === 403 || res.status === 401) { setState('denied'); return }
      if (!res.ok) throw new Error()
      setOffers((await res.json()).offers || []); setState('ready')
    } catch { setState('error') } finally { setNow(Date.now()) }
  }, [tab])
  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect -- loads after mount / tab change

  const decide = async (o: Offer, action: 'accept' | 'counter' | 'decline') => {
    const price = action === 'counter' ? Number(String(counter[o.id] || '').replace(/\D/g, '')) : undefined
    if (action === 'counter' && !(price && price > 0)) { setResult((r) => ({ ...r, [o.id]: { whatsapp: '', error: 'Enter your counter price first.' } })); return }
    setBusy(o.id + action)
    try {
      const res = await fetch(`/api/team/offers/${o.id}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, price }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Failed')
      setResult((r) => ({ ...r, [o.id]: { code: d.code, whatsapp: d.whatsapp, sentByApi: !!d.sentByApi } }))
      if (!d.sentByApi) window.open(d.whatsapp, '_blank', 'noopener,noreferrer') // API not set up / not delivered: open the chat instead
      setOffers((list) => list.map((x) => (x.id === o.id ? { ...x, status: action === 'decline' ? 'declined' : action === 'accept' ? 'accepted' : 'countered', coupon_code: d.code || null, agreed_price: action === 'accept' ? o.offer_price : price || null } : x)))
    } catch (e) {
      setResult((r) => ({ ...r, [o.id]: { whatsapp: '', error: e instanceof Error ? e.message : 'Failed' } }))
    } finally { setBusy(null) }
  }

  return (
    <div className="min-h-screen bg-stone-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl"><HandCoins className="h-7 w-7 text-orange-600" /> Price offers</h1>
            <p className="mt-1 text-sm text-neutral-500">Accept or counter to send a one-time code (valid 48 h). The customer pays the agreed price in normal checkout.</p>
          </div>
          <button onClick={() => { setState('loading'); load() }} className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-800"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>
        <div className="mt-4 flex gap-2">
          {(['new', 'all'] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setState('loading') }} aria-pressed={tab === t} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-orange-500 text-white' : 'bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700'}`}>{t === 'new' ? 'Waiting for reply' : 'All offers'}</button>
          ))}
        </div>

        <div className="mt-5">
          {state === 'loading' ? <div className="h-40 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />
            : state === 'denied' ? <p className={`${card} p-6 text-sm`}>This page is for Honic admins. <Link href="/auth/login?redirect=/team/offers" className="font-semibold text-orange-600 hover:underline">Sign in with an admin account</Link>.</p>
              : state === 'error' ? <p className={`${card} p-6 text-sm text-red-600`}>Could not load offers. <button onClick={load} className="underline">Try again</button></p>
                : offers.length === 0 ? <p className={`${card} p-10 text-center text-sm text-neutral-500`}>{tab === 'new' ? 'No offers waiting. Nice work!' : 'No offers yet.'}</p>
                  : (
                    <ul className="space-y-3">
                      {offers.map((o) => {
                        const off = Math.round((1 - o.offer_price / o.list_price) * 100)
                        const r = result[o.id]
                        return (
                          <li key={o.id} className={`${card} p-4 sm:p-5`}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <Link href={`/products/${o.product_id}`} target="_blank" className="line-clamp-2 font-bold hover:text-orange-600">{o.product_name}</Link>
                                <p className="text-xs text-neutral-500">{o.ref} · {now ? ago(o.created_at, now) : ''}{o.region ? ` · ${o.region}` : ''}</p>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${o.status === 'new' ? 'bg-orange-50 text-orange-700' : o.status === 'declined' ? 'bg-neutral-100 text-neutral-600' : 'bg-emerald-50 text-emerald-700'}`}>{o.status === 'new' ? 'Waiting' : o.status}</span>
                            </div>
                            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                              <div><dt className="text-xs text-neutral-500">Qty</dt><dd className="font-bold">{o.quantity}</dd></div>
                              <div><dt className="text-xs text-neutral-500">Price</dt><dd className="font-bold tabular-nums">{formatPrice(o.list_price)}</dd></div>
                              <div><dt className="text-xs text-neutral-500">Offer</dt><dd className="font-bold tabular-nums text-orange-700">{formatPrice(o.offer_price)} <span className="text-xs font-semibold">(−{off}%)</span></dd></div>
                              <div><dt className="text-xs text-neutral-500">Customer</dt><dd><a href={`https://wa.me/${o.phone}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 hover:underline">{o.name || 'Customer'}</a></dd></div>
                            </dl>
                            {o.note && <p className="mt-2 rounded-xl bg-stone-50 px-3 py-2 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">“{o.note}”</p>}
                            {o.coupon_code && <p className="mt-2 text-sm">Code <span className="font-mono font-bold">{o.coupon_code}</span>{o.agreed_price ? ` · agreed ${formatPrice(o.agreed_price)} each` : ''}</p>}

                            {o.status === 'new' && (
                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <button onClick={() => decide(o, 'accept')} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{busy === o.id + 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accept {formatPrice(o.offer_price)}</button>
                                <span className="inline-flex items-center gap-1 rounded-xl ring-1 ring-neutral-300 dark:ring-neutral-700">
                                  <input inputMode="numeric" placeholder="Counter price" value={counter[o.id] || ''} onChange={(e) => setCounter((c) => ({ ...c, [o.id]: e.target.value.replace(/\D/g, '') }))} className="h-10 w-32 rounded-l-xl bg-transparent px-3 text-sm outline-none" />
                                  <button onClick={() => decide(o, 'counter')} disabled={!!busy} className="h-10 rounded-r-xl bg-neutral-900 px-3 text-sm font-bold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">{busy === o.id + 'counter' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Counter'}</button>
                                </span>
                                <button onClick={() => decide(o, 'decline')} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-stone-100 disabled:opacity-60 dark:text-neutral-300 dark:hover:bg-neutral-800"><X className="h-4 w-4" /> Decline</button>
                              </div>
                            )}
                            {r?.error && <p role="alert" className="mt-3 text-sm text-red-600">{r.error}</p>}
                            {r?.sentByApi && <p className="mt-3 text-sm font-semibold text-emerald-700">✓ Sent to the customer on WhatsApp automatically.</p>}
                            {r?.whatsapp && !r.sentByApi && <a href={r.whatsapp} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"><MessageCircle className="h-4 w-4" /> Send the reply on WhatsApp</a>}
                          </li>
                        )
                      })}
                    </ul>
                  )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
