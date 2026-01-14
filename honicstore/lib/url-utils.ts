/**
 * Centralized URL utility functions
 * Production-ready with caching, validation, and error handling
 * All URLs should use these utilities instead of hardcoding
 */

// Cache for base URLs to avoid repeated environment variable lookups
let cachedBaseUrl: string | null = null
let cachedServerBaseUrl: string | null = null

/**
 * Validates if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Sanitizes and normalizes a URL string
 */
function normalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL: URL must be a non-empty string')
  }

  // Remove whitespace
  let normalized = url.trim()

  // Ensure protocol exists
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    // Only add https:// for non-localhost URLs
    normalized = normalized.startsWith('localhost') || normalized.startsWith('127.0.0.1')
      ? `http://${normalized}`
      : `https://${normalized}`
  }

  // Remove trailing slash
  normalized = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized

  // Validate the final URL
  if (!isValidUrl(normalized)) {
    throw new Error(`Invalid URL format: ${normalized}`)
  }

  return normalized
}

/**
 * Get the base URL for the application
 * Production-ready with caching and validation
 * 
 * Priority:
 * 1. Client-side: window.location.origin (most accurate)
 * 2. NEXT_PUBLIC_SITE_URL
 * 3. NEXT_PUBLIC_APP_URL
 * 4. NEXT_PUBLIC_WEBSITE_URL
 * 5. Development: localhost with LOCALHOST_PORT
 * 6. Production fallback: https://www.honiccompanystore.com
 * 
 * @returns Normalized base URL
 * @throws Error if URL cannot be determined or is invalid
 */
export function getBaseUrl(): string {
  // Client-side: use current origin (most accurate, always fresh)
  if (typeof window !== 'undefined') {
    try {
      return normalizeUrl(window.location.origin)
    } catch (error) {
      // Fall through to server-side logic
    }
  }

  // Use cached value if available (server-side only)
  if (cachedBaseUrl) {
    return cachedBaseUrl
  }

  // Server-side: use environment variables
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_WEBSITE_URL ||
    (process.env.NODE_ENV === 'development'
      ? `http://localhost:${process.env.LOCALHOST_PORT || '3000'}`
      : 'https://www.honiccompanystore.com')

  try {
    const normalized = normalizeUrl(baseUrl)
    // Cache for subsequent calls (server-side only)
    cachedBaseUrl = normalized
    return normalized
  } catch (error) {
    // Return a safe fallback
    const fallback = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://www.honiccompanystore.com'
    cachedBaseUrl = fallback
    return fallback
  }
}

/**
 * Get the base URL for server-side operations only
 * Does not use window.location.origin (for SSR/API routes)
 * Production-ready with caching and validation
 * 
 * @returns Normalized base URL
 * @throws Error if URL cannot be determined or is invalid
 */
export function getServerBaseUrl(): string {
  // Use cached value if available
  if (cachedServerBaseUrl) {
    return cachedServerBaseUrl
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_WEBSITE_URL ||
    (process.env.NODE_ENV === 'development'
      ? `http://localhost:${process.env.LOCALHOST_PORT || '3000'}`
      : 'https://www.honiccompanystore.com')

  try {
    const normalized = normalizeUrl(baseUrl)
    // Cache for subsequent calls
    cachedServerBaseUrl = normalized
    return normalized
  } catch (error) {
    // Return a safe fallback
    const fallback = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://www.honiccompanystore.com'
    cachedServerBaseUrl = fallback
    return fallback
  }
}

/**
 * Sanitizes a path to prevent URL injection attacks
 */
function sanitizePath(path: string): string {
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid path: Path must be a non-empty string')
  }

  // Remove any protocol or domain attempts
  let sanitized = path.trim()
  
  // Remove protocol if accidentally included
  sanitized = sanitized.replace(/^https?:\/\//, '')
  
  // Remove domain if accidentally included
  sanitized = sanitized.replace(/^[^/]+/, '')
  
  // Ensure path starts with /
  if (!sanitized.startsWith('/')) {
    sanitized = `/${sanitized}`
  }

  // Remove query string and hash for path validation (they'll be added separately if needed)
  sanitized = sanitized.split('?')[0].split('#')[0]

  // Validate path doesn't contain dangerous characters
  if (!/^\/[a-zA-Z0-9\-_/.]*$/.test(sanitized)) {
    throw new Error(`Invalid path format: ${sanitized}`)
  }

  return sanitized
}

/**
 * Build a full URL from a path
 * Production-ready with path sanitization and validation
 * 
 * @param path - The path to append (e.g., '/auth/callback')
 * @param queryParams - Optional query parameters object
 * @returns Full URL with base URL + path + query string
 * @throws Error if path is invalid
 */
export function buildUrl(path: string, queryParams?: Record<string, string | number | boolean>): string {
  const baseUrl = getBaseUrl()
  const sanitizedPath = sanitizePath(path)
  
  let url = `${baseUrl}${sanitizedPath}`
  
  // Add query parameters if provided
  if (queryParams && Object.keys(queryParams).length > 0) {
    const searchParams = new URLSearchParams()
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value))
      }
    })
    const queryString = searchParams.toString()
    if (queryString) {
      url = `${url}?${queryString}`
    }
  }
  
  return url
}

/**
 * Build a full URL from a path (server-side only)
 * Production-ready with path sanitization and validation
 * 
 * @param path - The path to append (e.g., '/auth/callback')
 * @param queryParams - Optional query parameters object
 * @returns Full URL with base URL + path + query string
 * @throws Error if path is invalid
 */
export function buildServerUrl(path: string, queryParams?: Record<string, string | number | boolean>): string {
  const baseUrl = getServerBaseUrl()
  const sanitizedPath = sanitizePath(path)
  
  let url = `${baseUrl}${sanitizedPath}`
  
  // Add query parameters if provided
  if (queryParams && Object.keys(queryParams).length > 0) {
    const searchParams = new URLSearchParams()
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value))
      }
    })
    const queryString = searchParams.toString()
    if (queryString) {
      url = `${url}?${queryString}`
    }
  }
  
  return url
}

/**
 * Clear cached URLs (useful for testing or when env vars change)
 */
export function clearUrlCache(): void {
  cachedBaseUrl = null
  cachedServerBaseUrl = null
}
