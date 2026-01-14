/**
 * Popular Products Cache
 * Production-grade: AliExpress-style popular products cache
 * 
 * Serves popular products without hitting database using multi-layer caching:
 * - CDN Cache (Cloudflare): 2 hours
 * - Server Cache (Redis/In-Memory): 1 hour
 * - Browser Cache: 1 hour
 * 
 * This cache stores frequently accessed products (by views, sales, ratings)
 * and serves them instantly without database queries.
 */

import { getCachedData, setCachedData, CACHE_TTL } from './database-optimization'
import { logger } from '@/lib/logger'
import { performanceMonitor } from '@/lib/performance-monitor'
import { cacheMonitor } from './cache-monitoring'

const POPULAR_PRODUCTS_NAMESPACE = 'products'
const POPULAR_PRODUCTS_KEY = 'popular_list'
const POPULAR_PRODUCTS_TTL = CACHE_TTL.POPULAR_PRODUCTS // 1 hour - AliExpress-style: popular products cached longer (no DB hit)

// Production-grade popularity thresholds (configurable)
const POPULAR_THRESHOLD = {
  MIN_VIEWS: 100,      // Minimum views to be considered popular
  MIN_SALES: 10,       // Minimum sales count
  MIN_RATING: 4.0,     // Minimum rating
  MIN_REVIEWS: 5       // Minimum reviews
} as const

interface PopularProduct {
  id: number
  name: string
  price: number
  image: string
  rating: number
  reviews: number
  sold_count: number
  views?: number
}

/**
 * Check if products list matches popular products criteria
 * (no search, no filters, default sort, first page)
 */
export function isPopularProductsRequest(params: {
  search?: string
  category?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  sortBy?: string
  sortOrder?: string
  offset?: number
}): boolean {
  // Popular products are: no search, no filters, default sort, first page
  return (
    !params.search &&
    !params.category &&
    !params.brand &&
    !params.minPrice &&
    !params.maxPrice &&
    (params.sortBy === 'created_at' || !params.sortBy) &&
    (params.sortOrder === 'desc' || !params.sortOrder) &&
    (!params.offset || params.offset === 0)
  )
}

/**
 * Get popular products from cache (no database hit)
 * Production-ready with error handling and monitoring
 */
export function getPopularProductsFromCache(): PopularProduct[] | null {
  const startTime = Date.now()
  
  try {
    const cached = getCachedData<PopularProduct[]>(POPULAR_PRODUCTS_KEY)
    
    if (cached && Array.isArray(cached) && cached.length > 0) {
      const duration = Date.now() - startTime
      cacheMonitor.recordHit('popular_products', duration)
      performanceMonitor.recordMetric('popular_products_cache_hit', duration, {
        count: cached.length,
        source: 'cache'
      })
      logger.log(`[Popular Cache] Hit: ${cached.length} products served from cache (${duration}ms)`)
      return cached
    }
    
    const duration = Date.now() - startTime
    cacheMonitor.recordMiss('popular_products', duration)
    performanceMonitor.recordMetric('popular_products_cache_miss', duration, { source: 'cache' })
    return null
  } catch (error: any) {
    const err = error instanceof Error ? error : new Error(String(error))
    cacheMonitor.recordError('popular_products', err)
    logger.error('[Popular Cache] Error getting popular products from cache:', error)
    performanceMonitor.recordMetric('popular_products_cache_error', Date.now() - startTime, {
      error: error.message
    })
    return null
  }
}

/**
 * Store popular products in cache
 * Production-ready with validation and monitoring
 */
