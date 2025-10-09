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
  
  // Admin endpoints - moderate limits
  '/api/admin': { windowMs: 60 * 1000, maxRequests: 30, blockDurationMs: 10 * 60 * 1000 },
  
  // General API endpoints
  default: { windowMs: 60 * 1000, maxRequests: 100, blockDurationMs: 5 * 60 * 1000 }
}

export function enhancedRateLimit(request: NextRequest): { allowed: boolean; reason?: string; retryAfter?: number } {
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







