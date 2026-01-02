import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchWithCache } from '@/lib/fetch-cache'

interface Product {
  id: number
  name: string
  price: number
  original_price?: number
  description?: string
  short_description?: string
  image?: string
  thumbnail_url?: string
  category?: string
  brand?: string
  rating?: number
  reviews?: number
  in_stock: boolean
  stock_quantity?: number
  free_delivery?: boolean
  same_day_delivery?: boolean
  import_china?: boolean
  is_new?: boolean
  is_featured?: boolean
  created_at: string
  updated_at: string
  product_variants?: Array<{
    id: number
    name: string
    price: number
    stock_quantity?: number
    in_stock: boolean
  }>
}

interface InfiniteProductsOptions {
  limit?: number
  initialOffset?: number // Starting offset for pagination (e.g., page 2 starts at offset 120)
  category?: string
  brand?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  useOptimized?: boolean
  useMaterializedView?: boolean
  enabled?: boolean
  // Server-side filtering options
  minPrice?: number
  maxPrice?: number
  categories?: string[] // Multiple categories
  inStock?: boolean
  isChina?: boolean // Filter by import_china
  supplier?: string // Filter by supplier_id or user_id
}

interface InfiniteProductsReturn {
  products: Product[]
  loading: boolean
  loadingMore: boolean
  filtering: boolean // New: filtering state (keeps products visible)
  hasMore: boolean
  error: string | null
  totalCount: number
  loadMore: () => Promise<void>
  reset: (clearProducts?: boolean) => void
  refresh: () => Promise<void>
}

