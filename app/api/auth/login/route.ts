import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { logAuthFailure } from '@/lib/security-monitor'
import { logger } from '@/lib/logger'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional()
})

export async function POST(request: NextRequest) {
  try {
    // Enhanced rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/auth/login',
        reason: rateLimitResult.reason
      }, request)
      
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
          }
        }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validatedData = loginSchema.parse(body)
    const remember = !!validatedData.remember
    
    // Create Supabase client with proper cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
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

    // Authenticate with Supabase (this sets the official auth token cookie)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email.toLowerCase(),
      password: validatedData.password
    })

    if (error) {
      // Log failed login attempt
      logAuthFailure({
        email: validatedData.email,
        error: error.message,
        endpoint: '/api/auth/login'
      }, request.headers.get('x-forwarded-for') || 'unknown', request.headers.get('user-agent'))
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid email or password. Please check your credentials and try again.',
          type: 'INVALID_CREDENTIALS'
        },
        { status: 401 }
      )
    }

    if (!data.user || !data.session) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication failed. Please try again.',
          type: 'AUTHENTICATION_FAILED'
        },
        { status: 401 }
      )
    }

    // Get user profile to determine role from database and remember me setting
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    const userRole = profile?.role === 'admin' || profile?.is_admin === true ? 'admin' : 'user'
    
    // Check user's remember me setting from profile, fallback to request parameter
    const userRememberMe = profile?.settings?.rememberMe ?? remember

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      message: 'Login successful!',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || profile?.full_name || data.user.email,
        role: userRole,
        isVerified: data.user.email_confirmed_at !== null
      },
      redirectTo: null // Don't force redirects, let the client decide
    }, { status: 200 })

    // Set the official Supabase auth cookies properly
    const isProd = process.env.NODE_ENV === 'production'
    
    logger.log('Setting auth cookies for user:', data.user.id)
    logger.log('Access token length:', data.session.access_token.length)
    logger.log('Refresh token length:', data.session.refresh_token.length)
    
    response.cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: userRememberMe ? 60 * 60 * 24 * 7 : 60 * 60 // 7 days or 1 hour
    })

    response.cookies.set('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: userRememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7 // 30 days or 7 days
    })
    
    // Also set a session indicator cookie for better persistence
    response.cookies.set('sb-session-active', 'true', {
      httpOnly: false, // Allow client-side access
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: userRememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7 // Same as refresh token
    })
    
    logger.log('Auth cookies set successfully')
    return response

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid input data. Please check your email and password.',
          type: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }

    console.error('Login error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'An unexpected error occurred. Please try again later.',
        type: 'SERVER_ERROR'
      },
      { status: 500 }
    )
  }
} 
 
 
 
 

