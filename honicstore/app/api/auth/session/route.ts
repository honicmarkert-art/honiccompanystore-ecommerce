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
    
    // Read explicit logout flag - if set, user explicitly logged out, so don't auto-login
    const explicitLogout = request.cookies.get('explicit-logout')?.value === 'true'
    
    // If user explicitly logged out, return unauthenticated immediately
    // This prevents auto-login after logout
    if (explicitLogout) {
      const response = NextResponse.json({
        success: false,
        authenticated: false,
        message: 'User explicitly logged out'
      }, { status: 401 })
      
      // Clear the explicit-logout flag after checking it
      response.cookies.set('explicit-logout', '', { path: '/', maxAge: 0 })
      return response
    }
    
    // Log incoming cookies for debugging
    // Note: Supabase SSR uses its own cookie format (sb-{project-ref}-auth-token)
    // These custom cookies are just for reference
    const accessToken = request.cookies.get('sb-access-token')?.value
    const refreshToken = request.cookies.get('sb-refresh-token')?.value
    
    // Check for Supabase's actual cookie format
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const projectRef = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
    const supabaseAuthCookieName = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'
    const supabaseAuthCookie = request.cookies.get(supabaseAuthCookieName)?.value
    
    
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

    // First, try to get session (Supabase SSR manages its own cookies)
    let { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    // If no session, try to refresh using Supabase's refresh mechanism
    // Supabase SSR will automatically use refresh tokens from its own cookies
    if (!session) {
      try {
        // Try to refresh - Supabase SSR will look for refresh token in its own cookies
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshError) {
          // Only log specific refresh token errors, suppress common ones to reduce noise
          const errorCode = (refreshError as any)?.code || ''
          const errorMessage = refreshError.message?.toLowerCase() || ''
          
          // Suppress "refresh_token_not_found" errors - these are common when cookies are cleared
          if (errorCode !== 'refresh_token_not_found' && !errorMessage.includes('refresh token not found')) {
            console.error('❌ Refresh failed:', refreshError.message)
          }
          
          // If automatic refresh fails and we have a custom refresh token, try using it
          if (refreshToken && refreshError.message?.includes('refresh') && errorCode !== 'refresh_token_not_found') {
            const { data: { session: manualRefresh }, error: manualError } = await supabase.auth.refreshSession({
              refresh_token: refreshToken
            })
            if (!manualError && manualRefresh) {
              session = manualRefresh
            }
          }
        } else if (refreshedSession) {
          session = refreshedSession
        }
      } catch (refreshErr: any) {
        // Suppress common refresh token errors
        const errorCode = (refreshErr as any)?.code || ''
        if (errorCode !== 'refresh_token_not_found') {
          console.error('❌ Error refreshing session:', refreshErr?.message || refreshErr)
        }
      }
    }
    
    // Get user from session or directly
    let { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // If getUser fails but we have a session, use session.user
    if ((userError || !user) && session?.user) {
      user = session.user
      userError = null
    }
    
    if (userError || !user) {
      // Log the error for debugging
      if (process.env.NODE_ENV === 'development') {
        // Check for Supabase's actual cookie names
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const projectRef = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
        const authCookieName = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'
        const authCookie = request.cookies.get(authCookieName)?.value
        
        console.error('❌ Session API - getUser() failed:', {
          error: userError?.message,
          hasCookies: {
            customAccessToken: !!accessToken,
            customRefreshToken: !!refreshToken,
            supabaseAuthCookie: !!supabaseAuthCookie,
            supabaseCookieName: supabaseAuthCookieName
          },
          allSupabaseCookies: request.cookies.getAll()
            .filter(c => c.name.includes('sb-') || c.name.includes('supabase'))
            .map(c => ({ name: c.name, hasValue: !!c.value, valueLength: c.value?.length || 0 }))
        })
      }
      
      const errorResponse = NextResponse.json({
        success: false,
        authenticated: false,
        message: userError?.message || 'Session verification failed'
      }, { status: 401 })
      
      copyCookies(response, errorResponse)
      return errorResponse
    }

    // If we still don't have a session but have a user, try to get it
    if (!session) {
      const { data: { session: sessionData }, error: sessionErr } = await supabase.auth.getSession()
      if (!sessionErr && sessionData) {
        session = sessionData
        // Update user from session if we got one
        if (sessionData.user && !user) {
          user = sessionData.user
        }
      }
    }

    // Get user from session if we still don't have one
    if (!user && session) {
      user = session.user
    }
    
    
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
      // Extract name from user metadata (handles Google OAuth users)
      const userName = user.user_metadata?.full_name || 
                       user.user_metadata?.name || 
                       user.user_metadata?.display_name ||
                       user.email?.split('@')[0] || 
                       user.email || 
                       'User'
      
      // Return user without role if profile fetch fails
      const successResponse = NextResponse.json({
        success: true,
        authenticated: true,
        isProfileLoaded: false,
        user: {
          id: user.id,
          email: user.email,
          name: userName,
          role: 'user', // Default to user if profile fetch fails
          // OAuth providers (like Google) automatically verify emails
          isVerified: user.email_confirmed_at !== null || user.app_metadata?.provider === 'google' || user.identities?.some((id: any) => id.provider === 'google'),
          isSupplier: false, // Default to false if profile fetch fails
          profile: null
        }
      }, { status: 200 })
      
      copyCookies(response, successResponse)
      return successResponse
    }

    // Determine role from database (handle missing columns gracefully)
    const userRole = (profile?.role === 'admin' || profile?.is_admin === true) ? 'admin' : 'user'

    // Extract name from user metadata (handles Google OAuth users) or profile
    // Google OAuth provides: full_name, name, or display_name in user_metadata
    const userName = (user.user_metadata?.full_name?.trim() || 
                     user.user_metadata?.name?.trim() || 
                     user.user_metadata?.display_name?.trim() ||
                     profile?.full_name?.trim() || 
                     user.email?.split('@')[0] || 
                     user.email || 
                     'User').trim()
    
    // Debug logging for Google OAuth users
    if (process.env.NODE_ENV === 'development' && user.user_metadata?.provider === 'google') {
      console.log('🔍 Google user name extraction:', {
        full_name: user.user_metadata?.full_name,
        name: user.user_metadata?.name,
        display_name: user.user_metadata?.display_name,
        extracted: userName,
        email: user.email
      })
    }

    // OAuth providers (like Google) automatically verify emails
    // Check if user is from OAuth provider - check identities array (most reliable)
    const isOAuthUser = user.identities?.some((id: any) => id.provider === 'google') || 
                        user.app_metadata?.provider === 'google' ||
                        user.user_metadata?.provider === 'google'
    // OAuth users are automatically verified by the provider (Google)
    const isVerified = user.email_confirmed_at !== null || isOAuthUser

    const successResponse = NextResponse.json({
      success: true,
      authenticated: true,
      isProfileLoaded: true,
      user: {
        id: user.id,
        email: user.email,
        name: userName,
        role: userRole,
        isVerified: isVerified,
        profile: {
          avatar: profile?.avatar || null,
          phone: profile?.phone || null,
          address: profile?.address || null,
          bio: profile?.bio || null,
          is_verified: profile?.is_verified || false,
          is_supplier: profile?.is_supplier || false,
          is_admin: profile?.is_admin || false,
          role: profile?.role || null
        },
        isSupplier: profile?.is_supplier || false
      }
    }, { status: 200 })
    
    copyCookies(response, successResponse)
    return successResponse

  } catch (error: any) {
    // Log the error for debugging
    console.error('❌ Session API - Unexpected error:', error)
    
    return NextResponse.json({
      success: false,
      authenticated: false,
      message: error?.message || 'Session verification failed'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token, role } = await request.json()

    if (!access_token) {
      return NextResponse.json({ success: false, error: 'Missing access token' }, { status: 400 })
    }

    // Create response to handle cookie updates
    const response = NextResponse.json({ success: true })

    // Create Supabase SSR client to properly set session cookies
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

    // Use Supabase's setSession to properly set all required cookies
    const { data: { session }, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token: refresh_token || '',
    })

    if (sessionError) {
      console.error('❌ Error setting session:', sessionError)
      return NextResponse.json({ 
        success: false, 
        error: sessionError.message || 'Failed to set session' 
      }, { status: 500 })
    }

    if (!session) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create session' 
      }, { status: 500 })
    }
    
    // Verify refresh token is in the session
    if (!session.refresh_token) {
      console.warn('⚠️ Session created but refresh_token is missing - session may not persist')
      // Try to use the provided refresh_token if session doesn't have it
      if (refresh_token) {
        console.log('⚠️ Attempting to set refresh token manually...')
        // Note: Supabase SSR should handle this automatically, but log for debugging
      }
    } else {
      console.log('✅ Session created with refresh token')
    }

    // Set role cookie if provided (custom cookie, not managed by Supabase)
    if (role) {
      const isProd = process.env.NODE_ENV === 'production'
      response.cookies.set('sb-user-role', role, {
        httpOnly: false,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
    }

    console.log('✅ Session set successfully via Supabase SSR')
    return response
  } catch (error: any) {
    console.error('❌ POST /api/auth/session error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Failed to set session' 
    }, { status: 500 })
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