export function setPopularProductsCache(products: PopularProduct[]): void {
  try {
    // Validate input
    if (!Array.isArray(products)) {
      logger.error('[Popular Cache] Invalid products array provided')
      return
    }

    if (products.length === 0) {
      logger.warn('[Popular Cache] Attempted to cache empty products array')
      return
    }

    // Validate product structure
    const validProducts = products.filter(p => {
      return (
        typeof p.id === 'number' &&
        typeof p.name === 'string' &&
        typeof p.price === 'number' &&
        p.price >= 0
      )
    })

    if (validProducts.length !== products.length) {
      logger.warn(`[Popular Cache] Filtered ${products.length - validProducts.length} invalid products`)
    }

    if (validProducts.length === 0) {
      logger.warn('[Popular Cache] No valid products to cache')
      return
    }

    // Store in cache
    setCachedData(POPULAR_PRODUCTS_KEY, validProducts, POPULAR_PRODUCTS_TTL)
    
    logger.log(`[Popular Cache] Cached ${validProducts.length} popular products (TTL: ${POPULAR_PRODUCTS_TTL / 1000 / 60} minutes)`)
    performanceMonitor.recordMetric('popular_products_cache_set', 0, {
      count: validProducts.length
    })
  } catch (error: any) {
    logger.error('[Popular Cache] Error setting popular products cache:', error)
    performanceMonitor.recordMetric('popular_products_cache_set_error', 0, {
      error: error.message
    })
  }
}

/**
 * Check if a product qualifies as "popular"
 * Production-ready with type safety and validation
 */
export function isPopularProduct(product: any): boolean {
  try {
    if (!product || typeof product !== 'object') {
      return false
    }

    const views = Number(product.views || product.view_count || 0)
    const sales = Number(product.sold_count || 0)
    const rating = Number(product.rating || 0)
    const reviews = Number(product.reviews || product.review_count || 0)

    // Validate numeric values
    if (!Number.isFinite(views) || !Number.isFinite(sales) || 
        !Number.isFinite(rating) || !Number.isFinite(reviews)) {
      return false
    }

    // Check popularity criteria
    return (
      views >= POPULAR_THRESHOLD.MIN_VIEWS ||
      sales >= POPULAR_THRESHOLD.MIN_SALES ||
      (rating >= POPULAR_THRESHOLD.MIN_RATING && reviews >= POPULAR_THRESHOLD.MIN_REVIEWS)
    )
  } catch (error: any) {
    logger.error('[Popular Cache] Error checking product popularity:', error)
    return false
  }
}

/**
 * Calculate popularity score for sorting
 * Production-ready scoring algorithm
 */
export function calculatePopularityScore(product: any): number {
  try {
    const views = Number(product.views || product.view_count || 0)
    const sales = Number(product.sold_count || 0)
    const rating = Number(product.rating || 0)
    const reviews = Number(product.reviews || product.review_count || 0)

    // Weighted scoring: sales (10x) > rating (5x) > reviews (1x) > views (0.1x)
    const score = 
      (sales * 10) +
      (rating * 5) +
      (reviews * 1) +
      (views * 0.1)

    return Number.isFinite(score) ? score : 0
  } catch (error: any) {
    logger.error('[Popular Cache] Error calculating popularity score:', error)
    return 0
  }
}

/**
 * Clear popular products cache (call when products are updated)
 * Production-ready with logging and monitoring
 */
export async function clearPopularProductsCache(): Promise<void> {
  try {
    const { clearCache } = await import('./database-optimization')
    clearCache(POPULAR_PRODUCTS_KEY)
    logger.log('[Popular Cache] Cleared popular products cache')
    performanceMonitor.recordMetric('popular_products_cache_cleared', 0)
  } catch (error: any) {
    logger.error('[Popular Cache] Error clearing cache:', error)
    performanceMonitor.recordMetric('popular_products_cache_clear_error', 0, {
      error: error.message
    })
  }
}

/**
 * Get popular products cache statistics
 * Production-ready with proper error handling
 */
export async function getPopularProductsCacheStats() {
  try {
    const { getCacheStats } = await import('./database-optimization')
    const stats = getCacheStats()
    
    return {
      ...stats,
      popularProductsKey: POPULAR_PRODUCTS_KEY,
      ttl: POPULAR_PRODUCTS_TTL / 1000 / 60, // minutes
      threshold: POPULAR_THRESHOLD
    }
  } catch (error: any) {
    logger.error('[Popular Cache] Error getting cache stats:', error)
    return null
  }
}
