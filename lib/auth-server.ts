import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Helper to build a SSR-safe supabase client per request
export function getSupabase(request: NextRequest) {
  let response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

// Helper to validate authentication in API routes
export async function validateAuth(request: NextRequest) {
  // Check for explicit logout flag first - if set, user should remain logged out
  const explicitLogout = request.cookies.get('explicit-logout')?.value
  if (explicitLogout === 'true') {
    logger.log('Explicit logout flag found in validateAuth, returning unauthenticated')
    const { supabase, response } = getSupabase(request)
    return { user: null, error: 'User has explicitly logged out', response, supabase }
  }
  
  const { supabase, response } = getSupabase(request)
  
  // First try to get the current session
  let { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  if (sessionError) {
    console.error('Session error:', sessionError)
    return { user: null, error: 'Session error', response, supabase }
  }

  // If no session, try to refresh
  if (!session) {
    const refreshToken = request.cookies.get('sb-refresh-token')?.value
    if (refreshToken) {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      })
      
      if (refreshError || !refreshedSession) {
        console.error('Refresh error:', refreshError)
        return { user: null, error: 'Authentication failed', response, supabase }
      }
      
      session = refreshedSession
    } else {
      return { user: null, error: 'No valid session', response, supabase }
    }
  }

  const user = session.user
  if (!user) {
    return { user: null, error: 'User not found', response, supabase }
  }

  return { user, error: null, response, supabase }
}

// Helper to get user and role from database
export async function getUserAndRole(userId: string) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Profile fetch error:', error)
    return { role: 'user', profile: null }
  }

  // Determine role from database (handle missing columns gracefully)
  const userRole = (profile?.role === 'admin' || profile?.is_admin === true) ? 'admin' : 'user'

  return { role: userRole, profile }
}

