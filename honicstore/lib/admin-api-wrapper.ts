/**
 * Production-ready Admin API Wrapper
 * Provides consistent security, validation, rate limiting, caching, and monitoring
 * for all admin API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData, CACHE_TTL } from '@/lib/database-optimization'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { z } from 'zod'

/**
 * Helper function to handle admin authentication errors consistently
 * Prevents ReadableStream locking issues and reduces noise from expected 403 errors
 */
export function handleAdminAuthError(
  authError: NextResponse,
  user: { id: string } | null | undefined,
  actionName: string,
  endpoint: string
): NextResponse {
  // Don't try to read the response body - it will be consumed by the return
  // Just use the status code to determine the error message
  const errorMessage = authError.status === 403 
    ? 'Admin privileges required' 
    : authError.status === 401 
    ? 'Authentication required'
    : 'Admin authentication failed'
  
  // Only log non-403 errors (403 is expected for non-admin users)
  if (authError.status !== 403) {
    logError(new Error(errorMessage), {
      userId: user?.id,
      action: actionName,
      endpoint,
      authErrorStatus: authError.status,
      authErrorStatusText: authError.statusText
    })
  }
  return authError
}

export interface AdminApiOptions {
  /**
   * Zod schema for input validation
   */
  inputSchema?: z.ZodSchema
  
  /**
   * Cache TTL in milliseconds (0 = no cache)
   */
  cacheTtl?: number
  
  /**
   * Custom cache key generator
   */
  cacheKey?: (request: NextRequest) => string
  
  /**
   * Whether to enable rate limiting (default: true)
   */
  enableRateLimit?: boolean
  
  /**
   * Custom rate limit per minute (default: 60)
   */
  rateLimitPerMinute?: number
  
  /**
   * Whether to log the request (default: true)
   */
  logRequest?: boolean
  
  /**
   * Action name for security logging
   */
  actionName?: string
}

/**
 * Wrapper for admin API routes with production-ready features
 */
export function withAdminApi<T = any>(
  handler: (request: NextRequest, context: { userId: string }) => Promise<NextResponse>,
  options: AdminApiOptions = {}
) {
  return async (request: NextRequest, context?: T): Promise<NextResponse> => {
    const {
      inputSchema,
      cacheTtl = 0, // Default: no cache
      cacheKey,
      enableRateLimit = true,
      rateLimitPerMinute = 60,
      logRequest = true,
      actionName = 'admin_api_call',
    } = options

    return performanceMonitor.measure(actionName, async () => {
      try {
        // 1. Rate limiting
        if (enableRateLimit) {
          const rateLimitResult = enhancedRateLimit(request)
          if (!rateLimitResult.allowed) {
            logSecurityEvent('RATE_LIMIT_EXCEEDED', {
              endpoint: request.nextUrl.pathname,
              reason: rateLimitResult.reason
            }, request)
            return NextResponse.json(
              { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
              { 
                status: 429,
                headers: {
                  'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
                }
              }
            )
          }
        }

        // 2. Authentication
        const { user, error: authError } = await validateAdminAccess()
        if (authError) {
          return handleAdminAuthError(authError, user, actionName, request.nextUrl.pathname)
        }

        if (!user) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          )
        }

        // 3. Input validation
        if (inputSchema && request.method !== 'GET') {
          try {
            const body = await request.json()
            inputSchema.parse(body)
          } catch (validationError) {
            if (validationError instanceof z.ZodError) {
              return NextResponse.json(
                { 
                  error: 'Validation failed',
                  details: validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`)
                },
                { status: 400 }
              )
            }
            throw validationError
          }
        }

        // 4. Cache check (GET requests only)
        if (request.method === 'GET' && cacheTtl > 0 && cacheKey) {
          const key = cacheKey(request)
          const cachedData = getCachedData<any>(key)
          if (cachedData) {
            return NextResponse.json(cachedData, {
              headers: {
                'X-Cache': 'HIT',
                'Cache-Control': `private, max-age=${Math.floor(cacheTtl / 1000)}`
              }
            })
          }
        }

        // 5. Execute handler
        const response = await handler(request, { userId: user.id })

        // 6. Cache response (GET requests only)
        if (request.method === 'GET' && cacheTtl > 0 && cacheKey && response.ok) {
          try {
            const responseData = await response.clone().json()
            const key = cacheKey(request)
            setCachedData(key, responseData, cacheTtl)
            
            // Add cache headers
            const headers = new Headers(response.headers)
            headers.set('X-Cache', 'MISS')
            headers.set('Cache-Control', `private, max-age=${Math.floor(cacheTtl / 1000)}`)
            
            return new NextResponse(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers,
            })
          } catch {
            // If response is not JSON, return as-is
            return response
          }
        }

        // 7. Log request if enabled
        if (logRequest && process.env.NODE_ENV === 'development') {
          logger.log(`[Admin API] ${request.method} ${request.nextUrl.pathname}`, {
            userId: user.id,
            action: actionName,
          })
        }

        return response

      } catch (error) {
        logError(error, {
          action: actionName,
          metadata: {
            endpoint: request.nextUrl.pathname
          }
        })
        return createErrorResponse(error, 500)
      }
    })
  }
}

/**
 * Helper to generate cache keys for admin APIs
 */
export function generateAdminCacheKey(
  baseKey: string,
  request: NextRequest,
  includeQueryParams: boolean = false
): string {
  const parts = [baseKey]
  
  if (includeQueryParams) {
    const searchParams = request.nextUrl.searchParams.toString()
    if (searchParams) {
      parts.push(searchParams)
    }
  }
  
  return parts.join('_')
}
