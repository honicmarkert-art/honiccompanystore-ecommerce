/**
 * Utility functions for checkout page
 * Provides secure session storage management and environment variable handling
 */

/**
 * Get the site URL from environment variables
 * Falls back to localhost for development
 * @deprecated Use getBaseUrl() from '@/lib/url-utils' instead for consistency
 */
export function getSiteUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use current origin
    return window.location.origin
  }
  // Server-side: use environment variables with consistent fallback
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_WEBSITE_URL ||
    (process.env.NODE_ENV === 'development'
      ? `http://localhost:${process.env.LOCALHOST_PORT || '3000'}`
      : 'https://www.honiccompanystore.com')
  
  // Ensure URL has protocol and no trailing slash
  const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
  return url.endsWith('/') ? url.slice(0, -1) : url
}

/**
 * Build return URL for payment gateway
 */
export function buildReturnUrl(orderReference: string): string {
  const baseUrl = getSiteUrl()
  return `${baseUrl}/checkout/return?orderReference=${orderReference}`
}

/**
 * Build cancel URL for payment gateway
 */
export function buildCancelUrl(orderReference: string): string {
  const baseUrl = getSiteUrl()
  return `${baseUrl}/checkout/return?orderReference=${orderReference}`
}

/**
 * Safe session storage operations with error handling
 */
export const sessionStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      return window.sessionStorage.getItem(key)
    } catch (error) {
      // Silently handle storage errors
      return null
    }
  },

  setItem: (key: string, value: string): boolean => {
    if (typeof window === 'undefined') return false
    try {
      window.sessionStorage.setItem(key, value)
      return true
    } catch (error) {
      // Silently handle storage errors
      return false
    }
  },

  removeItem: (key: string): boolean => {
    if (typeof window === 'undefined') return false
    try {
      window.sessionStorage.removeItem(key)
      return true
    } catch (error) {
      return false
    }
  },

  clear: (): boolean => {
    if (typeof window === 'undefined') return false
    try {
      window.sessionStorage.clear()
      return true
    } catch (error) {
      // Silently handle storage errors
      return false
    }
  },
}

/**
 * Clear all checkout-related session storage items
 */
export function clearCheckoutSessionStorage(): void {
  const keys = [
    'selected_cart_items',
    'buy_now_mode',
    'buy_now_item_data',
    'applied_promotion',
    'last_order_reference',
  ]

  keys.forEach(key => {
    sessionStorage.removeItem(key)
  })
}

/**
 * Secure error message handler
 * Prevents leaking sensitive information to users
 */
export function getSecureErrorMessage(error: unknown, defaultMessage: string): string {
  // Always return generic error messages to users
  // Detailed errors should only be logged server-side
  if (error instanceof Error) {
    // Only show user-friendly error messages
    const message = error.message.toLowerCase()
    
    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.'
    }
    
    // Timeout errors
    if (message.includes('timeout')) {
      return 'Request timed out. Please try again.'
    }
    
    // Rate limit errors
    if (message.includes('rate limit') || message.includes('429')) {
      return 'Too many requests. Please wait a moment and try again.'
    }
    
    // Generic error
    return defaultMessage
  }
  
  return defaultMessage
}

/**
 * Exponential backoff retry helper
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: unknown
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(2, attempt),
        maxDelay
      )
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay
      const finalDelay = delay + jitter
      
      await new Promise(resolve => setTimeout(resolve, finalDelay))
    }
  }
  
  throw lastError
}

/**
 * Rate limit aware fetch with retry
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 1
): Promise<Response> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(url, options)
      
      // If rate limited, throw error to trigger retry
      if (response.status === 429) {
        const error = new Error('Rate limit exceeded')
        ;(error as any).status = 429
        throw error
      }
      
      return response
    },
    maxRetries,
    1000, // Start with 1 second delay
    5000  // Max 5 seconds delay
  )
}



