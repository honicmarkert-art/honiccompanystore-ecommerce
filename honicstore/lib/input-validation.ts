/**
 * Input validation and sanitization utilities
 * Prevents XSS, SQL injection, and other security vulnerabilities
 */

/**
 * Sanitize string input to prevent XSS attacks
 */
export function sanitizeString(input: string, maxLength: number = 10000): string {
  if (typeof input !== 'string') {
    return ''
  }

  return input
    .trim()
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: protocol (can be used for XSS)
    .replace(/data:/gi, '')
    // Remove vbscript: protocol
    .replace(/vbscript:/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove CSS expressions
    .replace(/expression\s*\(/gi, '')
    // Remove iframe tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove object/embed tags
    .replace(/<(object|embed)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '')
    // Remove dangerous attributes
    .replace(/\s*(on\w+|href|src|style|javascript)\s*=/gi, '')
    // Limit length to prevent DoS
    .substring(0, maxLength)
}

/**
 * Validate and sanitize email address
 */
export function validateAndSanitizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null
  }

  const sanitized = email.trim().toLowerCase()
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(sanitized)) {
    return null
  }

  // Length check
  if (sanitized.length > 255) {
    return null
  }

  // Additional security checks
  if (sanitized.includes('<') || sanitized.includes('>') || sanitized.includes('javascript:')) {
    return null
  }

  return sanitized
}

/**
 * Validate and sanitize product review comment
 */
export function validateReviewComment(comment: string): { valid: boolean; sanitized: string; error?: string } {
  if (!comment || typeof comment !== 'string') {
    return { valid: false, sanitized: '', error: 'Comment is required' }
  }

  const trimmed = comment.trim()

  // Length validation
  if (trimmed.length < 10) {
    return { valid: false, sanitized: '', error: 'Comment must be at least 10 characters' }
  }

  if (trimmed.length > 5000) {
    return { valid: false, sanitized: '', error: 'Comment must be less than 5000 characters' }
  }

  // Sanitize
  const sanitized = sanitizeString(trimmed, 5000)

  // Check if sanitization removed too much (indicates malicious input)
  if (sanitized.length < trimmed.length * 0.5) {
    return { valid: false, sanitized: '', error: 'Invalid characters detected' }
  }

  return { valid: true, sanitized }
}

/**
 * Validate rating (1-5)
 */
export function validateRating(rating: number): boolean {
  return typeof rating === 'number' && 
         Number.isInteger(rating) && 
         rating >= 1 && 
         rating <= 5
}

/**
 * Validate product ID
 */
export function validateProductId(id: string | number): number | null {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id
  
  if (!Number.isInteger(numId) || numId <= 0 || numId > Number.MAX_SAFE_INTEGER) {
    return null
  }

  return numId
}

/**
 * Validate URL to prevent XSS through malicious URLs
 */
export function validateUrl(url: string, allowedDomains?: string[]): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  try {
    const parsed = new URL(url)
    
    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:']
    if (dangerousProtocols.includes(parsed.protocol.toLowerCase())) {
      return null
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol.toLowerCase())) {
      return null
    }

    // Check against allowed domains if provided
    if (allowedDomains && allowedDomains.length > 0) {
      const hostname = parsed.hostname.toLowerCase()
      const isAllowed = allowedDomains.some(domain => 
        hostname === domain.toLowerCase() || hostname.endsWith('.' + domain.toLowerCase())
      )
      if (!isAllowed) {
        return null
      }
    }

    return url
  } catch {
    return null
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Validate JSON input to prevent prototype pollution
 */
export function safeJsonParse<T = any>(json: string): T | null {
  try {
    const parsed = JSON.parse(json)
    
    // Check for prototype pollution
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed)
      if (keys.includes('__proto__') || keys.includes('constructor') || keys.includes('prototype')) {
        return null
      }
    }

    return parsed as T
  } catch {
    return null
  }
}

/**
 * Sanitize object recursively to prevent XSS
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T, maxDepth: number = 10): T {
  if (maxDepth <= 0) {
    return {} as T
  }

  const sanitized = {} as T

  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue
    }

    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeString(value) as T[keyof T]
    } else if (Array.isArray(value)) {
      sanitized[key as keyof T] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) : item
      ) as T[keyof T]
    } else if (value && typeof value === 'object') {
      sanitized[key as keyof T] = sanitizeObject(value, maxDepth - 1) as T[keyof T]
    } else {
      sanitized[key as keyof T] = value
    }
  }

  return sanitized
}
