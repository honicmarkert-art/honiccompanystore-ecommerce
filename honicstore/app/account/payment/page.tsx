"use client"

/**
 * Payments & addresses, built from the shopper's real orders:
 * - payment history = each order's payment status, amount and method
 * - addresses = the delivery addresses used on past orders (checkout asks for the address each time)
 */
import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPin, Phone, Smartphone, Wallet } from 'lucide-react'
import { useOrders } from '@/hooks/use-orders'
import { useCurrency } from '@/contexts/currency-context'

const card = 'rounded-2xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800'
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const method = (m?: string) => {
  const t = (m || 'mobile_money').replace(/[_-]+/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function paymentLabel(paymentStatus?: string, status?: string): { label: string; cls: string } {
  if (paymentStatus === 'paid') return status === 'cancelled'
    ? { label: 'Paid · order cancelled', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' }
    : { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' }
  if (paymentStatus === 'refunded') return { label: 'Refunded', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' }
  if (paymentStatus === 'failed') return { label: 'Failed', cls: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' }
  if (status === 'cancelled') return { label: 'Not charged', cls: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300' }
  return { label: 'Not paid', cls: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' }
}

export default function PaymentsAddressesPage() {
  const { orders, loading, error, refetch } = useOrders()
  const { formatPrice } = useCurrency()

  const sorted = useMemo(() => [...orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [orders])
  const totalPaid = sorted.filter((o) => o.paymentStatus === 'paid' && o.status !== 'cancelled').reduce((s, o) => s + (Number(o.totalAmount) || 0), 0)

  const addresses = useMemo(() => {
    const seen = new Map<string, { fullName?: string; address?: string; city?: string; region?: string; phone?: string; lastUsed: string }>()
    for (const o of sorted) {
      if (o.deliveryOption === 'pickup' || !o.shippingAddress?.address) continue
      const a = o.shippingAddress as { fullName?: string; address?: string; city?: string; state?: string; region?: string; phone?: string }
      const key = [a.address, a.city, a.phone].map((s) => (s || '').trim().toLowerCase()).join('|')
      if (!seen.has(key)) seen.set(key, { fullName: a.fullName, address: a.address, city: a.city, region: a.state || a.region, phone: a.phone, lastUsed: o.createdAt })
    }
    return [...seen.values()].slice(0, 6)
  }, [sorted])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Payments &amp; addresses</h1>
        <p className="mt-1 text-sm text-neutral-500">You pay with mobile money (M-Pesa, Airtel Money, Mixx, HaloPesa) at checkout. We never store card or PIN details.</p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">Could not load your orders. <button onClick={() => refetch()} className="font-semibold underline">Try again</button></p>}

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <h2 className="flex items-center gap-2 font-bold"><Wallet className="h-5 w-5 text-orange-600" /> Payment history</h2>
          {totalPaid > 0 && <p className="text-sm text-neutral-500">Paid in total <span className="font-bold text-neutral-900 tabular-nums dark:text-white">{formatPrice(totalPaid)}</span></p>}
        </div>
        {loading && orders.length === 0 ? (
          <div className="space-y-2 p-5">{[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-stone-100 dark:bg-neutral-800" />)}</div>
        ) : sorted.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-500">No payments yet. Your payments show here after you place an order.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sorted.map((o) => {
              const s = paymentLabel(o.paymentStatus, o.status)
              return (
                <li key={o.orderNumber}>
                  <Link href={`/account/orders/${o.orderNumber}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50 dark:hover:bg-neutral-800/50">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-neutral-500 dark:bg-neutral-800"><Smartphone className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{o.orderNumber}</span>
                      <span className="block text-xs text-neutral-500">{date(o.createdAt)} · {method(o.paymentMethod)}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold tabular-nums">{formatPrice(Number(o.totalAmount) || 0)}</span>
                      <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className={card}>
        <div className="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <h2 className="flex items-center gap-2 font-bold"><MapPin className="h-5 w-5 text-orange-600" /> Delivery addresses</h2>
          <p className="mt-1 text-sm text-neutral-500">Addresses from your past orders. Checkout asks where to deliver each time, so you can always use a new one.</p>
        </div>
        {addresses.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-500">{loading ? 'Loading…' : 'No delivery addresses yet.'}</p>
        ) : (
          <ul className="grid gap-3 p-5 sm:grid-cols-2">
            {addresses.map((a, i) => (
              <li key={i} className="rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-700">
                {a.fullName && <p className="font-semibold">{a.fullName}</p>}
                <p className="mt-0.5 text-neutral-600 dark:text-neutral-300">{a.address}</p>
                {(a.city || a.region) && <p className="text-neutral-600 dark:text-neutral-300">{[...new Set([a.city, a.region].filter(Boolean))].join(', ')}</p>}
                {a.phone && <p className="mt-1 flex items-center gap-1.5 text-neutral-500"><Phone className="h-3.5 w-3.5" />{a.phone}</p>}
                <p className="mt-2 text-xs text-neutral-400">Last used {date(a.lastUsed)}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-neutral-100 px-5 py-3 dark:border-neutral-800">
          <Link href="/support/shipping-info" className="-my-1 inline-flex items-center gap-1 py-2 text-sm font-semibold text-orange-600 hover:underline">Delivery areas and prices <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  )
}
