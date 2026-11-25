"use client"

/**
 * Price alerts: we check prices every morning (cron check-price-alerts) and email once when a
 * product reaches the target. Alerts are set from a product page.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Bell, BellRing, Loader2, Trash2 } from 'lucide-react'
import { useCurrency } from '@/contexts/currency-context'
import { optimizedImg } from '@/lib/image-optimize'

type AlertRow = {
  id: string; product_id: number; target_price: number; current_price: number | null
  is_active: boolean; email_sent: boolean
  products: { id: number; name: string; image: string | null; price: number; slug: string | null } | null
}

const card = 'rounded-2xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800'

export default function PriceAlertsPage() {
  const { formatPrice } = useCurrency()
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/user/price-alerts', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error()
      setAlerts(data.alerts || [])
    } catch {
      setError('Could not load your price alerts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect -- first load; state is set after the request

  const remove = async (id: string) => {
    setBusy(id); setError('')
    try {
      const res = await fetch(`/api/user/price-alerts?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setAlerts((list) => list.filter((a) => a.id !== id))
    } catch {
      setError('Could not remove the alert. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Price alerts</h1>
        <p className="mt-1 text-sm text-neutral-500">We check prices every morning and email you once when a product reaches your target. Set an alert from any product page.</p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />)}</div>
      ) : alerts.length === 0 && !error ? (
        <div className={`${card} px-6 py-12 text-center`}>
          <Bell className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-3 font-semibold">No price alerts yet</p>
          <p className="mt-1 text-sm text-neutral-500">Open a product and set the price you want to pay. We email you when it gets there.</p>
          <Link href="/products" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600">Browse products <ArrowRight className="h-4 w-4" /></Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => {
            const p = a.products
            const href = `/products/${p?.slug || a.product_id}`
            const live = Number(p?.price ?? a.current_price ?? 0)
            const target = Number(a.target_price) || 0
            const reached = live > 0 && live <= target
            const gap = live > target ? Math.max(1, Math.round(((live - target) / live) * 100)) : 0
            return (
              <li key={a.id} className={`${card} flex gap-3 p-3 sm:gap-4 sm:p-4`}>
                <Link href={href} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-neutral-100 dark:ring-neutral-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p?.image ? optimizedImg(p.image, 160) : '/placeholder.jpg'} alt="" className="h-full w-full object-contain p-1" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={href} className="-my-1 line-clamp-2 py-1 text-sm font-semibold hover:text-orange-600 sm:text-base">{p?.name || 'Product no longer available'}</Link>
                  <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                    <div><dt className="inline text-neutral-500">Now </dt><dd className="inline whitespace-nowrap font-bold tabular-nums">{formatPrice(live)}</dd></div>
                    <div><dt className="inline text-neutral-500">Your target </dt><dd className="inline whitespace-nowrap font-bold tabular-nums">{formatPrice(target)}</dd></div>
                  </dl>
                  <p className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${reached || a.email_sent ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-stone-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                    {a.email_sent ? <><BellRing className="h-3.5 w-3.5" /> Alert emailed</> : reached ? <><BellRing className="h-3.5 w-3.5" /> Target reached</> : `${gap}% above your target`}
                  </p>
                </div>
                <button onClick={() => remove(a.id)} disabled={busy === a.id} aria-label={`Remove price alert for ${p?.name || 'product'}`} className="grid h-10 w-10 shrink-0 place-items-center self-start rounded-xl text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-950/30">
                  {busy === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
