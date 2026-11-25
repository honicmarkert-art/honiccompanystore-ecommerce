import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { z } from '@/lib/zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/orders/track  { orderNumber, contact }  — order status for guests (no account needed).
 *
 * SECURITY: the order number alone is not enough; `contact` must match the phone or email used at
 * checkout. Unknown order and wrong contact get the same answer (no guessing which orders exist),
 * the route is tightly rate-limited, and only status information is returned (no address, no personal
 * data). Once the contact matches, it also returns the private order link (/orders/<reference>),
 * which shows the full order and the invoice PDF.
 */
const Body = z.object({
  orderNumber: z.string({ error: 'Enter your order number' }).trim().min(4, 'Enter your order number').max(64),
  contact: z.string({ error: 'Enter the phone number or email you used at checkout' }).trim().min(4, 'Enter the phone number or email you used at checkout').max(254),
})

const NOT_FOUND = 'We could not find an order with those details. Check the order number and use the phone number or email you entered at checkout.'

/** Last 9 digits: matches 0712…, 255712…, +255 712… */
const phoneKey = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-9)

type Step = { key: string; label: string; done: boolean; at?: string | null }

export async function POST(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', { endpoint: '/api/orders/track', reason: limit.reason }, request)
    return NextResponse.json({ error: 'Too many tries. Please wait a few minutes and try again.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 600) } })
  }

  let parsed
  try {
    parsed = Body.safeParse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the details and try again.' }, { status: 400 })
  }
  const orderNumber = parsed.data.orderNumber.toUpperCase()
  const contact = parsed.data.contact

  const supabase = getSupabaseClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, order_number, reference_id, status, payment_status, delivery_option, created_at, updated_at, payment_timestamp, tracking_number, estimated_delivery, total_amount, currency, shipping_address, billing_address, order_items ( product_name, variant_name, quantity )')
    .eq('order_number', orderNumber)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Could not look up the order right now. Please try again.' }, { status: 500 })

  const addr = { ...(order?.billing_address || {}), ...(order?.shipping_address || {}) } as Record<string, unknown>
  const isEmail = contact.includes('@')
  const matches = !!order && (isEmail
    ? [order.shipping_address?.email, order.billing_address?.email].some((e) => typeof e === 'string' && e.trim().toLowerCase() === contact.toLowerCase())
    : phoneKey(contact).length === 9 && [order.shipping_address?.phone, order.billing_address?.phone].some((p) => phoneKey(p) === phoneKey(contact)))

  if (!matches) {
    logSecurityEvent('ORDER_TRACK_NO_MATCH', { endpoint: '/api/orders/track' }, request)
    return NextResponse.json({ error: NOT_FOUND }, { status: 404 })
  }

  const s = String(order.status || 'pending')
  const paid = order.payment_status === 'paid'
  const pickup = order.delivery_option === 'pickup'
  const reached = (list: string[]) => list.includes(s)
  const steps: Step[] = s === 'cancelled'
    ? [
        { key: 'placed', label: 'Order placed', done: true, at: order.created_at },
        { key: 'cancelled', label: paid ? 'Cancelled (refund being arranged)' : 'Cancelled', done: true, at: order.updated_at },
      ]
    : [
        { key: 'placed', label: 'Order placed', done: true, at: order.created_at },
        { key: 'paid', label: 'Payment confirmed', done: paid, at: order.payment_timestamp },
        { key: 'confirmed', label: 'Being prepared', done: paid && reached(['confirmed', 'shipped', 'delivered', 'ready_for_pickup', 'picked_up']) },
        pickup
          ? { key: 'ready', label: 'Ready for pickup', done: reached(['ready_for_pickup', 'picked_up']) }
          : { key: 'shipped', label: 'On the way', done: reached(['shipped', 'delivered']) },
        pickup
          ? { key: 'done', label: 'Picked up', done: reached(['picked_up']) }
          : { key: 'done', label: 'Delivered', done: reached(['delivered']) },
      ]

  const fullName = typeof addr.fullName === 'string' ? addr.fullName.trim() : ''
  return NextResponse.json(
    {
      order: {
        orderNumber: order.order_number,
        status: s,
        paid,
        delivery: pickup ? 'pickup' : 'delivery',
        createdAt: order.created_at,
        trackingNumber: order.tracking_number || null,
        estimatedDelivery: order.estimated_delivery || null,
        total: Number(order.total_amount) || 0,
        currency: order.currency || 'TZS',
        firstName: fullName ? fullName.split(/\s+/)[0] : null,
        // contact matched: hand back the private order link (full order + invoice PDF on any device)
        orderLink: order.reference_id ? `/orders/${String(order.reference_id).replace(/[^A-Za-z0-9]/g, '').toLowerCase()}` : null,
        items: (order.order_items || []).map((i: { product_name?: string; variant_name?: string; quantity?: number }) => ({
          name: i.product_name || 'Item',
          variant: i.variant_name || null,
          quantity: Number(i.quantity) || 1,
        })),
        steps,
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
