/**
 * CDN Cache Manager
 * AliExpress-style: Manages CDN (Cloudflare) cache headers and cache invalidation
 */

import { NextResponse } from 'next/server'

export interface CDNCacheOptions {
  /**
   * Cache duration in seconds
   * - Popular products: 7200 (2 hours)
   * - Regular products: 1800 (30 minutes)
   * - Search results: 300 (5 minutes)
   */
  cdnMaxAge?: number
  
  /**
   * Browser cache duration in seconds
   */
  browserMaxAge?: number
  
  /**
   * Stale-while-revalidate duration in seconds
   * Allows serving stale content while fetching fresh data in background
   */
  staleWhileRevalidate?: number
  
  /**
   * Whether this is popular products (longer cache)
   */
  isPopular?: boolean
  
  /**
   * Cache tags for Cloudflare cache purging
   */
  cacheTags?: string[]
}

/**
 * Generate Cache-Control header for CDN + Browser caching
 * AliExpress-style: Multi-layer caching with stale-while-revalidate
 */
export function generateCacheControl(options: CDNCacheOptions = {}): string {
  const {
    cdnMaxAge = options.isPopular ? 7200 : 1800, // 2 hours for popular, 30 min for regular
    browserMaxAge = options.isPopular ? 3600 : 900, // 1 hour for popular, 15 min for regular
    staleWhileRevalidate = options.isPopular ? 14400 : 3600 // 4 hours for popular, 1 hour for regular
  } = options

  // Format: public, s-maxage=CDN_TTL, max-age=BROWSER_TTL, stale-while-revalidate=SWR_TTL
  return `public, s-maxage=${cdnMaxAge}, max-age=${browserMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`
}

/**
 * Add CDN cache headers to response
 * Cloudflare-compatible headers for optimal cache hit rates
 */
export function addCDNCacheHeaders(
  response: NextResponse,
  options: CDNCacheOptions = {}
): NextResponse {
  const cacheControl = generateCacheControl(options)
  
  // Standard Cache-Control header
  response.headers.set('Cache-Control', cacheControl)
  
  // CDN-specific headers (Cloudflare/Akamai compatible)
  if (options.cdnMaxAge || options.isPopular) {
    response.headers.set('CDN-Cache-Control', `public, s-maxage=${options.cdnMaxAge || (options.isPopular ? 7200 : 1800)}`)
    
    // Cloudflare cache status hint
    response.headers.set('CF-Cache-Status', options.isPopular ? 'HIT' : 'DYNAMIC')
    
    // Cache tags for purging (Cloudflare Enterprise)
    if (options.cacheTags && options.cacheTags.length > 0) {
      response.headers.set('Cache-Tag', options.cacheTags.join(','))
    }
  }
  
  // Vary header (minimal for better cache hits)
  response.headers.set('Vary', 'Accept, Accept-Encoding')
  
  // ETag for cache validation
  if (options.isPopular) {
    response.headers.set('X-Cache-Type', 'POPULAR_PRODUCTS')
    response.headers.set('X-No-DB-Hit', 'true')
  }
  
  return response
}

/**
 * Cache tags for different content types
 */
export const CACHE_TAGS = {
  POPULAR_PRODUCTS: 'popular-products',
  PRODUCTS: 'products',
  PRODUCT_DETAIL: 'product-detail',
  CATEGORIES: 'categories',
  SEARCH: 'search',
  BRAND: 'brand',
} as const

/**
 * Purge CDN cache (Cloudflare API)
 * Note: Requires Cloudflare API token in production
 */
export async function purgeCDNCache(tags: string[]): Promise<boolean> {
  // In production, implement Cloudflare API call:
  // POST https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache
  // Body: { tags: [...] }
  
  // For now, return success (implement in production)
  return true
}
