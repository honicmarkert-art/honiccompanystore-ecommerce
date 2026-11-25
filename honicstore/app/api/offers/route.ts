import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { validateAuth } from '@/lib/auth-server'
import { clientIp } from '@/lib/client-ip'
import { newCode, offerMessage, tzPhone } from '@/lib/offers'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/offers  -> save a "Make an offer" request and return the WhatsApp message to send.
 * The product and its price are read on the server (never trusted from the browser).
 */
const Body = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().min(1).max(10000),
  offerPrice: z.number().positive(),
  name: z.string().trim().max(80).optional().default(''),
  phone: z.string().trim().min(9, 'Enter your phone number').max(20),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  region: z.string().trim().max(60).optional().default(''),
  note: z.string().trim().max(300).optional().default(''),
})

export async function POST(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', { endpoint: '/api/offers', reason: limit.reason }, request)
    return NextResponse.json({ error: 'Too many offers. Please wait a while and try again.' }, { status: 429 })
  }
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check your offer' }, { status: 400 })
  const b = parsed.data
  const phone = tzPhone(b.phone)
  if (!phone) return NextResponse.json({ error: 'Enter a valid Tanzanian phone number (e.g. 0712 345 678)' }, { status: 400 })

  const supabase = getSupabaseClient()
  const { data: p } = await supabase.from('products').select('id, name, price, slug, supplier_id, in_stock').eq('id', b.productId).maybeSingle()
  if (!p) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  // a chosen option (variant) has its own price
  let listPrice = Number(p.price) || 0
  let variantName = ''
  if (b.variantId) {
    const { data: v } = await supabase.from('product_variants').select('price, variant_name').eq('id', b.variantId).eq('product_id', p.id).maybeSingle()
    if (v) { listPrice = Number(v.price) || listPrice; variantName = v.variant_name || '' }
  }
  if (!(b.offerPrice < listPrice)) return NextResponse.json({ error: 'Your offer should be lower than the current price.' }, { status: 400 })

  const { user } = await validateAuth(request).catch(() => ({ user: null }))
  const ref = newCode('OF-', 6)
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://honiccompanystore.com').replace(/\/$/, '')
  const productUrl = `${site}/products/${p.slug || p.id}`

  const { error } = await supabase.from('price_offers').insert({
    ref, product_id: p.id, product_name: variantName ? `${p.name} (${variantName})` : p.name, supplier_id: p.supplier_id || null, list_price: listPrice,
    offer_price: Math.round(b.offerPrice), quantity: b.quantity, name: b.name || null, phone, email: b.email || null,
    region: b.region || null, note: b.note || null, user_id: user?.id || null, ip: clientIp(request) || null,
  })
  if (error) {
    logger.error('Saving offer failed:', error.message)
    return NextResponse.json({ error: 'Could not save your offer. You can still send it on WhatsApp.' }, { status: 500 })
  }
  const message = offerMessage({ ref, productName: variantName ? `${p.name} (${variantName})` : p.name, productUrl, quantity: b.quantity, listPrice, offerPrice: Math.round(b.offerPrice), region: b.region, name: b.name, note: b.note })
  return NextResponse.json({ success: true, ref, message })
}
