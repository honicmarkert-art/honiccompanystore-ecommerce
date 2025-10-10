import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Cookie duration constants
const ONE_HOUR = 60 * 60
const ONE_WEEK = 60 * 60 * 24 * 7

// Helper function to copy cookies
function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(cookie => {
    target.cookies.set(cookie.name, cookie.value, cookie)
  })
}

export async function GET(request: NextRequest) {
  try {
    
    // Check for explicit logout flag first - if set, user should remain logged out
    const explicitLogout = request.cookies.get('explicit-logout')?.value
    if (explicitLogout === 'true') {
      return NextResponse.json({
        success: false,
        authenticated: false,
        message: 'User has explicitly logged out'
      }, { status: 401 })
    }
    
    // Log incoming cookies for debugging
    const accessToken = request.cookies.get('sb-access-token')?.value
    const refreshToken = request.cookies.get('sb-refresh-token')?.value
    
    
    // Create response to handle cookie updates
    let response = NextResponse.next()
    
    // Create Supabase client with proper cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            const cookie = request.cookies.get(name)
            return cookie?.value
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

    // Get current session first
    let { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      const errorResponse = NextResponse.json({
        success: false,
        authenticated: false,
        message: 'Session verification failed'
      }, { status: 500 })
      
      copyCookies(response, errorResponse)
      return errorResponse
    }

    // If no session, try to refresh using the refresh token
    if (!session) {
      
      // Get refresh token from cookies
      const refreshToken = request.cookies.get('sb-refresh-token')?.value
      
      if (!refreshToken) {
        const errorResponse = NextResponse.json({
          success: false,
          authenticated: false,
          message: 'No valid session found'
        }, { status: 401 })
        
        // Clear session indicator cookie
        errorResponse.cookies.set('sb-session-active', '', {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 0
        })
        
        copyCookies(response, errorResponse)
        return errorResponse
      }
      
      
      // Attempt to refresh the session with the refresh token
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      })
      
      if (refreshError) {
        const errorResponse = NextResponse.json({
          success: false,
          authenticated: false,
          message: 'Session refresh failed'
        }, { status: 401 })
        
        copyCookies(response, errorResponse)
        return errorResponse
      }
      
      if (!refreshedSession) {
        const errorResponse = NextResponse.json({
          success: false,
          authenticated: false,
          message: 'No valid session found'
        }, { status: 401 })
        
        copyCookies(response, errorResponse)
        return errorResponse
      }
      
      session = refreshedSession
    }

    // Get user from session (simplified - no need for separate getUser call)
    const user = session.user
    
    
    if (!user) {
      const errorResponse = NextResponse.json({
        success: false,
        authenticated: false,
        message: 'User not found'
      }, { status: 401 })
      
      copyCookies(response, errorResponse)
      return errorResponse
    }

    // Get user profile from database with timeout (only select existing columns)
    const profilePromise = supabase
      .from('profiles')
      .select('*') // Select all columns to avoid schema issues
      .eq('id', user.id)
      .single()
    
    // Add timeout to profile fetch
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
    )
    
    const { data: profile, error: profileError } = await Promise.race([
      profilePromise,
      timeoutPromise
    ]) as any

    if (profileError) {
      // Return user without role if profile fetch fails
      const successResponse = NextResponse.json({
        success: true,
        authenticated: true,
        isProfileLoaded: false,
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email,
          role: 'user', // Default to user if profile fetch fails
          isVerified: user.email_confirmed_at !== null
        }
      }, { status: 200 })
      
      copyCookies(response, successResponse)
      return successResponse
    }

    // Determine role from database (handle missing columns gracefully)
    const userRole = (profile?.role === 'admin' || profile?.is_admin === true) ? 'admin' : 'user'

    const successResponse = NextResponse.json({
      success: true,
      authenticated: true,
      isProfileLoaded: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || profile?.full_name || user.email,
        role: userRole,
        isVerified: user.email_confirmed_at !== null,
        profile: {
          avatar: profile?.avatar || null,
          phone: profile?.phone || null,
          address: profile?.address || null,
          bio: profile?.bio || null,
          is_verified: profile?.is_verified || false
        }
      }
    }, { status: 200 })
    
    copyCookies(response, successResponse)
    return successResponse

  } catch (error) {
    return NextResponse.json({
      success: false,
      authenticated: false,
      message: 'Session verification failed'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token, role } = await request.json()

    if (!access_token) {
      return NextResponse.json({ success: false, error: 'Missing access token' }, { status: 400 })
    }

    const response = NextResponse.json({ success: true })

    const isProd = process.env.NODE_ENV === 'production'

    response.cookies.set('sb-access-token', access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 // 1 hour
    })

    if (refresh_token) {
      response.cookies.set('sb-refresh-token', refresh_token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 14 // 14 days
      })
    }

    if (role) {
      response.cookies.set('sb-user-role', role, {
        httpOnly: false,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
    }

    return response
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to set session' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' as const }
  response.cookies.set('sb-access-token', '', { ...options, maxAge: 0 })
  response.cookies.set('sb-refresh-token', '', { ...options, maxAge: 0 })
  response.cookies.set('sb-user-role', '', { httpOnly: false, secure: options.secure, sameSite: 'lax' as const, path: '/', maxAge: 0 })
  return response
}


