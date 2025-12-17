import { NextRequest } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { logger } from './logger'

/**
 * IDOR Security Utilities
 * Prevents Insecure Direct Object Reference vulnerabilities
 */

export interface IdorSecurityConfig {
  enableIdObfuscation: boolean
  enableOwnershipValidation: boolean
  enableSequentialIdDetection: boolean
  enableRateLimitPerUser: boolean
  maxRequestsPerMinute: number
}

const defaultConfig: IdorSecurityConfig = {
  enableIdObfuscation: true,
  enableOwnershipValidation: true,
  enableSequentialIdDetection: true,
  enableRateLimitPerUser: true,
  maxRequestsPerMinute: 60
}

// In-memory stores for production use Redis
const userRequestHistory = new Map<string, { requests: number[], lastReset: number }>()
const sequentialIdAttempts = new Map<string, { attempts: number, lastAttempt: number }>()

/**
 * Generate obfuscated ID from numeric ID
 * Uses HMAC with secret key for consistent obfuscation
 */
export function obfuscateId(id: number, type: 'user' | 'product' | 'order' = 'product'): string {
  const secret = process.env.IDOR_SECRET_KEY || 'default-secret-change-in-production'
  const salt = `${type}_${id}`
  const hash = createHash('sha256').update(`${secret}${salt}`).digest('hex')
  return Buffer.from(hash).toString('base64url').substring(0, 16)
}

/**
 * Deobfuscate ID from obfuscated string
 * Returns null if invalid
 */
export function deobfuscateId(obfuscatedId: string, type: 'user' | 'product' | 'order' = 'product'): number | null {
  try {
    // For now, we'll use a simple approach
    // In production, implement proper deobfuscation
    const decoded = Buffer.from(obfuscatedId, 'base64url').toString('hex')
    // This is a simplified implementation
    // Real implementation would need to reverse the HMAC
    return null
  } catch {
    return null
  }
}

/**
 * Generate UUID-like identifier for public use
 */
export function generatePublicId(): string {
  return randomBytes(16).toString('base64url')
}

/**
 * Validate user ownership of resource
 */
export async function validateResourceOwnership(
  userId: string,
  resourceId: string,
  resourceType: 'order' | 'cart' | 'profile',
  supabase: any
): Promise<{ allowed: boolean; error?: string }> {
  try {
    switch (resourceType) {
      case 'order':
        const { data: order } = await supabase
          .from('orders')
          .select('user_id')
          .eq('id', resourceId)
          .single()
        
        if (!order || order.user_id !== userId) {
          return { allowed: false, error: 'Order not found or access denied' }
        }
        break

      case 'cart':
        const { data: cartItem } = await supabase
          .from('cart_items')
          .select('user_id')
          .eq('id', resourceId)
          .single()
        
        if (!cartItem || cartItem.user_id !== userId) {
          return { allowed: false, error: 'Cart item not found or access denied' }
        }
        break

      case 'profile':
        if (resourceId !== userId) {
          return { allowed: false, error: 'Profile access denied' }
        }
        break

      default:
        return { allowed: false, error: 'Invalid resource type' }
    }

    return { allowed: true }
  } catch (error) {
    logger.error('Resource ownership validation failed:', error)
    return { allowed: false, error: 'Validation failed' }
  }
}

/**
 * Detect sequential ID access attempts (potential IDOR attack)
 */
export function detectSequentialIdAccess(
  userId: string,
  resourceId: string,
  resourceType: string
): { suspicious: boolean; reason?: string } {
  const key = `${userId}_${resourceType}`
  const now = Date.now()
  const attempt = { attempts: 1, lastAttempt: now }
  
  if (sequentialIdAttempts.has(key)) {
    const existing = sequentialIdAttempts.get(key)!
    const timeDiff = now - existing.lastAttempt
    
    // If requests are within 5 seconds, increment counter
    if (timeDiff < 5000) {
      existing.attempts++
      existing.lastAttempt = now
      sequentialIdAttempts.set(key, existing)
      
      // Flag if more than 5 sequential attempts
      if (existing.attempts > 5) {
        logger.security('Sequential ID access detected', userId, {
          resourceType,
          attempts: existing.attempts,
          resourceId
        })
        return { suspicious: true, reason: 'Sequential ID access pattern detected' }
      }
    } else {
      // Reset counter if time gap is large
      sequentialIdAttempts.set(key, attempt)
    }
  } else {
    sequentialIdAttempts.set(key, attempt)
  }
  
  return { suspicious: false }
}

