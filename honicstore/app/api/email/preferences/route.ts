import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { validateAuth } from '@/lib/auth-server'
import { clientIp } from '@/lib/client-ip'
import { normEmail, verifyEmailToken } from '@/lib/email-links'
import { getPreferences, setPreferences, unsubscribeMarketing } from '@/lib/email-consent'
import { sendNewsletterConfirmEmail } from '@/lib/user-email-service'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Email preferences for one address. Allowed for:
 *   - the signed-in shopper (their account email), or
 *   - anyone holding the signed link from an email (?e=&t= / body e,t)
 * GET -> { email, prefs, pendingMarketing }    PUT { prefs?, marketing? } -> saves
 * Turning marketing ON never subscribes directly: it sends the double opt-in confirmation email.
 */
async function who(request: NextRequest, e?: string | null, t?: string | null): Promise<{ email: string; userId: string | null } | null> {
  if (e && t) {
    const email = normEmail(e)
    return verifyEmailToken('prefs', email, t) ? { email, userId: null } : null
  }
  const { user } = await validateAuth(request)
  return user?.email ? { email: normEmail(user.email), userId: user.id } : null
}

async function pendingMarketing(email: string) {
  const { data } = await getSupabaseClient().from('newsletter_subscriptions').select('status, confirmed_at').eq('email', email).maybeSingle()
  return data?.status === 'pending' || (data?.status === 'active' && !data.confirmed_at)
}

const mask = (email: string) => { const [u, d] = email.split('@'); return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(4, u.length - 2)))}@${d}` }

export async function GET(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const sp = request.nextUrl.searchParams
  const id = await who(request, sp.get('e'), sp.get('t'))
  if (!id) return NextResponse.json({ error: 'This link is not valid, or please sign in.' }, { status: 401 })
  try {
    return NextResponse.json({ email: id.userId ? id.email : mask(id.email), prefs: await getPreferences(id.email), pendingMarketing: await pendingMarketing(id.email) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logger.error('Load email preferences failed:', error)
    return NextResponse.json({ error: 'Could not load your preferences.' }, { status: 500 })
  }
}

const Body = z.object({
  e: z.string().optional(), t: z.string().optional(),
  prefs: z.object({ price_alerts: z.boolean().optional(), back_in_stock: z.boolean().optional(), abandoned_cart: z.boolean().optional(), review_requests: z.boolean().optional() }).optional(),
  marketing: z.boolean().optional(),
})

export async function PUT(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const id = await who(request, parsed.data.e, parsed.data.t)
  if (!id) return NextResponse.json({ error: 'This link is not valid, or please sign in.' }, { status: 401 })
  try {
    if (parsed.data.prefs) await setPreferences(id.email, parsed.data.prefs, id.userId)
    let confirmSent = false
    if (parsed.data.marketing === false) await unsubscribeMarketing(id.email)
    if (parsed.data.marketing === true) {
      const current = await getPreferences(id.email)
      if (!current.marketing) {
        const supabase = getSupabaseClient()
        const now = new Date().toISOString()
        const fields = { status: 'pending', source: id.userId ? 'account' : 'preferences', consent_ip: clientIp(request) || null, confirmation_sent_at: now, updated_at: now }
        const { data: row } = await supabase.from('newsletter_subscriptions').select('email').eq('email', id.email).maybeSingle()
        const { error } = row ? await supabase.from('newsletter_subscriptions').update(fields).eq('email', id.email) : await supabase.from('newsletter_subscriptions').insert({ email: id.email, subscribed_at: now, ...fields })
        if (error) throw new Error(error.message)
        confirmSent = (await sendNewsletterConfirmEmail(id.email)).success
      }
    }
    return NextResponse.json({ success: true, prefs: await getPreferences(id.email), pendingMarketing: await pendingMarketing(id.email), confirmSent })
  } catch (error) {
    logger.error('Save email preferences failed:', error)
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
}
