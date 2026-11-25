import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { clientIp } from '@/lib/client-ip'
import { normEmail } from '@/lib/email-links'
import { sendNewsletterConfirmEmail } from '@/lib/user-email-service'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/newsletter/subscribe { email, source? }  -> double opt-in, step 1.
 * Saves the address as 'pending' and emails a confirmation link. Nobody gets offers until they
 * click it. The answer is the same whether or not the address is already subscribed (no lookups).
 */
const Body = z.object({ email: z.string().trim().email('Enter a valid email address').max(254), source: z.string().trim().max(40).optional() })
const RESEND_AFTER_MS = 10 * 60 * 1000
const OK = { success: true, message: 'Almost done! Check your inbox and click the link to confirm.' }

export async function POST(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', { endpoint: '/api/newsletter/subscribe', reason: limit.reason }, request)
    return NextResponse.json({ success: false, error: 'Too many tries. Please wait a while and try again.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Enter a valid email address' }, { status: 400 })

  const email = normEmail(parsed.data.email)
  const supabase = getSupabaseClient()
  try {
    const { data: row } = await supabase.from('newsletter_subscriptions').select('status, confirmed_at, confirmation_sent_at').eq('email', email).maybeSingle()
    if (row?.status === 'active' && row.confirmed_at) return NextResponse.json(OK) // already confirmed: nothing to send
    if (row?.status === 'bounced') return NextResponse.json(OK) // address cannot receive mail
    // don't send confirmation emails over and over to the same address
    if (row?.confirmation_sent_at && Date.now() - new Date(row.confirmation_sent_at).getTime() < RESEND_AFTER_MS) return NextResponse.json(OK)

    const now = new Date().toISOString()
    const fields = { status: 'pending', source: parsed.data.source || 'website', consent_ip: clientIp(request) || null, confirmation_sent_at: now, updated_at: now }
    const { error } = row
      ? await supabase.from('newsletter_subscriptions').update(fields).eq('email', email)
      : await supabase.from('newsletter_subscriptions').insert({ email, subscribed_at: now, ...fields })
    if (error) throw new Error(error.message)

    const sent = await sendNewsletterConfirmEmail(email)
    if (!sent.success) throw new Error(sent.error || 'confirmation email failed')
    return NextResponse.json(OK)
  } catch (error) {
    logger.error('Newsletter subscribe failed:', error)
    return NextResponse.json({ success: false, error: 'We could not subscribe you right now. Please try again later.' }, { status: 500 })
  }
}
