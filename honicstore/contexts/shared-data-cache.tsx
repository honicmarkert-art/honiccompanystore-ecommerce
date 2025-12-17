"use client"

import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  key: string
}

interface SharedDataCacheContextType {
  get: <T>(key: string) => T | null
  set: <T>(key: string, data: T, ttl?: number) => void
  clear: (key?: string) => void
  isExpired: (key: string) => boolean
  getStats: () => { totalEntries: number; validEntries: number; expiredEntries: number }
}

const SharedDataCacheContext = createContext<SharedDataCacheContextType | null>(null)

interface SharedDataCacheProviderProps {
  children: React.ReactNode
}

/**
 * Shared Data Cache Provider
 * 
 * Provides cross-page data caching to avoid refetching data when navigating
 */
export function SharedDataCacheProvider({ children }: SharedDataCacheProviderProps) {
  const cache = useRef<Map<string, CacheEntry<any>>>(new Map())
  const pathname = usePathname()

  // Get data from cache
  const get = useCallback(<T,>(key: string): T | null => {
    const entry = cache.current.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      cache.current.delete(key)
      return null
    }

    return entry.data as T
  }, [])

  // Set data in cache
  const set = useCallback(<T,>(key: string, data: T, ttl: number = 10 * 60 * 1000) => {
    cache.current.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      key
    })
  }, [])

  // Clear cache
  const clear = useCallback((key?: string) => {
    if (key) {
      cache.current.delete(key)
    } else {
      cache.current.clear()
    }
  }, [])

  // Check if entry is expired
  const isExpired = useCallback((key: string): boolean => {
    const entry = cache.current.get(key)
    if (!entry) return true

    const now = Date.now()
    return now - entry.timestamp > entry.ttl
  }, [])

  // Get cache statistics
  const getStats = useCallback(() => {
    const now = Date.now()
    let validEntries = 0
    let expiredEntries = 0

    for (const [key, entry] of cache.current.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++
      } else {
        validEntries++
      }
    }

    return {
      totalEntries: cache.current.size,
      validEntries,
      expiredEntries
    }
  }, [])

  // Cleanup expired entries periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of cache.current.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          cache.current.delete(key)
        }
      }
    }, 60000) // Cleanup every minute

    return () => clearInterval(cleanup)
  }, [])

  // Clear cache on route change (optional - for fresh data)
  useEffect(() => {
    // You can choose to clear certain cache entries on route change
    // For now, we'll keep the cache persistent across routes
  }, [pathname])

  const value: SharedDataCacheContextType = {
    get,
    set,
    clear,
    isExpired,
    getStats
  }

  return (
    <SharedDataCacheContext.Provider value={value}>
      {children}
    </SharedDataCacheContext.Provider>
  )
}

/**
 * Hook to use shared data cache
 */
export function useSharedDataCache() {
  const context = useContext(SharedDataCacheContext)
  if (!context) {
    throw new Error('useSharedDataCache must be used within a SharedDataCacheProvider')
  }
  return context
}

/**
 * Hook for caching API responses across pages
 */
export function useApiCache() {
  const cache = useSharedDataCache()

  const getCachedApiResponse = useCallback(<T,>(endpoint: string, params?: Record<string, any>): T | null => {
    const cacheKey = `api:${endpoint}:${JSON.stringify(params || {})}`
    return cache.get<T>(cacheKey)
  }, [cache])

  const setCachedApiResponse = useCallback(<T,>(endpoint: string, data: T, params?: Record<string, any>, ttl?: number) => {
    const cacheKey = `api:${endpoint}:${JSON.stringify(params || {})}`
    cache.set(cacheKey, data, ttl)
  }, [cache])

  const clearApiCache = useCallback((endpoint?: string) => {
    if (endpoint) {
      // Clear all cache entries for this endpoint
      const keysToDelete: string[] = []
      for (const key of cache.getStats().totalEntries) {
        if (key.startsWith(`api:${endpoint}:`)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => cache.clear(key))
    } else {
      // Clear all API cache
      const keysToDelete: string[] = []
      for (const key of cache.getStats().totalEntries) {
        if (key.startsWith('api:')) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => cache.clear(key))
    }
  }, [cache])

  return {
    getCachedApiResponse,
    setCachedApiResponse,
    clearApiCache
  }
}

/**
 * Hook for caching user-specific data
 */
export function useUserDataCache() {
  const cache = useSharedDataCache()

  const getUserData = useCallback(<T,>(userId: string, dataType: string): T | null => {
    const cacheKey = `user:${userId}:${dataType}`
    return cache.get<T>(cacheKey)
  }, [cache])

  const setUserData = useCallback(<T,>(userId: string, dataType: string, data: T, ttl?: number) => {
    const cacheKey = `user:${userId}:${dataType}`
    cache.set(cacheKey, data, ttl)
  }, [cache])

  const clearUserData = useCallback((userId: string, dataType?: string) => {
    if (dataType) {
      const cacheKey = `user:${userId}:${dataType}`
      cache.clear(cacheKey)
    } else {
      // Clear all data for this user
      const keysToDelete: string[] = []
      for (const key of cache.getStats().totalEntries) {
        if (key.startsWith(`user:${userId}:`)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => cache.clear(key))
    }
  }, [cache])

  return {
    getUserData,
    setUserData,
    clearUserData
  }
}

/**
 * Hook for caching page-specific data
 */
export function usePageDataCache() {
  const cache = useSharedDataCache()
  const pathname = usePathname()

  const getPageData = useCallback(<T,>(dataType: string): T | null => {
    const cacheKey = `page:${pathname}:${dataType}`
    return cache.get<T>(cacheKey)
  }, [cache, pathname])

  const setPageData = useCallback(<T,>(dataType: string, data: T, ttl?: number) => {
    const cacheKey = `page:${pathname}:${dataType}`
    cache.set(cacheKey, data, ttl)
  }, [cache, pathname])

  const clearPageData = useCallback((dataType?: string) => {
    if (dataType) {
      const cacheKey = `page:${pathname}:${dataType}`
      cache.clear(cacheKey)
    } else {
      // Clear all data for this page
      const keysToDelete: string[] = []
      for (const key of cache.getStats().totalEntries) {
        if (key.startsWith(`page:${pathname}:`)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => cache.clear(key))
    }
  }, [cache, pathname])

  return {
    getPageData,
    setPageData,
    clearPageData
  }
}
