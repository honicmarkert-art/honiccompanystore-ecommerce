import { NextRequest, NextResponse } from 'next/server'

// Rate limiting storage (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Cleanup expired rate limit entries every minute to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 60000) // Run cleanup every 60 seconds

// Rate limiting configuration - Very lenient for development
const RATE_LIMIT = {
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 10000, // 10,000 requests per window (very high for development)
  apiMaxRequests: 5000, // 5,000 API requests per window (very high for development)
}

// Security headers configuration
const SECURITY_HEADERS = {
  'X-DNS-Prefetch-Control': 'off',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

// Content Security Policy
const CSP_HEADER = [
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
  "upgrade-insecure-requests"
].join('; ')

// IP-based rate limiting
function checkRateLimit(ip: string, isApi: boolean = false): boolean {
  const now = Date.now()
  const key = `${ip}:${isApi ? 'api' : 'web'}`
  const limit = isApi ? RATE_LIMIT.apiMaxRequests : RATE_LIMIT.maxRequests
  
  const current = rateLimitMap.get(key)
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs
    })
    return true
  }
  
  if (current.count >= limit) {
    return false
  }
  
  current.count++
  return true
}

// Input validation and sanitization
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
}

// CSRF token validation
function validateCSRFToken(request: NextRequest): boolean {
  const token = request.headers.get('x-csrf-token')
  const cookieToken = request.cookies.get('csrf-token')?.value
  
  if (!token || !cookieToken) {
    return false
  }
  
  return token === cookieToken
}

// Admin route protection - Hidden path for security
function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/siem-dashboard')
}

// API route protection
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const xff = request.headers.get('x-forwarded-for') || ''
  const ip = (xff.split(',')[0]?.trim()) || request.headers.get('x-real-ip') || 'unknown'
  
  // Skip rate limiting in development mode for easier testing
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // Rate limiting (skip in development)
  if (!isDevelopment) {
    const isApi = isApiRoute(pathname)
    if (!checkRateLimit(ip, isApi)) {
      console.warn(`Rate limit exceeded for IP: ${ip} on ${pathname}`)
      return new NextResponse('Too Many Requests', { 
        status: 429,
        headers: {
          'Retry-After': '60', // 1 minute
          ...SECURITY_HEADERS
        }
      })
    }
  }
  
  // Security headers for all responses
  const response = NextResponse.next()
  
  // Add security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  // Add CSP header
  response.headers.set('Content-Security-Policy', CSP_HEADER)
  
  // Block old /admin path - redirect to home
  if (pathname.startsWith('/admin')) {
    const homeUrl = new URL('/', request.url)
    return NextResponse.redirect(homeUrl)
  }

  // Admin route protection - Only protect /siem-dashboard routes
  if (isAdminRoute(pathname)) {
    // Check for Supabase session cookies
    const sessionCookie = request.cookies.get('sb-session-active')
    const authToken = request.cookies.get('supabase-auth-token')
    
    // If no session indicators found, redirect to login
    if (!sessionCookie && !authToken) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // CSRF protection for state-changing operations
    if (request.method !== 'GET' && !validateCSRFToken(request)) {
      return new NextResponse('CSRF token validation failed', { status: 403 })
    }
  }
  
  // API route protection
  if (isApiRoute(pathname)) {
    // Add API-specific security headers
    response.headers.set('X-API-Version', '1.0')
    
    // Validate request size for POST/PUT requests
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
      return new NextResponse('Request too large', { status: 413 })
    }
    
    // Block suspicious user agents
    const userAgent = request.headers.get('user-agent') || ''
    if (userAgent.includes('bot') && !userAgent.includes('googlebot')) {
      console.warn(`Blocked bot request from IP: ${ip}, User-Agent: ${userAgent}`)
      return new NextResponse('Forbidden', { status: 403 })
    }
  }
  
  // Input sanitization for form submissions
  if (request.method === 'POST' || request.method === 'PUT') {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      // This would need to be implemented in the actual route handlers
      // as middleware can't modify request body
    }
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}