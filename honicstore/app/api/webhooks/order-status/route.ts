import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { notifyOrderStatus } from '@/lib/order-status-messages'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/webhooks/order-status  { table, id, status }
 * Called by the database (pg_net trigger) when an order or item becomes shipped / ready for pickup /
 * delivered, from the seller dashboard or the admin app. Secured with the x-webhook-secret header
 * (ORDER_WEBHOOK_SECRET, also stored in Supabase Vault).
 */
function authorised(request: NextRequest) {
  const expected = process.env.ORDER_WEBHOOK_SECRET || ''
  const got = request.headers.get('x-webhook-secret') || ''
  if (!expected || got.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected))
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body?.table || body?.id == null || !body?.status) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  try {
    const result = await notifyOrderStatus({ table: String(body.table), id: body.id, status: String(body.status) })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    logger.error('Order status message failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
