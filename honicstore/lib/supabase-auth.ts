import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { logger } from '@/lib/logger'

// Environment variables - SECURITY: No hardcoded values, must be set in environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Validate critical environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window === 'undefined') {
    // Server-side: throw error in development, warn in production
    if (process.env.NODE_ENV === 'development') {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    } else {
      }
  }
}

// Create Supabase client with custom options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Rate limiting for failed login attempts
const loginAttempts = new Map<string, { count: number, lastAttempt: Date, lockedUntil?: Date }>()

// Constants
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_WINDOW = 5 * 60 * 1000 // 5 minutes

// Validation schemas
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
})

export const registerSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters long')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  email: z.string()
    .email('Please enter a valid email address')
    .min(5, 'Email must be at least 5 characters')
    .max(100, 'Email must be less than 100 characters')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match. Please make sure both passwords are identical.",
  path: ["confirmPassword"]
})

// Error types
export type AuthErrorType = 
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_NOT_FOUND'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_LOCKED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'RATE_LIMIT_ERROR'
  | 'ACCOUNT_DEACTIVATED'
  | 'EMAIL_ALREADY_EXISTS'
  | 'ALREADY_VERIFIED'
  | 'WEAK_PASSWORD'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR'

// Error messages mapping
export const ERROR_MESSAGES: Record<AuthErrorType, string> = {
  INVALID_CREDENTIALS: 'Invalid email or password. Please check your credentials and try again.',
  ACCOUNT_NOT_FOUND: 'No account found with this email address. Please check your email or create a new account.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before logging in. Check your inbox for a verification link.',
  ACCOUNT_LOCKED: 'Your account has been temporarily locked due to too many failed attempts. Please try again later.',
  RATE_LIMIT_EXCEEDED: 'Too many login attempts. Please wait a few minutes before trying again.',
  RATE_LIMIT_ERROR: 'Please wait a few seconds before trying again. This is a security measure.',
  ACCOUNT_DEACTIVATED: 'Your account has been deactivated. Please contact support for assistance.',
  EMAIL_ALREADY_EXISTS: 'An account with this email address already exists. Please use a different email or try logging in.',
  ALREADY_VERIFIED: 'This email address has already been verified. You can log in to your account.',
  WEAK_PASSWORD: 'Password must be at least 8 characters and contain uppercase, lowercase, and number.',
  NETWORK_ERROR: 'Network error. Please check your internet connection and try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
  UNKNOWN_ERROR: 'An unknown error occurred. Please try again.'
}

// Helper functions
function getClientIP(): string {
  // In a real app, you'd get this from request headers
  return 'unknown'
}

function isRateLimited(email: string): { limited: boolean; remainingTime?: number } {
  const clientIP = getClientIP()
  const attemptKey = `${clientIP}-${email}`
  const attempts = loginAttempts.get(attemptKey)

  if (!attempts) return { limited: false }

  // Check if account is locked
  if (attempts.lockedUntil && attempts.lockedUntil > new Date()) {
    const remainingTime = Math.ceil((attempts.lockedUntil.getTime() - Date.now()) / 1000 / 60)
    return { limited: true, remainingTime }
  }

  // Check rate limiting
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime()
    if (timeSinceLastAttempt < RATE_LIMIT_WINDOW) {
      const remainingTime = Math.ceil((RATE_LIMIT_WINDOW - timeSinceLastAttempt) / 1000 / 60)
      return { limited: true, remainingTime }
    } else {
      // Reset attempts after rate limit window
      loginAttempts.delete(attemptKey)
      return { limited: false }
    }
  }

  return { limited: false }
}

function recordFailedAttempt(email: string): void {
  const clientIP = getClientIP()
  const attemptKey = `${clientIP}-${email}`
  const attempts = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: new Date() }
  
  attempts.count += 1
  attempts.lastAttempt = new Date()
  
  // Lock account after max attempts
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    attempts.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION)
  }
  
  loginAttempts.set(attemptKey, attempts)
}

