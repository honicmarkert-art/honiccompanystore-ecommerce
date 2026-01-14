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
  const [offset, setOffset] = useState(0)

  // Refs to prevent duplicate requests and handle debouncing
  const loadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoadRef = useRef(true)

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

  // Initial fetch and refetch on filter changes with debouncing
  // Products load immediately on initial load, debounced on filter changes
  useEffect(() => {
    if (!enabled) return

    // Build filter signature (exclude categories if undefined to allow immediate loading)
    const filterSig = JSON.stringify({
      category,
      brand,
      search,
      sortBy,
      sortOrder,
      minPrice,
      maxPrice,
      categories: categories && categories.length > 0 ? categories : undefined, // Only include if actually set
      inStock,
      isChina
    })

    // Only reset and fetch if filters changed
    const filtersChanged = filterSig !== prevFiltersRef.current
    prevFiltersRef.current = filterSig

    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    if (filtersChanged) {
      reset()
      
      // Initial load: fetch immediately (no debounce)
      if (isInitialLoadRef.current && products.length === 0) {
        isInitialLoadRef.current = false
        fetchProducts(0, false)
        return
      }

      // Filter changes: debounce the fetch
      const debounceDelay = getDebounceDelay()
      debounceTimerRef.current = setTimeout(() => {
        fetchProducts(0, false)
        debounceTimerRef.current = null
      }, debounceDelay)
    } else if (products.length === 0 && !loadingRef.current && isInitialLoadRef.current) {
      // Initial load - start immediately (no debounce)
      isInitialLoadRef.current = false
      fetchProducts(0, false)
    }

    return () => {
      // Cleanup: abort request and clear debounce timer
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort()
        } catch {}
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [enabled, category, brand, search, sortBy, sortOrder, minPrice, maxPrice, categories, inStock, isChina, reset, fetchProducts, products.length, getDebounceDelay])

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
