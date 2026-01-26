import { NextRequest, NextResponse } from 'next/server'
import { supabaseAuth } from '@/lib/supabase-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { getSupabaseClient } from '@/lib/supabase-server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Email validation schema
const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address').max(255, 'Email address is too long')
})

// Rate limiting for resend verification (prevent abuse)
const resendRateLimitStore = new Map<string, { count: number; lastRequest: Date }>()
const MAX_RESEND_ATTEMPTS = 3 // Max 3 resend requests
const RESEND_WINDOW = 60 * 60 * 1000 // 1 hour window

function checkResendRateLimit(ip: string, email: string): { allowed: boolean; retryAfter?: number } {
  const key = `${ip}:${email.toLowerCase()}`
  const now = new Date()
  const record = resendRateLimitStore.get(key)

  if (!record) {
    resendRateLimitStore.set(key, { count: 1, lastRequest: now })
    return { allowed: true }
  }

  // Reset if window expired
  if (now.getTime() - record.lastRequest.getTime() > RESEND_WINDOW) {
    resendRateLimitStore.set(key, { count: 1, lastRequest: now })
    return { allowed: true }
  }

  if (record.count >= MAX_RESEND_ATTEMPTS) {
    const retryAfter = Math.ceil((RESEND_WINDOW - (now.getTime() - record.lastRequest.getTime())) / 1000)
    return { allowed: false, retryAfter }
  }

  record.count++
  record.lastRequest = now
  return { allowed: true }
}

export async function POST(request: NextRequest) {
  try {
    // Enhanced rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/auth/resend-verification',
        reason: rateLimitResult.reason
      }, request)
      
      return NextResponse.json(
        { 
          success: false,
          error: rateLimitResult.reason || 'Too many requests. Please try again later.'
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
          }
        }
      )
    }

    const body = await request.json()
    
    // Validate input with Zod schema
    let validatedData
    try {
      validatedData = emailSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            success: false,
            error: error.errors[0]?.message || 'Invalid email address'
          },
          { status: 400 }
        )
      }
      throw error
    }

    const { email } = validatedData
    const sanitizedEmail = email.toLowerCase().trim()

    // Check if email is already verified before attempting to resend
    try {
      const adminSupabase = getSupabaseClient()
      
      // Try to get user by email to check verification status
      // First check profiles table
      const { data: profile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('id, email')
        .eq('email', sanitizedEmail)
        .limit(1)
        .maybeSingle()
      
      if (!profileError && profile) {
        // User exists in profiles, check auth status
        try {
          // Try to get auth user using listUsers and filter
          const { data: authUsers, error: listError } = await adminSupabase.auth.admin.listUsers()
          
          if (!listError && authUsers?.users) {
            const authUser = authUsers.users.find(u => u.email?.toLowerCase() === sanitizedEmail)
            
            if (authUser && authUser.email_confirmed_at) {
              // Email is already verified
              return NextResponse.json(
                {
                  success: false,
                  error: 'This email address has already been verified. You can log in to your account.',
                  type: 'ALREADY_VERIFIED',
                  message: 'Your email is already verified. Please try logging in instead.'
                },
                { status: 400 }
              )
            }
          }
        } catch (authCheckError) {
          // If we can't check auth status, continue with resend attempt
          }
      }
    } catch (checkError) {
      // If check fails, continue with resend attempt (Supabase will handle it)
      }

    // Additional rate limiting for resend verification (per email)
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const resendRateLimit = checkResendRateLimit(clientIP, sanitizedEmail)
    
    if (!resendRateLimit.allowed) {
      logSecurityEvent('RESEND_VERIFICATION_RATE_LIMIT', {
        endpoint: '/api/auth/resend-verification',
        email: sanitizedEmail,
        ip: clientIP
      }, request)
      
      return NextResponse.json(
        { 
          success: false,
          error: `Too many verification email requests. Please wait ${Math.ceil((resendRateLimit.retryAfter || 3600) / 60)} minutes before requesting again.`
        },
        { 
          status: 429,
          headers: {
            'Retry-After': resendRateLimit.retryAfter?.toString() || '3600'
          }
        }
      )
    }

    const result = await supabaseAuth.resendVerificationEmail(sanitizedEmail)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message || 'Verification email sent! Please check your inbox.'
      })
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'Failed to resend verification email'
        },
        { status: 400 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: 'An unexpected error occurred. Please try again.'
      },
      { status: 500 }
    )
  }
}
