"use client"

/**
 * One order: progress, packages by seller, delivery and payment details, totals, and the two
 * customer actions the API supports: confirm a delivered package (mark-delivered) and confirm the
 * whole order received (mark-received). Refreshes quietly every 2 minutes while the tab is visible.
 */
import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, ArrowLeft, Check, CheckCircle2, CreditCard, Download, Loader2, MapPin,
  MessageCircle, Package, Phone, RefreshCw, RotateCcw, Store, Truck,
} from 'lucide-react'
import { useOrders } from '@/hooks/use-orders'
import { useCurrency } from '@/contexts/currency-context'
import { OrderStatusChip, orderStatus } from '@/components/account/order-status'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { optimizedImg } from '@/lib/image-optimize'
import { whatsappLink } from '@/lib/contact'
import { RETURN_DAYS, UNPAID_ORDER_EXPIRY_MINUTES } from '@/lib/policies'

type Address = { fullName?: string; address?: string; address1?: string; streetName?: string; ward?: string; district?: string; address2?: string; city?: string; state?: string; region?: string; country?: string; phone?: string; email?: string }
type Item = {
  productId: string; productName: string; productImage: string; variantName?: string
  quantity: number; unitPrice: number; totalPrice: number
  supplierName?: string | null; trackingNumber?: string | null; status?: string
}
type Order = {
  orderNumber: string; referenceId: string; pickupId: string; status: string
  totalAmount: number; currency: string; itemCount: number; createdAt: string; updatedAt: string
  paymentMethod: string; paymentStatus: string; paymentTimestamp?: string; failureReason?: string
  deliveryOption: 'shipping' | 'pickup' | 'delivery'; trackingNumber?: string; estimatedDelivery?: string
  isReceived?: boolean; receivedAt?: string | null; confirmedAt?: string | null
  shippingAddress?: Address; billingAddress?: Address; items: Item[]; notes?: string
}

const card = 'rounded-2xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800'
const when = (iso?: string | null, time = false) => iso
  ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) })
  : ''

