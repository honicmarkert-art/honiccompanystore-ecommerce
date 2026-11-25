"use client"

/**
 * Payment result: one page for every outcome, shown at /checkout/success, /checkout/return and
 * /checkout/cancel (old links keep working). It never trusts the URL: it asks the server, which
 * checks with the payment provider, and keeps checking while the payment is still waiting.
 *
 *   paid      -> thank you, what happens next, invoice PDF, order link (guests) / account link
 *   waiting   -> "approve the prompt on your phone", resend prompt
 *   failed    -> reason, try again (sends a new prompt to the same number), back to cart
 *   expired   -> order cancelled after the payment window, back to cart
 *
 * When the payment is confirmed it removes the bought items from the cart (recorded by checkout).
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Loader2, MessageCircle, PackageCheck, RefreshCw, ShoppingBag, Smartphone, XCircle } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/contexts/auth-context'
import { useCart } from '@/hooks/use-cart'
import { useCurrency } from '@/contexts/currency-context'
import { clearCheckoutSessionStorage } from '@/lib/checkout-utils'
import { BOUGHT_ITEMS_KEY as BOUGHT_KEY } from '@/lib/local-orders'
import { whatsappLink } from '@/lib/contact'
import { UNPAID_ORDER_EXPIRY_MINUTES } from '@/lib/policies'
import { InvoiceButton, OrderItemsCard, SaveLinkCard, card, useOrderView, when } from '@/components/orders/order-parts'

type Phase = 'paid' | 'waiting' | 'failed' | 'expired'

function readRef(sp: URLSearchParams): string | null {
  const raw = sp.get('orderReference') || sp.get('order_reference') || sp.get('reference') || sp.get('ref') || sp.get('order_id')
    || (typeof window !== 'undefined' ? sessionStorage.getItem('last_order_reference') : null)
  const ref = String(raw || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase()
  return /^[a-f0-9]{32}$/.test(ref) ? ref : null
}

export function PaymentResult() {
  const sp = useSearchParams()
  const [ref] = useState(() => readRef(new URLSearchParams(sp.toString())))
  const { order, state, reload } = useOrderView(ref)
  const { isAuthenticated } = useAuth()
  const { cart, hasLoaded, removeItem, clearCart } = useCart()
  const { formatPrice } = useCurrency()
  const [resending, setResending] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [now, setNow] = useState(0)
  const [promptAt, setPromptAt] = useState(0) // when we last re-sent the payment prompt

  const phase: Phase | null = !order ? null
    : order.paymentStatus === 'paid' ? 'paid'
      : order.status === 'cancelled' ? 'expired'
        : order.paymentStatus === 'failed' ? 'failed'
          : 'waiting'

  // ask the server (which checks with the payment provider) while the payment is waiting
  const check = useCallback(async () => {
    if (!ref) return
    try { await fetch(`/api/payment/snippe?orderReference=${encodeURIComponent(ref)}&t=${Date.now()}`, { cache: 'no-store' }) } catch { /* next tick */ }
    await reload()
    setNow(Date.now())
  }, [ref, reload])

  useEffect(() => {
    if (phase !== 'waiting') return
    const t = setInterval(check, 4000)
    return () => clearInterval(t)
  }, [phase, check])

  useEffect(() => { setNow(Date.now()) }, [phase]) // eslint-disable-line react-hooks/set-state-in-effect -- time stamp for "how long have we waited"

  // paid: tidy up checkout state and remove the bought items from the cart (one per render, with fresh cart data)
  useEffect(() => {
    if (phase !== 'paid' || !hasLoaded) return
    try { clearCheckoutSessionStorage(); sessionStorage.removeItem('last_order_reference') } catch { /* private mode */ }
    let rec: { ref?: string; all?: boolean; items?: { productId: number; variantId?: string | null }[] } | null = null
    try { rec = JSON.parse(sessionStorage.getItem(BOUGHT_KEY) || 'null') } catch { rec = null }
    if (!rec || rec.ref !== ref) return
    if (rec.all) { sessionStorage.removeItem(BOUGHT_KEY); clearCart(); return }
    const [next, ...rest] = rec.items || []
    if (!next) { sessionStorage.removeItem(BOUGHT_KEY); return }
    sessionStorage.setItem(BOUGHT_KEY, JSON.stringify({ ...rec, items: rest }))
    if (cart.some((c) => c.productId === next.productId)) removeItem(next.productId, next.variantId || undefined)
  }, [phase, hasLoaded, cart, ref, removeItem, clearCart])

  const resend = async () => {
    if (!order) return
    setResending(true); setNotice(null)
    try {
      const res = await fetch('/api/payment/snippe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: String(Math.round(order.total)), orderId: order.referenceId, customerDetails: {} }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data.error || 'Could not send the payment request.')
      setPromptAt(Date.now())
      setNotice({ tone: 'ok', text: `We sent a new payment request${order.phone ? ` to ${order.phone}` : ''}. Approve it on your phone.` })
      await reload()
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Could not send the payment request.' })
    } finally {
      setResending(false)
    }
  }

  const minutesLeft = order && now ? Math.max(0, Math.ceil(UNPAID_ORDER_EXPIRY_MINUTES - (now - new Date(order.createdAt).getTime()) / 60000)) : null
  // the first prompt goes out when the order is placed; allow a resend after 90 s without an answer
  const waitedLong = phase === 'waiting' && !!order && now > 0 && now - Math.max(new Date(order.createdAt).getTime(), promptAt) > 90_000
  const help = whatsappLink(`Hello Honic, I need help with the payment for order ${order?.orderNumber || ''}`.trim())
  const accountLink = order && isAuthenticated && order.hasAccount ? `/account/orders/${order.orderNumber}` : null

  return (
    <div className="min-h-screen bg-stone-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {state === 'loading' || (!order && state !== 'missing' && state !== 'error') ? (
          <div className={`${card} mx-auto max-w-xl px-6 py-16 text-center`}>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-orange-500" />
            <p className="mt-4 font-semibold">Checking your payment…</p>
          </div>
        ) : !order ? (
          <div className={`${card} mx-auto max-w-xl px-6 py-14 text-center`}>
            <AlertCircle className="mx-auto h-12 w-12 text-neutral-300" />
            <h1 className="mt-4 text-2xl font-black tracking-tight">{state === 'error' ? 'We could not load your order' : 'We could not find this order'}</h1>
            <p className="mt-2 text-sm text-neutral-500">
              {state === 'error' ? 'Check your connection and try again.' : 'The link may be incomplete. Find your order with your order number and phone number.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {state === 'error' && <button onClick={() => reload()} className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600">Try again</button>}
              <Link href="/support/order-tracking" className="rounded-xl bg-white px-5 py-3 text-sm font-bold ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-700">Track an order</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ---------- hero ---------- */}
            <section className={`${card} overflow-hidden`}>
              <div className={`h-1.5 ${phase === 'paid' ? 'bg-emerald-500' : phase === 'waiting' ? 'bg-orange-500' : 'bg-red-500'}`} />
              <div className="px-5 py-8 text-center sm:px-10 sm:py-10">
                {phase === 'paid' && <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"><CheckCircle2 className="h-9 w-9" /></span>}
                {phase === 'waiting' && (
                  <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-orange-50 text-orange-600 dark:bg-orange-950/40">
                    <span className="absolute inset-0 animate-ping rounded-full bg-orange-200 opacity-40 motion-reduce:hidden dark:bg-orange-900" />
                    <Smartphone className="relative h-8 w-8" />
                  </span>
                )}
                {(phase === 'failed' || phase === 'expired') && <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40">{phase === 'failed' ? <XCircle className="h-9 w-9" /> : <Clock className="h-8 w-8" />}</span>}

                <h1 className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">
                  {phase === 'paid' && `Thank you${order.firstName ? `, ${order.firstName}` : ''}! Payment received`}
                  {phase === 'waiting' && 'Approve the payment on your phone'}
                  {phase === 'failed' && 'Your payment did not go through'}
                  {phase === 'expired' && 'This order has expired'}
                </h1>
                <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-600 sm:text-base dark:text-neutral-300">
                  {phase === 'paid' && <>We received {formatPrice(order.total)} for order <span className="font-bold text-neutral-900 dark:text-white">{order.orderNumber}</span>. We are preparing it now.</>}
                  {phase === 'waiting' && <>We sent a request for <span className="font-bold text-neutral-900 dark:text-white">{formatPrice(order.total)}</span>{order.phone ? <> to <span className="font-semibold">{order.phone}</span></> : null}. Enter your mobile money PIN to confirm. This page updates by itself.</>}
                  {phase === 'failed' && <>{order.failureReason ? `${order.failureReason}. ` : ''}No money was taken. You can try again; your order is kept{minutesLeft !== null && minutesLeft > 0 ? ` for ${minutesLeft} more minute${minutesLeft === 1 ? '' : 's'}` : ''}.</>}
                  {phase === 'expired' && <>Order {order.orderNumber} was not paid within {UNPAID_ORDER_EXPIRY_MINUTES} minutes, so we cancelled it. No money was taken. Go back to your cart to place a new order.</>}
                </p>

                {phase === 'waiting' && (
                  <div className="mx-auto mt-5 flex max-w-md flex-col items-center gap-2 text-sm">
                    <p className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 font-semibold text-orange-800 dark:bg-orange-950/40 dark:text-orange-200"><Loader2 className="h-4 w-4 animate-spin" /> Waiting for confirmation{minutesLeft !== null ? ` · ${minutesLeft} min left` : ''}</p>
                    {waitedLong && <p className="text-neutral-500">No prompt on your phone? Check the number has mobile money and enough balance, then send it again.</p>}
                  </div>
                )}

                {notice && (
                  <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`mx-auto mt-5 max-w-md rounded-xl px-4 py-3 text-sm ${notice.tone === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>{notice.text}</p>
                )}

                <div className="mx-auto mt-6 flex max-w-xl flex-col justify-center gap-2 sm:flex-row sm:flex-wrap">
                  {phase === 'paid' && (
                    <>
                      <InvoiceButton ref_={order.referenceId} paid className="sm:w-auto" />
                      <Link href={accountLink || `/orders/${order.referenceId}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"><PackageCheck className="h-4 w-4" /> Follow your order</Link>
                    </>
                  )}
                  {(phase === 'waiting' || phase === 'failed') && (
                    <button onClick={resend} disabled={resending || (phase === 'waiting' && !waitedLong)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">
                      {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {phase === 'failed' ? 'Try again' : 'Send the request again'}
                    </button>
                  )}
                  {(phase === 'failed' || phase === 'expired') && (
                    <Link href="/cart" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-700"><ShoppingBag className="h-4 w-4" /> Back to cart</Link>
                  )}
                  {phase === 'waiting' && <button onClick={check} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-700">I have approved it</button>}
                </div>
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-5">
                {phase === 'paid' && (
                  <section className={`${card} p-5`}>
                    <h2 className="font-bold">What happens next</h2>
                    <ol className="mt-4 grid gap-4 sm:grid-cols-3">
                      {[
                        { t: 'Confirmation', d: order.email ? `Your receipt and invoice are on the way to ${order.email}.` : 'Your invoice is ready to download above.' },
                        { t: order.deliveryOption === 'pickup' ? 'We get it ready' : 'We pack and send', d: order.deliveryOption === 'pickup' ? 'Your order page shows when it is ready to collect.' : 'Your order page shows each step until it reaches you.' },
                        { t: order.deliveryOption === 'pickup' ? 'Collect it' : 'It arrives', d: order.deliveryOption === 'pickup' ? `Bring pickup ID ${order.pickupId || ''} and a valid ID.` : 'Dar es Salaam usually in 1–2 days; regions take longer.' },
                      ].map((s, i) => (
                        <li key={s.t} className="flex gap-3 sm:flex-col">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-500 text-sm font-black text-white">{i + 1}</span>
                          <span><span className="block text-sm font-bold">{s.t}</span><span className="block text-sm text-neutral-500">{s.d}</span></span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
                <OrderItemsCard order={order} />
              </div>

              <aside className="space-y-5">
                <section className={`${card} p-5 text-sm`}>
                  <h2 className="font-bold">Order details</h2>
                  <dl className="mt-3 space-y-2">
                    <div className="flex justify-between gap-3"><dt className="text-neutral-500">Order number</dt><dd className="font-semibold">{order.orderNumber}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-neutral-500">Placed</dt><dd>{when(order.createdAt, true)}</dd></div>
                    {order.paidAt && <div className="flex justify-between gap-3"><dt className="text-neutral-500">Paid</dt><dd>{when(order.paidAt, true)}</dd></div>}
                    <div className="flex justify-between gap-3"><dt className="text-neutral-500">Payment</dt><dd>Mobile money</dd></div>
                  </dl>
                  {phase !== 'paid' && <InvoiceButton ref_={order.referenceId} paid={false} className="mt-4" />}
                </section>
                {phase === 'paid' && !accountLink && <SaveLinkCard order={order} />}
                <section className={`${card} p-5`}>
                  <h2 className="font-bold">Need help?</h2>
                  <p className="mt-1 text-sm text-neutral-500">Payment taken but this page does not show it? Message us with your order number.</p>
                  <a href={help} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-100 px-4 py-3 text-sm font-semibold hover:bg-stone-200 dark:bg-neutral-800"><MessageCircle className="h-4 w-4" /> WhatsApp us</a>
                  <Link href="/products" className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30">Continue shopping <ArrowRight className="h-4 w-4" /></Link>
                </section>
              </aside>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
