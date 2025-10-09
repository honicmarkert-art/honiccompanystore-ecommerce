import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // This will be handled by the response
          },
          remove(name: string, options: any) {
            // This will be handled by the response
          },
        },
      }
    )

    // Sign out from Supabase (this invalidates the refresh token)
    const { error } = await supabase.auth.signOut()

    const isProd = process.env.NODE_ENV === 'production'

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    }, { status: 200 })

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

    // Clear official Supabase auth cookies
    response.cookies.set('sb-access-token', '', cookieOptions)
    response.cookies.set('sb-refresh-token', '', cookieOptions)

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

    return response

  } catch (error) {
    console.error('Logout error:', error)
    
    // Even if there's an error, clear the cookies
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    }, { status: 200 })

    // Clear cookies regardless of error
    const isProd = process.env.NODE_ENV === 'production'
    const cookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0
    }

    response.cookies.set('sb-access-token', '', cookieOptions)
    response.cookies.set('sb-refresh-token', '', cookieOptions)
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

    return response
  }
} 
 
 
 
 
 
 
 
 