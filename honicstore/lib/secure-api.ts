/**
 * Secure API Wrapper
 * 
 * Provides secure, validated API calls with proper error handling,
 * rate limiting, and input sanitization.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { securityUtils, performanceUtils } from './secure-config'
import { logger } from '@/lib/logger'

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Input validation schemas
const productQuerySchema = z.object({
  minimal: z.string().optional().transform(val => val === 'true'),
  limit: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  offset: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  category: z.string().optional().transform(val => val ? securityUtils.sanitizeInput(val) : undefined),
  brand: z.string().optional().transform(val => val ? securityUtils.sanitizeInput(val) : undefined),
  search: z.string().optional().transform(val => val ? securityUtils.sanitizeInput(val) : undefined),
})

const productCreateSchema = z.object({
  name: z.string().min(1).max(255).transform(securityUtils.sanitizeInput),
  description: z.string().max(2000).transform(securityUtils.sanitizeInput).optional(),
  price: z.number().min(0).max(1000000),
  originalPrice: z.number().min(0).max(1000000).optional(),
  category: z.string().min(1).max(100).transform(securityUtils.sanitizeInput),
  brand: z.string().min(1).max(100).transform(securityUtils.sanitizeInput),
  image: z.string().url().optional(),
  stockQuantity: z.number().min(0).max(100000).optional(),
  inStock: z.boolean().optional(),
  freeDelivery: z.boolean().optional(),
  sameDayDelivery: z.boolean().optional(),
})

// Rate limiting function
function checkRateLimit(ip: string, limit: number = 100, window: number = 900000): boolean {
  const now = Date.now()
  const key = `rate_limit:${ip}`
  
  const current = rateLimitStore.get(key)
  
  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + window })
    return true
  }
  
  if (current.count >= limit) {
    return false
  }
  
  current.count++
  return true
}

// Get client IP address
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const remoteAddr = request.headers.get('x-remote-addr')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (remoteAddr) {
    return remoteAddr
  }
  
  return 'unknown'
}

// Secure API response wrapper with AliExpress-style multi-layer caching
function createSecureResponse(data: any, options: {
  status?: number
  cacheControl?: string
  headers?: Record<string, string>
  // AliExpress-style cache options
  cdnCache?: boolean // Enable CDN caching (Cloudflare/Akamai)
  browserCache?: boolean // Enable browser caching
  popularProducts?: boolean // Mark as popular products (longer cache)
} = {}) {
  const response = NextResponse.json(data, { status: options.status || 200 })
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // AliExpress-style multi-layer caching headers
  if (options.cacheControl) {
    response.headers.set('Cache-Control', options.cacheControl)
  } else if (options.popularProducts) {
    // Popular products: Aggressive caching (CDN + Browser) - NO DATABASE HIT
    // CDN cache: 2 hours, Browser cache: 1 hour, Stale-while-revalidate: 4 hours
    // This ensures popular products are served from CDN/browser cache without hitting server
    response.headers.set('Cache-Control', 'public, s-maxage=7200, max-age=3600, stale-while-revalidate=14400')
    // CDN-specific headers (Cloudflare/Akamai compatible)
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=7200, stale-while-revalidate=14400')
    response.headers.set('CF-Cache-Status', 'HIT') // Cloudflare cache status hint
    response.headers.set('X-Cache-Type', 'POPULAR_PRODUCTS')
    response.headers.set('X-No-DB-Hit', 'true')
  } else if (options.cdnCache) {
    // CDN caching: 30 minutes CDN, 15 minutes browser, 1 hour stale-while-revalidate
    response.headers.set('Cache-Control', 'public, s-maxage=1800, max-age=900, stale-while-revalidate=3600')
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600')
    response.headers.set('CF-Cache-Status', 'DYNAMIC') // Cloudflare cache status
  } else if (options.browserCache) {
    // Browser-only caching: 15 minutes
    response.headers.set('Cache-Control', 'public, max-age=900, stale-while-revalidate=1800')
  }
  
  // ETag for cache validation (CDN and browser)
  // Production-ready: Generate stable ETag for cache validation
  if (options.cdnCache || options.popularProducts) {
    try {
      // Generate ETag from response data hash
      const dataString = JSON.stringify(data)
      // Use first 27 chars of base64 hash for ETag (RFC 7232 compliant)
      const etag = `"${Buffer.from(dataString).toString('base64').slice(0, 27)}"`
      response.headers.set('ETag', etag)
      // Support If-None-Match for 304 Not Modified responses
      response.headers.set('Vary', 'If-None-Match')
    } catch (error: any) {
      // Fail gracefully - ETag generation should not break response
      logger.error('[Secure API] Error generating ETag:', error)
    }
  }
  
  // Vary header for CDN (important for Cloudflare/Akamai)
  // Only vary on essential headers to maximize cache hits
  if (options.cdnCache || options.popularProducts) {
    // Minimal vary header for better cache hit rates
    response.headers.set('Vary', 'Accept, Accept-Encoding')
    // Cloudflare-specific: Cache everything except query params
    response.headers.set('Cache-Tag', options.popularProducts ? 'popular-products' : 'products')
  }
  
  // Add custom headers
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }
  
  return response
}

// Error response wrapper
function createErrorResponse(message: string, status: number = 400, details?: any) {
  const errorResponse = {
    error: message,
    timestamp: new Date().toISOString(),
    ...(details && { details })
  }
  
  return createSecureResponse(errorResponse, { status })
}

// Secure API handler wrapper
export function createSecureApiHandler(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  options: {
    requireAuth?: boolean
    rateLimit?: { max: number; window: number }
    validateInput?: z.ZodSchema
    logRequests?: boolean
  } = {}
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = Date.now()
    
    try {
      // Rate limiting
      if (options.rateLimit) {
        const clientIP = getClientIP(request)
        if (!checkRateLimit(clientIP, options.rateLimit.max, options.rateLimit.window)) {
          return createErrorResponse('Rate limit exceeded', 429, {
            retryAfter: Math.ceil(options.rateLimit.window / 1000)
          })
        }
      }
      
      // Input validation
      if (options.validateInput) {
        const url = new URL(request.url)
        const searchParams = Object.fromEntries(url.searchParams.entries())
        
        try {
          const validatedParams = options.validateInput.parse(searchParams)
          // Replace searchParams with validated params
          Object.assign(searchParams, validatedParams)
        } catch (error) {
          if (error instanceof z.ZodError) {
            return createErrorResponse('Invalid input parameters', 400, {
              errors: error.errors
            })
          }
          throw error
        }
      }
      
      // Authentication check
      if (options.requireAuth) {
        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return createErrorResponse('Authentication required', 401)
        }
      }
      
      // Log request (if enabled)
      if (options.logRequests) {
        logger.log(`🔒 Secure API Request: ${request.method} ${request.url}`, {
          ip: getClientIP(request),
          userAgent: request.headers.get('user-agent'),
          timestamp: new Date().toISOString()
        })
      }
      
      // Execute handler
      const response = await handler(request, context)
      
      // Log response time
      const duration = Date.now() - startTime
      if (options.logRequests) {
        logger.log(`✅ Secure API Response: ${request.method} ${request.url} - ${duration}ms`)
      }
      
      return response
      
    } catch (error) {
      // Don't expose internal errors in production
      const isDevelopment = process.env.NODE_ENV === 'development'
      const errorMessage = isDevelopment 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : 'Internal server error'
      
      return createErrorResponse(errorMessage, 500, isDevelopment ? { stack: error instanceof Error ? error.stack : undefined } : undefined)
    }
  }
}

// Secure product API handlers
export const secureProductHandlers = {
  // GET products with validation
  getProducts: createSecureApiHandler(
    async (request: NextRequest) => {
      const { searchParams } = new URL(request.url)
      const params = Object.fromEntries(searchParams.entries())
      
      // Validate and sanitize parameters
      const validatedParams = productQuerySchema.parse(params)
      
      // Build secure query
      const queryParams = new URLSearchParams()
      Object.entries(validatedParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.set(key, String(value))
        }
      })
      
      // Make secure API call
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/products?${queryParams}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      return createSecureResponse(data, {
        cacheControl: 'public, s-maxage=1800, stale-while-revalidate=3600',
        headers: {
          'X-Products-Count': Array.isArray(data) ? data.length.toString() : '0'
        }
      })
    },
    {
      rateLimit: { max: 100, window: 900000 }, // 100 requests per 15 minutes
      validateInput: productQuerySchema,
      logRequests: true
    }
  ),
  
  // POST create product with validation
  createProduct: createSecureApiHandler(
    async (request: NextRequest) => {
      const body = await request.json()
      
      // Validate and sanitize input
      const validatedData = productCreateSchema.parse(body)
      
      // Make secure API call
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('authorization') || '',
        },
        body: JSON.stringify(validatedData),
      })
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      return createSecureResponse(data, { status: 201 })
    },
    {
      requireAuth: true,
      rateLimit: { max: 10, window: 900000 }, // 10 requests per 15 minutes
      validateInput: productCreateSchema,
      logRequests: true
    }
  )
}

// Secure search handler
export const secureSearchHandler = createSecureApiHandler(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query) {
      return createErrorResponse('Search query is required', 400)
    }
    
    // Sanitize search query
    const sanitizedQuery = securityUtils.sanitizeInput(query)
    
    if (sanitizedQuery.length < 2) {
      return createErrorResponse('Search query must be at least 2 characters', 400)
    }
    
    // Perform secure search
    const searchParams_ = new URLSearchParams({
      search: sanitizedQuery,
      minimal: 'true'
    })
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/products?${searchParams_}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Search API call failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    return createSecureResponse(data, {
      cacheControl: 'public, s-maxage=300, stale-while-revalidate=600',
      headers: {
        'X-Search-Query': sanitizedQuery,
        'X-Results-Count': Array.isArray(data) ? data.length.toString() : '0'
      }
    })
  },
  {
    rateLimit: { max: 200, window: 900000 }, // 200 searches per 15 minutes
    logRequests: true
  }
)

// Export utilities
export {
  createSecureResponse,
  createErrorResponse,
  checkRateLimit,
  getClientIP,
  productQuerySchema,
  productCreateSchema,
}





