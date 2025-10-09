"use client"

import { useRobustApiFetch } from '@/lib/robust-api-fetch'

interface UseRobustApiOptions {
  endpoint: string
  params?: Record<string, any>
  retryDelay?: number
  maxRetries?: number
  rateLimitCooldown?: number
}

interface UseRobustApiReturn<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  isRateLimited: boolean
  refetch: () => void
  clearError: () => void
  isFetching: boolean
}

/**
 * Simple wrapper around useRobustApiFetch for easy API calls
 * 
 * Features:
 * - No infinite requests (prevents re-fetch if already fetching)
 * - Graceful 429 handling (shows friendly error instead of crashing)
 * - Single mount fetch (useEffect with correct deps)
 * - Manual refetch capability
 */
export function useRobustApi<T>(options: UseRobustApiOptions): UseRobustApiReturn<T> {
  const { endpoint, params = {}, retryDelay = 1000, maxRetries = 3, rateLimitCooldown = 60000 } = options

  // Build the full URL
  const url = new URL(endpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value))
    }
  })

  return useRobustApiFetch<T>(url.toString(), {
    retryDelay,
    maxRetries,
    rateLimitCooldown
  })
}




