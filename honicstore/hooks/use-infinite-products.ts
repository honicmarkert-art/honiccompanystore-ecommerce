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
    limit = 20, // AliExpress-style: Fixed 20 products per batch
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

  // Fetch products function with smart cache busting
  const fetchProducts = useCallback(async (currentOffset: number, isLoadMore: boolean = false, forceRefresh: boolean = false) => {
    if (!enabled || loadingRef.current) return

    // For load-more, don't abort previous request (let it complete) - only abort on filter changes
    if (!isLoadMore && abortControllerRef.current) {
      try { abortControllerRef.current.abort() } catch {}
    }
    // Only clear in-flight map on filter changes, not on load-more
    if (!isLoadMore) {
      inFlightRequestsRef.current.clear()
    }
    abortControllerRef.current = new AbortController()
    loadingRef.current = true
    
    // Check cache first (unless force refresh or load-more)
    // Skip cache for load-more to ensure fresh data and faster response
    if (!forceRefresh && !isLoadMore && typeof window !== 'undefined') {
      try {
        const cacheKey = `products_${JSON.stringify({ category, brand, search, minPrice, maxPrice, categories, inStock, isChina, supplier, sortBy, sortOrder })}_${currentOffset}_${limit}`
        const cached = sessionStorage.getItem(cacheKey)
        if (cached) {
          const cacheData = JSON.parse(cached)
          const now = Date.now()
          // Use cached data if less than 5 minutes old
          if (cacheData.timestamp && (now - cacheData.timestamp) < 5 * 60 * 1000) {
            // Set cached data immediately (synchronous) to hide skeleton
            setProducts(cacheData.products || [])
            setHasMore(cacheData.hasMore !== undefined ? cacheData.hasMore : true)
            setTotalCount(cacheData.totalCount || 0)
            setLoading(false)
            setFiltering(false)
            loadingRef.current = false
            // Return early to prevent showing loading state
            // Fresh data will be fetched in background via the effect below
            return
          }
        }
      } catch (e) {
        // Ignore cache errors, continue with fetch
      }
    }
    
    // Optimized: Set loading state immediately to prevent delays
    if (isLoadMore) {
      setLoadingMore(true)
      // Don't set main loading state for load-more to keep existing products visible
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
      
      // Smart cache busting: only when explicitly needed
      // - Always cache bust for search queries (fresh results needed)
      // - Cache bust for filter changes (new results needed)
      // - Use cache for regular browsing (faster, reduces API calls)
      const isSearching = !!search && String(search).trim().length > 0
      const hasFilters = isSearching || category || brand || minPrice !== undefined || maxPrice !== undefined || categories?.length || inStock !== undefined || isChina !== undefined || supplier
      
      // Only cache bust if:
      // 1. Searching (need fresh results)
      // 2. Force refresh requested
      // 3. Filter changed (need new results)
      if (isSearching || forceRefresh || (hasFilters && !isLoadMore)) {
        params.append('t', Date.now().toString())
      }

      const fullUrl = `${url}?${params.toString()}`
      
      // Request deduplication: only for initial loads (not load-more) to avoid blocking scroll
      if (!isLoadMore) {
        const existingRequest = inFlightRequestsRef.current.get(fullUrl)
        if (existingRequest) {
          try {
            const data = await existingRequest
            inFlightRequestsRef.current.delete(fullUrl)
            return data
          } catch (err) {
            inFlightRequestsRef.current.delete(fullUrl)
            throw err
          }
        }
      }
      
      // Optimized fetch: For load-more, use direct fetch with no cache for maximum speed
      const fetchOnce = async () => {
        if (isLoadMore) {
          // Load-more: Direct fetch, no cache layer, no delays - fastest possible
          const response = await fetch(fullUrl, { 
            signal: abortControllerRef.current?.signal,
            cache: 'no-store' // Ensure fresh data for load-more
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return await response.json()
        } else {
          // Initial load: Use cache for better performance
          const cacheTTL = isSearching ? 1000 : 30_000
          const cacheSWR = isSearching ? 0 : 180_000
          return await fetchWithCache(fullUrl, { ttlMs: cacheTTL, swrMs: cacheSWR, signal: abortControllerRef.current?.signal })
        }
      }

      // Create request promise and store it for deduplication
      const requestPromise = (async () => {
        try {
          let data: any
          try {
            data = await fetchOnce()
          } catch (err: any) {
            // For load-more, skip retry delay - fail fast
            if (isLoadMore) throw err
            
            // For initial load, retry on rate limit with minimal delay
            const message = err?.message || ''
            const status = (err as any)?.status
            const isRateLimited = status === 429 || /429|too many requests|rate limit/i.test(message)
            if (isRateLimited) {
              // Minimal backoff for initial load only
              await new Promise(resolve => setTimeout(resolve, 200))
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
      
      // CRITICAL FIX: Use API's hasMore if available, otherwise check if:
      // 1. We received a full batch (30 products), OR
      // 2. The total count indicates more products exist
      // IMPORTANT: Use limit (30) not newProducts.length for offset calculation
      let hasMoreData = false
      if (pagination?.hasMore !== undefined) {
        // Trust API's hasMore flag (most accurate)
        hasMoreData = pagination.hasMore
      } else if (pagination?.total !== undefined) {
        // Calculate based on total count: if current offset + limit < total, there's more
        // Use limit (30) not newProducts.length because offset must increment by requested amount
        const nextOffset = currentOffset + limit
        hasMoreData = nextOffset < pagination.total
      } else {
        // Fallback: if we got a full batch, assume there might be more
        hasMoreData = receivedFullBatch
      }
      
      hasMoreRef.current = hasMoreData
      setHasMore(hasMoreData)

      // Optimized: Minimal transformation - only set missing fields, skip full mapping for load-more
      const transformedProducts = isLoadMore && newProducts.length > 0 && newProducts[0].inStock !== undefined
        ? newProducts // Skip transformation for load-more - already correct format
        : newProducts.map((product: any) => ({
            ...product,
            // Only set if missing - avoid unnecessary object creation
            inStock: product.inStock ?? product.in_stock ?? true,
            in_stock: product.in_stock ?? product.inStock ?? true
          }))

      // Update products - use functional update to get current state
      if (isLoadMore) {
        setProducts(prev => [...prev, ...transformedProducts])
      } else {
        setProducts(transformedProducts)
      }
      
      // Cache only for initial load (not load-more) to avoid storage overhead
      if (!isLoadMore && typeof window !== 'undefined') {
        try {
          const cacheKey = `products_${JSON.stringify({ category, brand, search, minPrice, maxPrice, categories, inStock, isChina, supplier, sortBy, sortOrder })}_${currentOffset}_${limit}`
          sessionStorage.setItem(cacheKey, JSON.stringify({
            products: transformedProducts,
            hasMore: hasMoreData,
            totalCount: pagination?.total || transformedProducts.length,
            timestamp: Date.now()
          }))
        } catch (e) {
          // Ignore storage errors
        }
      }

      // Update offset - CRITICAL FIX: Always increment by the number of products requested (limit)
      // not by the number returned, to maintain correct pagination even if API returns fewer products
      // This ensures: offset 0 → 30 → 60 → 90, not 0 → 22 → 44 → 66
      const nextOffset = currentOffset + limit
      setOffset(nextOffset)
      
      // Mark initial load as complete after first successful fetch
      if (!isLoadMore && !hasInitialLoadRef.current) {
        hasInitialLoadRef.current = true
      }

    } catch (err) {
      // Ignore AbortError as it's an intentional cancellation
      if ((err as any)?.name === 'AbortError') {
        return
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products'
      setError(errorMessage)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setFiltering(false) // Clear filtering state when fetch completes
      loadingRef.current = false
      abortControllerRef.current = null
    }
  }, [enabled, limit, category, brand, search, sortBy, sortOrder, useOptimized, useMaterializedView, minPrice, maxPrice, categories, inStock, isChina, supplier])

  // Load more function - optimized for speed (no delays, immediate fetch)
  const loadMore = useCallback(async () => {
    if (!hasMoreRef.current || loadingRef.current) return
    // Fetch immediately without any delays for faster scroll experience
    // Use current offset from state (which is correctly incremented by limit)
    fetchProducts(offset, true)
  }, [fetchProducts, offset])

  // Refresh function
  const refresh = useCallback(async () => {
    reset()
    await fetchProducts(0, false)
  }, [reset, fetchProducts])

  // Track if this is the first mount to avoid unnecessary resets on navigation
  const isFirstMountRef = useRef(true)
  const prevFiltersRef = useRef<string>('')
  const hasInitialLoadRef = useRef(false) // Track if initial load has happened

  // Initial load - reset and fetch when filters change
  useEffect(() => {
    if (!enabled) return
    
    // Don't run if currently loading (prevents interference with load-more)
    if (loadingRef.current) return

    // Build filter signature to detect actual filter changes
    const filterSig = JSON.stringify({ category, brand, search, sortBy, sortOrder, minPrice, maxPrice, categories, inStock, isChina, supplier })
    const filtersChanged = filterSig !== prevFiltersRef.current
    prevFiltersRef.current = filterSig

    // Build a stable signature for categories (order-independent)
    const sig = Array.isArray(categories) ? [...categories].sort().join(',') : 'undefined'
    if (prevCategoriesSigRef.current !== sig && Array.isArray(categories)) {
      // Categories actually changed → clear fetch cache (but keep sessionStorage cache for instant display)
      // Only clear if categories actually changed (not on return navigation)
      if (filtersChanged) {
        // Clear cache on filter changes (async import to avoid build issues)
        import('@/lib/fetch-cache').then(({ clearCache }) => {
          clearCache('/api/products')
        }).catch(() => {
          // Ignore if module not available
        })
      }
      prevCategoriesSigRef.current = sig
    } else if (prevCategoriesSigRef.current === null) {
      prevCategoriesSigRef.current = sig
    }

    // On first mount or when returning (no filter change), check cache first
    if (isFirstMountRef.current || !filtersChanged) {
      isFirstMountRef.current = false
      
      // CRITICAL: If products already exist (from load-more), don't reset them!
      if (products.length > 0 && hasInitialLoadRef.current) {
        return
      }
      
      // Check cache BEFORE resetting - if cache exists, use it immediately
      if (typeof window !== 'undefined') {
        try {
          const cacheKey = `products_${JSON.stringify({ category, brand, search, minPrice, maxPrice, categories, inStock, isChina, supplier, sortBy, sortOrder })}_${initialOffset}_${limit}`
          const cached = sessionStorage.getItem(cacheKey)
          if (cached) {
            const cacheData = JSON.parse(cached)
            const now = Date.now()
            // Use cached data if less than 5 minutes old
            if (cacheData.timestamp && (now - cacheData.timestamp) < 5 * 60 * 1000 && cacheData.products?.length > 0) {
              // Set cached products immediately without reset
              setProducts(cacheData.products || [])
              setHasMore(cacheData.hasMore !== undefined ? cacheData.hasMore : true)
              setTotalCount(cacheData.totalCount || 0)
              setLoading(false)
              setFiltering(false)
              loadingRef.current = false
              hasInitialLoadRef.current = true
              
              // Fetch fresh data in background immediately (stale-while-revalidate)
              // No delay needed - cached products already displayed
              fetchProducts(initialOffset, false)
              return // Skip reset and cooldown - products already shown
            }
          }
        } catch (e) {
          // Ignore cache errors, continue with normal flow
        }
      }
    }

    // Only reset if filters actually changed (not on first mount or return)
    // CRITICAL: Don't fetch if we already have products (from load-more) unless filters changed
    if (filtersChanged) {
      const isSearchActive = search && search.trim().length > 0
      reset(isSearchActive)
      hasInitialLoadRef.current = false // Reset flag on filter change
      
      // Clear any existing timeout
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current)
        cooldownTimeoutRef.current = null
      }
      
      // Fetch immediately for filter changes (no cooldown for faster response)
      fetchProducts(initialOffset, false)
    } else if (!hasInitialLoadRef.current && products.length === 0 && !loadingRef.current) {
      // Only fetch on first mount if no products exist and initial load hasn't happened
      // Don't fetch if products.length > 0 (from load-more) - this prevents reset
      // Don't fetch if already loading (prevents interference with load-more)
      hasInitialLoadRef.current = true
      fetchProducts(initialOffset, false)
    }
    
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
  }, [enabled, category, brand, search, sortBy, sortOrder, useOptimized, useMaterializedView, minPrice, maxPrice, categories, inStock, isChina, supplier, initialOffset, limit, fetchProducts, reset, products.length])

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
