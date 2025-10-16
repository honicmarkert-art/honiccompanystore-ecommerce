import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Helper to build a SSR-safe supabase client per request
export function getSupabase(request: NextRequest) {
  let response = NextResponse.next()
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

// Helper to validate authentication in API routes
export async function validateAuth(request: NextRequest) {
  const { supabase, response } = getSupabase(request)
  const explicitLogout = request.cookies.get('explicit-logout')?.value === 'true'
  
  // First try to get the current session
  let { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  if (sessionError) {
    console.error('Session error:', sessionError)
    return { user: null, error: 'Session error', response, supabase }
  }

  // If no session, try to refresh
  if (!session) {
    // Respect explicit logout only when there is truly no active session
    if (explicitLogout) {
      logger.log('Explicit logout cookie honored - no active session')
      return { user: null, error: 'User has explicitly logged out', response, supabase }
    }

    const refreshToken = request.cookies.get('sb-refresh-token')?.value
    if (refreshToken) {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      })
      
      if (refreshError || !refreshedSession) {
        console.error('Refresh error:', refreshError)
        // Fallback: try Authorization Bearer header
        const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
        const bearer = authHeader?.startsWith('Bearer ')
          ? authHeader.substring('Bearer '.length)
          : null
        if (bearer) {
          try {
            const headerClient = createServerClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL || '',
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              {
                global: { headers: { Authorization: `Bearer ${bearer}` } },
              }
            )
            const { data: userData, error: userErr } = await headerClient.auth.getUser()
            if (!userErr && userData.user) {
              // Clear stale explicit-logout if present
              if (explicitLogout) {
                try { response.cookies.set('explicit-logout', '', { path: '/', maxAge: 0 }) } catch {}
              }
              return { user: userData.user, error: null, response, supabase: headerClient as any }
            }
          } catch (e) {
            console.error('Authorization header validation failed:', e)
          }
        }
        return { user: null, error: 'Authentication failed', response, supabase }
      }
      
      session = refreshedSession
    } else {
      // Final fallback: Authorization header
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
      const bearer = authHeader?.startsWith('Bearer ')
        ? authHeader.substring('Bearer '.length)
        : null
      if (bearer) {
        try {
          const headerClient = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            { global: { headers: { Authorization: `Bearer ${bearer}` } } }
          )
          const { data: userData, error: userErr } = await headerClient.auth.getUser()
          if (!userErr && userData.user) {
            if (explicitLogout) {
              try { response.cookies.set('explicit-logout', '', { path: '/', maxAge: 0 }) } catch {}
            }
            return { user: userData.user, error: null, response, supabase: headerClient as any }
          }
        } catch (e) {
          console.error('Authorization header validation failed:', e)
        }
      }
      return { user: null, error: 'No valid session', response, supabase }
    }
  }

  const user = session.user
  if (!user) {
    return { user: null, error: 'User not found', response, supabase }
  }

  // If we successfully have a session, clear any stale explicit-logout flag
  if (explicitLogout) {
    try {
      response.cookies.set('explicit-logout', '', { path: '/', maxAge: 0 })
    } catch {}
  }

  return { user, error: null, response, supabase }
}

// Helper to get user and role from database
export async function getUserAndRole(userId: string) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
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


