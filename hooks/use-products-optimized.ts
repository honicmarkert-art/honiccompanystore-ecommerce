"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useProducts } from './use-products'
import { useRobustApiFetch } from '@/lib/robust-api-fetch'
import { logger } from '@/lib/logger'

// Extend window object for search timeout
declare global {
  interface Window {
    searchTimeout?: NodeJS.Timeout
  }
}

interface UseProductsOptimizedOptions {
  category?: string
  brand?: string
  search?: string
  limit?: number
  enableInfiniteScroll?: boolean
}

interface UseProductsOptimizedReturn {
  products: any[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  loadMore: () => void
  refresh: () => void
  searchProducts: (query: string) => void
  filterByCategory: (category: string) => void
  filterByBrand: (brand: string) => void
  clearFilters: () => void
}

/**
 * Optimized products hook with caching, infinite scroll, and search
 */
export function useProductsOptimized(options: UseProductsOptimizedOptions = {}): UseProductsOptimizedReturn {
  const {
    category,
    brand,
    search,
    limit = 20,
    enableInfiniteScroll = true
  } = options

  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [currentFilters, setCurrentFilters] = useState({
    category,
    brand,
    search
  })

  // Cache for API responses
  const [cache, setCache] = useState<Map<string, any>>(new Map())
  
  // Rate limiting
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [isRateLimited, setIsRateLimited] = useState(false)

  // Generate cache key
  const generateCacheKey = useCallback((filters: any, offset: number) => {
    return `products:${JSON.stringify(filters)}:${offset}:${limit}`
  }, [limit])

  // Fetch products with caching and rate limiting
  const fetchProducts = useCallback(async (
    filters: any,
    offset: number,
    isLoadMore: boolean = false
  ) => {
    const cacheKey = generateCacheKey(filters, offset)
    
    // Check cache first
    if (cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey)
      if (isLoadMore) {
        setProducts(prev => [...prev, ...cachedData.products])
      } else {
        setProducts(cachedData.products)
      }
      setHasMore(cachedData.hasMore)
      return
    }

    // Rate limiting check
    const now = Date.now()
    const timeSinceLastFetch = now - lastFetchTime
    const minInterval = 1000 // 1 second minimum between requests (reduced for better UX)

    if (timeSinceLastFetch < minInterval && !isLoadMore) {
      logger.log('Rate limiting: Too soon since last fetch')
      return
    }

    // Check if we're currently rate limited
    if (isRateLimited) {
      logger.log('Rate limited: Skipping fetch')
      return
    }

    try {
      if (isLoadMore) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }
      setError(null)
      setLastFetchTime(now)

      const params = new URLSearchParams({
        minimal: 'true',
        limit: limit.toString(),
        offset: offset.toString(),
        ...(filters.category && { category: filters.category }),
        ...(filters.brand && { brand: filters.brand }),
        ...(filters.search && { search: filters.search })
      })

      const response = await fetch(`/api/products?${params}`)
      
      if (response.status === 429) {
        // Handle rate limiting
        setIsRateLimited(true)
        setError('Too many requests. Please wait a moment and try again.')
        
        // Reset rate limit after 60 seconds
        setTimeout(() => {
          setIsRateLimited(false)
          setError(null)
        }, 60000)
        
        return
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const newProducts = await response.json()
      
      // Cache the response
      setCache(prev => new Map(prev).set(cacheKey, {
        products: newProducts,
        hasMore: newProducts.length === limit,
        timestamp: Date.now()
      }))

      if (isLoadMore) {
        setProducts(prev => [...prev, ...newProducts])
      } else {
        setProducts(newProducts)
      }
      
      setHasMore(newProducts.length === limit)
      setOffset(offset + limit)
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [cache, generateCacheKey, limit, lastFetchTime, isRateLimited])

  // Load more products
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && enableInfiniteScroll) {
      fetchProducts(currentFilters, offset, true)
    }
  }, [isLoadingMore, hasMore, enableInfiniteScroll, fetchProducts, currentFilters, offset])

  // Refresh products
  const refresh = useCallback(() => {
    setOffset(0)
    setProducts([])
    setCache(new Map()) // Clear cache
    fetchProducts(currentFilters, 0, false)
  }, [fetchProducts, currentFilters])

  // Search products (no debouncing - handled by input)
  const searchProducts = useCallback((query: string) => {
    const newFilters = { ...currentFilters, search: query }
    setCurrentFilters(newFilters)
    setOffset(0)
    setProducts([])
    setCache(new Map()) // Clear cache
    fetchProducts(newFilters, 0, false)
  }, [currentFilters, fetchProducts])

  // Filter by category
  const filterByCategory = useCallback((category: string) => {
    const newFilters = { ...currentFilters, category }
    setCurrentFilters(newFilters)
    setOffset(0)
    setProducts([])
    setCache(new Map()) // Clear cache
    fetchProducts(newFilters, 0, false)
  }, [currentFilters, fetchProducts])

  // Filter by brand
  const filterByBrand = useCallback((brand: string) => {
    const newFilters = { ...currentFilters, brand }
    setCurrentFilters(newFilters)
    setOffset(0)
    setProducts([])
    setCache(new Map()) // Clear cache
    fetchProducts(newFilters, 0, false)
  }, [currentFilters, fetchProducts])

  // Clear filters
  const clearFilters = useCallback(() => {
    const newFilters = { category: undefined, brand: undefined, search: undefined }
    setCurrentFilters(newFilters)
    setOffset(0)
    setProducts([])
    setCache(new Map()) // Clear cache
    fetchProducts(newFilters, 0, false)
  }, [fetchProducts])

  // Initial load with delay to prevent simultaneous API calls
  useEffect(() => {
    const delayedFetch = async () => {
      // Add delay to prevent simultaneous API calls with categories/ads
      await new Promise(resolve => setTimeout(resolve, 300))
      fetchProducts(currentFilters, 0, false)
    }
    delayedFetch()
  }, []) // Only run on mount

  // Cleanup cache periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now()
      const maxAge = 5 * 60 * 1000 // 5 minutes
      
      setCache(prev => {
        const newCache = new Map()
        for (const [key, value] of prev.entries()) {
          if (now - value.timestamp < maxAge) {
            newCache.set(key, value)
          }
        }
        return newCache
      })
    }, 60000) // Cleanup every minute

    return () => clearInterval(cleanup)
  }, [])

  // Memoized return value
  return useMemo(() => ({
    products,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    searchProducts,
    filterByCategory,
    filterByBrand,
    clearFilters
  }), [
    products,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    searchProducts,
    filterByCategory,
    filterByBrand,
    clearFilters
  ])
}
