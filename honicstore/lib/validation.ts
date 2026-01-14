/**
 * Production-ready input validation utilities
 * Provides comprehensive validation with security in mind
 */

import { z } from 'zod'

/**
 * Common validation schemas
 */
export const ValidationSchemas = {
  email: z
    .string()
    .email('Please enter a valid email address')
    .min(5, 'Email must be at least 5 characters')
    .max(255, 'Email is too long')
    .toLowerCase()
    .trim(),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),

  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name is too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
    .trim(),

  url: z
    .string()
    .url('Please enter a valid URL')
    .max(2048, 'URL is too long'),

  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number')
    .max(20, 'Phone number is too long'),

  uuid: z.string().uuid('Invalid ID format'),
} as const

/**
 * Sanitize string input to prevent XSS attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 10000) // Limit length
}

/**
 * Sanitize URL to prevent open redirect attacks
 */
export function sanitizeUrl(url: string, allowedDomains?: string[]): string {
  try {
    const parsed = new URL(url)
    
    // If allowed domains are specified, validate against them
    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some((domain) => {
        return parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      })
      
      if (!isAllowed) {
        throw new Error('URL domain not allowed')
      }
    }
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid URL protocol')
    }
    
    return parsed.toString()
  } catch {
    // Return safe fallback
    return '/'
  }
}

/**
 * Validate and sanitize email address
 */
export function validateAndSanitizeEmail(email: string): {
  isValid: boolean
  sanitized?: string
  error?: string
} {
  try {
    const result = ValidationSchemas.email.parse(email)
    return {
      isValid: true,
      sanitized: result,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        error: error.errors[0]?.message || 'Invalid email address',
      }
    }
    return {
      isValid: false,
      error: 'Invalid email address',
    }
  }
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean
  strength: 'weak' | 'medium' | 'strong'
  errors: string[]
} {
  const errors: string[] = []
  let strength: 'weak' | 'medium' | 'strong' = 'weak'

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)')
  }

  // Calculate strength
  if (errors.length === 0) {
    if (password.length >= 12 && /[@$!%*?&]/.test(password)) {
      strength = 'strong'
    } else {
      strength = 'medium'
    }
  }

  return {
    isValid: errors.length === 0,
    strength,
    errors,
  }
}

/**
 * Rate limiting helper for client-side validation
 */
class RateLimiter {
  private attempts: Map<string, { count: number; resetAt: number }> = new Map()
  private readonly maxAttempts: number
  private readonly windowMs: number

  constructor(maxAttempts: number = 5, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
  }

  check(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now()
    const record = this.attempts.get(key)

    if (!record || now > record.resetAt) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs })
      return { allowed: true }
    }

    if (record.count >= this.maxAttempts) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000)
      return { allowed: false, retryAfter }
    }

    record.count++
    return { allowed: true }
  }

  reset(key: string): void {
    this.attempts.delete(key)
  }
}

export const validationRateLimiter = new RateLimiter(5, 60000)
