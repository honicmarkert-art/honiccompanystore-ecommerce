import { createHash, timingSafeEqual } from 'crypto'
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

/**
 * Server-to-server calls from the admin app (honicstore-admin): page refresh and status.
 * The admin sends `Authorization: Bearer <SHOP_REVALIDATE_SECRET>`; the secret itself lives ONLY in
 * the admin app. The shop keeps just its SHA-256 fingerprint (SHOP_REVALIDATE_SECRET_SHA256, 64 hex
 * characters), so reading the shop's settings does not reveal a usable secret.
 * Required in every environment (also development); if the fingerprint is missing, every call is refused.
 */
export function internalCallAllowed(request: NextRequest): boolean {
  const expected = (process.env.SHOP_REVALIDATE_SECRET_SHA256 || '').trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(expected)) return false
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (given.length < 24) return false
  const a = createHash('sha256').update(given).digest()
  return timingSafeEqual(a, Buffer.from(expected, 'hex'))
}
