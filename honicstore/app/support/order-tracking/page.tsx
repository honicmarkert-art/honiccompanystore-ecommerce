'use client'

/**
 * Track an order.
 *  - Anyone: order number + the phone or email used at checkout (POST /api/orders/track).
 *  - Signed in: their recent orders (GET /api/user/orders) with links to the full order page.
 * (The old page showed made-up orders such as "HC-2025-001234" to everyone.)
 */
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, Loader2, MessageCircle, PackageSearch, Search, Store, Truck, X } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/contexts/auth-context'
import { useCurrency } from '@/contexts/currency-context'
import { whatsappLink } from '@/lib/contact'

type Step = { key: string; label: string; done: boolean; at?: string | null }
type Tracked = {
  orderNumber: string
  orderLink?: string | null
  status: string
  paid: boolean
  delivery: 'pickup' | 'delivery'
  createdAt: string
  trackingNumber: string | null
  estimatedDelivery: string | null
  total: number
  firstName: string | null
  items: { name: string; variant: string | null; quantity: number }[]
  steps: Step[]
}
type MyOrder = { orderNumber: string; status: string; createdAt?: string; totalAmount?: number; total?: number; items?: unknown[] }

const STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting for payment',
  confirmed: 'Being prepared',
  shipped: 'On the way',
  delivered: 'Delivered',
  ready_for_pickup: 'Ready for pickup',
  picked_up: 'Picked up',
  cancelled: 'Cancelled',
}
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export default function OrderTrackingPage() {
  // useSearchParams needs a Suspense boundary
  return (
    <Suspense fallback={<div className="min-h-screen bg-white dark:bg-neutral-950" />}>
      <OrderTracking />
    </Suspense>
  )
}

function OrderTracking() {
  const { isAuthenticated } = useAuth()
  const { formatPrice } = useCurrency()
  // ?order=ORD-123 prefills the form (links from emails)
  const [orderNumber, setOrderNumber] = useState(useSearchParams().get('order') || '')
  const [contact, setContact] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Tracked | null>(null)
  const [mine, setMine] = useState<MyOrder[] | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return // the list only renders when signed in
    let cancelled = false
    fetch('/api/user/orders', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setMine(Array.isArray(d?.orders) ? d.orders.slice(0, 5) : []) })
      .catch(() => { if (!cancelled) setMine([]) })
    return () => { cancelled = true }
  }, [isAuthenticated])

  const track = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, contact }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.order) throw new Error(d?.error || 'Could not find that order.')
      setResult(d.order)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find that order.')
    } finally {
      setLoading(false)
    }
  }

  const field = 'w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-neutral-700 dark:bg-neutral-900'

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
          <Link href="/support" className="hover:text-orange-600">Help centre</Link> <span aria-hidden>/</span> Track an order
        </nav>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Track your order</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-300">Enter your order number and the phone number or email you used at checkout.</p>

        {/* signed in: recent orders */}
        {isAuthenticated && mine && mine.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Your recent orders</h2>
            <ul className="mt-3 divide-y divide-neutral-200 rounded-2xl ring-1 ring-neutral-200 dark:divide-neutral-800 dark:ring-neutral-800">
              {mine.map((o) => (
                <li key={o.orderNumber}>
                  <Link href={`/account/orders/${o.orderNumber}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                    <span className="min-w-0">
                      <span className="block font-semibold">{o.orderNumber}</span>
                      <span className="text-xs text-neutral-500">{date(o.createdAt)}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-950/40">{STATUS_LABEL[o.status] || o.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/account/orders" className="mt-2 inline-block text-sm font-semibold text-orange-600 hover:underline">See all your orders</Link>
          </section>
        )}

        {/* lookup */}
        <form onSubmit={track} className="mt-8 grid gap-3 rounded-2xl p-5 ring-1 ring-neutral-200 dark:ring-neutral-800 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Order number</span>
            <input required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="e.g. ORD-1795358150702" autoComplete="off" className={field} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Phone or email</span>
            <input required value={contact} onChange={(e) => setContact(e.target.value)} placeholder="0712 345 678 or you@email.com" autoComplete="tel" className={field} />
          </label>
          <button disabled={loading} className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Track
          </button>
          <p className="text-xs text-neutral-500 sm:col-span-3">Your order number is in your confirmation email and in your account under &quot;My orders&quot;.</p>
        </form>

        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <X className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        {result && (
          <section className="mt-6 rounded-2xl p-6 ring-1 ring-neutral-200 dark:ring-neutral-800" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Order {result.orderNumber}</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">{STATUS_LABEL[result.status] || result.status}</h2>
                <p className="text-sm text-neutral-500">Placed {date(result.createdAt)}{result.firstName ? ` by ${result.firstName}` : ''} · {formatPrice(result.total)}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold dark:bg-neutral-800">
                {result.delivery === 'pickup' ? <Store className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                {result.delivery === 'pickup' ? 'Store pickup' : 'Delivery'}
              </span>
            </div>

            <ol className="mt-6 space-y-3">
              {result.steps.map((s) => (
                <li key={s.key} className="flex items-center gap-3">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${s.done ? (s.key === 'cancelled' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white') : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'}`}>
                    {s.done ? (s.key === 'cancelled' ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />) : <span className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                  <span className={s.done ? 'font-semibold' : 'text-neutral-500'}>{s.label}</span>
                  {s.at && <span className="ml-auto text-xs text-neutral-500">{date(s.at)}</span>}
                </li>
              ))}
            </ol>

            {(result.trackingNumber || result.estimatedDelivery) && (
              <p className="mt-5 rounded-xl bg-orange-50 px-4 py-3 text-sm dark:bg-orange-950/30">
                {result.trackingNumber && <>Tracking / parcel number: <strong>{result.trackingNumber}</strong>. </>}
                {result.estimatedDelivery && <>Expected: <strong>{date(result.estimatedDelivery)}</strong>.</>}
              </p>
            )}

            <h3 className="mt-6 text-sm font-bold">Items</h3>
            <ul className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
              {result.items.map((i, n) => <li key={n}>{i.quantity} × {i.name}{i.variant ? ` (${i.variant})` : ''}</li>)}
            </ul>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href={whatsappLink(`Hello Honic, a question about my order ${result.orderNumber}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950">
                <MessageCircle className="h-4 w-4" /> Ask about this order
              </a>
              {result.orderLink && (
                <Link href={result.orderLink} className="inline-flex items-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600">Full order &amp; invoice (PDF)</Link>
              )}
              {isAuthenticated && !result.orderLink && (
                <Link href={`/account/orders/${result.orderNumber}`} className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-bold ring-1 ring-neutral-300 hover:ring-orange-500 dark:ring-neutral-700">Open full order</Link>
              )}
            </div>
          </section>
        )}

        {!result && !error && (
          <div className="mt-10 flex items-start gap-3 text-sm text-neutral-500">
            <PackageSearch className="h-5 w-5 shrink-0 text-orange-600" />
            <p>Can&apos;t find your order number? <a href={whatsappLink('Hello Honic, I need help finding my order')} target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-600 hover:underline">Message us on WhatsApp</a> with the name and phone number you used, and we&apos;ll look it up.</p>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
