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

import { getFriendlyErrorMessage, FRIENDLY } from '@/lib/friendly-error'

/** @deprecated Use getFriendlyErrorMessage from '@/lib/friendly-error' */
export const getSecureErrorMessage = getFriendlyErrorMessage

/**
 * Exponential backoff retry helper
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 300, // Reduced to 300ms for faster retries
  maxDelay: number = 1500 // Reduced to 1500ms for faster failure
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
      
      // Calculate delay with exponential backoff (faster: 500ms, 1000ms max)
      const delay = Math.min(
        initialDelay * Math.pow(2, attempt),
        maxDelay
      )
      
      // Reduced jitter for faster retries
      const jitter = Math.random() * 0.2 * delay
      const finalDelay = delay + jitter
      
      await new Promise(resolve => setTimeout(resolve, finalDelay))
    }
  }
  
  throw lastError
}

/**
 * Rate limit aware fetch with retry.
 * Retries on network errors, 5xx server errors, rate limits, and timeouts.
 */
async function fetchWithRetryImpl(
  url: string,
  options: RequestInit,
  maxRetries: number = 1
): Promise<Response> {
  return retryWithBackoff(
    async () => {
      let response: Response
      try {
        response = await fetch(url, options)
      } catch (networkError: any) {
        throw networkError
      }
      if (response.status === 429) {
        const err = new Error(FRIENDLY.rateLimit)
        ;(err as any).status = 429
        throw err
      }
      if (response.status >= 500 && response.status < 600) {
        const err = new Error(FRIENDLY.server)
        ;(err as any).status = response.status
        throw err
      }
      if (response.status === 408) {
        const err = new Error(FRIENDLY.timeout)
        ;(err as any).status = 408
        throw err
      }
      if (response.status === 404 && maxRetries > 0 && (url.includes('/api/payment/') || url.includes('/api/orders'))) {
        const err = new Error('Order not found')
        ;(err as any).status = 404
        throw err
      }
      return response
    },
    maxRetries,
    300,
    1500
  )
}

export { fetchWithRetryImpl as fetchWithRetry }



