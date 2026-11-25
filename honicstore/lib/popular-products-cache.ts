/**
 * Helpers for the "popular products" listing (no search, no filters, default sort, first page).
 * The old dedicated popular-products cache was never written to and has been removed; the products
 * API uses the shared in-memory cache (lib/database-optimization) and CDN headers instead.
 */

/** True for the default first page of the product list, the most common request. */
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

/** Shared server cache statistics, for the internal /api/health/cache endpoint. */
export async function getPopularProductsCacheStats() {
  try {
    const { getCacheStats } = await import('./database-optimization')
    return getCacheStats()
  } catch {
    return null
  }
}
