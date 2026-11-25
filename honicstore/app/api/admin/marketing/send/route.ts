import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { validateAuth } from '@/lib/auth-server'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { esc, paragraph } from '@/lib/email-layout'
import { sendMarketingEmail } from '@/lib/user-email-service'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * POST /api/admin/marketing/send  (admins only) — an offer / ad / news email.
 *   { subject, preheader, title, message, ctaLabel?, ctaUrl?, mode: 'count' | 'test' | 'send', testEmail? }
 *   count -> how many confirmed subscribers would get it (nothing sent)
 *   test  -> sends only to testEmail (must be a Honic company address)
 *   send  -> sends to confirmed subscribers only (status active + confirmed_at), each with one-click unsubscribe
 * The message is plain text (paragraphs separated by blank lines); it is escaped, never raw HTML.
 */
const Body = z.object({
  subject: z.string().trim().min(3).max(120),
  preheader: z.string().trim().max(160).default(''),
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(5000),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaUrl: z.string().trim().url().refine((u) => u.startsWith('https://'), 'Link must start with https://').optional(),
  mode: z.enum(['count', 'test', 'send']),
  testEmail: z.string().trim().email().optional(),
})
const COMPANY_DOMAIN = /@honiccompanystore\.com$/i

export async function POST(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const { user } = await validateAuth(request)
  if (!user) return NextResponse.json({ error: 'Sign in as an admin' }, { status: 401 })
  const supabase = getSupabaseClient()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) {
    logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS', { endpoint: '/api/admin/marketing/send' }, request)
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the fields' }, { status: 400 })
  const m = parsed.data
  const bodyHtml = m.message.split(/\n\s*\n/).map((p) => paragraph(esc(p).replace(/\n/g, '<br>'))).join('')
  const email = { subject: m.subject, preheader: m.preheader || m.title, title: m.title, bodyHtml, text: m.message, ctaLabel: m.ctaLabel, ctaUrl: m.ctaUrl }

  const { data: subs, error } = await supabase.from('newsletter_subscriptions').select('email').eq('status', 'active').not('confirmed_at', 'is', null).limit(5000)
  if (error) return NextResponse.json({ error: 'Could not load subscribers' }, { status: 500 })
  const recipients = (subs || []).map((s) => String(s.email))

  if (m.mode === 'count') return NextResponse.json({ recipients: recipients.length })

  if (m.mode === 'test') {
    if (!m.testEmail || !COMPANY_DOMAIN.test(m.testEmail)) return NextResponse.json({ error: 'Test emails go to a @honiccompanystore.com address only' }, { status: 400 })
    // a test still respects consent: the test address must be a confirmed subscriber to receive it
    const r = await sendMarketingEmail(m.testEmail, email)
    return NextResponse.json({ sent: r.success && !r.skipped ? 1 : 0, skipped: !!r.skipped, note: r.skipped ? 'The test address is not a confirmed subscriber. Subscribe it in the footer and confirm first.' : undefined, error: r.error })
  }

  let sent = 0, failed = 0, skipped = 0
  for (const to of recipients) {
    const r = await sendMarketingEmail(to, email)
    if (r.skipped) skipped++
    else if (r.success) sent++
    else failed++
  }
  logger.log(`Marketing email "${m.subject}": sent ${sent}, skipped ${skipped}, failed ${failed}`)
  return NextResponse.json({ recipients: recipients.length, sent, skipped, failed })
}
