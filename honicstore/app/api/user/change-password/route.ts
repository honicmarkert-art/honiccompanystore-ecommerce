import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { OTPUtils } from '@/lib/otp'
import { otpManager } from '@/lib/otp'
import { sendPasswordChangeOTPEmail } from '@/lib/user-email-service'
import { validatePasswordStrength } from '@/lib/security'
import { createHash } from 'crypto'

export const runtime = 'nodejs'

// Rate limiting store per user (use Redis in production)
const passwordChangeRateLimit = new Map<string, { count: number; resetTime: number; blockedUntil?: number }>()
const OTP_ATTEMPT_LIMIT = 3 // Max OTP verification attempts per user
const OTP_REQUEST_LIMIT = 3 // Max OTP requests per hour per user
const OTP_ATTEMPT_WINDOW = 15 * 60 * 1000 // 15 minutes
const OTP_REQUEST_WINDOW = 60 * 60 * 1000 // 1 hour

// Store password change requests to bind OTP to specific password
const passwordChangeRequests = new Map<string, { passwordHash: string; timestamp: number }>()

// Helper to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  
  return realIP || 'unknown'
}

// Rate limiting per user
function checkUserRateLimit(userId: string, isOTPRequest: boolean = false): { allowed: boolean; reason?: string; retryAfter?: number } {
  const now = Date.now()
  const key = `password-change:${userId}:${isOTPRequest ? 'request' : 'verify'}`
  const entry = passwordChangeRateLimit.get(key)
  
  const config = isOTPRequest 
    ? { windowMs: OTP_REQUEST_WINDOW, maxRequests: OTP_REQUEST_LIMIT }
    : { windowMs: OTP_ATTEMPT_WINDOW, maxRequests: OTP_ATTEMPT_LIMIT }
  
  // Check if blocked
  if (entry?.blockedUntil && now < entry.blockedUntil) {
    return {
      allowed: false,
      reason: 'Too many attempts. Please try again later.',
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000)
    }
  }
  
  // Reset if window expired
  if (!entry || now > entry.resetTime) {
    passwordChangeRateLimit.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    })
    return { allowed: true }
  }
  
  // Increment count
  entry.count++
  
  // Check limit
  if (entry.count > config.maxRequests) {
    entry.blockedUntil = now + (30 * 60 * 1000) // Block for 30 minutes
    entry.count = 0
    
    return {
      allowed: false,
      reason: 'Too many attempts. Account temporarily blocked for security.',
      retryAfter: 1800 // 30 minutes in seconds
    }
  }
  
  return { allowed: true }
}

// Create hash of password for binding
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

// Validate and sanitize input
function sanitizeString(input: string): string {
  if (typeof input !== 'string') return ''
  return input.trim().slice(0, 255) // Limit length
}

