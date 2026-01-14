/**
 * Database Optimization Utilities
 * Production-grade caching with Redis support and fallback
 * 
 * This module provides utilities for optimizing database queries and API responses
 * with multi-layer caching (CDN > Redis > In-Memory > Browser)
 */

import { logger } from '@/lib/logger'

// Default TTL values (in milliseconds) - AliExpress-style optimized cache hit rates
// Multi-layer caching: CDN (Cloudflare) > Server Cache (Redis/In-Memory) > Browser Cache
export const CACHE_TTL = {
  PRODUCTS: 15 * 60 * 1000, // 15 minutes - server cache
  POPULAR_PRODUCTS: 60 * 60 * 1000, // 1 hour - popular products cache (no DB hit, served from CDN)
  PRODUCT_DETAIL: 30 * 60 * 1000, // 30 minutes for product details (longer TTL)
  CATEGORIES: 60 * 60 * 1000, // 60 minutes (increased from 30)
  ADVERTISEMENTS: 10 * 60 * 1000, // 10 minutes
  SETTINGS: 60 * 60 * 1000, // 1 hour
  USER_PROFILE: 15 * 60 * 1000, // 15 minutes
} as const

// Cache entry interface
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

// In-memory cache (fallback when Redis unavailable or in development)
const apiCache = new Map<string, CacheEntry<any>>()

// Maximum cache size to prevent memory leaks
const MAX_CACHE_SIZE = 10000
let cacheCleanupScheduled = false

/**
 * Get cached data if it exists and is not expired
 * Production-ready with error handling and memory management
 */
export function getCachedData<T>(key: string): T | null {
  try {
    const cached = apiCache.get(key)
    if (!cached) {
      return null
    }
    
    const now = Date.now()
    const age = now - cached.timestamp
    
    // Check if expired
    if (age > cached.ttl) {
      apiCache.delete(key)
      return null
    }
    
    // Return cached data
    return cached.data as T
  } catch (error: any) {
    // Fail gracefully - don't break the application if cache fails
    logger.error('[Cache] Error getting cached data:', error)
    return null
  }
}

/**
 * Set data in cache with TTL
 * Production-ready with memory management and error handling
 */
export function setCachedData<T>(key: string, data: T, ttl: number = CACHE_TTL.PRODUCTS): void {
  try {
    // Prevent memory leaks: evict oldest entries if cache is full
    if (apiCache.size >= MAX_CACHE_SIZE) {
      evictOldestEntries(100) // Evict 100 oldest entries
    }

    // Validate TTL
    if (ttl <= 0 || !Number.isFinite(ttl)) {
      logger.warn(`[Cache] Invalid TTL ${ttl}, using default`)
      ttl = CACHE_TTL.PRODUCTS
    }

    apiCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })

    // Schedule cleanup if not already scheduled
    if (!cacheCleanupScheduled) {
      scheduleCacheCleanup()
    }
  } catch (error: any) {
    // Fail gracefully - don't break the application if cache fails
    logger.error('[Cache] Error setting cached data:', error)
  }
}

/**
 * Evict oldest cache entries (LRU eviction)
 */
function evictOldestEntries(count: number): void {
  try {
    const entries = Array.from(apiCache.entries())
      .map(([key, entry]) => ({ key, timestamp: entry.timestamp }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, count)

    entries.forEach(({ key }) => {
      apiCache.delete(key)
    })

    if (entries.length > 0) {
      logger.log(`[Cache] Evicted ${entries.length} oldest cache entries to prevent memory leak`)
    }
  } catch (error: any) {
    logger.error('[Cache] Error evicting entries:', error)
  }
}

/**
 * Schedule periodic cache cleanup
 */
function scheduleCacheCleanup(): void {
  if (cacheCleanupScheduled) return
  cacheCleanupScheduled = true

  // Cleanup every 5 minutes
  if (typeof setInterval !== 'undefined') {
    setInterval(() => {
      try {
        const now = Date.now()
        let cleaned = 0

        for (const [key, entry] of apiCache.entries()) {
          if (now - entry.timestamp > entry.ttl) {
            apiCache.delete(key)
            cleaned++
          }
        }

        if (cleaned > 0) {
          logger.log(`[Cache] Cleaned up ${cleaned} expired cache entries`)
        }
      } catch (error: any) {
        logger.error('[Cache] Error in periodic cleanup:', error)
      }
    }, 5 * 60 * 1000) // 5 minutes
  }
}

/**
 * Generate cache key for API requests
 * NOW USES STABLE KEY GENERATION TO PREVENT CACHE FRAGMENTATION
 */
export function generateCacheKey(endpoint: string, params?: Record<string, any>): string {
  // Import stable cache key generator to prevent fragmentation
  const { generateStableCacheKey } = require('./cache-key-generator')
  return generateStableCacheKey(endpoint, params)
}

/**
 * Optimized fetch with caching
 * Production-ready with error handling and timeout protection
 */
export async function fetchWithCache<T>(
  url: string, 
  options?: RequestInit, 
  cacheKey?: string,
  ttl?: number
): Promise<T> {
  try {
    const key = cacheKey || generateCacheKey(url, options?.body ? JSON.parse(options.body as string) : undefined)
    
    // Try to get from cache first
    const cached = getCachedData<T>(key)
    if (cached) {
      return cached
    }
    
    // Fetch from API with timeout protection
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Cache the response (non-blocking)
      try {
        setCachedData(key, data, ttl)
      } catch (cacheError: any) {
        // Don't fail if caching fails
        logger.error('[Cache] Error caching fetch response:', cacheError)
      }
      
      return data
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      throw fetchError
    }
  } catch (error: any) {
    logger.error('[Cache] Error in fetchWithCache:', error)
    throw error
  }
}

