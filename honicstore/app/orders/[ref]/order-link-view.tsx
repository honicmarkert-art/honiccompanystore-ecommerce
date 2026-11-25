"use client"

/**
 * Private order page for anyone holding the order link (guests on any device, or a shopper who
 * opens the link from the email). Status, items, totals, delivery and the invoice PDF.
 */
import Link from 'next/link'
import { AlertCircle, Check, Loader2, MessageCircle, RotateCcw, Store, Truck, UserRound } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/contexts/auth-context'
import { useCurrency } from '@/contexts/currency-context'
import { OrderStatusChip } from '@/components/account/order-status'
import { InvoiceButton, OrderItemsCard, SaveLinkCard, card, useOrderView, when } from '@/components/orders/order-parts'
import { whatsappLink } from '@/lib/contact'

export function OrderLinkView({ reference }: { reference: string }) {
  const ref = String(reference || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase()
  const { order, state, reload } = useOrderView(/^[a-f0-9]{32}$/.test(ref) ? ref : null)
  const { isAuthenticated } = useAuth()
  const { formatPrice } = useCurrency()

  if (!order) {
    return (
      <Shell>
        <div className={`${card} mx-auto max-w-xl px-6 py-14 text-center`}>
          {state === 'loading'
            ? <><Loader2 className="mx-auto h-10 w-10 animate-spin text-orange-500" /><p className="mt-4 font-semibold">Loading your order…</p></>
            : <>
                <AlertCircle className="mx-auto h-12 w-12 text-neutral-300" />
                <h1 className="mt-4 text-2xl font-black tracking-tight">{state === 'error' ? 'We could not load this order' : 'Order link not valid'}</h1>
                <p className="mt-2 text-sm text-neutral-500">{state === 'error' ? 'Check your connection and try again.' : 'The link may be incomplete. You can still find your order with its number and your phone number.'}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {state === 'error' && <button onClick={() => reload()} className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600">Try again</button>}
                  <Link href="/support/order-tracking" className="rounded-xl bg-white px-5 py-3 text-sm font-bold ring-1 ring-neutral-200 hover:ring-orange-400 dark:bg-neutral-900 dark:ring-neutral-700">Track an order</Link>
                </div>
              </>}
        </div>
      </Shell>
    )
  }

  const paid = order.paymentStatus === 'paid'
  const cancelled = order.status === 'cancelled'
  const pickup = order.deliveryOption === 'pickup'
  const flow = ['pending', 'confirmed', 'shipped', 'ready_for_pickup', 'delivered', 'picked_up']
  const at = (s: string) => flow.indexOf(order.status) >= flow.indexOf(s)
  const steps = [
    { label: 'Placed', done: true, at: order.createdAt },
    { label: 'Paid', done: paid, at: order.paidAt },
    { label: 'Being prepared', done: paid && at('confirmed') },
    { label: pickup ? 'Ready for pickup' : 'On the way', done: paid && at(pickup ? 'ready_for_pickup' : 'shipped') },
    { label: pickup ? 'Picked up' : 'Delivered', done: at(pickup ? 'picked_up' : 'delivered') },
  ]

  return (
    <Shell>
      <div className="space-y-5">
        <section className={`${card} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-neutral-500">{order.firstName ? `${order.firstName}'s order` : 'Your order'}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <h1 className="break-all text-2xl font-black tracking-tight">{order.orderNumber}</h1>
                <OrderStatusChip status={order.status} paymentStatus={order.paymentStatus} />
              </div>
              <p className="mt-1 text-sm text-neutral-500">Placed {when(order.createdAt, true)}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black tabular-nums">{formatPrice(order.total)}</p>
              <p className="text-xs text-neutral-500">{paid ? 'Paid' : cancelled ? 'Not charged' : 'Not paid yet'}</p>
            </div>
          </div>

          {cancelled ? (
            <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              This order was cancelled{order.failureReason ? `: ${order.failureReason}` : '.'} {paid ? 'The refund goes back to the same payment method.' : 'No money was taken.'}
            </p>
          ) : (
            <ol className="mt-6 grid grid-cols-5 gap-1">
              {steps.map((s, i) => (
                <li key={s.label} className="relative flex flex-col items-center text-center">
                  {i > 0 && <span aria-hidden className={`absolute right-1/2 top-3.5 h-0.5 w-full ${s.done ? 'bg-orange-500' : 'bg-neutral-200 dark:bg-neutral-700'}`} />}
                  <span className={`relative grid h-7 w-7 place-items-center rounded-full ${s.done ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-400 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700'}`}>
                    {s.done ? <Check className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  <span className={`mt-1.5 text-[11px] font-semibold leading-tight sm:text-xs ${s.done ? '' : 'text-neutral-400'}`}>{s.label}</span>
                  {s.done && s.at && <span className="hidden text-[11px] text-neutral-500 sm:block">{when(s.at)}</span>}
                </li>
              ))}
            </ol>
          )}

          {!paid && !cancelled && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <p>This order is waiting for payment.</p>
              <Link href={`/checkout/return?orderReference=${order.referenceId}`} className="rounded-xl bg-orange-500 px-4 py-2.5 font-bold text-white hover:bg-orange-600">Check payment</Link>
            </div>
          )}
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0"><OrderItemsCard order={order} /></div>
          <aside className="space-y-5">
            <section className={`${card} p-5`}>
              <h2 className="font-bold">{paid ? 'Invoice' : 'Order summary'}</h2>
              <p className="mt-1 text-sm text-neutral-500">{paid ? 'A PDF you can print or send.' : 'A PDF of this order. It is not a receipt until payment is made.'}</p>
              <InvoiceButton ref_={order.referenceId} paid={paid} className="mt-3" />
            </section>

            <section className={`${card} p-5 text-sm`}>
              <h2 className="flex items-center gap-2 font-bold">{pickup ? <Store className="h-4 w-4 text-orange-600" /> : <Truck className="h-4 w-4 text-orange-600" />}{pickup ? 'Store pickup' : 'Delivery'}</h2>
              <div className="mt-2 space-y-1 text-neutral-600 dark:text-neutral-300">
                {pickup
                  ? <p>Pickup ID <span className="font-mono font-bold">{order.pickupId}</span>. Bring it and a valid ID.</p>
                  : <p>{order.area ? `To ${order.area}` : 'To the address you gave at checkout'}{order.phone ? ` · ${order.phone}` : ''}</p>}
                {order.trackingNumber && <p>Tracking number <span className="font-mono font-semibold">{order.trackingNumber}</span></p>}
                {order.estimatedDelivery && !at(pickup ? 'picked_up' : 'delivered') && <p>Expected {when(order.estimatedDelivery)}</p>}
              </div>
            </section>

            {order.hasAccount && (
              <section className={`${card} p-5 text-sm`}>
                <h2 className="flex items-center gap-2 font-bold"><UserRound className="h-4 w-4 text-orange-600" /> In your account</h2>
                <p className="mt-1 text-neutral-500">This order is also saved in a Honic account{isAuthenticated ? '' : '. Sign in to confirm delivery or see all your orders'}.</p>
                <Link href={`/account/orders/${order.orderNumber}`} className="mt-3 inline-flex rounded-xl bg-stone-100 px-4 py-2.5 font-semibold hover:bg-stone-200 dark:bg-neutral-800">Open in my account</Link>
              </section>
            )}

            {!order.hasAccount && <SaveLinkCard order={order} />}

            <section className={`${card} p-5`}>
              <h2 className="font-bold">Need help?</h2>
              <div className="mt-3 grid gap-2">
                <a href={whatsappLink(`Hello Honic, I need help with order ${order.orderNumber}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold hover:bg-stone-200 dark:bg-neutral-800"><MessageCircle className="h-4 w-4" /> WhatsApp us about this order</a>
                <Link href="/support/returns-refunds" className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold hover:bg-stone-200 dark:bg-neutral-800"><RotateCcw className="h-4 w-4" /> Returns &amp; refunds</Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <SiteFooter />
    </div>
  )
}
