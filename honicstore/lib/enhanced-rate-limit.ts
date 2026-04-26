import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  blockDurationMs: number
}

interface RateLimitEntry {
  count: number
  resetTime: number
  blockedUntil?: number
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Different rate limits for different endpoints
const rateLimitConfigs: Record<string, RateLimitConfig> = {
  // Authentication endpoints - stricter limits
  '/api/auth/login': { windowMs: 15 * 60 * 1000, maxRequests: 5, blockDurationMs: 30 * 60 * 1000 },
  '/api/auth/register': { windowMs: 60 * 60 * 1000, maxRequests: 3, blockDurationMs: 60 * 60 * 1000 },
  
  // Payment endpoints - very strict
  '/api/payment': { windowMs: 5 * 60 * 1000, maxRequests: 10, blockDurationMs: 60 * 60 * 1000 },
  '/api/checkout': { windowMs: 5 * 60 * 1000, maxRequests: 5, blockDurationMs: 30 * 60 * 1000 },
  '/api/webhooks/manual-trigger': { windowMs: 60 * 60 * 1000, maxRequests: 3, blockDurationMs: 2 * 60 * 60 * 1000 },
  '/api/media/upload': { windowMs: 60 * 1000, maxRequests: 10, blockDurationMs: 15 * 60 * 1000 },
  '/api/media/delete': { windowMs: 60 * 1000, maxRequests: 20, blockDurationMs: 15 * 60 * 1000 },
  '/api/orders/': { windowMs: 60 * 1000, maxRequests: 30, blockDurationMs: 10 * 60 * 1000 },
  
  // Cart endpoints - moderate limits to prevent abuse
  '/api/cart': { windowMs: 60 * 1000, maxRequests: 30, blockDurationMs: 5 * 60 * 1000 },
  
  // Newsletter subscription - moderate limits to prevent spam
  '/api/newsletter/subscribe': { windowMs: 60 * 60 * 1000, maxRequests: 5, blockDurationMs: 60 * 60 * 1000 },
  
  // Public API endpoints - higher limits for products (used for infinite scroll)
  '/api/products': { windowMs: 60 * 1000, maxRequests: 120, blockDurationMs: 2 * 60 * 1000 },
  '/api/categories': { windowMs: 60 * 1000, maxRequests: 60, blockDurationMs: 5 * 60 * 1000 },
  '/api/advertisements': { windowMs: 60 * 1000, maxRequests: 60, blockDurationMs: 5 * 60 * 1000 },
  
  
  // Supplier endpoints - moderate limits
  '/api/supplier/products': { windowMs: 60 * 1000, maxRequests: 60, blockDurationMs: 5 * 60 * 1000 },
  '/api/supplier/orders': { windowMs: 60 * 1000, maxRequests: 60, blockDurationMs: 5 * 60 * 1000 },
  '/api/supplier/logo-upload': { windowMs: 60 * 1000, maxRequests: 10, blockDurationMs: 10 * 60 * 1000 }, // Stricter for file uploads
  '/api/supplier-plans': { windowMs: 60 * 1000, maxRequests: 60, blockDurationMs: 5 * 60 * 1000 },
  '/api/supplier': { windowMs: 60 * 1000, maxRequests: 60, blockDurationMs: 5 * 60 * 1000 }, // Catch-all for other supplier endpoints
  
  // General API endpoints
  default: { windowMs: 60 * 1000, maxRequests: 100, blockDurationMs: 5 * 60 * 1000 }
}

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

async function upstashCommand(command: string[]): Promise<any> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Upstash Redis is not configured')
  }

  const response = await fetch(UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  if (!response.ok) {
    throw new Error(`Upstash request failed: ${response.status}`)
  }

  const payload = await response.json()
  if (payload?.error) {
    throw new Error(String(payload.error))
  }
  return payload?.result
}