export function useInfiniteProducts(options: InfiniteProductsOptions = {}): InfiniteProductsReturn {
  const {
    limit = 24,
    initialOffset = 0,
    category,
    brand,
    search,
    sortBy = 'created_at',
    sortOrder = 'desc',
    useOptimized = true,
    useMaterializedView = false,
    enabled = true,
    // Server-side filtering parameters
    minPrice,
    maxPrice,
    categories,
    inStock,
    isChina,
    supplier
  } = options

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filtering, setFiltering] = useState(false) // New state: filtering without clearing products
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(initialOffset)
  
  // Refs to prevent duplicate requests
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastResetAtRef = useRef<number>(0)
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track previous category signature to avoid no-op cache clears
  const prevCategoriesSigRef = useRef<string | null>(null)
  // Request deduplication: track in-flight requests by URL to prevent duplicate API calls
  const inFlightRequestsRef = useRef<Map<string, Promise<any>>>(new Map())

  // Reset function - clears all products immediately (for initial load or major changes)
  const reset = useCallback((clearProducts: boolean = true) => {
    // Abort any in-flight request when resetting
    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort() } catch {}
      abortControllerRef.current = null
    }
    lastResetAtRef.current = Date.now()
    // Only clear products if explicitly requested (not for filter changes)
    if (clearProducts) {
      setProducts([])
      // CRITICAL: When clearing products (e.g., for search), set loading to true immediately
      // This prevents showing "No products found" during the gap between reset and fetch
      setLoading(true)
      setFiltering(false)
    } else {
      // Soft reset: keep products visible, just indicate filtering
      setFiltering(true)
      setLoading(false)
    }
    setOffset(initialOffset)
    setHasMore(true)
    setError(null)
    setTotalCount(0)
    hasMoreRef.current = true
    loadingRef.current = false
    setLoadingMore(false)
  }, [initialOffset])

  // Fetch products function
  const fetchProducts = useCallback(async (currentOffset: number, isLoadMore: boolean = false) => {
    
    if (!enabled || loadingRef.current) return

    // Cancel any in-flight request before starting a new one
    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort() } catch {}
    }
    // Clear in-flight requests map when starting new fetch to prevent stale requests
    inFlightRequestsRef.current.clear()
    abortControllerRef.current = new AbortController()
    loadingRef.current = true
    
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      // If we have existing products, use filtering state instead of loading
      if (products.length > 0) {
        setFiltering(true)
        setLoading(false)
      } else {
        setLoading(true)
        setFiltering(false)
      }
    }
    
    setError(null)

    try {
      // Debug removed
      // Remove artificial delay to speed up load-more requests

      let url = '/api/products'
      if (useMaterializedView) {
        url = '/api/products/optimized'
      }

      const params = new URLSearchParams()
        if (category) {
          params.append('category', category)
        }
      if (brand) params.append('brand', brand)
      // Only send search query if it has at least 3 characters (matches API requirement)
      if (search && String(search).trim().length >= 3) {
        params.append('search', String(search).trim())
      }
      params.append('limit', limit.toString())
      params.append('offset', currentOffset.toString())
      params.append('sortBy', sortBy) // Changed from sort_by to sortBy for consistency
      params.append('sortOrder', sortOrder) // Changed from sort_order to sortOrder
      
      // Server-side filtering parameters
      if (minPrice !== undefined && minPrice >= 0) {
        params.append('minPrice', minPrice.toString())
      }
      if (maxPrice !== undefined && maxPrice >= 0) {
        params.append('maxPrice', maxPrice.toString())
      }
      if (categories !== undefined) {
        if (categories.length > 0) {
          params.append('categories', categories.join(','))
        } else {
          // Empty array means main category with 0 subcategories - should return 0 products
          params.append('categories', '')
        }
      }
      if (inStock !== undefined) {
        params.append('inStock', inStock.toString())
      }
      if (isChina !== undefined) {
        params.append('isChina', isChina.toString())
      }
      if (supplier) {
        params.append('supplier', supplier)
      }
      
      if (useOptimized && !useMaterializedView) {
        params.append('enriched', 'true')
      }
      
      // Only add cache busting for search queries to allow caching for regular browsing
      // This significantly reduces API calls and prevents rate limiting
      const isSearching = !!search && String(search).trim().length > 0
      if (isSearching) {
        params.append('t', Date.now().toString())
      }

      const fullUrl = `${url}?${params.toString()}`
      
      // Request deduplication: if same request is in-flight, reuse it to prevent duplicate API calls
      const existingRequest = inFlightRequestsRef.current.get(fullUrl)
      if (existingRequest) {
        try {
          const data = await existingRequest
          // Request completed, remove from map
          inFlightRequestsRef.current.delete(fullUrl)
          return data
        } catch (err) {
          // Request failed, remove from map
          inFlightRequestsRef.current.delete(fullUrl)
          throw err
        }
      }
      
      // For search queries, reduce cache to avoid stale results
      // Fetch with a single retry on 429 rate limit using short exponential backoff with jitter
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

      const fetchOnce = async () => {
        return await fetchWithCache(fullUrl, { ttlMs: isSearching ? 1000 : 30_000, swrMs: isSearching ? 0 : 180_000, signal: abortControllerRef.current?.signal })
      }

      // Create request promise and store it for deduplication
      const requestPromise = (async () => {
        try {
          let data: any
          try {
            data = await fetchOnce()
          } catch (err: any) {
            const message = err?.message || ''
            const status = (err as any)?.status
            const isRateLimited = status === 429 || /429|too many requests|rate limit/i.test(message)
            if (isRateLimited) {
              // Backoff: 400ms base + small jitter, single retry
              const backoffMs = 400 + Math.floor(Math.random() * 300)
              await sleep(backoffMs)
              data = await fetchOnce()
            } else {
              throw err
            }
          }
          return data
        } finally {
          // Remove from in-flight map when done (success or failure)
          inFlightRequestsRef.current.delete(fullUrl)
        }
      })()

      // Store request for deduplication
      inFlightRequestsRef.current.set(fullUrl, requestPromise)
      
      const data = await requestPromise
      
      // API returns {products: [...], pagination: {...}}
      const newProducts = Array.isArray(data) ? data : (data.products || [])
      const pagination = !Array.isArray(data) ? data.pagination : null
      
      
      
      
      // Update total count if available
      if (pagination?.total !== undefined) {
        setTotalCount(pagination.total)
      }

      // Check if we have more data - use API's hasMore flag if available
      // Account for client-side filtering (out-of-stock products) by checking if we got full batch
      const receivedFullBatch = newProducts.length >= limit
      const hasMoreData = pagination?.hasMore ?? receivedFullBatch
      
      
      hasMoreRef.current = hasMoreData
      setHasMore(hasMoreData)

      // Transform products to ensure importChina field is properly mapped
      // CRITICAL: Ensure all products have required fields for frontend filtering
      const transformedProducts = newProducts.map((product: any) => {
        // Ensure inStock and in_stock fields are always set correctly
        const hasInStock = product.inStock !== undefined ? product.inStock : (product.in_stock !== undefined ? product.in_stock : true)
        const hasInStock2 = product.in_stock !== undefined ? product.in_stock : hasInStock
        
        return {
          ...product,
          // Always set both fields to prevent frontend filtering issues
          inStock: hasInStock,
          in_stock: hasInStock2
        }
      })

      // Update products
      if (isLoadMore) {
        setProducts(prev => [...prev, ...transformedProducts])
      } else {
        setProducts(transformedProducts)
      }
      
      // Log for debugging (only in development)
      if (process.env.NODE_ENV === 'development' && transformedProducts.length > 0) {
        console.log(`[useInfiniteProducts] Set ${transformedProducts.length} products, first product:`, transformedProducts[0]?.name, transformedProducts[0]?.inStock, transformedProducts[0]?.in_stock)
      }

      // Update offset
      setOffset(currentOffset + newProducts.length)

    } catch (err) {
      // Ignore AbortError as it's an intentional cancellation
      if ((err as any)?.name === 'AbortError') {
        return
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products'
      setError(errorMessage)
      // Keep console clean in production; surface error state only
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setFiltering(false) // Clear filtering state when fetch completes
      loadingRef.current = false
      abortControllerRef.current = null
    }
  }, [enabled, limit, category, brand, search, sortBy, sortOrder, useOptimized, useMaterializedView, minPrice, maxPrice, categories, inStock, isChina, supplier, products.length])

  // Load more function
  const loadMore = useCallback(async () => {
    if (!hasMoreRef.current || loadingRef.current) return
    await fetchProducts(offset, true)
  }, [fetchProducts, offset])

  // Refresh function
  const refresh = useCallback(async () => {
    reset()
    await fetchProducts(0, false)
  }, [reset, fetchProducts])

  // Initial load - reset and fetch when filters change
  useEffect(() => {
    if (!enabled) return

    // Build a stable signature for categories (order-independent)
    const sig = Array.isArray(categories) ? [...categories].sort().join(',') : 'undefined'
    if (prevCategoriesSigRef.current !== sig) {
      // Categories actually changed → clear cache once
      if (Array.isArray(categories)) {
        const { clearCache } = require('@/lib/fetch-cache')
        clearCache('/api/products')
      }
      prevCategoriesSigRef.current = sig
    }

    // Debounced cooldown to avoid immediate double-fetch after reset
    // CRITICAL: For search queries, do hard reset (clear products) to prevent showing wrong products
    // For other filters, use soft reset to keep products visible during filtering
    const isSearchActive = search && search.trim().length > 0
    reset(isSearchActive) // Hard reset (clear products) for search, soft reset for other filters
    
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current)
      cooldownTimeoutRef.current = null
    }
    // Reduced cooldown from 500-800ms to 200-400ms for faster response
    // Still prevents double-fetch but reduces perceived latency
    const cooldownMs = 200 + Math.floor(Math.random() * 200) // 200–400ms
    cooldownTimeoutRef.current = setTimeout(() => {
      fetchProducts(initialOffset, false)
    }, cooldownMs)
    return () => {
      if (abortControllerRef.current) {
        try { abortControllerRef.current.abort() } catch {}
        abortControllerRef.current = null
      }
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current)
        cooldownTimeoutRef.current = null
      }
    }
  }, [enabled, category, brand, search, sortBy, sortOrder, useOptimized, useMaterializedView, minPrice, maxPrice, categories, inStock, isChina, supplier, initialOffset])

  return {
    products,
    loading,
    loadingMore,
    hasMore,
    error,
    totalCount,
    loadMore,
    reset,
    refresh
  }
}

