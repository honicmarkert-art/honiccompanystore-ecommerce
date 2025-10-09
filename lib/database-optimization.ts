/**
 * Database Optimization Utilities
 * 
 * This module provides utilities for optimizing database queries and API responses
 */

// Cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number; ttl: number }>()

// Default TTL values (in milliseconds) - Optimized for better cache hit rates
export const CACHE_TTL = {
  PRODUCTS: 15 * 60 * 1000, // 15 minutes (increased from 5)
  PRODUCT_DETAIL: 30 * 60 * 1000, // 30 minutes for product details (longer TTL)
  CATEGORIES: 60 * 60 * 1000, // 60 minutes (increased from 30)
  ADVERTISEMENTS: 10 * 60 * 1000, // 10 minutes
  SETTINGS: 60 * 60 * 1000, // 1 hour
  USER_PROFILE: 15 * 60 * 1000, // 15 minutes
} as const

/**
 * Get cached data if it exists and is not expired
 */
export function getCachedData<T>(key: string): T | null {
  const cached = apiCache.get(key)
  if (!cached) return null
  
  const now = Date.now()
  if (now - cached.timestamp > cached.ttl) {
    apiCache.delete(key)
    return null
  }
  
  return cached.data as T
}

/**
 * Set data in cache with TTL
 */
export function setCachedData<T>(key: string, data: T, ttl: number = CACHE_TTL.PRODUCTS): void {
  apiCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  })
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
 */
export async function fetchWithCache<T>(
  url: string, 
  options?: RequestInit, 
  cacheKey?: string,
  ttl?: number
): Promise<T> {
  const key = cacheKey || generateCacheKey(url, options?.body ? JSON.parse(options.body as string) : undefined)
  
  // Try to get from cache first
  const cached = getCachedData<T>(key)
  if (cached) {
    return cached
  }
  
  // Fetch from API
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  const data = await response.json()
  
  // Cache the response
  setCachedData(key, data, ttl)
  
  return data
}

/**
 * Clear cache for specific key or all cache
 */
export function clearCache(key?: string): void {
  if (key) {
    apiCache.delete(key)
  } else {
    apiCache.clear()
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const now = Date.now()
  let validEntries = 0
  let expiredEntries = 0
  
  for (const [key, cached] of apiCache.entries()) {
    if (now - cached.timestamp > cached.ttl) {
      expiredEntries++
    } else {
      validEntries++
    }
  }
  
  return {
    totalEntries: apiCache.size,
    validEntries,
    expiredEntries,
    memoryUsage: JSON.stringify(Array.from(apiCache.entries())).length
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
