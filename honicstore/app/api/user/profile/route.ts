import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Columns the account, supplier and winga pages read (the caller's own row only). Keep in sync when a page needs more. */
const PROFILE_COLUMNS = [
  'id', 'full_name', 'email', 'phone', 'created_at', 'updated_at', 'is_supplier', 'is_active', 'is_verified',
  'company_name', 'company_logo', 'detail_sentence', 'location', 'office_number', 'region', 'nation',
  'business_registration_number', 'registration_type', 'full_legal_name', 'tin_or_nida',
  'business_tin_certificate_url', 'company_certificate_url', 'nida_card_front_url', 'nida_card_rear_url', 'self_picture_url',
  'supplier_plan_id', 'pending_plan_id', 'pending_premium_plan_id', 'payment_status',
].join(', ')

/** Public Supabase storage URL prefix; profile photos must be inside the user's own avatars folder. */
const STORAGE_PREFIX = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')}/storage/v1/object/public/`

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers })
}

async function limited(request: NextRequest) {
  const r = await enhancedRateLimit(request)
  if (r.allowed) return null
  logSecurityEvent('RATE_LIMIT_EXCEEDED', { endpoint: '/api/user/profile', reason: r.reason }, request)
  return json({ success: false, error: r.reason }, 429, { 'Retry-After': r.retryAfter?.toString() || '60' })
}

/** The signed-in user, from the `Authorization: Bearer` token (what the account pages send) or the session cookie. */
async function requestUser(request: NextRequest): Promise<User | null> {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (bearer) {
    const { data, error } = await getSupabaseClient().auth.getUser(bearer)
    return error ? null : data.user
  }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { cookies: { get: (name: string) => request.cookies.get(name)?.value, set() {}, remove() {} } },
  )
  const { data, error } = await supabase.auth.getUser()
  return error ? null : data.user
}

const avatarOf = (user: User) => (typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : '')

export async function GET(request: NextRequest) {
  try {
    const blocked = await limited(request)
    if (blocked) return blocked
    const user = await requestUser(request)
    if (!user) return json({ success: false, error: 'Unauthorized' }, 401)

    // Admin client, filtered to the caller's own row
    const { data: profile, error } = await getSupabaseClient()
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', user.id)
      .maybeSingle()
    if (error) return json({ success: false, error: 'Failed to fetch profile' }, 500)

    return json({ success: true, profile: { ...((profile as Record<string, unknown> | null) || { id: user.id, email: user.email }), avatar: avatarOf(user) } })
  } catch {
    return json({ success: false, error: 'An unexpected error occurred. Please try again later.' }, 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const blocked = await limited(request)
    if (blocked) return blocked
    const user = await requestUser(request)
    if (!user) return json({ success: false, error: 'Unauthorized' }, 401)

    let body: Record<string, unknown>
    try { body = await request.json() } catch { return json({ success: false, error: 'Invalid request' }, 400) }
    const { full_name, phone, avatar_url } = body

    const updateData: { updated_at: string; full_name?: string; phone?: string | null } = { updated_at: new Date().toISOString() }

    if (full_name !== undefined) {
      if (typeof full_name !== 'string') return json({ success: false, error: 'Invalid name' }, 400)
      const name = full_name.replace(/[<>]/g, '').trim()
      if (name.length < 2 || name.length > 100) return json({ success: false, error: 'Name must be 2–100 characters.' }, 400)
      updateData.full_name = name
    }

    if (phone !== undefined) {
      if (phone !== null && typeof phone !== 'string') return json({ success: false, error: 'Invalid phone number' }, 400)
      const p = (phone || '').trim()
      if (p && !/^\+?[0-9 ()-]{7,20}$/.test(p)) return json({ success: false, error: 'Enter a valid phone number.' }, 400)
      updateData.phone = p || null
    }

    let avatar: string | undefined
    if (avatar_url !== undefined && avatar_url !== null) {
      if (typeof avatar_url !== 'string') return json({ success: false, error: 'Invalid photo' }, 400)
      avatar = avatar_url.trim()
      // Only a photo this user uploaded to their own avatar folder (see /api/media/upload, context "avatar")
      const ownFolder = `${STORAGE_PREFIX}product-images/avatars/${user.id}/`
      if (avatar && (!STORAGE_PREFIX.startsWith('https://') || !avatar.startsWith(ownFolder) || avatar.includes('..') || avatar.length > 1000)) {
        return json({ success: false, error: 'Please upload the photo again.' }, 400)
      }
    }

    // Admin client: RLS only lets customers READ their own profile. Filtered to user.id; only name/phone are written.
    const { data: profile, error: updateError } = await getSupabaseClient()
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select(PROFILE_COLUMNS)
      .maybeSingle()
    if (updateError) return json({ success: false, error: 'Failed to update profile' }, 500)

    // The profile photo lives on the login record (user_metadata.avatar_url), where the account menu reads it.
    if (avatar !== undefined && avatar !== avatarOf(user)) {
      const { error: metaError } = await getSupabaseClient().auth.admin.updateUserById(user.id, {
        user_metadata: { ...(user.user_metadata || {}), avatar_url: avatar || null },
      })
      if (metaError) return json({ success: false, error: 'Your details were saved, but the photo could not be updated.' }, 500)
    }

    return json({ success: true, profile: { ...((profile as Record<string, unknown> | null) || { id: user.id }), avatar: avatar ?? avatarOf(user) } })
  } catch {
    return json({ success: false, error: 'An unexpected error occurred. Please try again later.' }, 500)
  }
}