/** the furthest status any item in a package has reached */
function packageStatus(items: Item[]) {
  const rank = ['confirmed', 'shipped', 'ready_for_pickup', 'delivered', 'picked_up']
  return items.reduce((best, i) => (rank.indexOf(i.status || 'confirmed') > rank.indexOf(best) ? (i.status as string) : best), 'confirmed')
}
const payMethod = (m?: string) => {
  const t = (m || 'mobile_money').replace(/[_-]+/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const PACKAGE_LABEL: Record<string, string> = {
  confirmed: 'Being prepared', shipped: 'On the way', ready_for_pickup: 'Ready for pickup', delivered: 'Delivered', picked_up: 'Received',
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderNumber } = use(params)
  const { fetchOrderByNumber } = useOrders()
  const { formatPrice } = useCurrency()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'package' | 'received' | 'invoice' | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [loadedAt, setLoadedAt] = useState(0)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true)
    try {
      const data = await fetchOrderByNumber(orderNumber)
      if (data) setOrder(data as unknown as Order)
      setLoadedAt(Date.now())
      setError(null)
    } catch (e: unknown) {
      if (!quiet) {
        const err = e as { status?: number; code?: string }
        setError(err?.status === 429 || err?.code === 'over_request_rate_limit'
          ? 'Too many requests. Please wait a moment and try again.'
          : getFriendlyErrorMessage(e, 'Could not load this order. Please try again.'))
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fetchOrderByNumber, orderNumber])

  useEffect(() => {
    load(true) // eslint-disable-line react-hooks/set-state-in-effect -- first load; state is set after the request
    const t = setInterval(() => { if (!document.hidden) load(true) }, 120_000)
    return () => clearInterval(t)
  }, [load])

  const patch = async (path: 'mark-delivered' | 'mark-received', kind: 'package' | 'received', okText: string) => {
    setBusy(kind); setNotice(null)
    try {
      const res = await fetch(`/api/user/orders/${encodeURIComponent(orderNumber)}/${path}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(getFriendlyErrorMessage(data?.error || data?.details, 'Something went wrong. Please try again.'))
      setNotice({ tone: 'ok', text: okText })
      setConfirming(false)
      await load(true)
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  const downloadInvoice = async () => {
    setBusy('invoice'); setNotice(null)
    try {
      const res = await fetch(`/api/user/orders/${encodeURIComponent(orderNumber)}/invoice`)
      if (!res.ok) throw new Error()
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a'); a.href = url; a.download = `Honic-invoice-${orderNumber}.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      setNotice({ tone: 'error', text: 'Could not download the invoice. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />)}</div>
  }

  if (!order) {
    return (
      <div className={`${card} px-6 py-12 text-center`}>
        {error ? <AlertCircle className="mx-auto h-10 w-10 text-red-500" /> : <Package className="mx-auto h-10 w-10 text-neutral-300" />}
        <p className="mt-3 font-semibold">{error ? 'Could not load this order' : 'Order not found'}</p>
        <p className="mt-1 text-sm text-neutral-500">{error || 'This order does not exist, or it belongs to another account.'}</p>
        <div className="mt-4 flex justify-center gap-2">
          {error && <button onClick={() => load()} className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600">Try again</button>}
          <Link href="/account/orders" className="rounded-xl bg-stone-100 px-5 py-2.5 text-sm font-semibold hover:bg-stone-200 dark:bg-neutral-800">My orders</Link>
        </div>
      </div>
    )
  }

  const pickup = order.deliveryOption === 'pickup'
  const paid = order.paymentStatus === 'paid'
  const cancelled = order.status === 'cancelled'
  const status = orderStatus(order.status, order.paymentStatus)
  const items = order.items || []
  const subtotal = items.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0)
  const total = Number(order.totalAmount) || 0
  const deliveryFee = Math.max(0, total - subtotal)
  const minutesOld = (loadedAt - new Date(order.createdAt).getTime()) / 60_000
  const canPay = !paid && !cancelled && order.status === 'pending' && minutesOld < UNPAID_ORDER_EXPIRY_MINUTES && !!order.referenceId
  const allArrived = ['delivered', 'picked_up'].includes(order.status) || (items.length > 0 && items.every((i) => i.status === 'delivered' || i.status === 'picked_up'))
  const canConfirmReceived = !order.isReceived && !cancelled && ['delivered', 'picked_up'].includes(order.status)

  // seller packages
  const groups = new Map<string, Item[]>()
  for (const it of items) {
    const k = it.supplierName && !/^unknown/i.test(it.supplierName) ? it.supplierName : 'Honic'
    groups.set(k, [...(groups.get(k) || []), it])
  }

  // progress steps
  const reached = (s: string) => {
    const flow = ['pending', 'confirmed', 'shipped', 'ready_for_pickup', 'delivered', 'picked_up']
    return flow.indexOf(order.status) >= flow.indexOf(s)
  }
  const steps = [
    { label: 'Placed', done: true, at: order.createdAt },
    { label: 'Paid', done: paid, at: order.paymentTimestamp },
    { label: 'Prepared', done: paid && (reached('confirmed') || !!order.confirmedAt), at: order.confirmedAt },
    { label: pickup ? 'Ready for pickup' : 'On the way', done: paid && (pickup ? reached('ready_for_pickup') : reached('shipped')) },
    { label: pickup ? 'Picked up' : 'Delivered', done: allArrived },
    { label: 'Received', done: !!order.isReceived, at: order.receivedAt },
  ]

  const addr = order.shippingAddress
  // checkout saves address1 / streetName / ward / district; older orders may have "address"
  const street = addr ? [addr.address1 || addr.address, addr.streetName, addr.address2].filter(Boolean).join(', ') : ''
  const area = addr ? [...new Set([addr.ward, addr.district, addr.city, addr.region || addr.state].filter(Boolean))].join(', ') : ''
  const help = whatsappLink(`Hello Honic, I need help with order ${order.orderNumber}`)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href={order.isReceived ? '/account/orders/history' : '/account/orders'} className="-ml-2 inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold text-neutral-600 hover:text-orange-600 dark:text-neutral-300">
          <ArrowLeft className="h-4 w-4" /> {order.isReceived ? 'Order history' : 'My orders'}
        </Link>
        <button onClick={() => load()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold ring-1 ring-neutral-200 hover:ring-orange-400 disabled:opacity-60 dark:bg-neutral-900 dark:ring-neutral-800">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* header */}
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-all text-xl font-black tracking-tight sm:text-2xl">{order.orderNumber}</h1>
              {order.isReceived
                ? <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Received</span>
                : <OrderStatusChip status={order.status} paymentStatus={order.paymentStatus} />}
            </div>
            <p className="mt-1 text-sm text-neutral-500">Placed {when(order.createdAt, true)} · {order.itemCount || items.length} item{(order.itemCount || items.length) === 1 ? '' : 's'}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black tabular-nums">{formatPrice(total)}</p>
            <p className="text-xs text-neutral-500">{paid ? 'Paid' : cancelled ? 'Not charged' : 'To pay'}</p>
          </div>
        </div>

        {!cancelled && (
          <ol className="mt-6 grid grid-cols-3 gap-y-4 sm:grid-cols-6">
            {steps.map((s, i) => (
              <li key={s.label} className="relative flex flex-col items-center text-center">
                {i > 0 && <span aria-hidden className={`absolute right-1/2 top-3.5 hidden h-0.5 w-full sm:block ${s.done ? 'bg-orange-500' : 'bg-neutral-200 dark:bg-neutral-700'}`} />}
                <span className={`relative grid h-7 w-7 place-items-center rounded-full ${s.done ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-400 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700'}`}>
                  {s.done ? <Check className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <span className={`mt-1.5 text-xs font-semibold ${s.done ? '' : 'text-neutral-400'}`}>{s.label}</span>
                {s.done && s.at && <span className="text-[11px] text-neutral-500">{when(s.at)}</span>}
              </li>
            ))}
          </ol>
        )}

        {/* what to do now */}
        {cancelled && (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            This order was cancelled.{paid ? ' If you were charged, the refund goes back to the same payment method.' : ''} {order.failureReason ? `Reason: ${order.failureReason}` : ''}
          </p>
        )}
        {!paid && !cancelled && order.status === 'pending' && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p>
              {canPay
                ? `Waiting for your payment. Unpaid orders are cancelled after ${UNPAID_ORDER_EXPIRY_MINUTES} minutes.`
                : 'This order was not paid in time, so it will be cancelled. Add the items to your cart again to place a new order.'}
            </p>
            {canPay && (
              <Link href={`/checkout/return?orderReference=${encodeURIComponent(order.referenceId)}`} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 font-bold text-white hover:bg-orange-600">
                <CreditCard className="h-4 w-4" /> Complete payment
              </Link>
            )}
          </div>
        )}
        {status.label === 'Ready for pickup' && !order.isReceived && (
          <p className="mt-5 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:bg-orange-950/30 dark:text-orange-200">
            Your order is ready. Bring your pickup ID <span className="font-mono font-bold">{order.pickupId}</span> and a valid ID when you collect it.
          </p>
        )}
        {canConfirmReceived && (
          <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-4 dark:bg-emerald-950/30">
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">Got everything?</p>
            <p className="mt-0.5 text-sm text-emerald-800 dark:text-emerald-300">Confirm once all items have arrived and work. Something wrong? You have {RETURN_DAYS} days to <Link href="/support/returns-refunds" className="font-semibold underline">ask for a return</Link>.</p>
            {confirming ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => patch('mark-received', 'received', 'Thank you! Your order is complete.')} disabled={busy === 'received'} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {busy === 'received' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Yes, I received my order
                </button>
                <button onClick={() => setConfirming(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/40">Not yet</button>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Confirm order received
              </button>
            )}
          </div>
        )}
        {notice && (
          <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-xl px-4 py-3 text-sm ${notice.tone === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>{notice.text}</p>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* packages */}
        <div className="min-w-0 space-y-4">
          {[...groups.entries()].map(([seller, its]) => {
            const ps = packageStatus(its)
            const tracking = its.find((i) => i.trackingNumber)?.trackingNumber
            return (
              <section key={seller} className={card}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-100 px-4 py-3 sm:px-5 dark:border-neutral-800">
                  <Store className="h-4 w-4 text-neutral-400" />
                  <span className="font-bold">{seller}</span>
                  <span className="text-xs text-neutral-500">{its.length} product{its.length === 1 ? '' : 's'}</span>
                  {paid && !cancelled && (
                    <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${ps === 'delivered' || ps === 'picked_up' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'}`}>{PACKAGE_LABEL[ps] || ps}</span>
                  )}
                </div>
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {its.map((it, idx) => (
                    <li key={`${it.productId}-${idx}`} className="flex gap-3 px-4 py-3 sm:px-5">
                      <Link href={`/products/${it.productId}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-neutral-100 dark:ring-neutral-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.productImage ? optimizedImg(it.productImage, 128) : '/placeholder.jpg'} alt="" className="h-full w-full object-contain p-1" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link href={`/products/${it.productId}`} className="-my-1.5 line-clamp-2 py-1.5 text-sm font-semibold hover:text-orange-600">{it.productName}</Link>
                        {it.variantName && <p className="text-xs text-neutral-500">{it.variantName}</p>}
                        <p className="mt-0.5 text-xs text-neutral-500">{it.quantity} × {formatPrice(Number(it.unitPrice) || 0)}</p>
                      </div>
                      <p className="text-sm font-bold tabular-nums">{formatPrice(Number(it.totalPrice) || 0)}</p>
                    </li>
                  ))}
                </ul>
                {(tracking || ps === 'delivered') && (
                  <div className="space-y-3 border-t border-neutral-100 px-4 py-3 sm:px-5 dark:border-neutral-800">
                    {tracking && <p className="text-sm"><span className="text-neutral-500">Tracking number:</span> <span className="break-all font-mono font-semibold">{tracking}</span></p>}
                    {ps === 'delivered' && !order.isReceived && (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-neutral-600 dark:text-neutral-300">{seller} marked this package as delivered{pickup ? ' to the pickup point' : ''}. Do you have it?</p>
                        <button onClick={() => patch('mark-delivered', 'package', 'Thanks, we noted that you have the package.')} disabled={busy === 'package'} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-950">
                          {busy === 'package' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} I have this package
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}
          {order.notes && (
            <section className={`${card} p-5`}>
              <h2 className="font-bold">Your note</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-neutral-600 dark:text-neutral-300">{order.notes}</p>
            </section>
          )}
        </div>

        {/* side */}
        <aside className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 xl:content-start">
          <section className={`${card} p-5`}>
            <h2 className="font-bold">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-neutral-500">Items</dt><dd className="tabular-nums">{formatPrice(subtotal)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-neutral-500">{pickup ? 'Pickup' : 'Delivery'}</dt><dd className="tabular-nums">{deliveryFee > 0 ? formatPrice(deliveryFee) : 'Free'}</dd></div>
              <div className="flex justify-between gap-3 border-t border-neutral-100 pt-2 text-base font-black dark:border-neutral-800"><dt>Total</dt><dd className="tabular-nums">{formatPrice(total)}</dd></div>
            </dl>
            {paid && (
              <button onClick={downloadInvoice} disabled={busy === 'invoice'} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold hover:bg-stone-200 disabled:opacity-60 dark:bg-neutral-800">
                {busy === 'invoice' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download invoice (PDF)
              </button>
            )}
          </section>

          <section className={`${card} p-5`}>
            <h2 className="flex items-center gap-2 font-bold">{pickup ? <Store className="h-4 w-4 text-orange-600" /> : <Truck className="h-4 w-4 text-orange-600" />} {pickup ? 'Store pickup' : 'Delivery'}</h2>
            {pickup ? (
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">Pickup ID <span className="font-mono font-bold">{order.pickupId}</span>. Bring it and a valid ID when you collect.</p>
            ) : addr ? (
              <div className="mt-2 space-y-0.5 text-sm text-neutral-600 dark:text-neutral-300">
                {addr.fullName && <p className="font-semibold text-neutral-900 dark:text-white">{addr.fullName}</p>}
                {street && <p className="flex gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />{street}</p>}
                {area && <p className={street ? "pl-5" : ""}>{area}</p>}
                {addr.phone && <p className="flex gap-1.5"><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />{addr.phone}</p>}
              </div>
            ) : <p className="mt-2 text-sm text-neutral-500">No address on this order.</p>}
            {order.estimatedDelivery && !allArrived && <p className="mt-3 text-sm"><span className="text-neutral-500">Expected:</span> <span className="font-semibold">{when(order.estimatedDelivery)}</span></p>}
          </section>

          <section className={`${card} p-5`}>
            <h2 className="flex items-center gap-2 font-bold"><CreditCard className="h-4 w-4 text-orange-600" /> Payment</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{payMethod(order.paymentMethod)} · <span className={paid ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'font-semibold'}>{paid ? `Paid${order.paymentTimestamp ? ` ${when(order.paymentTimestamp)}` : ''}` : order.paymentStatus === 'failed' ? 'Payment failed' : 'Not paid'}</span></p>
            <p className="mt-1 text-xs text-neutral-500">Reference {order.referenceId}</p>
          </section>

          <section className={`${card} p-5`}>
            <h2 className="font-bold">Need help?</h2>
            <div className="mt-3 grid gap-2">
              <a href={help} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold hover:bg-stone-200 dark:bg-neutral-800"><MessageCircle className="h-4 w-4" /> WhatsApp us about this order</a>
              <Link href="/support/returns-refunds" className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold hover:bg-stone-200 dark:bg-neutral-800"><RotateCcw className="h-4 w-4" /> Returns &amp; refunds</Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
