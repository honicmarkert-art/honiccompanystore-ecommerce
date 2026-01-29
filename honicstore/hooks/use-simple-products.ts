/**
 * Simple Products Hook - Amazon/AliExpress Style
 * 
 * Features:
 * - 200 products per page
 * - CDN caching for fast loading
 * - Simple infinite scroll
 * - No rate limiting issues
 * - Secure and fast
 */

import { useState, useEffect, useCallback, useRef } from 'react'

interface Product {
  id: number
  name: string
  price: number
  original_price?: number
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
  [key: string]: any
}

interface SimpleProductsOptions {
  limit?: number
  /** When set (e.g. for page 2+), first fetch uses this offset so the list shows that page's products */
  initialOffset?: number
  category?: string
  brand?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  minPrice?: number
  maxPrice?: number
  categories?: string[]
  inStock?: boolean
  isChina?: boolean
  enabled?: boolean
}

interface SimpleProductsReturn {
  products: Product[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  totalCount: number
  loadMore: () => Promise<void>
  reset: () => void
  refresh: () => Promise<void>
}

const PRODUCTS_PER_PAGE = 200 // Amazon/AliExpress style: large page size

export function useSimpleProducts(options: SimpleProductsOptions = {}): SimpleProductsReturn {
  const {
    limit = PRODUCTS_PER_PAGE,
    initialOffset: initialOffsetOption = 0,
    category,
    brand,
    search,
    sortBy = 'created_at',
    sortOrder = 'desc',
    minPrice,
    maxPrice,
    categories,
    inStock,
    isChina,
    enabled = true
  } = options

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(initialOffsetOption)

  // Refs to prevent duplicate requests and handle debouncing
  const loadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoadRef = useRef(true)
  const hasRestoredFromCacheRef = useRef(false)

  // Build API URL with filters
  const buildApiUrl = useCallback((currentOffset: number) => {
    const params = new URLSearchParams()
    params.append('limit', limit.toString())
    params.append('offset', currentOffset.toString())
    params.append('sortBy', sortBy)
    params.append('sortOrder', sortOrder)
    params.append('enriched', 'true') // Get optimized data

    if (category) params.append('category', category)
    if (brand) params.append('brand', brand)
    if (search && search.trim().length >= 3) {
      params.append('search', search.trim())
    }
    if (minPrice !== undefined && minPrice >= 0) {
      params.append('minPrice', minPrice.toString())
    }
    if (maxPrice !== undefined && maxPrice >= 0) {
      params.append('maxPrice', maxPrice.toString())
    }
    if (categories && categories.length > 0) {
      params.append('categories', categories.join(','))
    }
    if (inStock !== undefined) {
      params.append('inStock', inStock.toString())
    }
    if (isChina !== undefined) {
      params.append('isChina', isChina.toString())
    }

    return `/api/products?${params.toString()}`
  }, [limit, category, brand, search, sortBy, sortOrder, minPrice, maxPrice, categories, inStock, isChina])

  // Fetch products with CDN caching
  const fetchProducts = useCallback(async (currentOffset: number, isLoadMore: boolean = false) => {
    if (!enabled || loadingRef.current) return

    // Abort previous request if exists
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch {}
    }

    abortControllerRef.current = new AbortController()
    loadingRef.current = true

    // Set loading state
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError(null)
    }

    try {
      const url = buildApiUrl(currentOffset)

      // Fetch with CDN cache support
      // Browser will use CDN cache automatically based on Cache-Control headers
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        // Use default cache strategy - CDN will handle caching
        cache: 'default',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Extract products and pagination info
      const newProducts = Array.isArray(data) ? data : (data.products || [])
      const pagination = !Array.isArray(data) ? data.pagination : null

      // Update total count
      if (pagination?.total !== undefined) {
        setTotalCount(pagination.total)
      }

      // Determine if there are more products
      const hasMoreData = pagination?.hasMore !== undefined
        ? pagination.hasMore
        : (pagination?.total !== undefined
          ? (currentOffset + limit < pagination.total)
          : (newProducts.length >= limit))

      setHasMore(hasMoreData)

      // Update products
      if (isLoadMore) {
        setProducts(prev => {
          // Prevent duplicates
          const existingIds = new Set(prev.map(p => p.id))
          const uniqueNew = newProducts.filter((p: Product) => !existingIds.has(p.id))
          return [...prev, ...uniqueNew]
        })
      } else {
        setProducts(newProducts)
      }

      // Update offset
      setOffset(currentOffset + newProducts.length)

    } catch (err: any) {
      // Ignore abort errors
      if (err.name === 'AbortError') {
        return
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products'
      setError(errorMessage)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      loadingRef.current = false
      abortControllerRef.current = null
    }
  }, [enabled, buildApiUrl, limit])

