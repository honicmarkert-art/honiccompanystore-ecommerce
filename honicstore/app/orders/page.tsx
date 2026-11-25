"use client"

/** Orders placed in this browser (kept locally), each opening its private order page. */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, PackageSearch, ShoppingBag } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/contexts/auth-context'
import { useCurrency } from '@/contexts/currency-context'
import { readLocalOrders, type LocalOrder } from '@/lib/local-orders'

const card = 'rounded-2xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800'
const refOf = (o: LocalOrder) => o.referenceId.replace(/[^A-Za-z0-9]/g, '').toLowerCase()

export default function LocalOrdersPage() {
  const { isAuthenticated } = useAuth()
  const { formatPrice } = useCurrency()
  const [orders, setOrders] = useState<LocalOrder[] | null>(null)

  useEffect(() => { setOrders(readLocalOrders()) }, []) // eslint-disable-line react-hooks/set-state-in-effect -- browser storage is only readable after mount

  return (
    <div className="min-h-screen bg-stone-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Orders on this device</h1>
        <p className="mt-1 text-sm text-neutral-500">Orders placed in this browser. On another phone or computer, use the order link from your email or <Link href="/support/order-tracking" className="font-semibold text-orange-600 hover:underline">track an order</Link>.</p>
        {isAuthenticated && <Link href="/account/orders" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-700">All orders in my account <ArrowRight className="h-4 w-4" /></Link>}

        <div className="mt-6">
          {orders === null ? (
            <div className="h-24 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />
          ) : orders.length === 0 ? (
            <div className={`${card} px-6 py-12 text-center`}>
              <ShoppingBag className="mx-auto h-10 w-10 text-neutral-300" />
              <p className="mt-3 font-semibold">No orders in this browser</p>
              <p className="mt-1 text-sm text-neutral-500">Ordered on another device? Track it with your order number and phone.</p>
              <Link href="/support/order-tracking" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600"><PackageSearch className="h-4 w-4" /> Track an order</Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li key={o.referenceId}>
                  <Link href={/^[a-f0-9]{32}$/.test(refOf(o)) ? `/orders/${refOf(o)}` : '/support/order-tracking'} className={`${card} flex items-center gap-4 p-4 hover:ring-orange-400`}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40"><ShoppingBag className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{o.items.length ? `${o.items[0].name}${o.items.length > 1 ? ` + ${o.items.length - 1} more` : ''}` : 'Order'}</span>
                      <span className="block text-xs text-neutral-500">{new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {o.status === 'paid' ? 'Paid' : 'Payment started'}</span>
                    </span>
                    <span className="whitespace-nowrap font-black tabular-nums">{formatPrice(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
