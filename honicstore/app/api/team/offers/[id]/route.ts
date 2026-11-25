import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/team-auth'
import { OFFER_COUPON_HOURS, newCode, offerReply, tsh } from '@/lib/offers'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/team/offers/[id] { action: 'accept' | 'counter' | 'decline', price? }  (admins only)
 * accept / counter -> creates a ONE-TIME coupon for that product and quantity, valid 48 h, and returns
 * a WhatsApp link to the customer with the code ready to send. decline -> polite reply link.
 */
const Body = z.object({ action: z.enum(['accept', 'counter', 'decline']), price: z.number().positive().optional() })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { action, price } = parsed.data
  const { id } = await params

  const supabase = getSupabaseClient()
  const { data: offer } = await supabase.from('price_offers').select('*').eq('id', id).maybeSingle()
  if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
  if (offer.status !== 'new') return NextResponse.json({ error: `This offer was already ${offer.status}.` }, { status: 409 })

  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://honiccompanystore.com').replace(/\/$/, '')
  const { data: product } = await supabase.from('products').select('id, slug, supplier_id, user_id').eq('id', offer.product_id).maybeSingle()
  const productUrl = `${site}/products/${product?.slug || offer.product_id}`
  const waTo = (text: string) => `https://wa.me/${offer.phone}?text=${encodeURIComponent(text)}`
  const now = new Date()

  if (action === 'decline') {
    await supabase.from('price_offers').update({ status: 'declined', decided_at: now.toISOString(), decided_by: admin.userId }).eq('id', id)
    const first = offer.name ? ` ${String(offer.name).split(/\s+/)[0]}` : ''
    const text = `Habari${first}, asante kwa ofa yako. Kwa sasa hatuwezi kushusha bei ya ${offer.product_name} zaidi ya ${tsh(offer.list_price)}.\nThank you for your offer. For now we can't go below ${tsh(offer.list_price)} for this item.\n${productUrl}`
    return NextResponse.json({ success: true, whatsapp: waTo(text) })
  }

  const agreed = Math.round(action === 'accept' ? Number(offer.offer_price) : Number(price))
  const list = Number(offer.list_price)
  if (!(agreed > 0 && agreed < list)) return NextResponse.json({ error: `The price must be between TSh 1 and ${tsh(list - 1)}.` }, { status: 400 })
  const sellerId = product?.supplier_id || product?.user_id
  if (!sellerId) return NextResponse.json({ error: 'This product has no seller account, so a code cannot be made. Agree the price on WhatsApp instead.' }, { status: 422 })

  const qty = Number(offer.quantity) || 1
  const discount = (list - agreed) * qty
  const code = newCode()
  const end = new Date(now.getTime() + OFFER_COUPON_HOURS * 3600_000)
  const { error } = await supabase.from('supplier_promotions').insert({
    supplier_id: sellerId,
    name: `Offer ${offer.ref}`,
    code,
    description: `Agreed price ${tsh(agreed)} x ${qty} for ${offer.product_name} (offer ${offer.ref})`,
    discount_type: 'fixed',
    discount_value: discount,
    max_discount_amount: discount,
    min_purchase_amount: list * qty, // the agreed quantity must be in the cart
    usage_limit: 1,
    used_count: 0,
    start_date: now.toISOString(),
    end_date: end.toISOString(),
    is_active: true,
    applies_to_all_products: false,
    product_ids: [String(offer.product_id)],
  })
  if (error) {
    logger.error('Offer coupon failed:', error.message)
    return NextResponse.json({ error: 'Could not create the code. Please try again.' }, { status: 500 })
  }
  await supabase.from('price_offers').update({
    status: action === 'accept' ? 'accepted' : 'countered', agreed_price: agreed, coupon_code: code, decided_at: now.toISOString(), decided_by: admin.userId,
  }).eq('id', id)

  const text = offerReply({ name: offer.name, productName: offer.product_name, productUrl, quantity: qty, agreedPrice: agreed, code, counter: action === 'counter' })
  return NextResponse.json({ success: true, code, whatsapp: waTo(text), expiresAt: end.toISOString() })
}