  // Load more function
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingRef.current || loadingMore) return
    await fetchProducts(offset, true)
  }, [hasMore, fetchProducts, offset, loadingMore])

  // Reset function
  const reset = useCallback(() => {
    // Clear debounce timer if exists
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch {}
      abortControllerRef.current = null
    }
    setProducts([])
    setOffset(0)
    setHasMore(true)
    setError(null)
    setTotalCount(0)
    loadingRef.current = false
  }, [])

  // Refresh function
  const refresh = useCallback(async () => {
    reset()
    await fetchProducts(0, false)
  }, [reset, fetchProducts])

  // Track filter changes
  const prevFiltersRef = useRef<string>('')

  // Debounce delay: 300ms for search, 500ms for other filters
  const getDebounceDelay = useCallback(() => {
    // Search queries need faster response
    if (search && search.trim().length >= 3) {
      return 300
    }
    // Other filters can wait a bit longer
    return 500
  }, [search])

  // Cache key for sessionStorage (include initialOffset so page 2 has its own cache)
  const getCacheKey = useCallback(() => {
    const filterSig = JSON.stringify({
      initialOffset: initialOffsetOption,
      category,
      brand,
      search,
      sortBy,
      sortOrder,
      minPrice,
      maxPrice,
      categories: categories && categories.length > 0 ? categories : undefined,
      inStock,
      isChina
    })
    return `products_cache_${btoa(filterSig).replace(/[^a-zA-Z0-9]/g, '_')}`
  }, [initialOffsetOption, category, brand, search, sortBy, sortOrder, minPrice, maxPrice, categories, inStock, isChina])

  // Restore products from cache on mount if available (only if no search/filters and page 1)
  useEffect(() => {
    if (!enabled || hasRestoredFromCacheRef.current) return
    
    // Don't use cache when we're on page 2+ (initialOffset) - we need a fresh fetch for that page
    if (initialOffsetOption > 0) {
      hasRestoredFromCacheRef.current = true
      return
    }
    
    // Don't use cache if there are active filters/search
    const hasActiveFilters = search || category || brand || minPrice !== undefined || maxPrice !== undefined || (categories && categories.length > 0)
    if (hasActiveFilters) {
      hasRestoredFromCacheRef.current = true
      return
    }
    
    try {
      const cacheKey = getCacheKey()
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const cachedData = JSON.parse(cached)
        const cacheAge = Date.now() - (cachedData.timestamp || 0)
        // Use cache if less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000 && Array.isArray(cachedData.products)) {
          setProducts(cachedData.products)
          setOffset(cachedData.offset || 0)
          setHasMore(cachedData.hasMore !== undefined ? cachedData.hasMore : true)
          setTotalCount(cachedData.totalCount || 0)
          hasRestoredFromCacheRef.current = true
          isInitialLoadRef.current = false
          return
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
  }, [enabled, getCacheKey, initialOffsetOption, search, category, brand, minPrice, maxPrice, categories])

  // Save products to cache whenever they change (with delay after filter changes)
  useEffect(() => {
    if (!enabled || products.length === 0) return
    
    // Check if we have active filters/search
    const hasActiveFilters = search || category || brand || minPrice !== undefined || maxPrice !== undefined || (categories && categories.length > 0)
    
    // If no filters, cache immediately
    // If filters exist, wait 3 seconds before caching (to ensure API results are stable)
    const cacheDelay = hasActiveFilters ? 3000 : 0
    
    const cacheTimer = setTimeout(() => {
      try {
        const cacheKey = getCacheKey()
        const cacheData = {
          products,
          offset,
          hasMore,
          totalCount,
          timestamp: Date.now()
        }
        sessionStorage.setItem(cacheKey, JSON.stringify(cacheData))
      } catch (e) {
        // Ignore cache errors (e.g., quota exceeded)
      }
    }, cacheDelay)
    
    return () => {
      clearTimeout(cacheTimer)
    }
  }, [enabled, products, offset, hasMore, totalCount, getCacheKey, search, category, brand, minPrice, maxPrice, categories])

  // Initial fetch and refetch on filter or initialOffset (page) changes with debouncing
  useEffect(() => {
    if (!enabled) return

    const startOffset = initialOffsetOption
    // Build filter signature (include initialOffset so page change triggers refetch)
    const filterSig = JSON.stringify({
      initialOffset: startOffset,
      category,
      brand,
      search,
      sortBy,
      sortOrder,
      minPrice,
      maxPrice,
      categories: categories && categories.length > 0 ? categories : undefined,
      inStock,
      isChina
    })

    const filtersChanged = filterSig !== prevFiltersRef.current
    prevFiltersRef.current = filterSig

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    if (filtersChanged) {
      hasRestoredFromCacheRef.current = false
      try {
        sessionStorage.removeItem(getCacheKey())
      } catch (e) {}
      reset()
      setOffset(startOffset)
      if (isInitialLoadRef.current || products.length === 0) {
        isInitialLoadRef.current = false
        fetchProducts(startOffset, false)
        return
      }
      const debounceDelay = getDebounceDelay()
      debounceTimerRef.current = setTimeout(() => {
        fetchProducts(startOffset, false)
        debounceTimerRef.current = null
      }, debounceDelay)
    } else if (products.length === 0 && !loadingRef.current && (isInitialLoadRef.current || startOffset > 0) && !hasRestoredFromCacheRef.current) {
      isInitialLoadRef.current = false
      fetchProducts(startOffset, false)
    }

    return () => {
      if (abortControllerRef.current) {
        try { abortControllerRef.current.abort() } catch {}
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [enabled, initialOffsetOption, category, brand, search, sortBy, sortOrder, minPrice, maxPrice, categories, inStock, isChina, reset, fetchProducts, products.length, getDebounceDelay, getCacheKey])

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