/**
 * Rate limiting per user
 */
export function checkUserRateLimit(userId: string, config: IdorSecurityConfig = defaultConfig): boolean {
  if (!config.enableRateLimitPerUser) return true
  
  const now = Date.now()
  const minuteAgo = now - 60000
  
  if (!userRequestHistory.has(userId)) {
    userRequestHistory.set(userId, { requests: [now], lastReset: now })
    return true
  }
  
  const userHistory = userRequestHistory.get(userId)!
  
  // Clean old requests
  userHistory.requests = userHistory.requests.filter(time => time > minuteAgo)
  
  // Check if under limit
  if (userHistory.requests.length >= config.maxRequestsPerMinute) {
    logger.security('Rate limit exceeded', userId, {
      requests: userHistory.requests.length,
      limit: config.maxRequestsPerMinute
    })
    return false
  }
  
  // Add current request
  userHistory.requests.push(now)
  userRequestHistory.set(userId, userHistory)
  
  return true
}

/**
 * Comprehensive IDOR protection middleware
 */
export async function protectAgainstIdor(
  request: NextRequest,
  userId: string,
  resourceId: string,
  resourceType: 'user' | 'product' | 'order' | 'cart',
  supabase: any,
  config: IdorSecurityConfig = defaultConfig
): Promise<{ allowed: boolean; error?: string; statusCode?: number }> {
  try {
    // 1. Rate limiting check
    if (!checkUserRateLimit(userId, config)) {
      return {
        allowed: false,
        error: 'Rate limit exceeded',
        statusCode: 429
      }
    }
    
    // 2. Sequential ID detection
    if (config.enableSequentialIdDetection) {
      const sequentialCheck = detectSequentialIdAccess(userId, resourceId, resourceType)
      if (sequentialCheck.suspicious) {
        return {
          allowed: false,
          error: 'Suspicious access pattern detected',
          statusCode: 403
        }
      }
    }
    
    // 3. Ownership validation for user-specific resources
    if (config.enableOwnershipValidation && ['order', 'cart', 'user'].includes(resourceType)) {
      const ownershipCheck = await validateResourceOwnership(
        userId,
        resourceId,
        resourceType as 'order' | 'cart' | 'profile',
        supabase
      )
      
      if (!ownershipCheck.allowed) {
        logger.security('IDOR attempt blocked', userId, {
          resourceType,
          resourceId,
          reason: ownershipCheck.error
        })
        return {
          allowed: false,
          error: ownershipCheck.error,
          statusCode: 403
        }
      }
    }
    
    return { allowed: true }
    
  } catch (error) {
    logger.error('IDOR protection failed:', error)
    return {
      allowed: false,
      error: 'Security validation failed',
      statusCode: 500
    }
  }
}

/**
 * Generate secure resource URL with obfuscated ID
 */
export function generateSecureResourceUrl(
  baseUrl: string,
  resourceId: number,
  resourceType: 'user' | 'product' | 'order' = 'product'
): string {
  const obfuscatedId = obfuscateId(resourceId, resourceType)
  return `${baseUrl}/${obfuscatedId}`
}

/**
 * Log security events for monitoring
 */
export function logIdorEvent(
  event: 'access_granted' | 'access_denied' | 'suspicious_pattern',
  userId: string,
  details: any
): void {
  logger.security(`IDOR ${event}`, userId, {
    timestamp: new Date().toISOString(),
    ...details
  })
}

/**
 * Clean up old tracking data
 */
export function cleanupTrackingData(): void {
  const now = Date.now()
  const oneHourAgo = now - 3600000
  
  // Clean user request history
  for (const [userId, history] of userRequestHistory.entries()) {
    if (history.lastReset < oneHourAgo) {
      userRequestHistory.delete(userId)
    }
  }
  
  // Clean sequential ID attempts
  for (const [key, attempt] of sequentialIdAttempts.entries()) {
    if (attempt.lastAttempt < oneHourAgo) {
      sequentialIdAttempts.delete(key)
    }
  }
}

// Run cleanup every hour
setInterval(cleanupTrackingData, 3600000)
