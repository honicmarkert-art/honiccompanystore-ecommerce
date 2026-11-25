import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Guards internal/ops endpoints (cache control, metrics) that must not be public.
 *
 * Production: requires `Authorization: Bearer <CRON_SECRET>` (same secret the cron jobs use).
 * Development: open, so local debugging keeps working.
 *
 * Returns a 404 response to block (doesn't reveal the endpoint exists), or null to allow.
 */
export function requireInternal(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === 'development') return null

  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (secret && token) {
    const a = Buffer.from(token)
    const b = Buffer.from(secret)
    if (a.length === b.length && timingSafeEqual(a, b)) return null
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
