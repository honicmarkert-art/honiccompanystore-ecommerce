"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRobustApiFetch } from '@/lib/robust-api-fetch'
import { useApiCache } from '@/contexts/shared-data-cache'
import { logger } from '@/lib/logger'

interface UseOptimizedApiOptions {
  endpoint: string
  params?: Record<string, any>
  ttl?: number
  enabled?: boolean
  refetchOnMount?: boolean
  refetchOnWindowFocus?: boolean
  staleWhileRevalidate?: boolean
}

interface UseOptimizedApiReturn<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  mutate: (newData: T) => void
  clearCache: () => void
}

/**
 * Optimized API Hook with intelligent caching
 * 
 * Provides caching, background refetching, and performance optimizations
 */
export function useOptimizedApi<T>({
  endpoint,
  params = {},
  ttl = 10 * 60 * 1000, // 10 minutes default (increased for better cache hit rate)
  enabled = true,
  refetchOnMount = true,
  refetchOnWindowFocus = true,
  staleWhileRevalidate = true
}: UseOptimizedApiOptions): UseOptimizedApiReturn<T> {
  const { getCachedApiResponse, setCachedApiResponse, clearApiCache } = useApiCache()
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Rate limiting state
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [isRateLimited, setIsRateLimited] = useState(false)

  // Generate stable cache key (prevents fragmentation from object key order)
  const { generateStableCacheKey } = require('@/lib/cache-key-generator')
  const cacheKey = generateStableCacheKey(endpoint, params)

  // Fetch data from API
  const fetchData = useCallback(async (isBackground = false) => {
    if (!enabled) return

    // Rate limiting check
    const now = Date.now()
    const timeSinceLastFetch = now - lastFetchTime
    const minInterval = 2000 // 2 seconds minimum between requests

    if (timeSinceLastFetch < minInterval && !isBackground) {
      logger.log('Rate limiting: Too soon since last fetch')
      return
    }

    // Check if we're currently rate limited
    if (isRateLimited) {
      logger.log('Rate limited: Skipping fetch')
      return
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    try {
      if (!isBackground) {
        setIsLoading(true)
      }
      setError(null)
      setLastFetchTime(now)

      // Build URL with params
      const url = new URL(endpoint, window.location.origin)
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value))
        }
      })

      const response = await fetch(url.toString(), {
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 429) {
        // Handle rate limiting
        setIsRateLimited(true)
        setError('Too many requests. Please wait a moment and try again.')
        
        // Reset rate limit after 60 seconds
        setTimeout(() => {
          setIsRateLimited(false)
          setError(null)
        }, 60000)
        
        return
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      // Update state
      setData(result)
      setCachedApiResponse(endpoint, result, params, ttl)
      
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
        console.error(`API Error for ${endpoint}:`, err)
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [endpoint, params, enabled, ttl, setCachedApiResponse, lastFetchTime, isRateLimited])

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchData(false)
  }, [fetchData])

  // Mutate function for optimistic updates
  const mutate = useCallback((newData: T) => {
    setData(newData)
    setCachedApiResponse(endpoint, newData, params, ttl)
  }, [endpoint, params, ttl, setCachedApiResponse])

  // Clear cache function
  const clearCache = useCallback(() => {
    clearApiCache(endpoint)
    setData(null)
  }, [clearApiCache, endpoint])

  // Initial load with cache check
  useEffect(() => {
    if (!enabled || isInitialized) return

    // Check cache first
    const cachedData = getCachedApiResponse<T>(endpoint, params)
    if (cachedData) {
      setData(cachedData)
      
      if (staleWhileRevalidate) {
        // Background refetch for stale data
        fetchData(true)
      }
    } else if (refetchOnMount) {
      // No cache, fetch immediately
      fetchData(false)
    }

    setIsInitialized(true)
  }, [enabled, isInitialized, endpoint, params, getCachedApiResponse, fetchData, refetchOnMount, staleWhileRevalidate])

  // Refetch on window focus (with rate limiting)
  useEffect(() => {
    if (!enabled || !refetchOnWindowFocus) return

    const handleFocus = () => {
      // Only refetch if not rate limited and enough time has passed
      const now = Date.now()
      const timeSinceLastFetch = now - lastFetchTime
      const minInterval = 5000 // 5 seconds minimum for focus refetch
      
      if (staleWhileRevalidate && !isRateLimited && timeSinceLastFetch > minInterval) {
        fetchData(true) // Background refetch
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [enabled, refetchOnWindowFocus, fetchData, staleWhileRevalidate, lastFetchTime, isRateLimited])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    data,
    isLoading,
    error,
    refetch,
    mutate,
    clearCache
  }
}

/**
 * Hook for multiple API calls with batching
 */
export function useOptimizedApiBatch<T>(
  requests: Array<UseOptimizedApiOptions & { key: string }>
): Record<string, UseOptimizedApiReturn<T>> {
  const results: Record<string, UseOptimizedApiReturn<T>> = {}

  requests.forEach(({ key, ...options }) => {
    results[key] = useOptimizedApi<T>(options)
  })

  return results
}

/**
 * Hook for paginated API calls
 */
export function useOptimizedPaginatedApi<T>({
  endpoint,
  initialParams = {},
  pageSize = 20,
  ttl = 5 * 60 * 1000
}: {
  endpoint: string
  initialParams?: Record<string, any>
  pageSize?: number
  ttl?: number
}) {
  const [page, setPage] = useState(1)
  const [allData, setAllData] = useState<T[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const { data, isLoading, error, refetch } = useOptimizedApi<{
    data: T[]
    hasMore: boolean
    total: number
  }>({
    endpoint,
    params: {
      ...initialParams,
      page,
      limit: pageSize
    },
    ttl,
    staleWhileRevalidate: true
  })

  // Update data when API response changes
  useEffect(() => {
    if (data) {
      if (page === 1) {
        setAllData(data.data)
      } else {
        setAllData(prev => [...prev, ...data.data])
      }
      setHasMore(data.hasMore)
    }
  }, [data, page])

  // Load more function
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return

    setIsLoadingMore(true)
    setPage(prev => prev + 1)
    setIsLoadingMore(false)
  }, [hasMore, isLoadingMore])

  // Reset pagination
  const reset = useCallback(() => {
    setPage(1)
    setAllData([])
    setHasMore(true)
  }, [])

  return {
    data: allData,
    isLoading: isLoading && page === 1,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    reset,
    refetch
  }
}

/**
 * Hook for real-time data with WebSocket-like behavior
 */
export function useOptimizedRealtimeApi<T>({
  endpoint,
  params = {},
  ttl = 30 * 1000, // 30 seconds for real-time data
  interval = 10000, // 10 seconds
  enabled = true
}: {
  endpoint: string
  params?: Record<string, any>
  ttl?: number
  interval?: number
  enabled?: boolean
}) {
  const { data, isLoading, error, refetch } = useOptimizedApi<T>({
    endpoint,
    params,
    ttl,
    enabled,
    staleWhileRevalidate: true
  })

  // Set up polling with rate limiting
  useEffect(() => {
    if (!enabled) return

    const intervalId = setInterval(() => {
      // Only refetch if not rate limited
      if (!error || !error.includes('Too many requests')) {
        refetch()
      }
    }, Math.max(interval, 10000)) // Minimum 10 seconds between polls

    return () => clearInterval(intervalId)
  }, [enabled, interval, refetch, error])

  return {
    data,
    isLoading,
    error,
    refetch
  }
}
