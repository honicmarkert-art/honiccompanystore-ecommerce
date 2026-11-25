"use client"

/**
 * Pieces shared by the payment result page (/checkout/success|return|cancel) and the private
 * order page (/orders/[ref]): loading an order by its reference, item list, totals, invoice button,
 * and the "save your order link" box for guests.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Download, Loader2, Store, Truck } from 'lucide-react'
import { useCurrency } from '@/contexts/currency-context'
import { optimizedImg } from '@/lib/image-optimize'
import { TOP_UP_LABEL } from '@/lib/policies'

export type OrderView = {
  orderNumber: string
  referenceId: string
  status: string
  paymentStatus: string
  failureReason: string | null
  createdAt: string
  paidAt: string | null
  deliveryOption: 'pickup' | 'delivery'
  pickupId: string | null
  trackingNumber: string | null
  estimatedDelivery: string | null
  currency: string
  total: number
  subtotal: number
  deliveryFee: number
  firstName: string | null
  area: string | null
  phone: string | null
  email: string | null
  hasAccount: boolean
  items: { productId: number | null; name: string; variant: string | null; quantity: number; unitPrice: number; total: number; image: string | null }[]
}

export const card = 'rounded-2xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800'
export const when = (iso?: string | null, time = false) => (iso
  ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) })
  : '')
export const orderLink = (ref: string) => (typeof window !== 'undefined' ? window.location.origin : '') + `/orders/${ref}`

/** Load (and reload) an order by its private reference. */
export function useOrderView(ref: string | null) {
  const [order, setOrder] = useState<OrderView | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>(ref ? 'loading' : 'missing')

  const load = useCallback(async () => {
    if (!ref) { setState('missing'); return null }
    try {
      const res = await fetch(`/api/orders/view/${encodeURIComponent(ref)}`, { cache: 'no-store' })
      if (res.status === 404) { setState('missing'); return null }
      if (!res.ok) throw new Error()
      const data = await res.json()
      setOrder(data.order); setState('ready')
      return data.order as OrderView
    } catch {
      setState((s) => (s === 'ready' ? s : 'error'))
      return null
    }
  }, [ref])

  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect -- first load; state is set after the request
  return { order, state, reload: load }
}

/** Download the invoice PDF (or open it), with an inline error instead of a pop-up. */
export function InvoiceButton({ ref_, paid, className = '' }: { ref_: string; paid: boolean; className?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const download = async () => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/orders/invoice/${encodeURIComponent(ref_)}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'Honic-invoice.pdf'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      setError('Could not download the PDF. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={className}>
      <button onClick={download} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-950">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {paid ? 'Download invoice (PDF)' : 'Download order summary (PDF)'}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

/** Items + totals. */
export function OrderItemsCard({ order }: { order: OrderView }) {
  const { formatPrice } = useCurrency()
  const pickup = order.deliveryOption === 'pickup'
  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
        <h2 className="font-bold">Your items</h2>
        <span className="text-sm text-neutral-500">{order.items.length} item{order.items.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {order.items.map((it, i) => (
          <li key={i} className="flex gap-3 px-5 py-3">
            <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-neutral-100 dark:ring-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.image ? optimizedImg(it.image, 112) : '/placeholder.jpg'} alt="" className="h-full w-full object-contain p-1" />
            </span>
            <div className="min-w-0 flex-1">
              {it.productId
                ? <Link href={`/products/${it.productId}`} className="-my-1 line-clamp-2 py-1 text-sm font-semibold hover:text-orange-600">{it.name}</Link>
                : <p className="line-clamp-2 text-sm font-semibold">{it.name}</p>}
              {it.variant && <p className="text-xs text-neutral-500">{it.variant}</p>}
              <p className="text-xs text-neutral-500">{it.quantity} × {formatPrice(it.unitPrice)}</p>
            </div>
            <p className="whitespace-nowrap text-sm font-bold tabular-nums">{formatPrice(it.total)}</p>
          </li>
        ))}
      </ul>
      <dl className="space-y-2 border-t border-neutral-100 px-5 py-4 text-sm dark:border-neutral-800">
        <div className="flex justify-between gap-3"><dt className="text-neutral-500">Items</dt><dd className="tabular-nums">{formatPrice(order.subtotal)}</dd></div>
        <div className="flex justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-neutral-500">{pickup ? <Store className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}{pickup ? (order.deliveryFee > 0 ? TOP_UP_LABEL : 'Store pickup') : `Delivery${order.area ? ` to ${order.area}` : ''}`}</dt>
          <dd className="tabular-nums">{order.deliveryFee > 0 ? formatPrice(order.deliveryFee) : 'Free'}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-neutral-100 pt-2 text-base font-black dark:border-neutral-800"><dt>Total</dt><dd className="tabular-nums">{formatPrice(order.total)}</dd></div>
      </dl>
    </section>
  )
}

/** "Keep this link" box: how guests get back to their order from any phone or computer. */
export function SaveLinkCard({ order }: { order: OrderView }) {
  const [copied, setCopied] = useState(false)
  const link = orderLink(order.referenceId)
  const copy = async () => {
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ title: `Honic order ${order.orderNumber}`, url: link }); return }
      await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500)
    } catch { /* share sheet closed */ }
  }
  return (
    <section className={`${card} p-5`}>
      <h2 className="font-bold">Your private order link</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
        Open it on any phone or computer to follow this order and download the invoice. No account needed.
        {order.email && order.paymentStatus === 'paid' ? <> It is also in the receipt we emailed to <span className="font-semibold">{order.email}</span>.</> : null}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Order link" className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-stone-50 px-3.5 py-3 font-mono text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300" />
        <button onClick={copy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white hover:bg-orange-600">
          {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy link</>}
        </button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Keep it private: anyone with this link can see the order. Lost it? Use <Link href="/support/order-tracking" className="font-semibold text-orange-600 hover:underline">Track an order</Link> with your order number and phone.</p>
    </section>
  )
}
