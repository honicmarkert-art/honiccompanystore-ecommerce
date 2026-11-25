"use client"

/**
 * Account overview: a quick look at orders, saved items, messages and coupons.
 * (Profile and password live in Settings; navigation lives in the account layout.)
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Clock, Heart, MessageCircle, Package, PackageSearch, ShoppingBag, Ticket } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useOrders } from '@/hooks/use-orders'
import { useWishlist } from '@/hooks/use-wishlist'
import { useSavedLater } from '@/hooks/use-saved-later'
import { useCurrency } from '@/contexts/currency-context'
import { OrderStatusChip } from '@/components/account/order-status'
import { whatsappLink } from '@/lib/contact'

type Coupon = { id: string; code: string; type: 'percentage' | 'fixed'; value: number; endsAt: string | null }

const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export default function AccountOverviewPage() {
  const { user } = useAuth()
  const { orders, loading: ordersLoading } = useOrders()
  const { items: wishlist } = useWishlist()
  const { items: saved } = useSavedLater()
  const { formatPrice } = useCurrency()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/promotions', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const rows = Array.isArray(d?.promotions) ? d.promotions : []
        setCoupons(rows.slice(0, 4).map((row: { id: string; code: string; discount_type: string; discount_value: number; end_date?: string | null }) => ({
          id: String(row.id), code: row.code, type: row.discount_type === 'percentage' ? 'percentage' : 'fixed',
          value: Number(row.discount_value) || 0, endsAt: row.end_date || null,
        })))
      })
      .catch(() => {})
    fetch('/api/notifications?unread_only=true', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setUnread(Number(d?.unreadCount) || 0) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const first = (user?.name || user?.email?.split('@')[0] || 'there').split(' ')[0]
  const active = orders.filter((o) => o.isReceived !== true && o.status !== 'cancelled')
  const recent = [...orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 3)

  const tiles = [
    { href: '/account/orders', label: 'Active orders', value: active.length, icon: Package },
    { href: '/account/wishlist', label: 'Wishlist', value: wishlist.length, icon: Heart },
    { href: '/account/saved-later', label: 'Saved for later', value: saved.length, icon: Clock },
    { href: '/account/messages', label: 'Unread messages', value: unread, icon: MessageCircle },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Hi, {first}</h1>
        <p className="mt-1 text-sm text-neutral-500">Your orders, saved items and messages in one place.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ href, label, value, icon: Icon }) => (
          <Link key={href} href={href} className="group rounded-2xl bg-white p-4 ring-1 ring-neutral-200 transition hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-800">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40"><Icon className="h-5 w-5" /></span>
            <p className="mt-3 text-2xl font-black tabular-nums">{value}</p>
            <p className="text-sm text-neutral-500">{label}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <h2 className="font-bold">Recent orders</h2>
          {orders.length > 0 && (
            <Link href="/account/orders" className="-my-2 inline-flex items-center gap-1 py-2 text-sm font-semibold text-orange-600 hover:underline">All orders <ArrowRight className="h-4 w-4" /></Link>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-neutral-300" />
            <p className="mt-3 font-semibold">{ordersLoading ? 'Loading your orders…' : 'No orders yet'}</p>
            {!ordersLoading && <p className="mt-1 text-sm text-neutral-500">When you buy something, you can follow it here.</p>}
            {!ordersLoading && (
              <Link href="/products" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600">Start shopping <ArrowRight className="h-4 w-4" /></Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recent.map((o) => (
              <li key={o.orderNumber}>
                <Link href={`/account/orders/${o.orderNumber}`} className="flex items-center gap-3 px-5 py-4 hover:bg-stone-50 dark:hover:bg-neutral-800/50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-neutral-500 dark:bg-neutral-800"><Package className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{o.orderNumber}</span>
                    <span className="block text-xs text-neutral-500">{date(o.createdAt)} · {o.totalItems || o.itemCount || o.items?.length || 0} item(s) · {formatPrice(Number(o.totalAmount) || 0)}</span>
                  </span>
                  <OrderStatusChip status={o.status} paymentStatus={o.paymentStatus} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold"><Ticket className="h-5 w-5 text-orange-600" /> Coupons</h2>
            {coupons.length > 0 && <Link href="/account/coupons" className="-my-2 py-2 text-sm font-semibold text-orange-600 hover:underline">See all</Link>}
          </div>
          {coupons.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No coupons right now. We&apos;ll show them here when there are offers.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {coupons.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-orange-300 px-3 py-2.5 dark:border-orange-800">
                  <span className="font-mono font-bold tracking-wide">{c.code}</span>
                  <span className="text-right text-xs text-neutral-500">
                    <span className="block text-sm font-bold text-orange-700 dark:text-orange-300">{c.type === 'percentage' ? `${c.value}% off` : `${formatPrice(c.value)} off`}</span>
                    {c.endsAt ? `until ${date(c.endsAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
          <h2 className="flex items-center gap-2 font-bold"><PackageSearch className="h-5 w-5 text-orange-600" /> Need help with an order?</h2>
          <p className="mt-2 text-sm text-neutral-500">Track a delivery, return an item, or ask us anything.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/support/order-tracking" className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold hover:bg-stone-200 dark:bg-neutral-800">Track an order</Link>
            <Link href="/support/returns-refunds" className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold hover:bg-stone-200 dark:bg-neutral-800">Returns</Link>
            <a href={whatsappLink('Hello Honic, I need help with my order')} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950">WhatsApp us</a>
          </div>
        </section>
      </div>
    </div>
  )
}