function enhancedRateLimitInMemory(request: NextRequest): { allowed: boolean; reason?: string; retryAfter?: number } {
  const clientIP = getClientIP(request)
  const pathname = request.nextUrl.pathname
  
  // Get rate limit config for this endpoint
  const config = getRateLimitConfig(pathname)
  const key = `${clientIP}:${pathname}`
  
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  
  // Check if currently blocked
  if (entry?.blockedUntil && now < entry.blockedUntil) {
    return {
      allowed: false,
      reason: 'Rate limit exceeded. Account temporarily blocked.',
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000)
    }
  }
  
  // Reset if window has expired
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    })
    return { allowed: true }
  }
  
  // Increment count
  entry.count++
  
  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    // Block the IP
    entry.blockedUntil = now + config.blockDurationMs
    entry.count = 0 // Reset count
    
    return {
      allowed: false,
      reason: 'Rate limit exceeded. Too many requests.',
      retryAfter: Math.ceil(config.blockDurationMs / 1000)
    }
  }
  
  return { allowed: true }
}

export async function enhancedRateLimitDistributed(
  request: NextRequest
): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return enhancedRateLimitInMemory(request)
  }

  const clientIP = getClientIP(request)
  const pathname = request.nextUrl.pathname
  const config = getRateLimitConfig(pathname)
  const baseKey = `ratelimit:${pathname}:${clientIP}`
  const windowKey = `${baseKey}:window`
  const blockKey = `${baseKey}:blocked`

  try {
    const blockedExists = Number(await upstashCommand(['EXISTS', blockKey])) === 1
    if (blockedExists) {
      const ttlMs = Number(await upstashCommand(['PTTL', blockKey]))
      return {
        allowed: false,
        reason: 'Rate limit exceeded. Account temporarily blocked.',
        retryAfter: Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : config.blockDurationMs) / 1000)),
      }
    }

    const count = Number(await upstashCommand(['INCR', windowKey]))
    if (count === 1) {
      await upstashCommand(['PEXPIRE', windowKey, String(config.windowMs)])
    }

    if (count > config.maxRequests) {
      await upstashCommand(['SET', blockKey, '1', 'PX', String(config.blockDurationMs)])
      return {
        allowed: false,
        reason: 'Rate limit exceeded. Too many requests.',
        retryAfter: Math.ceil(config.blockDurationMs / 1000),
      }
    }

    return { allowed: true }
  } catch (error) {
    logger.warn('Distributed rate limit unavailable; falling back to in-memory limiter')
    return enhancedRateLimitInMemory(request)
  }
}

// Default limiter used across routes: distributed-first with in-memory fallback.
export async function enhancedRateLimit(
  request: NextRequest
): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
  return enhancedRateLimitDistributed(request)
}

export async function getRateLimitBackendStatus(): Promise<{
  backend: 'upstash' | 'memory'
  healthy: boolean
  configured: boolean
  reason?: string
}> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return {
      backend: 'memory',
      healthy: true,
      configured: false,
      reason: 'Upstash environment variables are missing; using in-memory fallback.',
    }
  }

  try {
    const pong = await upstashCommand(['PING'])
    const healthy = String(pong).toUpperCase() === 'PONG'
    return {
      backend: 'upstash',
      healthy,
      configured: true,
      reason: healthy ? undefined : 'Unexpected Upstash PING response.',
    }
  } catch (error) {
    return {
      backend: 'memory',
      healthy: false,
      configured: true,
      reason: 'Upstash is configured but currently unreachable; requests will fall back to in-memory.',
    }
  }
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (cfConnectingIP) return cfConnectingIP
  if (realIP) return realIP
  if (forwarded) return forwarded.split(',')[0].trim()
  
  return 'unknown'
}

function getRateLimitConfig(pathname: string): RateLimitConfig {
  // Find matching config
  for (const [pattern, config] of Object.entries(rateLimitConfigs)) {
    if (pattern !== 'default' && pathname.startsWith(pattern)) {
      return config
    }
  }
  
  return rateLimitConfigs.default
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime && (!entry.blockedUntil || now > entry.blockedUntil)) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000) // Cleanup every 5 minutes

// Security monitoring
export function logSecurityEvent(event: string, details: any, request: NextRequest) {
  const clientIP = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const timestamp = new Date().toISOString()
  
  logger.log(`[SECURITY] ${timestamp} - ${event}`, {
    ip: clientIP,
    userAgent,
    path: request.nextUrl.pathname,
    method: request.method,
    ...details
  })
  
  // In production, send to monitoring service
  // Example: sendToMonitoringService(event, { ip: clientIP, ...details })
}