// Hook for intersection observer-based infinite scroll
export function useInfiniteScroll(
  loadMore: () => Promise<void>,
  hasMore: boolean,
  loading: boolean,
  options: {
    rootMargin?: string
    threshold?: number
    enabled?: boolean
  } = {}
) {
  // Start loading well before user reaches the end for smoother UX
  const { rootMargin = '1200px', threshold = 0.01, enabled = true } = options
  const observerRef = useRef<IntersectionObserver | null>(null)
  const elementRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!enabled || !hasMore || loading) return

    const element = elementRef.current
    if (!element) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      {
        rootMargin,
        threshold
      }
    )

    observerRef.current.observe(element)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [loadMore, hasMore, loading, rootMargin, threshold, enabled])

  return elementRef
}

// Hook for scroll-based infinite scroll (fallback)
export function useScrollInfinite(
  loadMore: () => Promise<void>,
  hasMore: boolean,
  loading: boolean,
  options: {
    threshold?: number
    enabled?: boolean
  } = {}
) {
  const { threshold = 100, enabled = true } = options

  useEffect(() => {
    if (!enabled || !hasMore || loading) return

    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop + threshold >=
        document.documentElement.offsetHeight
      ) {
        loadMore()
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadMore, hasMore, loading, threshold, enabled])
}