function clearFailedAttempts(email: string): void {
  const clientIP = getClientIP()
  const attemptKey = `${clientIP}-${email}`
  loginAttempts.delete(attemptKey)
}

// Main authentication functions
export const supabaseAuth = {
  // Sign in with comprehensive error handling
  signIn: async (email: string, password: string) => {
    try {
      // Validate input
      const validation = loginSchema.safeParse({ email, password })
      if (!validation.success) {
        return {
          success: false,
          error: 'Please check your email and password.',
          type: 'VALIDATION_ERROR' as AuthErrorType,
          details: validation.error.errors
        }
      }

      // Check rate limiting
      const rateLimitCheck = isRateLimited(email)
      if (rateLimitCheck.limited) {
        return {
          success: false,
          error: rateLimitCheck.remainingTime 
            ? `Too many failed attempts. Please try again in ${rateLimitCheck.remainingTime} minutes.`
            : ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
          type: 'RATE_LIMIT_EXCEEDED' as AuthErrorType
        }
      }

      // Attempt sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password
      })

      if (error) {
        // Record failed attempt
        recordFailedAttempt(email)

        // Handle specific Supabase errors
        switch (error.message) {
          case 'Invalid login credentials':
            return {
              success: false,
              error: ERROR_MESSAGES.INVALID_CREDENTIALS,
              type: 'INVALID_CREDENTIALS' as AuthErrorType
            }
          
          case 'Email not confirmed':
            return {
              success: false,
              error: ERROR_MESSAGES.EMAIL_NOT_VERIFIED,
              type: 'EMAIL_NOT_VERIFIED' as AuthErrorType
            }
          
          case 'User not found':
            return {
              success: false,
              error: ERROR_MESSAGES.ACCOUNT_NOT_FOUND,
              type: 'ACCOUNT_NOT_FOUND' as AuthErrorType
            }
          
          default:
            return {
              success: false,
              error: ERROR_MESSAGES.INVALID_CREDENTIALS,
              type: 'INVALID_CREDENTIALS' as AuthErrorType
            }
        }
      }

      if (data.user) {
        // Check if email is verified
        if (!data.user.email_confirmed_at && !data.user.confirmed_at) {
          return {
            success: false,
            error: 'Please verify your email address before logging in. Check your inbox for the verification link.',
            type: 'EMAIL_NOT_VERIFIED' as AuthErrorType
          }
        }

        // Clear failed attempts on successful login
        clearFailedAttempts(email)

        // Return success immediately without profile check
        // Profile will be fetched separately in the auth context
        return {
          success: true,
          data: {
            user: data.user,
            session: data.session
          }
        }
      }

      return {
        success: false,
        error: ERROR_MESSAGES.UNKNOWN_ERROR,
        type: 'UNKNOWN_ERROR' as AuthErrorType
      }

    } catch (error) {
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR,
        type: 'NETWORK_ERROR' as AuthErrorType
      }
    }
  },

  // Sign up with comprehensive error handling and security
  signUp: async (name: string, email: string, password: string, confirmPassword: string, phone?: string, isSupplier?: boolean) => {
    try {
      // SECURITY: Sanitize and validate inputs
      const sanitizedName = name.trim()
      const sanitizedEmail = email.toLowerCase().trim()
      const sanitizedPhone = phone ? phone.trim() : undefined

      // Validate input with schema
      const validation = registerSchema.safeParse({ 
        name: sanitizedName, 
        email: sanitizedEmail, 
        password, 
        confirmPassword 
      })
      
      if (!validation.success) {
        // SECURITY: Don't expose detailed validation errors in production
        const errorMessage = process.env.NODE_ENV === 'development' 
          ? validation.error.errors[0]?.message || ERROR_MESSAGES.VALIDATION_ERROR
          : ERROR_MESSAGES.VALIDATION_ERROR
        
        return {
          success: false,
          error: errorMessage,
          type: 'VALIDATION_ERROR' as AuthErrorType,
          details: process.env.NODE_ENV === 'development' ? validation.error.errors : undefined
        }
      }

      // SECURITY: Validate environment variables
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                      process.env.NEXT_PUBLIC_APP_URL || 
                      (process.env.NODE_ENV === 'development' 
                        ? `http://localhost:${process.env.LOCALHOST_PORT || '3000'}` 
                        : (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://honiccompanystore.com'))
      if (!siteUrl) {
        return {
          success: false,
          error: 'Server configuration error. Please contact support.',
          type: 'SERVER_ERROR' as AuthErrorType
        }
      }
      
      // Log the URL being used for debugging
      // Note: We don't check for existing users here as it requires admin privileges
      // Supabase will handle duplicate email validation automatically

      // SECURITY: Add a small delay to prevent rate limiting and brute force
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Attempt sign up with email verification enabled
      // Using Supabase's built-in email sending with custom template
      // Customize email template in: Supabase Dashboard → Authentication → Email Templates → Confirm signup
      logger.log('Attempting signup for:', sanitizedEmail)
      
      const { data, error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password,
        options: {
          // SECURITY: Use environment variable for redirect URL
          emailRedirectTo: `${siteUrl}/auth/callback`,
          data: {
            name: sanitizedName,
            full_name: sanitizedName,
            phone: sanitizedPhone || '',
            is_supplier: isSupplier || false,
            isSupplier: isSupplier || false
          }
        }
      })

      if (error) {
        // Handle email rate limit specifically
        if (error.status === 429 && error.code === 'over_email_send_rate_limit') {
          return {
            success: false,
            error: 'Email rate limit exceeded. Please wait a few minutes before trying again. This helps prevent spam and ensures email delivery.',
            type: 'RATE_LIMIT_ERROR' as AuthErrorType
          }
        }
        
        // Handle duplicate email errors - check multiple possible error messages and codes
        const duplicateEmailMessages = [
          'User already registered',
          'A user with this email address has already been registered',
          'Email already registered',
          'User with this email already exists',
          'already registered',
          'email already exists',
          'user already exists'
        ]
        
        const duplicateEmailCodes = [
          'signup_disabled',
          'email_address_not_authorized',
          'email_rate_limit_exceeded'
        ]
        
        // Check if error is related to duplicate email
        const isDuplicateEmail = duplicateEmailMessages.some(msg => 
          error.message?.toLowerCase().includes(msg.toLowerCase())
        ) || duplicateEmailCodes.some(code => error.code === code)
        
        if (isDuplicateEmail || error.status === 422 || error.status === 400) {
          // Additional check: if error mentions email or user exists, treat as duplicate
          const errorMsg = error.message?.toLowerCase() || ''
          if (errorMsg.includes('email') && (errorMsg.includes('exist') || errorMsg.includes('register'))) {
            return {
              success: false,
              error: ERROR_MESSAGES.EMAIL_ALREADY_EXISTS,
              type: 'EMAIL_ALREADY_EXISTS' as AuthErrorType
            }
          }
        }
        
        // Explicit duplicate email check
        if (isDuplicateEmail) {
          return {
            success: false,
            error: ERROR_MESSAGES.EMAIL_ALREADY_EXISTS,
            type: 'EMAIL_ALREADY_EXISTS' as AuthErrorType
          }
        }
        
        switch (error.message) {
          case 'Password should be at least 6 characters':
          case 'Password should be at least 8 characters':
            return {
              success: false,
              error: ERROR_MESSAGES.WEAK_PASSWORD,
              type: 'WEAK_PASSWORD' as AuthErrorType
            }
          
          case 'For security purposes, you can only request this after 3 seconds.':
            return {
              success: false,
              error: ERROR_MESSAGES.RATE_LIMIT_ERROR,
              type: 'RATE_LIMIT_ERROR' as AuthErrorType
            }
          
          case 'Invalid email':
            return {
              success: false,
              error: 'Please enter a valid email address.',
              type: 'VALIDATION_ERROR' as AuthErrorType
            }
          
          default:
            return {
              success: false,
              error: error.message || ERROR_MESSAGES.SERVER_ERROR,
              type: 'SERVER_ERROR' as AuthErrorType
            }
        }
      }

      // SECURITY: Check if user was actually created or if this is an existing user
      // Supabase might return a user object even for existing emails in some configurations
      // SECURITY: If we get here without an error, Supabase created or returned a user
      // We MUST verify this is actually a NEW user creation, not an existing user
      if (data.user) {
        // CRITICAL SECURITY CHECK: Verify this is a new user by checking created_at timestamp
        // New users will have a created_at timestamp very close to now (within 3 seconds max)
        const userCreatedAt = data.user.created_at ? new Date(data.user.created_at) : null
        const now = new Date()
        const secondsSinceCreation = userCreatedAt ? (now.getTime() - userCreatedAt.getTime()) / 1000 : null
        
        // SECURITY: If user was created more than 3 seconds ago, this is DEFINITELY an existing user
        // Supabase should have returned an error, but if it didn't, we MUST block this registration
        if (secondsSinceCreation !== null && secondsSinceCreation > 3) {
          // Security check: User appears to be existing, blocking registration
          return {
            success: false,
            error: ERROR_MESSAGES.EMAIL_ALREADY_EXISTS,
            type: 'EMAIL_ALREADY_EXISTS' as AuthErrorType
          }
        }
        
        // Additional security: If no session AND no email confirmation AND user seems old, block it
        if (!data.session && !data.user.email_confirmed_at && secondsSinceCreation !== null && secondsSinceCreation > 2) {
          // Security check: User appears to be existing without proper confirmation
          return {
            success: false,
            error: ERROR_MESSAGES.EMAIL_ALREADY_EXISTS,
            type: 'EMAIL_ALREADY_EXISTS' as AuthErrorType
          }
        }
        
        // User is confirmed to be newly created (within 3 seconds)
        // SECURITY: Only use session if Supabase directly provided it
        // DO NOT attempt automatic sign-in - this was the security vulnerability
        // If Supabase didn't return a session, the user needs to verify their email first
        const session = data.session
        
        return {
          success: true,
          data: {
            user: data.user,
            session: session // Only include session if Supabase directly provided it
          },
          message: session 
            ? 'Account created successfully! You are now logged in. Please check your email to verify your account for full access.'
            : 'Account created successfully! Please check your email to verify your account.'
        }
      }

      return {
        success: false,
        error: ERROR_MESSAGES.UNKNOWN_ERROR,
        type: 'UNKNOWN_ERROR' as AuthErrorType
      }

    } catch (error) {
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR,
        type: 'NETWORK_ERROR' as AuthErrorType
      }
    }
  },

  // Sign out
  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        return {
          success: false,
          error: ERROR_MESSAGES.SERVER_ERROR,
          type: 'SERVER_ERROR' as AuthErrorType
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR,
        type: 'NETWORK_ERROR' as AuthErrorType
      }
    }
  },

  // Get current user
  getCurrentUser: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        return {
          success: false,
          error: ERROR_MESSAGES.SERVER_ERROR,
          type: 'SERVER_ERROR' as AuthErrorType
        }
      }

      if (!user) {
        return {
          success: false,
          error: 'No authenticated user found',
          type: 'INVALID_CREDENTIALS' as AuthErrorType
        }
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      return {
        success: true,
        data: {
          user: {
            ...user,
            profile
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR,
        type: 'NETWORK_ERROR' as AuthErrorType
      }
    }
  },

  // Get current session
  getCurrentSession: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        return {
          success: false,
          error: ERROR_MESSAGES.SERVER_ERROR,
          type: 'SERVER_ERROR' as AuthErrorType
        }
      }

      return {
        success: true,
        data: { session }
      }
    } catch (error) {
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR,
        type: 'NETWORK_ERROR' as AuthErrorType
      }
    }
  },

  // Listen to auth changes
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback)
  },

  // Reset password
  resetPassword: async (email: string) => {
    try {
      // Use client-side Supabase client for password reset
      // This ensures proper browser context and redirect URL handling
      const { supabaseClient } = await import('@/lib/supabase-client')
      
      // Get the current URL (client-side) or use environment variable
      let redirectUrl = ''
      if (typeof window !== 'undefined') {
        redirectUrl = `${window.location.origin}/auth/reset-password`
      } else {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || (process.env.NODE_ENV === 'development' ? `http://localhost:${process.env.LOCALHOST_PORT || '3000'}` : 'https://honiccompanystore.com')
        redirectUrl = `${baseUrl}/auth/reset-password`
      }

      const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      })

      if (error) {
        return {
          success: false,
          error: error.message || 'Failed to send reset email. Please check your email address and try again.',
          type: 'SERVER_ERROR' as AuthErrorType
        }
      }

      return {
        success: true,
        message: 'Password reset email sent successfully! Please check your inbox and spam folder.'
      }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || ERROR_MESSAGES.NETWORK_ERROR,
        type: 'NETWORK_ERROR' as AuthErrorType
      }
    }
  },

  // Update password
  updatePassword: async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password
      })

      if (error) {
        return {
          success: false,
          error: 'Failed to update password. Please try again.',
          type: 'SERVER_ERROR' as AuthErrorType
        }
      }

      return {
        success: true,
        message: 'Password updated successfully!'
      }
    } catch (error) {
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR,
        type: 'NETWORK_ERROR' as AuthErrorType
      }
    }
  },

  // Resend verification email using Supabase's built-in resend function
  // Customize email template in: Supabase Dashboard → Authentication → Email Templates → Confirm signup
  resendVerificationEmail: async (email: string) => {
    try {
      // SECURITY: Validate email format and sanitize
      const sanitizedEmail = email.toLowerCase().trim()
      if (!sanitizedEmail || !sanitizedEmail.includes('@') || sanitizedEmail.length > 255) {
        return {
          success: false,
          error: 'Invalid email address format.',
          type: 'VALIDATION_ERROR' as AuthErrorType
        }
      }

      // SECURITY: Use environment variable for redirect URL
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                      process.env.NEXT_PUBLIC_APP_URL || 
                      (process.env.NODE_ENV === 'development' 
                        ? `http://localhost:${process.env.LOCALHOST_PORT || '3000'}` 
                        : (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://honiccompanystore.com'))
      if (!siteUrl) {
        return {
          success: false,
          error: 'Server configuration error. Please contact support.',
          type: 'SERVER_ERROR' as AuthErrorType
        }
      }

      const { data: resendData, error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: sanitizedEmail,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`
        }
      })

      if (resendError) {
        // Provide more helpful error messages
        let errorMessage = resendError.message || 'Failed to resend verification email.'
        
        // Check if email is already verified (Supabase may return this error)
        if (resendError.message?.toLowerCase().includes('already verified') || 
            resendError.message?.toLowerCase().includes('email already confirmed') ||
            resendError.message?.toLowerCase().includes('email_confirmed_at')) {
          errorMessage = 'This email address has already been verified. You can log in to your account.'
          return {
            success: false,
            error: errorMessage,
            type: 'ALREADY_VERIFIED' as AuthErrorType
          }
        }
        
        if (resendError.message?.includes('rate limit') || resendError.message?.includes('too many')) {
          errorMessage = 'Too many verification email requests. Please wait a few minutes before trying again.'
        } else if (resendError.message?.includes('SMTP') || resendError.message?.includes('email')) {
          errorMessage = 'Email service configuration error. Please contact support or check your Supabase email settings.'
        }

        return {
          success: false,
          error: errorMessage,
          type: 'SERVER_ERROR' as AuthErrorType
        }
      }

      return {
        success: true,
        message: 'Verification email request has been sent to Supabase. Please check your inbox (including spam/junk folder). If you don\'t receive it within a few minutes, please check: 1) Supabase Dashboard → Authentication → SMTP Settings, 2) Resend Dashboard for delivery status, 3) See docs/TROUBLESHOOTING_VERIFICATION_EMAIL.md for detailed troubleshooting steps.'
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || ERROR_MESSAGES.NETWORK_ERROR,
        type: 'NETWORK_ERROR' as AuthErrorType
      }
    }
  }
} 