// POST /api/user/change-password - Change user password with two-step verification
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let userId: string | null = null
  
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user || !user.email || !user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    userId = user.id
    const clientIP = getClientIP(request)

    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }

    const { step, currentPassword, newPassword, otpCode } = body

    // Validate step parameter
    if (!step || (step !== 'request-otp' && step !== 'verify-otp')) {
      return NextResponse.json(
        { error: 'Invalid step parameter' },
        { status: 400 }
      )
    }

    // Step 1: Request OTP - Verify current password and send OTP
    if (step === 'request-otp') {
      // Rate limiting
      const rateLimitCheck = checkUserRateLimit(userId, true)
      if (!rateLimitCheck.allowed) {
        return NextResponse.json(
          { error: rateLimitCheck.reason || 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: rateLimitCheck.retryAfter ? {
              'Retry-After': rateLimitCheck.retryAfter.toString()
            } : {}
          }
        )
      }

      // Validate inputs
      const sanitizedCurrentPassword = sanitizeString(currentPassword || '')
      const sanitizedNewPassword = sanitizeString(newPassword || '')

      if (!sanitizedCurrentPassword || !sanitizedNewPassword) {
        return NextResponse.json(
          { error: 'Current password and new password are required' },
          { status: 400 }
        )
      }

      // Validate password length
      if (sanitizedNewPassword.length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters long' },
          { status: 400 }
        )
      }

      if (sanitizedNewPassword.length > 128) {
        return NextResponse.json(
          { error: 'New password is too long (max 128 characters)' },
          { status: 400 }
        )
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(sanitizedNewPassword)
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { 
            error: 'Password does not meet security requirements',
            details: passwordValidation.feedback.join('; ')
          },
          { status: 400 }
        )
      }

      // Check if passwords are the same
      if (sanitizedCurrentPassword === sanitizedNewPassword) {
        return NextResponse.json(
          { error: 'New password must be different from current password' },
          { status: 400 }
        )
      }

      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: sanitizedCurrentPassword
      })

      if (signInError) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 401 }
        )
      }

      // Store password hash for step 2 validation
      const passwordHash = hashPassword(sanitizedNewPassword)
      passwordChangeRequests.set(userId, {
        passwordHash,
        timestamp: Date.now()
      })

      // Clean up old requests (older than 15 minutes)
      setTimeout(() => {
        passwordChangeRequests.delete(userId)
      }, 15 * 60 * 1000)

      // Generate and send OTP
      const otpCode = OTPUtils.generatePasswordChangeOTP(user.email!)
      
      // Send OTP email
      const emailResult = await sendPasswordChangeOTPEmail(user.email!, otpCode, 15)
      
      if (!emailResult.success) {
        return NextResponse.json(
          { error: 'Failed to send verification code. Please try again.' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Verification code sent to your email',
        step: 'verify-otp'
      })
    }

    // Step 2: Verify OTP and change password
    if (step === 'verify-otp') {
      // Rate limiting for OTP verification
      const rateLimitCheck = checkUserRateLimit(userId, false)
      if (!rateLimitCheck.allowed) {
        return NextResponse.json(
          { error: rateLimitCheck.reason || 'Too many attempts. Please try again later.' },
          { 
            status: 429,
            headers: rateLimitCheck.retryAfter ? {
              'Retry-After': rateLimitCheck.retryAfter.toString()
            } : {}
          }
        )
      }

      // Validate inputs
      const sanitizedOtpCode = sanitizeString(otpCode || '').replace(/\D/g, '') // Remove non-digits
      const sanitizedNewPassword = sanitizeString(newPassword || '')

      if (!sanitizedOtpCode || sanitizedOtpCode.length !== 6) {
        return NextResponse.json(
          { error: 'Please enter a valid 6-digit verification code' },
          { status: 400 }
        )
      }

      if (!sanitizedNewPassword) {
        return NextResponse.json(
          { error: 'New password is required' },
          { status: 400 }
        )
      }

      // Validate password length
      if (sanitizedNewPassword.length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters long' },
          { status: 400 }
        )
      }

      if (sanitizedNewPassword.length > 128) {
        return NextResponse.json(
          { error: 'New password is too long (max 128 characters)' },
          { status: 400 }
        )
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(sanitizedNewPassword)
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { 
            error: 'Password does not meet security requirements',
            details: passwordValidation.feedback.join('; ')
          },
          { status: 400 }
        )
      }

      // Verify password matches the one from step 1
      const storedRequest = passwordChangeRequests.get(userId)
      if (!storedRequest) {
        return NextResponse.json(
          { error: 'Password change request expired or invalid. Please start over.' },
          { status: 400 }
        )
      }

      // Check if request is too old (15 minutes)
      if (Date.now() - storedRequest.timestamp > 15 * 60 * 1000) {
        passwordChangeRequests.delete(userId)
        return NextResponse.json(
          { error: 'Password change request expired. Please start over.' },
          { status: 400 }
        )
      }

      // Verify password hash matches
      const passwordHash = hashPassword(sanitizedNewPassword)
      if (passwordHash !== storedRequest.passwordHash) {
        return NextResponse.json(
          { error: 'New password does not match the password from your request. Please start over.' },
          { status: 400 }
        )
      }

      // Validate OTP
      const otpResult = otpManager.validateOTP(user.email!, 'password-change', sanitizedOtpCode)
      
      if (!otpResult.valid) {
        return NextResponse.json(
          { error: otpResult.message || 'Invalid or expired verification code' },
          { status: 400 }
        )
      }

      // Clear the stored request
      passwordChangeRequests.delete(userId)

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: sanitizedNewPassword
      })

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update password. Please try again.' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully'
      })
    }

    return NextResponse.json(
      { error: 'Invalid step. Use "request-otp" or "verify-otp"' },
      { status: 400 }
    )
  } catch (error: any) {
    // Don't expose internal error details
    return NextResponse.json(
      { error: 'An error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}
