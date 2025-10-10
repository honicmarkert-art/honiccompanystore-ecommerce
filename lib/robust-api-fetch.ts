"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { logger } from '@/lib/logger'

interface FetchState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  isRateLimited: boolean
}

interface FetchOptions {
  retryDelay?: number
  maxRetries?: number
  rateLimitCooldown?: number
}

/**
 * Robust API fetching hook with:
 * - No infinite requests (prevents re-fetch if already fetching)
 * - Graceful 429 handling (shows friendly error instead of crashing)
 * - Single mount fetch (useEffect with correct deps)
 * - Manual refetch capability
 */
export function useRobustApiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
) {
  const {
    retryDelay = 1000,
    maxRetries = 3,
    rateLimitCooldown = 60000
  } = options

  const [state, setState] = useState<FetchState<T>>({
    data: null,
    isLoading: false,
    error: null,
    isRateLimited: false
  })

  const isFetchingRef = useRef(false)
  const retryCountRef = useRef(0)
  const rateLimitTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Prevent infinite requests - don't fetch if already fetching
    if (isFetchingRef.current && !forceRefresh) {
      logger.log('Already fetching, skipping request')
      return
    }

    // Don't fetch if rate limited
    if (state.isRateLimited && !forceRefresh) {
      logger.log('Rate limited, skipping request')
      return
    }

    try {
      isFetchingRef.current = true
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 429) {
        // Handle 429 gracefully - show friendly error instead of crashing
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Too many requests. Please wait a moment and try again.',
          isRateLimited: true
        }))

        // Set rate limit cooldown
        if (rateLimitTimeoutRef.current) {
          clearTimeout(rateLimitTimeoutRef.current)
        }
        rateLimitTimeoutRef.current = setTimeout(() => {
          setState(prev => ({ ...prev, isRateLimited: false, error: null }))
        }, rateLimitCooldown)

        return
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      logger.log('useRobustApiFetch: Setting data for', endpoint, data)
      
      setState({
        data,
        isLoading: false,
        error: null,
        isRateLimited: false
      })

      // Reset retry count on success
      retryCountRef.current = 0

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data'
      
      // Retry logic for non-429 errors
      if (retryCountRef.current < maxRetries && !state.isRateLimited) {
        retryCountRef.current++
        logger.log(`Retrying fetch (attempt ${retryCountRef.current}/${maxRetries})`)
        
        setTimeout(() => {
          fetchData(true) // Force refresh for retry
        }, retryDelay * retryCountRef.current) // Exponential backoff
        
        return
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        isRateLimited: false
      }))
    } finally {
      isFetchingRef.current = false
    }
  }, [endpoint, retryDelay, maxRetries, rateLimitCooldown])

  const refetch = useCallback(() => {
    retryCountRef.current = 0
    fetchData(true)
  }, [fetchData])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Fetch data on mount
  useEffect(() => {
    logger.log('useRobustApiFetch useEffect:', {
      endpoint,
      hasData: !!state.data,
      isLoading: state.isLoading,
      isFetching: isFetchingRef.current
    })
    
    if (!state.data && !state.isLoading && !isFetchingRef.current) {
      logger.log('useRobustApiFetch: Triggering fetch for', endpoint)
      fetchData()
    }
  }, [endpoint]) // Only depend on endpoint to avoid infinite loops

  return {
    ...state,
    refetch,
    clearError,
    isFetching: isFetchingRef.current
  }
}

/**
 * Hook for fetching data once on mount with proper dependencies
 */
export function useFetchOnce<T>(
  endpoint: string,
  options: FetchOptions = {}
) {
  const fetchResult = useRobustApiFetch<T>(endpoint, options)
  const hasFetchedRef = useRef(false)

  const fetchOnce = useCallback(() => {
    if (!hasFetchedRef.current && !fetchResult.isLoading && !fetchResult.data) {
      hasFetchedRef.current = true
      fetchResult.refetch()
    }
  }, [fetchResult])

  return {
    ...fetchResult,
    fetchOnce
  }
}

/**
 * Hook for cached API calls with automatic cache invalidation
 */
export function useCachedApiFetch<T>(
  endpoint: string,
  cacheKey: string,
  cacheTTL: number = 5 * 60 * 1000, // 5 minutes default
  options: FetchOptions = {}
) {
  const fetchResult = useRobustApiFetch<T>(endpoint, options)
  const [cacheTimestamp, setCacheTimestamp] = useState<number>(0)

  const isCacheValid = useCallback(() => {
    const now = Date.now()
    return cacheTimestamp > 0 && (now - cacheTimestamp) < cacheTTL
  }, [cacheTimestamp, cacheTTL])

  const fetchWithCache = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh && isCacheValid()) {
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData)
          setState(prev => ({ ...prev, data: parsedData, isLoading: false, error: null }))
          return
        } catch (error) {
          console.warn('Failed to parse cached data:', error)
        }
      }
    }

    // Fetch fresh data
    await fetchResult.refetch()
    
    // Update cache if successful
    if (fetchResult.data && !fetchResult.error) {
      localStorage.setItem(cacheKey, JSON.stringify(fetchResult.data))
      setCacheTimestamp(Date.now())
    }
  }, [cacheKey, isCacheValid, fetchResult])

  return {
    ...fetchResult,
    fetchWithCache,
    isCacheValid: isCacheValid()
  }
}

