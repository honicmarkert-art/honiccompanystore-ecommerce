// Rate limiting utility for API endpoints

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Configuration
const RATE_LIMIT_CONFIG = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100, // 100 requests per window
  CHECKOUT_WINDOW_MS: 5 * 60 * 1000, // 5 minutes for checkout
  CHECKOUT_MAX_REQUESTS: 10, // 10 checkout attempts per 5 minutes
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60 * 1000) // Clean up every minute

// Generic rate limiting function
export function rateLimit(
  identifier: string, 
  windowMs: number = RATE_LIMIT_CONFIG.WINDOW_MS,
  maxRequests: number = RATE_LIMIT_CONFIG.MAX_REQUESTS
): boolean {
  const now = Date.now()
  const key = `rate_limit:${identifier}`
  
  const current = rateLimitStore.get(key)
  
  if (!current || current.resetTime < now) {
    // Create new entry or reset expired entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    })
    return true
  }
  
  if (current.count >= maxRequests) {
    return false
  }
  
  current.count += 1
  return true
}

// Specific rate limiting for checkout operations
export function checkoutRateLimit(identifier: string): boolean {
  return rateLimit(
    `checkout:${identifier}`,
    RATE_LIMIT_CONFIG.CHECKOUT_WINDOW_MS,
    RATE_LIMIT_CONFIG.CHECKOUT_MAX_REQUESTS
  )
}

// Rate limiting for authentication attempts
export function authRateLimit(identifier: string): boolean {
  return rateLimit(
    `auth:${identifier}`,
    15 * 60 * 1000, // 15 minutes
    5 // 5 attempts per 15 minutes
  )
}

// Rate limiting for payment operations
export function paymentRateLimit(identifier: string): boolean {
  return rateLimit(
    `payment:${identifier}`,
    10 * 60 * 1000, // 10 minutes
    5 // 5 payment attempts per 10 minutes
  )
}

// Get rate limit status for debugging
export function getRateLimitStatus(identifier: string): {
  remaining: number
  resetTime: number
  isLimited: boolean
} {
  const key = `rate_limit:${identifier}`
  const current = rateLimitStore.get(key)
  const now = Date.now()
  
  if (!current || current.resetTime < now) {
    return {
      remaining: RATE_LIMIT_CONFIG.MAX_REQUESTS,
      resetTime: now + RATE_LIMIT_CONFIG.WINDOW_MS,
      isLimited: false
    }
  }
  
  return {
    remaining: Math.max(0, RATE_LIMIT_CONFIG.MAX_REQUESTS - current.count),
    resetTime: current.resetTime,
    isLimited: current.count >= RATE_LIMIT_CONFIG.MAX_REQUESTS
  }
}

// Middleware helper for Next.js API routes
export function withRateLimit(
  handler: Function,
  options: {
    windowMs?: number
    maxRequests?: number
    identifier?: (req: any) => string
  } = {}
) {
  return async (req: any, res: any) => {
    const identifier = options.identifier 
      ? options.identifier(req)
      : req.ip || req.headers['x-forwarded-for'] || 'unknown'
    
    const isAllowed = rateLimit(
      identifier,
      options.windowMs,
      options.maxRequests
    )
    
    if (!isAllowed) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Please try again later'
      })
    }
    
    return handler(req, res)
  }
}







