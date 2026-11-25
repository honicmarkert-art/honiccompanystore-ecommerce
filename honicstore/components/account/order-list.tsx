"use client"

/**
 * The order cards behind "My orders" (still in progress) and "Order history" (received or
 * fully picked up). Search, status filters (active only) and invoice download for paid orders.
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Download, Loader2, Package, RefreshCw, Search, ShoppingBag, Store, Truck } from 'lucide-react'
import { useOrders } from '@/hooks/use-orders'
import { useCurrency } from '@/contexts/currency-context'
import { OrderStatusChip, orderStatus } from '@/components/account/order-status'
import { optimizedImg } from '@/lib/image-optimize'

type Filter = 'all' | 'to_pay' | 'progress' | 'done' | 'cancelled'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'to_pay', label: 'To pay' },
  { id: 'progress', label: 'In progress' },
  { id: 'done', label: 'Delivered / picked up' },
  { id: 'cancelled', label: 'Cancelled' },
]

const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export function OrderList({ mode }: { mode: 'active' | 'history' }) {
  const { orders, loading, error, refetch } = useOrders()
  const { formatPrice } = useCurrency()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)

  // finished = received, or every item picked up; everything else is in progress
  const active = useMemo(() => orders.filter((o) => {
    const done = o.isReceived === true || (!!o.items?.length && o.items.every((i) => (i as { status?: string }).status === 'picked_up'))
    return mode === 'history' ? done : !done
  }).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [orders, mode])

  const shown = active.filter((o) => {
    const s = orderStatus(o.status, o.paymentStatus)
    if (filter === 'to_pay' && s.label !== 'Awaiting payment') return false
    if (filter === 'progress' && s.tone !== 'progress') return false
    if (filter === 'done' && s.tone !== 'success') return false
    if (filter === 'cancelled' && s.tone !== 'danger') return false
    const term = q.trim().toLowerCase()
    return !term || o.orderNumber.toLowerCase().includes(term) || o.items?.some((i) => (i.productName || '').toLowerCase().includes(term))
  })

  const downloadInvoice = async (orderNumber: string) => {
    setDownloading(orderNumber); setInvoiceError(null)
    try {
      const res = await fetch(`/api/user/orders/${encodeURIComponent(orderNumber)}/invoice`)
      if (!res.ok) throw new Error()
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a'); a.href = url; a.download = `Honic-invoice-${orderNumber}.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      setInvoiceError(`Could not download the invoice for ${orderNumber}. Please try again.`)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{mode === 'history' ? 'Order history' : 'My orders'}</h1>
          {mode === 'history'
            ? <p className="mt-1 text-sm text-neutral-500">Orders you have received. Orders still on the way are in <Link href="/account/orders" className="font-semibold text-orange-600 hover:underline">my orders</Link>.</p>
            : <p className="mt-1 text-sm text-neutral-500">Orders on their way to you. Finished orders are in <Link href="/account/orders/history" className="font-semibold text-orange-600 hover:underline">order history</Link>.</p>}
        </div>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-800">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {active.length > 0 && (
        <div className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Search your orders</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by order number or product" className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-orange-500 dark:border-neutral-700 dark:bg-neutral-900" />
          </label>
          {mode === 'active' && <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${filter === f.id ? 'bg-orange-500 text-white' : 'bg-white ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-700'}`}>
                {f.label}
              </button>
            ))}
          </div>}
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">Could not load your orders. <button onClick={() => refetch()} className="font-semibold underline">Try again</button></p>}
      {invoiceError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{invoiceError}</p>}

      {loading && orders.length === 0 ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />)}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
          <ShoppingBag className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-3 font-semibold">{active.length ? 'No orders match' : mode === 'history' ? 'No finished orders yet' : 'No orders in progress'}</p>
          <p className="mt-1 text-sm text-neutral-500">{active.length ? 'Try another filter or search.' : mode === 'history' ? 'Orders appear here once you confirm you received them.' : 'When you buy something, you can follow it here.'}</p>
          {!active.length && <Link href="/products" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600">Start shopping <ArrowRight className="h-4 w-4" /></Link>}
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((o) => {
            const items = o.items || []
            const count = o.totalItems || o.itemCount || items.length
            return (
              <li key={o.orderNumber} className="rounded-2xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800 sm:px-5">
                  <span className="font-bold">{o.orderNumber}</span>
                  <span className="text-xs text-neutral-500">{date(o.createdAt)}</span>
                  <span className="ml-auto">{o.isReceived ? <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Received{o.receivedAt ? ` ${date(o.receivedAt)}` : ''}</span> : <OrderStatusChip status={o.status} paymentStatus={o.paymentStatus} />}</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
                  <div className="flex -space-x-3">
                    {items.slice(0, 3).map((it, i) => (
                      <span key={i} className="relative h-14 w-14 overflow-hidden rounded-xl bg-white ring-2 ring-white dark:ring-neutral-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.productImage ? optimizedImg(it.productImage, 64) : '/placeholder.jpg'} alt="" className="h-full w-full object-contain p-1" />
                      </span>
                    ))}
                    {items.length === 0 && <span className="grid h-14 w-14 place-items-center rounded-xl bg-stone-100 dark:bg-neutral-800"><Package className="h-6 w-6 text-neutral-400" /></span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{items[0]?.productName || 'Order'}{items.length > 1 ? ` + ${items.length - 1} more` : ''}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                      {o.deliveryOption === 'pickup' ? <Store className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                      {o.deliveryOption === 'pickup' ? 'Store pickup' : `Delivery${o.shippingAddress?.city ? ` to ${o.shippingAddress.city}` : ''}`} · {count} item{count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <p className="text-lg font-black tabular-nums">{formatPrice(Number(o.totalAmount) || 0)}</p>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-4 py-3 dark:border-neutral-800 sm:px-5">
                  <Link href={`/account/orders/${o.orderNumber}`} className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600">View order <ArrowRight className="h-4 w-4" /></Link>
                  {o.paymentStatus === 'paid' && (
                    <button onClick={() => downloadInvoice(o.orderNumber)} disabled={downloading === o.orderNumber} className="inline-flex items-center gap-1.5 rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold hover:bg-stone-200 disabled:opacity-60 dark:bg-neutral-800">
                      {downloading === o.orderNumber ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Invoice PDF
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
