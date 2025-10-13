import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { logger } from '@/lib/logger'

// Environment variables with fallbacks
const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL || ''

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvYm9ib2NsZGZqaGRrcGp5dXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NDE4MDUsImV4cCI6MjA3MDExNzgwNX0.Icmvt4EZuTJXf97K_LU14ICaAIikVurWb9j0m_WNEsY'

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
      console.error('Sign in error:', error)
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR,
        type: 'NETWORK_ERROR' as AuthErrorType
      }
    }
  },

  // Sign up with comprehensive error handling
  signUp: async (name: string, email: string, password: string, confirmPassword: string, phone?: string) => {
    try {
      // Validate input
      const validation = registerSchema.safeParse({ name, email, password, confirmPassword })
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.errors[0]?.message || ERROR_MESSAGES.VALIDATION_ERROR,
          type: 'VALIDATION_ERROR' as AuthErrorType,
          details: validation.error.errors
        }
      }

      // Note: We don't check for existing users here as it requires admin privileges
      // Supabase will handle duplicate email validation automatically

      // Add a small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Attempt sign up
      logger.log('Attempting signup with:', { email: email.toLowerCase(), name: name.trim(), phone: phone || '' })
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: {
          data: {
            name: name.trim(),
            full_name: name.trim(),
            phone: phone || '' // Include phone number in user metadata
          }
        }
      })

      if (error) {
        console.error('Supabase signup error:', error)
        switch (error.message) {
          case 'User already registered':
          case 'A user with this email address has already been registered':
            return {
              success: false,
              error: ERROR_MESSAGES.EMAIL_ALREADY_EXISTS,
              type: 'EMAIL_ALREADY_EXISTS' as AuthErrorType
            }
          
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

      if (data.user) {
        // Profile is automatically created by the trigger on_auth_user_created
        // No need to manually insert here to avoid conflicts
        
        return {
          success: true,
          data: {
            user: data.user,
            session: data.session
          },
          message: 'Account created successfully! Please check your email to verify your account.'
        }
      }

      return {
        success: false,
        error: ERROR_MESSAGES.UNKNOWN_ERROR,
        type: 'UNKNOWN_ERROR' as AuthErrorType
      }

    } catch (error) {
      console.error('Sign up error:', error)
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
      console.error('Sign out error:', error)
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
      console.error('Get current user error:', error)
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
      console.error('Get current session error:', error)
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/reset-password`
      })

      if (error) {
        return {
          success: false,
          error: 'Failed to send reset email. Please try again.',
          type: 'SERVER_ERROR' as AuthErrorType
        }
      }

      return {
        success: true,
        message: 'Password reset email sent successfully!'
      }
    } catch (error) {
      console.error('Reset password error:', error)
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR,
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
      console.error('Update password error:', error)
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR,
        type: 'NETWORK_ERROR' as AuthErrorType
      }
    }
  }
} 