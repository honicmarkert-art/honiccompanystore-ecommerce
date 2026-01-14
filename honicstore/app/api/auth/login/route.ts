import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { z } from 'zod'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { logAuthFailure } from '@/lib/security-monitor'
import { logger } from '@/lib/logger'
import { getSupabaseCredentials } from '@/lib/supabase-server-utils'



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

    // Parse request body with error handling
    let body
    try {
      const text = await request.text()
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { 
            success: false,
            error: 'Request body is required',
            type: 'VALIDATION_ERROR'
          },
          { status: 400 }
        )
      }
      body = JSON.parse(text)
    } catch (parseError) {
      logger.error('Failed to parse login request body:', parseError)
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid request format. Please check your input and try again.',
          type: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }
    
    // Validate input
    const validatedData = loginSchema.parse(body)
    const remember = !!validatedData.remember
    
    // Validate Supabase environment variables (CRITICAL: Must be set for authentication to work)
    let supabaseUrl: string
    let supabaseAnonKey: string
    try {
      const credentials = getSupabaseCredentials()
      supabaseUrl = credentials.url
      supabaseAnonKey = credentials.anonKey
      
      // Log in development to verify credentials are loaded
      if (process.env.NODE_ENV === 'development') {
        logger.log('Supabase credentials loaded:', {
          url: supabaseUrl?.substring(0, 30) + '...',
          hasKey: !!supabaseAnonKey,
          keyLength: supabaseAnonKey?.length || 0,
        })
      }
    } catch (error) {
      logger.error('Missing Supabase environment variables', { 
        error: error instanceof Error ? error.message : String(error),
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      })
      return NextResponse.json(
        { 
          success: false,
          error: 'Server configuration error. Please contact support.',
          type: 'SERVER_ERROR',
          details: process.env.NODE_ENV === 'development' 
            ? 'Missing Supabase environment variables. Check .env.local file.'
            : undefined
        },
        { status: 500 }
      )
    }
    
    // Track cookies that Supabase wants to set
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = []
    
    // Create Supabase client with proper cookie handling
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
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
    logger.log('Attempting login for email:', validatedData.email.toLowerCase())
    logger.log('Supabase URL configured:', !!supabaseUrl)
    logger.log('Supabase Anon Key configured:', !!supabaseAnonKey)
    logger.log('Cookies before login:', request.cookies.getAll()
      .filter(c => c.name.includes('sb-') || c.name.includes('supabase'))
      .map(c => ({ name: c.name, hasValue: !!c.value })))
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email.toLowerCase(),
      password: validatedData.password
    })
    
    logger.log('After signInWithPassword:', {
      hasData: !!data,
      hasError: !!error,
      hasSession: !!data?.session,
      hasUser: !!data?.user,
      cookiesToSetCount: cookiesToSet.length,
    })

    if (error) {
      // Enhanced error logging for debugging
      logger.error('Login failed - Supabase error:', {
        message: error.message,
        status: (error as any).status,
        code: (error as any).code,
        email: validatedData.email.toLowerCase(),
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseAnonKey,
        supabaseUrlPreview: supabaseUrl?.substring(0, 30) + '...',
      })
      
      // Log failed login attempt
      logAuthFailure({
        email: validatedData.email,
        error: error.message,
        endpoint: '/api/auth/login'
      }, request.headers.get('x-forwarded-for') || 'unknown', request.headers.get('user-agent'))
      
      // Check if error is related to email verification
      const errorMessage = error.message?.toLowerCase() || ''
      const errorCode = (error as any).code || ''
      const isEmailNotVerified = 
        errorMessage.includes('email not confirmed') ||
        errorMessage.includes('email_not_confirmed') ||
        errorMessage.includes('email not verified') ||
        errorMessage.includes('verification') ||
        errorCode === 'email_not_confirmed' ||
        errorCode === 'email_not_verified' ||
        (error.status === 400 && errorMessage.includes('confirm'))
      
      // If error message suggests email verification issue, check the user in database
      // Supabase might return "Invalid login credentials" even when email is not verified
      if (isEmailNotVerified || errorMessage.includes('invalid login credentials') || errorMessage.includes('invalid login')) {
        try {
          // Use admin client to check if user exists and email is not verified
          const adminSupabase = createAdminSupabaseClient()
          const { data: authUser } = await adminSupabase.auth.admin.getUserByEmail(validatedData.email.toLowerCase())
          
          if (authUser?.user && !authUser.user.email_confirmed_at && !authUser.user.confirmed_at) {
            // User exists but email is not verified
            return NextResponse.json(
              { 
                success: false,
                error: 'Your email address has not been verified yet. Please check your inbox for the verification email and click the verification link before logging in. If you didn\'t receive the email, you can request a new one.',
                type: 'EMAIL_NOT_VERIFIED'
              },
              { status: 403 }
            )
          }
        } catch (checkError) {
          // If we can't check, fall through to generic error
          logger.warn('Could not check user verification status:', checkError)
        }
      }
      
      // Return specific error if we detected email verification issue
      if (isEmailNotVerified) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Your email address has not been verified yet. Please check your inbox for the verification email and click the verification link before logging in. If you didn\'t receive the email, you can request a new one.',
            type: 'EMAIL_NOT_VERIFIED'
          },
          { status: 403 }
        )
      }
      
      // SECURITY: Return generic error message to prevent information disclosure
      // Never reveal if email exists or which part of credentials is wrong
      return NextResponse.json({
        success: false,
        error: 'Invalid email or password. Please check your credentials and try again.',
        type: 'INVALID_CREDENTIALS'
      }, { status: 401 })
    }

    if (!data.user || !data.session) {
      logger.error('Login failed - no user or session:', {
        hasUser: !!data.user,
        hasSession: !!data.session,
        hasData: !!data,
        cookiesToSetCount: cookiesToSet.length,
      })
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication failed. Please try again.',
          type: 'AUTHENTICATION_FAILED',
          debug: process.env.NODE_ENV === 'development' ? {
            hasUser: !!data.user,
            hasSession: !!data.session,
          } : undefined
        },
        { status: 401 }
      )
    }
    
    logger.log('Login successful - session created:', {
      userId: data.user.id,
      hasSession: !!data.session,
      sessionExpiresAt: data.session?.expires_at,
      cookiesToSetCount: cookiesToSet.length,
    })

    // Check if email is verified - REQUIRED for email/password login (not for OAuth)
    if (!data.user.email_confirmed_at && !data.user.confirmed_at) {
      // Sign out the user since they can't login without verification
      await supabase.auth.signOut()
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Your email address has not been verified. Please check your inbox for the verification link and click it before logging in. If you didn\'t receive the email, you can resend it.',
          type: 'EMAIL_NOT_VERIFIED'
        },
        { status: 403 }
      )
    }

    // Get user profile to determine role from database and remember me setting
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    const userRole = profile?.role === 'admin' || profile?.is_admin === true ? 'admin' : 'user'
    const isSupplier = profile?.is_supplier === true
    
    // Check user's remember me setting from profile, fallback to request parameter
    const userRememberMe = profile?.settings?.rememberMe ?? remember

    logger.log('Login successful for user:', data.user.id)
    logger.log('User role determined as:', userRole)
    logger.log('User is supplier:', isSupplier)

    // Determine redirect based on user role
    let redirectTo: string | null = null
    if (userRole === 'admin') {
      // Admin can access admin pages - no forced redirect
      redirectTo = null
    } else if (isSupplier) {
      // Supplier should go to supplier dashboard
      redirectTo = '/supplier/dashboard'
    } else {
      // Regular buyer should go to products page
      redirectTo = '/products'
    }

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
        profile: profile,
        isSupplier: isSupplier
      },
      redirectTo: redirectTo
    }, { status: 200 })

    // Set the cookies that Supabase wanted to set
    const isProd = process.env.NODE_ENV === 'production'
    const isLocalhost = request.headers.get('host')?.includes('localhost') || 
                       request.headers.get('host')?.includes('127.0.0.1')
    
    // In development/localhost, secure must be false for cookies to work
    const shouldUseSecure = isProd && !isLocalhost
    
    logger.log('Setting cookies:', {
      count: cookiesToSet.length,
      cookieNames: cookiesToSet.map(c => c.name),
      isProd,
      isLocalhost,
      shouldUseSecure,
    })
    
    for (const cookie of cookiesToSet) {
      if (cookie.value) {
        // Set cookie with proper options for development
        const cookieOptions = {
          httpOnly: cookie.options?.httpOnly !== false,
          secure: shouldUseSecure, // Force false in development/localhost
          sameSite: (cookie.options?.sameSite ?? 'lax') as 'lax' | 'strict' | 'none',
          path: cookie.options?.path ?? '/',
          maxAge: cookie.options?.maxAge ?? 60 * 60 * 24 * 7, // 7 days default
        }
        
        response.cookies.set(cookie.name, cookie.value, cookieOptions)
        
        if (process.env.NODE_ENV === 'development') {
          logger.log(`Cookie set: ${cookie.name}`, {
            hasValue: !!cookie.value,
            valueLength: cookie.value.length,
            options: cookieOptions,
          })
        }
      } else {
        // Remove cookie
        response.cookies.delete(cookie.name)
        if (process.env.NODE_ENV === 'development') {
          logger.log(`Cookie deleted: ${cookie.name}`)
        }
      }
    }
    
    logger.log('Auth cookies processed:', {
      total: cookiesToSet.length,
      set: cookiesToSet.filter(c => c.value).length,
      deleted: cookiesToSet.filter(c => !c.value).length,
      names: cookiesToSet.map(c => c.name),
    })
    
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
 
 
 
 

