import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase-server'

// Helper to build a SSR-safe supabase client per request
export function getSupabase(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set(name, value, options)
        },
        remove(name: string, options: any) {
          response.cookies.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )
  return { supabase, response }
}

// Helper to copy cookies from response to final response
export function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(cookie => {
    target.cookies.set(cookie.name, cookie.value, cookie)
  })
}

// Helper to validate authentication in API routes.
//
// SECURITY: a user is only accepted after Supabase has verified it — getUser() on the cookie
// session, a server-side refresh, or getUser() on a Bearer token. getSession() alone is never
// trusted: it just decodes the cookie, so a hand-made cookie could claim to be any user (incl. an admin).
export async function validateAuth(request: NextRequest) {
  const { supabase, response } = getSupabase(request)
  const explicitLogout = request.cookies.get('explicit-logout')?.value === 'true'
  const ok = (user: User, client: typeof supabase) => {
    if (explicitLogout) {
      try { response.cookies.set('explicit-logout', '', { path: '/', maxAge: 0 }) } catch {}
    }
    return { user, error: null, response, supabase: client }
  }

  // 1. Cookie session, verified by the auth server
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return ok(user, supabase)

  // 2. Expired access token: refresh on the server (the refresh token is checked by Supabase)
  if (!explicitLogout) {
    const { data: { session } } = await supabase.auth.getSession()
    const refreshToken = session?.refresh_token || request.cookies.get('sb-refresh-token')?.value
    if (refreshToken) {
      const { data: refreshed } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
      if (refreshed.session?.user) {
        const { data: { user: verified } } = await supabase.auth.getUser(refreshed.session.access_token)
        if (verified) return ok(verified, supabase)
      }
    }
  }

  // 3. Authorization: Bearer <access token>, verified by the auth server
  const bearer = request.headers.get('authorization')?.match(/^Bearers+(.+)$/i)?.[1]
  if (bearer) {
    const headerClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { cookies: { get: () => undefined, set() {}, remove() {} }, global: { headers: { Authorization: `Bearer ${bearer}` } } }
    )
    const { data: { user: headerUser } } = await headerClient.auth.getUser(bearer)
    if (headerUser) return ok(headerUser, headerClient as unknown as typeof supabase)
  }

  return { user: null, error: explicitLogout ? 'User has explicitly logged out' : 'Authentication failed', response, supabase }
}

// Helper to get user and role from database
export async function getUserAndRole(userId: string) {
  // Admin client: profiles are private under RLS, so the anon key can't read the admin flag reliably
  const { data: profile, error } = await getSupabaseClient()
    .from('profiles')
    .select('id, is_admin, is_supplier')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) {
    return { role: 'user', profile: null }
  }
  return { role: profile.is_admin === true ? 'admin' : 'user', profile }
}


