"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRobustApiFetch } from '@/lib/robust-api-fetch'

interface Product {
  id: number
  name: string
  description: string
  price: number
  originalPrice: number
  image: string
  gallery: string[]
  category: string
  brand: string
  rating: number
  reviews: number
  inStock: boolean
  freeDelivery?: boolean
  sameDayDelivery?: boolean
  specifications: Record<string, any>
  variants?: any[]
  variantImages?: any[]
  variantConfig?: any
  sku?: string
  model?: string
  views?: number
  video?: string
  view360?: string
}

interface UseRobustProductsOptions {
  category?: string
  brand?: string
  search?: string
  limit?: number
  enableInfiniteScroll?: boolean
}

interface UseRobustProductsReturn {
  products: Product[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  isRateLimited: boolean
  loadMore: () => void
  refresh: () => void
  searchProducts: (query: string) => void
  filterByCategory: (category: string) => void
  filterByBrand: (brand: string) => void
  clearFilters: () => void
}

/**
 * Robust products hook with:
 * - No infinite requests (prevents re-fetch if already fetching)
 * - Graceful 429 handling (shows friendly error instead of crashing)
 * - Single mount fetch (useEffect with correct deps)
 * - Manual refetch capability
 */
export function useRobustProducts(options: UseRobustProductsOptions = {}): UseRobustProductsReturn {
  const {
    category,
    brand,
    search,
    limit = 20,
    enableInfiniteScroll = true
  } = options

  const [products, setProducts] = useState<Product[]>([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [currentFilters, setCurrentFilters] = useState({ category, brand, search })
  const [allProducts, setAllProducts] = useState<Product[]>([])

  // Update filters when props change
  useEffect(() => {
    setCurrentFilters({ category, brand, search })
  }, [category, brand, search])

  // Build API endpoint
  const buildEndpoint = useCallback((currentOffset = 0, filters = currentFilters) => {
    const params = new URLSearchParams({
      minimal: 'true',
      limit: limit.toString(),
      offset: currentOffset.toString()
    })

    if (filters.category) {
      params.append('category', filters.category)
    }
    if (filters.brand) params.append('brand', filters.brand)
    if (filters.search) params.append('search', filters.search)

    const endpoint = `/api/products?${params.toString()}`
    return endpoint
  }, [limit, currentFilters])

  // Use robust API fetch
  const { data, isLoading, error, refetch, isRateLimited } = useRobustApiFetch<Product[]>(
    buildEndpoint(),
    {
      retryDelay: 1000,
      maxRetries: 3,
      rateLimitCooldown: 60000
    }
  )

  // Update products when data changes
  useEffect(() => {
    if (data) {
      // Extract products array from response (handle both old array and new object format)
      const productsArray = Array.isArray(data) ? data : (data.products || [])
      const paginationInfo = data.pagination || null
      
      if (offset === 0) {
        // First load or filter change - remove duplicates
        const uniqueProducts = productsArray.filter((product, index, self) => 
          index === self.findIndex(p => p.id === product.id)
        )
        setProducts(uniqueProducts)
        setAllProducts(uniqueProducts)
      } else {
        // Load more - remove duplicates when adding
        setProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const newUniqueProducts = productsArray.filter(p => !existingIds.has(p.id))
          return [...prev, ...newUniqueProducts]
        })
        setAllProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const newUniqueProducts = productsArray.filter(p => !existingIds.has(p.id))
          return [...prev, ...newUniqueProducts]
        })
      }
      
      // Use pagination info if available, otherwise fallback to array length check
      setHasMore(paginationInfo ? paginationInfo.hasMore : productsArray.length === limit)
    }
  }, [data, offset, limit])

  // Fetch once on mount with correct dependencies
  useEffect(() => {
    // Only fetch if we don't have data and we're not already loading
    if (!isLoading && !data && !error) {
      refetch()
    }
  }, [isLoading, data, error, refetch])

  // Load more products
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || isLoading || isRateLimited) {
      return // Prevent infinite requests
    }

    setIsLoadingMore(true)
    const newOffset = offset + limit
    setOffset(newOffset)

    // Fetch more products
    fetch(buildEndpoint(newOffset))
      .then(response => {
        if (response.status === 429) {
          // Handle rate limiting gracefully - don't throw error
          console.warn('Rate limited when loading more products')
          return null // Return null instead of throwing
        }
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then(newData => {
        if (newData) {
          // Remove duplicates when adding new products
          setProducts(prev => {
            const existingIds = new Set(prev.map(p => p.id))
            const newUniqueProducts = newData.filter(p => !existingIds.has(p.id))
            return [...prev, ...newUniqueProducts]
          })
          setAllProducts(prev => {
            const existingIds = new Set(prev.map(p => p.id))
            const newUniqueProducts = newData.filter(p => !existingIds.has(p.id))
            return [...prev, ...newUniqueProducts]
          })
          setHasMore(newData.length === limit)
        }
        // If newData is null (rate limited), don't update state
      })
      .catch(err => {
        console.error('Error loading more products:', err)
        // Don't update state on error to prevent UI issues
      })
      .finally(() => {
        setIsLoadingMore(false)
      })
  }, [isLoadingMore, hasMore, isLoading, isRateLimited, offset, limit, buildEndpoint])

  // Refresh all data
  const refresh = useCallback(() => {
    setOffset(0)
    setProducts([])
    setAllProducts([])
    setHasMore(true)
    refetch()
  }, [refetch])

  // Search products
  const searchProducts = useCallback((query: string) => {
    const newFilters = { ...currentFilters, search: query }
    setCurrentFilters(newFilters)
    setOffset(0)
    setProducts([])
    setAllProducts([])
    setHasMore(true)
    
    // Update endpoint and refetch
    const newEndpoint = buildEndpoint(0, newFilters)
    fetch(newEndpoint)
      .then(response => {
        if (response.status === 429) {
          throw new Error('Rate limited')
        }
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        // Extract products array from response (handle both old array and new object format)
        const productsArray = Array.isArray(data) ? data : (data.products || [])
        
        // Remove duplicates
        const uniqueProducts = productsArray.filter((product, index, self) => 
          index === self.findIndex(p => p.id === product.id)
        )
        setProducts(uniqueProducts)
        setAllProducts(uniqueProducts)
        setHasMore(uniqueProducts.length === limit)
      })
      .catch(err => {
        console.error('Error searching products:', err)
      })
  }, [currentFilters, buildEndpoint, limit])

  // Filter by category
  const filterByCategory = useCallback((categorySlug: string) => {
    const newFilters = { ...currentFilters, category: categorySlug, search: '' }
    setCurrentFilters(newFilters)
    setOffset(0)
    setProducts([])
    setAllProducts([])
    setHasMore(true)
    
    // Update endpoint and refetch
    const newEndpoint = buildEndpoint(0, newFilters)
    fetch(newEndpoint)
      .then(response => {
        if (response.status === 429) {
          throw new Error('Rate limited')
        }
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        // Extract products array from response (handle both old array and new object format)
        const productsArray = Array.isArray(data) ? data : (data.products || [])
        
        // Remove duplicates
        const uniqueProducts = productsArray.filter((product, index, self) => 
          index === self.findIndex(p => p.id === product.id)
        )
        setProducts(uniqueProducts)
        setAllProducts(uniqueProducts)
        setHasMore(uniqueProducts.length === limit)
      })
      .catch(err => {
        console.error('Error filtering by category:', err)
      })
  }, [currentFilters, buildEndpoint, limit])

  // Filter by brand
  const filterByBrand = useCallback((brandName: string) => {
    const newFilters = { ...currentFilters, brand: brandName }
    setCurrentFilters(newFilters)
    setOffset(0)
    setProducts([])
    setAllProducts([])
    setHasMore(true)
    
    // Update endpoint and refetch
    const newEndpoint = buildEndpoint(0, newFilters)
    fetch(newEndpoint)
      .then(response => {
        if (response.status === 429) {
          throw new Error('Rate limited')
        }
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        // Extract products array from response (handle both old array and new object format)
        const productsArray = Array.isArray(data) ? data : (data.products || [])
        
        // Remove duplicates
        const uniqueProducts = productsArray.filter((product, index, self) => 
          index === self.findIndex(p => p.id === product.id)
        )
        setProducts(uniqueProducts)
        setAllProducts(uniqueProducts)
        setHasMore(uniqueProducts.length === limit)
      })
      .catch(err => {
        console.error('Error filtering by brand:', err)
      })
  }, [currentFilters, buildEndpoint, limit])

  // Clear all filters
  const clearFilters = useCallback(() => {
    const newFilters = { category: undefined, brand: undefined, search: undefined }
    setCurrentFilters(newFilters)
    setOffset(0)
    setProducts([])
    setAllProducts([])
    setHasMore(true)
    
    // Update endpoint and refetch
    const newEndpoint = buildEndpoint(0, newFilters)
    fetch(newEndpoint)
      .then(response => {
        if (response.status === 429) {
          throw new Error('Rate limited')
        }
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        // Extract products array from response (handle both old array and new object format)
        const productsArray = Array.isArray(data) ? data : (data.products || [])
        
        // Remove duplicates
        const uniqueProducts = productsArray.filter((product, index, self) => 
          index === self.findIndex(p => p.id === product.id)
        )
        setProducts(uniqueProducts)
        setAllProducts(uniqueProducts)
        setHasMore(uniqueProducts.length === limit)
      })
      .catch(err => {
        console.error('Error clearing filters:', err)
      })
  }, [buildEndpoint, limit])

  return {
    products,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    isRateLimited,
    loadMore,
    refresh,
    searchProducts,
    filterByCategory,
    filterByBrand,
    clearFilters
  }
}
