import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    const isProd = process.env.NODE_ENV === 'production'
    
    // Create response first so we can set cookies on it
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    }, { status: 200 })

    // Create Supabase client with proper cookie handling that writes to response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Write cookies to the response so they're actually set
            response.cookies.set(name, value, options)
          },
          remove(name: string, options: any) {
            // Remove cookies from the response
            response.cookies.set(name, '', { ...options, maxAge: 0 })
          },
        },
      }
    )

    // Sign out from Supabase (this invalidates the refresh token and clears session)
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Supabase signOut error:', error)
      // Continue with cookie cleanup even if Supabase signOut fails
    }

    // Get project ref to clear Supabase SSR cookies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const projectRef = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
    const supabaseAuthCookieName = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'

    // Set explicit logout flag to prevent auto-login
    response.cookies.set('explicit-logout', 'true', {
      httpOnly: false, // Allow client-side access
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    })

    // Clear the official Supabase auth token cookies
    const cookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0
    }

    // Clear official Supabase SSR cookies (these are the actual cookies Supabase uses)
    // Supabase SSR uses cookies like: sb-{project-ref}-auth-token.0 and sb-{project-ref}-auth-token.1
    if (projectRef) {
      // Clear all possible Supabase SSR cookie variants
      response.cookies.set(`${supabaseAuthCookieName}.0`, '', cookieOptions)
      response.cookies.set(`${supabaseAuthCookieName}.1`, '', cookieOptions)
      response.cookies.set(supabaseAuthCookieName, '', cookieOptions)
    }

    // Clear custom Supabase auth cookies (legacy)
    response.cookies.set('sb-access-token', '', cookieOptions)
    response.cookies.set('sb-refresh-token', '', cookieOptions)
    response.cookies.set('sb-session-active', '', {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })
    response.cookies.set('sb-user-role', '', {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })

    // Also clear any legacy custom cookies if they exist
    response.cookies.set('auth-token', '', cookieOptions)
    response.cookies.set('refresh-token', '', cookieOptions)
    response.cookies.set('session-id', '', cookieOptions)
    response.cookies.set('user-role', '', {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })

    // Clear all cookies that start with 'sb-' to catch any other Supabase cookies
    request.cookies.getAll().forEach(cookie => {
      if (cookie.name.startsWith('sb-')) {
        response.cookies.set(cookie.name, '', cookieOptions)
      }
    })

    return response

  } catch (error) {
    console.error('Logout error:', error)
    
    // Even if there's an error, clear the cookies and session
    const isProd = process.env.NODE_ENV === 'production'
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    }, { status: 200 })

    // Try to sign out from Supabase even in error case
    try {
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
      await supabase.auth.signOut()
    } catch (signOutError) {
      console.error('Error during signOut in catch block:', signOutError)
    }

    // Clear cookies regardless of error
    const cookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0
    }

    // Get project ref to clear Supabase SSR cookies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const projectRef = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
    const supabaseAuthCookieName = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'

    // Set explicit logout flag
    response.cookies.set('explicit-logout', 'true', {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    })

    // Clear Supabase SSR cookies
    if (projectRef) {
      response.cookies.set(`${supabaseAuthCookieName}.0`, '', cookieOptions)
      response.cookies.set(`${supabaseAuthCookieName}.1`, '', cookieOptions)
      response.cookies.set(supabaseAuthCookieName, '', cookieOptions)
    }

    response.cookies.set('sb-access-token', '', cookieOptions)
    response.cookies.set('sb-refresh-token', '', cookieOptions)
    response.cookies.set('sb-session-active', '', {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })
    response.cookies.set('sb-user-role', '', {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })
    response.cookies.set('auth-token', '', cookieOptions)
    response.cookies.set('refresh-token', '', cookieOptions)
    response.cookies.set('session-id', '', cookieOptions)
    response.cookies.set('user-role', '', {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })

    // Clear all cookies that start with 'sb-'
    request.cookies.getAll().forEach(cookie => {
      if (cookie.name.startsWith('sb-')) {
        response.cookies.set(cookie.name, '', cookieOptions)
      }
    })

    return response
  }
} 
 
 
 
 
 
 
 
 

