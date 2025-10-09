import { NextRequest, NextResponse } from 'next/server'

// Security headers configuration
export const SECURITY_HEADERS = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // XSS protection
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // DNS prefetch control
  'X-DNS-Prefetch-Control': 'off',
  
  // Permissions policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  
  // Strict transport security (HTTPS only)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Cross-origin policies
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

// Content Security Policy
export const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com https://www.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co https://api.clickpesa.com wss://*.supabase.co",
  "media-src 'self' data: blob: https: http:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
  "block-all-mixed-content"
].join('; ')

// API-specific security headers
export const API_SECURITY_HEADERS = {
  ...SECURITY_HEADERS,
  'X-API-Version': '1.0',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}

// Rate limiting configuration
export const RATE_LIMITS = {
  // General web requests
  web: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  
  // API requests
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50,
  },
  
  // Authentication requests
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  
  // File upload requests
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },
}

// Security middleware helper
export function addSecurityHeaders(response: NextResponse, isApi: boolean = false): NextResponse {
  const headers = isApi ? API_SECURITY_HEADERS : SECURITY_HEADERS
  
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  response.headers.set('Content-Security-Policy', CSP_POLICY)
  
  return response
}

// CSRF token generation and validation
export function generateCSRFToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function validateCSRFToken(request: NextRequest): boolean {
  const token = request.headers.get('x-csrf-token')
  const cookieToken = request.cookies.get('csrf-token')?.value
  
  if (!token || !cookieToken) {
    return false
  }
  
  // Use constant-time comparison to prevent timing attacks
  return token.length === cookieToken.length && 
         token === cookieToken
}

// Input sanitization
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .trim()
}

// SQL injection prevention
export function escapeSqlString(input: string): string {
  return input
    .replace(/'/g, "''") // Escape single quotes
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove block comment start
    .replace(/\*\//g, '') // Remove block comment end
    .replace(/xp_/gi, '') // Remove extended procedures
    .replace(/sp_/gi, '') // Remove stored procedures
}

// XSS prevention
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

// File upload security
export function validateFileUpload(file: File, options: {
  maxSize?: number
  allowedTypes?: string[]
  allowedExtensions?: string[]
}): { valid: boolean; error?: string } {
  const { 
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'],
    allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm']
  } = options
  
  // Check file size
  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` }
  }
  
  // Check MIME type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type ${file.type} not allowed` }
  }
  
  // Check file extension
  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !allowedExtensions.includes(extension)) {
      return { valid: false, error: `File extension .${extension} not allowed` }
    }
  }
  
  // Check for suspicious file names
  const suspiciousPatterns = [
    /\.exe$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.scr$/i,
    /\.pif$/i,
    /\.com$/i,
    /\.vbs$/i,
    /\.js$/i,
    /\.php$/i,
    /\.asp$/i,
    /\.jsp$/i
  ]
  
  if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
    return { valid: false, error: 'File type not allowed for security reasons' }
  }
  
  return { valid: true }
}

// Password strength validation
export function validatePasswordStrength(password: string): {
  valid: boolean
  score: number
  feedback: string[]
} {
  const feedback: string[] = []
  let score = 0
  
  // Length check
  if (password.length >= 8) {
    score += 1
  } else {
    feedback.push('Password must be at least 8 characters long')
  }
  
  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1
  } else {
    feedback.push('Password must contain at least one uppercase letter')
  }
  
  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1
  } else {
    feedback.push('Password must contain at least one lowercase letter')
  }
  
  // Number check
  if (/\d/.test(password)) {
    score += 1
  } else {
    feedback.push('Password must contain at least one number')
  }
  
  // Special character check
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1
  } else {
    feedback.push('Password must contain at least one special character')
  }
  
  // Common password check
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ]
  
  if (commonPasswords.includes(password.toLowerCase())) {
    score -= 2
    feedback.push('Password is too common')
  }
  
  return {
    valid: score >= 4,
    score,
    feedback
  }
}

// IP address validation and blocking
export function isBlockedIP(ip: string): boolean {
  // Block private IPs in production (except for localhost)
  if (process.env.NODE_ENV === 'production') {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ]
    
    if (privateRanges.some(range => range.test(ip)) && ip !== '127.0.0.1') {
      return true
    }
  }
  
  // Block known malicious IPs (in production, use a threat intelligence service)
  const maliciousIPs = [
    // Add known malicious IPs here
  ]
  
  return maliciousIPs.includes(ip)
}

// Request size validation
export function validateRequestSize(request: NextRequest): boolean {
  const contentLength = request.headers.get('content-length')
  if (!contentLength) return true
  
  const size = parseInt(contentLength)
  const maxSize = 10 * 1024 * 1024 // 10MB
  
  return size <= maxSize
}

// User agent validation
export function isSuspiciousUserAgent(userAgent: string): boolean {
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java/i,
    /php/i,
    /perl/i,
    /ruby/i,
    /go-http/i,
    /okhttp/i,
    /apache/i,
    /nginx/i
  ]
  
  // Allow legitimate bots
  const allowedBots = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /whatsapp/i,
    /telegrambot/i
  ]
  
  // Check if it's an allowed bot
  if (allowedBots.some(pattern => pattern.test(userAgent))) {
    return false
  }
  
  // Check if it's a suspicious pattern
  return suspiciousPatterns.some(pattern => pattern.test(userAgent))
}