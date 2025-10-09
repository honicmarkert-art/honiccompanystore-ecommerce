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
}

interface InfiniteProductsReturn {
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

export function useInfiniteProducts(options: InfiniteProductsOptions = {}): InfiniteProductsReturn {
  const {
    limit = 20,
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
    inStock
  } = options

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(initialOffset)
  
  // Refs to prevent duplicate requests
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)

  // Reset function
  const reset = useCallback(() => {
    setProducts([])
    setOffset(initialOffset)
    setHasMore(true)
    setError(null)
    setTotalCount(0)
    hasMoreRef.current = true
    loadingRef.current = false
  }, [initialOffset])

  // Fetch products function
  const fetchProducts = useCallback(async (currentOffset: number, isLoadMore: boolean = false) => {
    if (!enabled || loadingRef.current) return

    loadingRef.current = true
    
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    
    setError(null)

    try {
      // Add small delay to prevent rapid-fire requests
      if (currentOffset > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      let url = '/api/products'
      if (useMaterializedView) {
        url = '/api/products/optimized'
      }

      const params = new URLSearchParams()
        if (category) {
          params.append('category', category)
        }
      if (brand) params.append('brand', brand)
      if (search) params.append('search', search)
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
      if (categories && categories.length > 0) {
        params.append('categories', categories.join(','))
      }
      if (inStock !== undefined) {
        params.append('inStock', inStock.toString())
      }
      
      if (useOptimized && !useMaterializedView) {
        params.append('enriched', 'true')
      }

      const fullUrl = `${url}?${params.toString()}`
      // For search queries, reduce cache to avoid stale results
      const isSearching = !!search && String(search).trim().length > 0
      const data = await fetchWithCache(fullUrl, { ttlMs: isSearching ? 1000 : 30_000, swrMs: isSearching ? 0 : 180_000 })
      
      // API returns {products: [...], pagination: {...}}
      const newProducts = Array.isArray(data) ? data : (data.products || [])
      const pagination = !Array.isArray(data) ? data.pagination : null
      
      // Update total count if available
      if (pagination?.total !== undefined) {
        setTotalCount(pagination.total)
      }

      // Check if we have more data - use API's hasMore flag if available
      const hasMoreData = pagination?.hasMore ?? (newProducts.length === limit)
      
      hasMoreRef.current = hasMoreData
      setHasMore(hasMoreData)

      // Update products
      if (isLoadMore) {
        setProducts(prev => [...prev, ...newProducts])
      } else {
        setProducts(newProducts)
      }

      // Update offset
      setOffset(currentOffset + newProducts.length)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products'
      setError(errorMessage)
      console.error('Infinite products fetch error:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      loadingRef.current = false
    }
  }, [enabled, limit, category, brand, search, sortBy, sortOrder, useOptimized, useMaterializedView, minPrice, maxPrice, categories, inStock])

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
    if (enabled) {
      reset()
      fetchProducts(initialOffset, false)
    }
  }, [enabled, category, brand, search, sortBy, sortOrder, useOptimized, useMaterializedView, minPrice, maxPrice, categories, inStock, initialOffset])

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
  const { rootMargin = '100px', threshold = 0.1, enabled = true } = options
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
