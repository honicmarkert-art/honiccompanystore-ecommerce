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
    
    // Track cookies that Supabase wants to set
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = []
    
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
            // Store cookie to set later
            cookiesToSet.push({ name, value, options })
          },
          remove(name: string, options: any) {
            // Store cookie to remove later
            cookiesToSet.push({ name, value: '', options: { ...options, maxAge: 0 } })
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

    logger.log('Login successful for user:', data.user.id)
    logger.log('User role determined as:', userRole)
    
    // Create response with user data
    const response = NextResponse.json({
      success: true,
      message: 'Login successful!',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || profile?.full_name || data.user.email,
        role: userRole,
        isVerified: data.user.email_confirmed_at !== null,
        profile: profile
      },
      redirectTo: null // Don't force redirects, let the client decide
    }, { status: 200 })

    // Set the cookies that Supabase wanted to set
    const isProd = process.env.NODE_ENV === 'production'
    
    for (const cookie of cookiesToSet) {
      if (cookie.value) {
        // Set cookie
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: cookie.options?.httpOnly !== false,
          secure: cookie.options?.secure ?? isProd,
          sameSite: cookie.options?.sameSite ?? 'lax',
          path: cookie.options?.path ?? '/',
          maxAge: cookie.options?.maxAge ?? 60 * 60 * 24 * 7
        })
      } else {
        // Remove cookie
        response.cookies.delete(cookie.name)
      }
    }
    
    logger.log('Auth cookies set:', cookiesToSet.map(c => c.name))
    
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
 
 
 
 

