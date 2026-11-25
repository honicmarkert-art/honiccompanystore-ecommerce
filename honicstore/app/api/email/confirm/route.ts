import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { clientIp } from '@/lib/client-ip'
import { normEmail, verifyEmailToken } from '@/lib/email-links'
import { sendNewsletterWelcomeEmail } from '@/lib/user-email-service'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/email/confirm { e, t } -> double opt-in, step 2 (the link in the confirmation email).
 * POST, not GET, so link scanners in mail apps can't confirm on the person's behalf.
 */
export async function POST(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) return NextResponse.json({ success: false, error: 'Too many tries. Please wait and try again.' }, { status: 429 })
  const body = await request.json().catch(() => null)
  const email = normEmail(body?.e || '')
  if (!verifyEmailToken('confirm', email, String(body?.t || ''))) {
    return NextResponse.json({ success: false, error: 'This confirmation link is not valid. Please subscribe again.' }, { status: 400 })
  }
  try {
    const supabase = getSupabaseClient()
    const { data: row } = await supabase.from('newsletter_subscriptions').select('status, confirmed_at').eq('email', email).maybeSingle()
    if (row?.status === 'active' && row.confirmed_at) return NextResponse.json({ success: true, already: true })
    const now = new Date().toISOString()
    const fields = { status: 'active', confirmed_at: now, unsubscribed_at: null, consent_ip: clientIp(request) || null, updated_at: now }
    const { error } = row
      ? await supabase.from('newsletter_subscriptions').update(fields).eq('email', email)
      : await supabase.from('newsletter_subscriptions').insert({ email, subscribed_at: now, source: 'confirm-link', ...fields })
    if (error) throw new Error(error.message)
    void sendNewsletterWelcomeEmail(email)
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Newsletter confirm failed:', error)
    return NextResponse.json({ success: false, error: 'We could not confirm right now. Please try again.' }, { status: 500 })
  }
}
