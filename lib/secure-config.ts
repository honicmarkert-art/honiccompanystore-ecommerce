/**
 * Secure Configuration Management
 * 
 * Centralized configuration with proper validation and security checks
 */

import { z } from 'zod'
import { logger } from '@/lib/logger'

// Environment variable validation schema
const envSchema = z.object({
  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required').optional(),
  
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url('Invalid app URL').optional(),
  
  // Security Configuration
  NEXTAUTH_SECRET: z.string().min(32, 'NextAuth secret must be at least 32 characters').optional(),
  NEXTAUTH_URL: z.string().url('Invalid NextAuth URL').optional(),
  
  // API Configuration
  CLICKPESA_API_KEY: z.string().min(1, 'ClickPesa API key is required').optional(),
  CLICKPESA_SECRET: z.string().min(1, 'ClickPesa secret is required').optional(),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'), // 15 minutes
  
  // Cache Configuration
  CACHE_TTL_PRODUCTS: z.string().transform(Number).default('300000'), // 5 minutes
  CACHE_TTL_CATEGORIES: z.string().transform(Number).default('1800000'), // 30 minutes
  CACHE_TTL_ADVERTISEMENTS: z.string().transform(Number).default('600000'), // 10 minutes
})

// Validate environment variables
function validateEnvironment() {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => err.path.join('.'))
      throw new Error(`Missing or invalid environment variables: ${missingVars.join(', ')}`)
    }
    throw error
  }
}

// Get validated environment variables
export const env = validateEnvironment()

// Security configuration
export const securityConfig = {
  // Rate limiting
  rateLimit: {
    max: env.RATE_LIMIT_MAX,
    window: env.RATE_LIMIT_WINDOW,
  },
  
  // CORS configuration
  cors: {
    origin: env.NODE_ENV === 'production' 
      ? [env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com']
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
  
  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Only for development
        "https://qobobocldfjhdkpjyuuq.supabase.co",
        "https://*.supabase.co"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://qobobocldfjhdkpjyuuq.supabase.co",
        "https://*.supabase.co"
      ],
      connectSrc: [
        "'self'",
        "https://qobobocldfjhdkpjyuuq.supabase.co",
        "https://*.supabase.co",
        "https://api.clickpesa.com"
      ],
      mediaSrc: [
        "'self'",
        "https://qobobocldfjhdkpjyuuq.supabase.co",
        "https://*.supabase.co"
      ],
    }
  },
  
  // Session configuration
  session: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  }
}

// Cache configuration
export const cacheConfig = {
  products: env.CACHE_TTL_PRODUCTS,
  categories: env.CACHE_TTL_CATEGORIES,
  advertisements: env.CACHE_TTL_ADVERTISEMENTS,
  default: 300000, // 5 minutes
}

// API configuration
export const apiConfig = {
  clickpesa: {
    apiKey: env.CLICKPESA_API_KEY,
    secret: env.CLICKPESA_SECRET,
    baseUrl: 'https://api.clickpesa.com',
  },
  supabase: {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

// Development-only configuration
export const devConfig = {
  enableDebugLogs: env.NODE_ENV === 'development',
  enablePerformanceMonitoring: env.NODE_ENV === 'development',
  enableSecurityAudit: env.NODE_ENV === 'development',
}

// Production-only configuration
export const prodConfig = {
  enableCompression: env.NODE_ENV === 'production',
  enableMinification: env.NODE_ENV === 'production',
  enableSecurityHeaders: env.NODE_ENV === 'production',
  enableRateLimiting: env.NODE_ENV === 'production',
}

// Security utilities
export const securityUtils = {
  // Sanitize input
  sanitizeInput: (input: string): string => {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 1000) // Limit length
  },
  
  // Validate email
  validateEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },
  
  // Validate URL
  validateUrl: (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  },
  
  // Generate secure random string
  generateSecureRandom: (length: number = 32): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  },
  
  // Hash password (for client-side validation)
  hashPassword: async (password: string): Promise<string> => {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

// Performance utilities
export const performanceUtils = {
  // Debounce function
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  },
  
  // Throttle function
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  },
  
  // Measure performance
  measurePerformance: (name: string, fn: () => void): void => {
    if (devConfig.enablePerformanceMonitoring) {
      const start = performance.now()
      fn()
      const end = performance.now()
      logger.log(`⏱️ ${name}: ${(end - start).toFixed(2)}ms`)
    } else {
      fn()
    }
  }
}

// Export default configuration
export default {
  env,
  securityConfig,
  cacheConfig,
  apiConfig,
  devConfig,
  prodConfig,
  securityUtils,
  performanceUtils,
}





