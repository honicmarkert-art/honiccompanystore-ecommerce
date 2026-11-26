import { NextRequest, NextResponse } from 'next/server'
import { getRateLimitBackendStatus } from '@/lib/enhanced-rate-limit'
import { whatsappEnabled } from '@/lib/whatsapp'
import { smsEnabled } from '@/lib/sms'
import { internalCallAllowed } from '@/lib/internal-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/internal/status (admin app only, shared secret) -> which shop services are set up. Names only, never values. */
export async function GET(request: NextRequest) {
  if (!internalCallAllowed(request)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const has = (...k: string[]) => k.every((x) => !!process.env[x])
  const rl = await getRateLimitBackendStatus().catch(() => ({ healthy: false, backend: 'unknown' }))
  const checks = [
    { key: 'payments', label: 'Mobile money payments (Snippe)', ok: has('SNIPPE_API_KEY', 'SNIPPE_WEBHOOK_SECRET') },
    { key: 'email', label: 'Email sending', ok: has('RESEND_API_KEY') || has('SMTP_HOST', 'SMTP_PASSWORD') },
    { key: 'emaillinks', label: 'Signed email links (unsubscribe / confirm)', ok: has('EMAIL_LINK_SECRET') },
    { key: 'statusmsg', label: 'Order status messages (database trigger secret)', ok: has('ORDER_WEBHOOK_SECRET') },
    { key: 'whatsapp', label: 'WhatsApp Business API', ok: whatsappEnabled(), hint: 'Add WHATSAPP_* keys (docs/WHATSAPP_TEMPLATES.md)' },
    { key: 'sms', label: 'SMS backup (Beem)', ok: smsEnabled(), optional: true, hint: 'Add BEEM_* keys' },
    { key: 'ratelimit', label: 'Shared rate limits (Upstash)', ok: rl.backend === 'upstash' && rl.healthy, hint: 'Add UPSTASH_* keys' },
    { key: 'turnstile', label: 'Bot protection on sign-up (Turnstile)', ok: has('TURNSTILE_SECRET_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY') },
    { key: 'maps', label: 'Address lookup (Google)', ok: has('GOOGLE_GEOCODING_API_KEY') || has('GOOGLE_MAPS_PLACES_API_KEY'), optional: true },
  ]
  return NextResponse.json({ checks }, { headers: { 'Cache-Control': 'no-store' } })
}
