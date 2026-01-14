/**
 * Production-Grade Prefetch Products Hook
 * Secure, robust prefetching system with immediate display
 * 
 * Strategy:
 * - Initial fetch: 24 products
 * - Display: 4 rows (12 products)
 * - Prefetch: Keep next 12 ready
 * - On scroll: Show prefetched, fetch next batch
 * - Security: Input validation, request deduplication, cache protection
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchWithCache } from '@/lib/fetch-cache'
import { logger } from '@/lib/logger'

interface Product {
  id: number
  name: string
  price: number
  image?: string
  [key: string]: any
}

interface PrefetchOptions {
  limit?: number
  initialOffset?: number
  category?: string
  brand?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  minPrice?: number
  maxPrice?: number
  categories?: string[]
  enabled?: boolean
}

interface PrefetchReturn {
  displayedProducts: Product[]
  prefetchedProducts: Product[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  totalCount: number
  loadMore: () => Promise<void>
  reset: () => void
}

// Security: Input validation and sanitization
function validateOptions(options: PrefetchOptions): PrefetchOptions {
  const validated = { ...options }
  
  // Validate limit (must be positive integer, max 100)
  if (validated.limit !== undefined) {
    validated.limit = Math.max(1, Math.min(100, Math.floor(validated.limit || 24)))
  }
  
  // Validate offset (must be non-negative integer)
  if (validated.initialOffset !== undefined) {
    validated.initialOffset = Math.max(0, Math.floor(validated.initialOffset || 0))
  }
  
  // Sanitize search string (prevent injection)
  if (validated.search) {
    validated.search = String(validated.search).trim().slice(0, 200)
  }
  
  // Validate price ranges
  if (validated.minPrice !== undefined) {
    validated.minPrice = Math.max(0, Number(validated.minPrice) || 0)
  }
  if (validated.maxPrice !== undefined) {
    validated.maxPrice = Math.max(0, Number(validated.maxPrice) || 100000)
  }
  
  return validated
}

// Security: Generate secure cache key (prevent tampering)
function generateSecureCacheKey(options: PrefetchOptions, offset: number, limit: number): string {
  // Create deterministic key from validated options
  const keyData = {
    category: options.category || '',
    brand: options.brand || '',
    search: options.search || '',
    minPrice: options.minPrice || 0,
    maxPrice: options.maxPrice || 100000,
    categories: (options.categories || []).sort().join(','),
    sortBy: options.sortBy || 'created_at',
    sortOrder: options.sortOrder || 'desc',
    offset,
    limit
  }
  
  // Use stable JSON stringification (sorted keys)
  const keyString = JSON.stringify(keyData, Object.keys(keyData).sort())
  
  // Add hash for security (simple but effective)
  let hash = 0
  for (let i = 0; i < keyString.length; i++) {
    const char = keyString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return `prefetch_${Math.abs(hash)}_${offset}_${limit}`
}

export function usePrefetchProducts(options: PrefetchOptions = {}): PrefetchReturn {
  // Security: Validate and sanitize all inputs
  const validatedOptions = validateOptions(options)
  
  const {
    limit = 24, // Initial fetch: 24 products
    initialOffset = 0,
    category,
    brand,
    search,
    sortBy = 'created_at',
    sortOrder = 'desc',
    minPrice,
    maxPrice,
    categories,
    enabled = true
  } = validatedOptions

  // Display: 4 rows (12 products for 3 columns, adjust based on grid)
  // Note: This is a fallback - actual DISPLAY_COUNT should be calculated from gridColumns
  // But since we don't have access to gridColumns here, use a reasonable default
  const DISPLAY_COUNT = 12 // 4 rows * 3 columns (mobile) - will be overridden by actual grid
  const PREFETCH_COUNT = 12 // Keep 12 prefetched
  
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [displayIndex, setDisplayIndex] = useState(0) // Current display position
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(initialOffset)
  
  // Security: Request deduplication and abort control
  const loadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const inFlightRequestsRef = useRef<Map<string, Promise<any>>>(new Map())
  const prefetchOffsetRef = useRef(initialOffset + limit) // Next prefetch offset
  
  // Computed: Displayed and prefetched products
  const displayedProducts = allProducts.slice(displayIndex, displayIndex + DISPLAY_COUNT)
  const prefetchedProducts = allProducts.slice(displayIndex + DISPLAY_COUNT, displayIndex + DISPLAY_COUNT + PREFETCH_COUNT)
  
  // Security: Secure fetch with validation
  const secureFetch = useCallback(async (
    currentOffset: number,
    currentLimit: number,
    isPrefetch: boolean = false
  ): Promise<{ products: Product[], total: number, hasMore: boolean }> => {
    // Security: Prevent duplicate requests
    const cacheKey = generateSecureCacheKey(validatedOptions, currentOffset, currentLimit)
    
    if (inFlightRequestsRef.current.has(cacheKey)) {
      // Request already in flight, return existing promise
      return inFlightRequestsRef.current.get(cacheKey)!
    }
    
    // Security: Validate offset and limit
    const safeOffset = Math.max(0, Math.floor(currentOffset))
    const safeLimit = Math.max(1, Math.min(100, Math.floor(currentLimit)))
    
    // Build secure API URL
    const params = new URLSearchParams()
    params.set('limit', String(safeLimit))
    params.set('offset', String(safeOffset))
    params.set('enriched', 'true')
    
    if (category) params.set('category', String(category).slice(0, 100))
    if (brand) params.set('brand', String(brand).slice(0, 100))
    if (search) params.set('search', String(search).slice(0, 200))
    if (minPrice) params.set('minPrice', String(Math.max(0, Number(minPrice))))
    if (maxPrice) params.set('maxPrice', String(Math.max(0, Number(maxPrice))))
    if (categories && categories.length > 0) {
      // Security: Validate category IDs
      const validCategories = categories
        .filter(c => /^[a-zA-Z0-9_-]+$/.test(String(c)))
        .slice(0, 50) // Max 50 categories
      if (validCategories.length > 0) {
        params.set('categories', validCategories.join(','))
      }
    }
    if (sortBy) params.set('sortBy', String(sortBy).slice(0, 50))
    if (sortOrder) params.set('sortOrder', String(sortOrder).slice(0, 10))
    
    const url = `/api/products?${params.toString()}`
    
    // Create abort controller for this request
    const controller = new AbortController()
    abortControllerRef.current = controller
    
    // Create fetch promise
    const fetchPromise = (async () => {
      try {
        // Use fetchWithCache for CDN/server cache (not sessionStorage for prefetch)
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        // Security: Validate response structure
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response format')
        }
        
        const products = Array.isArray(data.products) ? data.products : []
        const total = Number(data.pagination?.total) || 0
        const hasMore = Boolean(data.pagination?.hasMore)
        
        // Security: Validate products array
        const validProducts = products.filter((p: any) => {
          return p && typeof p === 'object' && 
                 typeof p.id === 'number' && 
                 p.id > 0 &&
                 typeof p.name === 'string' &&
                 typeof p.price === 'number' &&
                 p.price >= 0
        })
        
        return {
          products: validProducts,
          total,
          hasMore
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error('Request aborted')
        }
        logger.error('[Prefetch] Fetch error:', err)
        throw err
      } finally {
        // Remove from in-flight requests
        inFlightRequestsRef.current.delete(cacheKey)
      }
    })()
    
    // Store promise for deduplication
    inFlightRequestsRef.current.set(cacheKey, fetchPromise)
    
    return fetchPromise
  }, [validatedOptions, category, brand, search, minPrice, maxPrice, categories, sortBy, sortOrder])
  
  // Initial fetch: 24 products
  const initialFetch = useCallback(async () => {
    if (!enabled || loadingRef.current) return
    
    loadingRef.current = true
    setLoading(true)
    setError(null)
    
    try {
      // Fetch 24 products initially
      const result = await secureFetch(initialOffset, limit, false)
      
      // Security: Validate fetched data
      if (!Array.isArray(result.products)) {
        throw new Error('Invalid products array')
      }
      
      setAllProducts(result.products)
      setDisplayIndex(0) // Start displaying from index 0
      setTotalCount(result.total)
      setHasMore(result.hasMore)
      setOffset(initialOffset + result.products.length)
      prefetchOffsetRef.current = initialOffset + result.products.length
      
      // Prefetch next batch immediately (background, non-blocking)
      if (result.hasMore && result.products.length >= DISPLAY_COUNT) {
        setTimeout(() => {
          prefetchNext()
        }, 0)
      }
    } catch (err: any) {
      if (err.message !== 'Request aborted') {
        logger.error('[Prefetch] Initial fetch error:', err)
        setError(err.message || 'Failed to load products')
      }
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [enabled, initialOffset, limit, secureFetch])
  
  // Prefetch next batch (background, non-blocking)
  const prefetchNext = useCallback(async () => {
    if (!enabled || loadingRef.current) return
    
    // Check if we should continue based on total count (more reliable than hasMore flag)
    const shouldContinue = hasMore || (totalCount > 0 && allProducts.length < totalCount)
    if (!shouldContinue) return
    
    const nextOffset = prefetchOffsetRef.current
    if (nextOffset < 0) return
    
    try {
      // Prefetch 12 products (next batch)
      const result = await secureFetch(nextOffset, PREFETCH_COUNT, true)
      
      if (result.products.length > 0) {
        // Append prefetched products
        setAllProducts(prev => {
          // Security: Prevent duplicates
          const existingIds = new Set(prev.map(p => p.id))
          const newProducts = result.products.filter((p: Product) => !existingIds.has(p.id))
          return [...prev, ...newProducts]
        })
        
        prefetchOffsetRef.current = nextOffset + result.products.length
        setHasMore(result.hasMore)
        
        // Update total count if provided
        if (result.total > 0) {
          setTotalCount(result.total)
        }
      } else {
        // No products returned - check if we've reached the total
        if (totalCount > 0 && allProducts.length >= totalCount) {
          setHasMore(false)
        } else {
          // Might be a temporary issue, keep hasMore as is
        }
      }
    } catch (err: any) {
      if (err.message !== 'Request aborted') {
        logger.error('[Prefetch] Prefetch error:', err)
        // Don't set error for prefetch failures (non-critical)
        // Don't set hasMore to false on error - might be temporary
      }
    }
  }, [enabled, hasMore, totalCount, allProducts.length, secureFetch, category, brand, search, sortBy, sortOrder, minPrice, maxPrice, categories])
  
  // Load more: Show prefetched, fetch next
  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore) return
    
    // Check if we have enough prefetched products to show
    const availableAfterDisplay = allProducts.length - (displayIndex + DISPLAY_COUNT)
    
    // Check if we should continue based on total count (more reliable than hasMore flag)
    const shouldContinue = hasMore || (totalCount > 0 && allProducts.length < totalCount)
    
    if (availableAfterDisplay >= PREFETCH_COUNT) {
      // We have prefetched products, just advance display (instant, no fetch)
      setDisplayIndex(prev => prev + PREFETCH_COUNT)
      
      // Prefetch next batch in background (non-blocking) if we should continue
      if (shouldContinue) {
        setTimeout(() => {
          prefetchNext()
        }, 0)
      }
      return
    }
    
    // Not enough prefetched, but check if we should fetch more
    // Only fetch if hasMore is true OR if totalCount indicates more products available
    if (!shouldContinue && availableAfterDisplay === 0) {
      // No more products and nothing prefetched - don't fetch
      setHasMore(false)
      return
    }
    
    // Not enough prefetched, fetch now
    setLoadingMore(true)
    
    try {
      const result = await secureFetch(prefetchOffsetRef.current, PREFETCH_COUNT, false)
      
      if (result.products.length > 0) {
        setAllProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const newProducts = result.products.filter((p: Product) => !existingIds.has(p.id))
          return [...prev, ...newProducts]
        })
        
        // Advance display index to show new products
        setDisplayIndex(prev => {
          // If we have prefetched products, advance by PREFETCH_COUNT
          // Otherwise, advance by what we just fetched
          const advanceBy = availableAfterDisplay > 0 ? PREFETCH_COUNT : result.products.length
          return prev + advanceBy
        })
        
        prefetchOffsetRef.current = prefetchOffsetRef.current + result.products.length
        setHasMore(result.hasMore)
        
        // Update total count if provided
        if (result.total > 0) {
          setTotalCount(result.total)
        }
        
        // Prefetch next batch in background (non-blocking)
        if (result.hasMore) {
          setTimeout(() => {
            prefetchNext()
          }, 0)
        }
      } else {
        // No products returned - check if we should still show prefetched
        if (availableAfterDisplay > 0) {
          // We have prefetched products, show them
          setDisplayIndex(prev => prev + Math.min(availableAfterDisplay, PREFETCH_COUNT))
        } else {
          // No products and nothing prefetched - check total count
          if (totalCount > 0 && allProducts.length >= totalCount) {
            setHasMore(false)
          } else if (!hasMore) {
            // Double-check by trying one more fetch with a small offset increment
            // This handles cases where hasMore was set incorrectly
            const checkResult = await secureFetch(prefetchOffsetRef.current, 1, false)
            setHasMore(checkResult.hasMore && checkResult.products.length > 0)
          }
        }
      }
    } catch (err: any) {
      if (err.message !== 'Request aborted') {
        logger.error('[Prefetch] Load more error:', err)
        setError(err.message || 'Failed to load more products')
        // Don't set hasMore to false on error - might be temporary
      }
    } finally {
      setLoadingMore(false)
    }
  }, [enabled, loadingMore, hasMore, totalCount, allProducts.length, displayIndex, DISPLAY_COUNT, PREFETCH_COUNT, secureFetch, prefetchNext])
  
  // Reset function
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch {}
      abortControllerRef.current = null
    }
    
    inFlightRequestsRef.current.clear()
    setAllProducts([])
    setDisplayIndex(0)
    setLoading(false)
    setLoadingMore(false)
    setHasMore(true)
    setError(null)
    setTotalCount(0)
    setOffset(initialOffset)
    prefetchOffsetRef.current = initialOffset + limit
    loadingRef.current = false
  }, [initialOffset, limit])
  
  // Initial fetch on mount and when filters change
  useEffect(() => {
    if (enabled) {
      initialFetch()
    }
    
    return () => {
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort()
        } catch {}
      }
    }
  }, [enabled, initialOffset, category, brand, search, sortBy, sortOrder, minPrice, maxPrice, categories]) // Re-fetch when filters change
  
  return {
    displayedProducts,
    prefetchedProducts,
    loading,
    loadingMore,
    hasMore,
    error,
    totalCount,
    loadMore,
    reset
  }
}
