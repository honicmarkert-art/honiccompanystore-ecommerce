import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { z } from '@/lib/zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/auth/check-verification-status { email } -> { isVerified }
 * Used by the sign-in popup after sign-up ("have you confirmed your email yet?").
 *
 * SECURITY: rate-limited; answers only true/false, and unknown emails get the same answer as
 * unverified ones, so it can't be used to collect account IDs or list who is registered.
 */
const Body = z.object({ email: z.string().email().max(255) })

export async function POST(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', { endpoint: '/api/auth/check-verification-status', reason: limit.reason }, request)
    return NextResponse.json({ success: false, isVerified: false, error: 'Too many requests. Please wait and try again.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }

  let email: string
  try {
    const parsed = Body.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, isVerified: false, error: 'Please enter a valid email address' }, { status: 400 })
    email = parsed.data.email.toLowerCase().trim()
  } catch {
    return NextResponse.json({ success: false, isVerified: false, error: 'Invalid request' }, { status: 400 })
  }

  try {
    const supabase = getSupabaseClient()
    // direct lookup (listUsers only returns the first page of accounts)
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).limit(1).maybeSingle()
    let isVerified = false
    if (profile?.id) {
      const { data } = await supabase.auth.admin.getUserById(profile.id)
      isVerified = !!data?.user?.email_confirmed_at
    }
    return NextResponse.json({ success: true, isVerified }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ success: false, isVerified: false, error: 'Could not check right now' }, { status: 500 })
  }
}
