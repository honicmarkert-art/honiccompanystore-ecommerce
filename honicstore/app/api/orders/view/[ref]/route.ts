import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { normalizeReference } from '@/lib/invoice-pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/orders/view/[ref] -> order summary for the payment result page and the guest order page.
 *
 * SECURITY: keyed by the 32-character random order reference (never the guessable order number).
 * Returns what the buyer needs to follow the order; contact details are masked, no internal IDs.
 */
const maskPhone = (p?: string) => {
  const d = String(p || '').replace(/\D/g, '')
  return d.length >= 7 ? `${d.startsWith('255') ? '+255 ' : ''}${'•'.repeat(3)} ${d.slice(-3)}` : null
}
const maskEmail = (e?: string) => {
  const [u, dom] = String(e || '').split('@')
  return u && dom ? `${u.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(4, u.length - 2)))}@${dom}` : null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', { endpoint: '/api/orders/view/[ref]', reason: limit.reason }, request)
    return NextResponse.json({ error: 'Too many requests. Please wait and try again.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }
  const ref = normalizeReference((await params).ref)
  if (!ref) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const supabase = getSupabaseClient()
  const { data: o } = await supabase
    .from('orders')
    .select('user_id, order_number, reference_id, status, payment_status, failure_reason, created_at, payment_timestamp, delivery_option, pickup_id, tracking_number, estimated_delivery, total_amount, currency, shipping_address, billing_address, order_items(product_id, product_name, variant_name, quantity, price, total_price)')
    .eq('reference_id', ref)
    .maybeSingle()
  if (!o) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const rows = (o.order_items as Array<Record<string, unknown>>) || []
  const ids = [...new Set(rows.map((r) => Number(r.product_id)).filter(Boolean))]
  const images = new Map<number, string>()
  if (ids.length) {
    const { data: prods } = await supabase.from('products').select('id, image').in('id', ids)
    for (const p of prods || []) if (p.image) images.set(p.id, p.image)
  }
  const items = rows.map((r) => {
    const quantity = Number(r.quantity) || 1
    const unitPrice = Number(r.price) || 0
    return {
      productId: Number(r.product_id) || null,
      name: String(r.product_name || 'Item'),
      variant: (r.variant_name as string) || null,
      quantity,
      unitPrice,
      total: Number(r.total_price) || unitPrice * quantity,
      image: images.get(Number(r.product_id)) || null,
    }
  })
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const total = Number(o.total_amount) || 0
  const ship = (o.shipping_address || {}) as Record<string, string>
  const bill = (o.billing_address || {}) as Record<string, string>
  const fullName = String(bill.fullName || ship.fullName || '').trim()

  return NextResponse.json(
    {
      order: {
        orderNumber: o.order_number,
        referenceId: o.reference_id,
        status: o.status || 'pending',
        paymentStatus: o.payment_status || 'pending',
        failureReason: o.failure_reason || null,
        createdAt: o.created_at,
        paidAt: o.payment_timestamp || null,
        deliveryOption: o.delivery_option === 'pickup' ? 'pickup' : 'delivery',
        pickupId: o.delivery_option === 'pickup' ? o.pickup_id || null : null,
        trackingNumber: o.tracking_number || null,
        estimatedDelivery: o.estimated_delivery || null,
        currency: o.currency || 'TZS',
        total,
        subtotal,
        deliveryFee: Math.max(0, total - subtotal),
        firstName: fullName ? fullName.split(/\s+/)[0] : null,
        area: [...new Set([ship.district, ship.city, ship.region].filter(Boolean))].join(', ') || null,
        phone: maskPhone(bill.phone || ship.phone),
        email: maskEmail(bill.email || ship.email),
        hasAccount: !!o.user_id,
        items,
      },
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  )
}