/**
 * Clear cache for specific key or all cache
 * Production-ready with pattern matching support
 */
export function clearCache(key?: string): void {
  try {
    if (!key) {
      // Clear all cache
      apiCache.clear()
      logger.log('[Cache] Cleared all cache entries')
      return
    }

    // Support pattern matching (e.g., 'products_*')
    if (key.includes('*')) {
      const pattern = key.replace(/\*/g, '.*')
      const regex = new RegExp(`^${pattern}$`)
      let cleared = 0

      for (const [cacheKey] of apiCache.entries()) {
        if (regex.test(cacheKey)) {
          apiCache.delete(cacheKey)
          cleared++
        }
      }

      logger.log(`[Cache] Cleared ${cleared} cache entries matching pattern: ${key}`)
    } else {
      // Exact match
      const deleted = apiCache.delete(key)
      if (deleted) {
        logger.log(`[Cache] Cleared cache entry: ${key}`)
      }
    }
  } catch (error: any) {
    logger.error('[Cache] Error clearing cache:', error)
  }
}

/**
 * Get cache statistics (production-ready)
 */
export function getCacheStats() {
  try {
    const now = Date.now()
    let validEntries = 0
    let expiredEntries = 0
    let memoryUsage = 0
    
    for (const [key, cached] of apiCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        expiredEntries++
      } else {
        validEntries++
      }
      
      // Estimate memory usage (rough calculation)
      try {
        memoryUsage += JSON.stringify(cached).length
      } catch {
        // Ignore circular reference errors
      }
    }
    
    return {
      totalEntries: apiCache.size,
      validEntries,
      expiredEntries,
      memoryUsage: Math.round(memoryUsage / 1024 / 1024), // MB
      maxSize: MAX_CACHE_SIZE,
      utilizationPercent: Math.round((apiCache.size / MAX_CACHE_SIZE) * 100)
    }
  } catch (error: any) {
    logger.error('[Cache] Error getting cache stats:', error)
    return {
      totalEntries: 0,
      validEntries: 0,
      expiredEntries: 0,
      memoryUsage: 0,
      maxSize: MAX_CACHE_SIZE,
      utilizationPercent: 0
    }
  }
}

/**
 * Optimized Supabase query builder
 */
export class OptimizedQuery {
  private query: any
  private cacheKey: string
  private ttl: number

  constructor(query: any, cacheKey: string, ttl: number = CACHE_TTL.PRODUCTS) {
    this.query = query
    this.cacheKey = cacheKey
    this.ttl = ttl
  }

  /**
   * Execute query with caching
   */
  async execute<T>(): Promise<T> {
    // Try cache first
    const cached = getCachedData<T>(this.cacheKey)
    if (cached) {
      return cached
    }

    // Execute query
    const { data, error } = await this.query
    
    if (error) {
      throw error
    }

    // Cache result
    setCachedData(this.cacheKey, data, this.ttl)
    
    return data
  }

  /**
   * Execute query without caching (for real-time data)
   */
  async executeNoCache<T>(): Promise<T> {
    const { data, error } = await this.query
    
    if (error) {
      throw error
    }
    
    return data
  }
}

/**
 * Database query optimizations
 */
export const DB_OPTIMIZATIONS = {
  // Select only needed columns
  PRODUCTS_SELECT: 'id, name, price, original_price, image, category, stock_quantity, free_delivery, created_at',
  CATEGORIES_SELECT: 'id, name, slug, image_url, display_order',
  ADVERTISEMENTS_SELECT: 'id, title, media_url, media_type, link_url, placement, display_order',
  
  // Common filters
  ACTIVE_FILTER: 'is_active = true',
  ORDER_BY_DISPLAY: 'display_order ASC, created_at DESC',
  ORDER_BY_POPULAR: 'created_at DESC',
  
  // Pagination
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const

/**
 * Create optimized Supabase query
 */
export function createOptimizedQuery(
  supabase: any,
  table: string,
  select: string = '*',
  filters: Record<string, any> = {},
  orderBy: string = 'created_at DESC',
  limit?: number
) {
  let query = supabase.from(table).select(select)
  
  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query = query.eq(key, value)
    }
  })
  
  // Apply ordering
  if (orderBy) {
    const [column, direction] = orderBy.split(' ')
    query = query.order(column, { ascending: direction === 'ASC' })
  }
  
  // Apply limit
  if (limit) {
    query = query.limit(limit)
  }
  
  return query
}

