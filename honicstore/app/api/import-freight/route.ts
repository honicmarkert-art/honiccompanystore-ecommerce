import { NextRequest, NextResponse } from 'next/server'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { freightForCart, getFreightSettings } from '@/lib/import-freight-server'

/**
 * Buy-from-China shipping prices.
 *  GET  /api/import-freight                       -> the rates (air and sea), for calculators
 *  POST /api/import-freight { items: [{ productId, quantity }] } -> air and sea price for the China
 *       items of a cart (sizes and weights come from the database, never from the request)
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const settings = await getFreightSettings()
  if (!settings) return NextResponse.json({ error: 'Shipping prices are not set' }, { status: 503 })
  return NextResponse.json({ settings }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
}

export async function POST(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items.slice(0, 200) : []
  const lines = items
    .map((i: { productId?: unknown; quantity?: unknown }) => ({ productId: Number(i?.productId), quantity: Number(i?.quantity) }))
    .filter((l: { productId: number; quantity: number }) => Number.isInteger(l.productId) && l.productId > 0 && l.quantity > 0)
  const r = await freightForCart(lines)
  return NextResponse.json({ chinaItems: r.chinaItems, air: r.air, sea: r.sea }, { headers: { 'Cache-Control': 'no-store' } })
}
