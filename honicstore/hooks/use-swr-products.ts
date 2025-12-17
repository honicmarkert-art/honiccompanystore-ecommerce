"use client"

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'

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

interface UseSWRProductsOptions {
  category?: string
  brand?: string
  search?: string
  limit?: number
  offset?: number
  enabled?: boolean
}

interface UseSWRProductsReturn {
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
  loadProducts: () => void
  isManualLoad: boolean
}

// SWR fetcher with rate limiting
const fetcher = async (url: string): Promise<Product[]> => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (response.status === 429) {
    throw new Error('RATE_LIMITED')
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// SWR mutation for manual loading
const mutationFetcher = async (url: string): Promise<Product[]> => {
  return fetcher(url)
}

/**
 * SWR-based products hook with proper rate limiting and caching
 * 
 * Features:
 * - No infinite requests (SWR handles deduplication)
 * - Graceful 429 handling (shows friendly error instead of crashing)
 * - Manual loading (only fetch when user clicks "Load Products")
 * - Built-in caching and revalidation
 * - Rate limiting with SWR
 */
export function useSWRProducts(options: UseSWRProductsOptions = {}): UseSWRProductsReturn {
  const {
    category,
    brand,
    search,
    limit = 20,
    offset = 0,
    enabled = false // Start disabled for manual loading
  } = options

  const [isManualLoad, setIsManualLoad] = useState(false)
  const [currentOffset, setCurrentOffset] = useState(0)
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [currentFilters, setCurrentFilters] = useState({ category, brand, search })

  // Build API endpoint
  const buildEndpoint = useCallback((currentOffset = 0, filters = currentFilters) => {
    const params = new URLSearchParams({
      minimal: 'true',
      limit: limit.toString(),
      offset: currentOffset.toString()
    })

    if (filters.category) params.append('category', filters.category)
    if (filters.brand) params.append('brand', filters.brand)
    if (filters.search) params.append('search', filters.search)

    return `/api/products?${params.toString()}`
  }, [limit, currentFilters])

  // SWR for automatic data fetching
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? buildEndpoint(currentOffset) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000, // 5 seconds deduplication
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      onError: (error) => {
        console.error('SWR Error:', error)
      }
    }
  )

  // SWR mutation for manual loading
  const { trigger: triggerLoad, isMutating: isLoadingMore } = useSWRMutation(
    buildEndpoint(currentOffset),
    mutationFetcher,
    {
      onSuccess: (data) => {
        if (currentOffset === 0) {
          setAllProducts(data)
        } else {
          setAllProducts(prev => [...prev, ...data])
        }
        setCurrentOffset(prev => prev + limit)
      },
      onError: (error) => {
        console.error('Mutation Error:', error)
      }
    }
  )

  // Check if rate limited
  const isRateLimited = error?.message === 'RATE_LIMITED'
  const hasMore = data ? data.length === limit : false

  // Manual load function
  const loadProducts = useCallback(() => {
    setIsManualLoad(true)
    setCurrentOffset(0)
    setAllProducts([])
    triggerLoad()
  }, [triggerLoad])

  // Load more products
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || isRateLimited) {
      return
    }
    triggerLoad()
  }, [isLoadingMore, hasMore, isRateLimited, triggerLoad])

  // Refresh all data
  const refresh = useCallback(() => {
    setCurrentOffset(0)
    setAllProducts([])
    mutate()
  }, [mutate])

  // Search products
  const searchProducts = useCallback((query: string) => {
    const newFilters = { ...currentFilters, search: query }
    setCurrentFilters(newFilters)
    setCurrentOffset(0)
    setAllProducts([])
    setIsManualLoad(true)
    
    // Use mutation for search
    const searchEndpoint = buildEndpoint(0, newFilters)
    fetch(searchEndpoint)
      .then(response => {
        if (response.status === 429) {
          throw new Error('RATE_LIMITED')
        }
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        setAllProducts(data)
        setCurrentOffset(limit)
      })
      .catch(err => {
        console.error('Error searching products:', err)
      })
  }, [currentFilters, buildEndpoint, limit])

  // Filter by category
  const filterByCategory = useCallback((categorySlug: string) => {
    const newFilters = { ...currentFilters, category: categorySlug, search: '' }
    setCurrentFilters(newFilters)
    setCurrentOffset(0)
    setAllProducts([])
    setIsManualLoad(true)
    
    const categoryEndpoint = buildEndpoint(0, newFilters)
    fetch(categoryEndpoint)
      .then(response => {
        if (response.status === 429) {
          throw new Error('RATE_LIMITED')
        }
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        setAllProducts(data)
        setCurrentOffset(limit)
      })
      .catch(err => {
        console.error('Error filtering by category:', err)
      })
  }, [currentFilters, buildEndpoint, limit])

  // Filter by brand
  const filterByBrand = useCallback((brandName: string) => {
    const newFilters = { ...currentFilters, brand: brandName }
    setCurrentFilters(newFilters)
    setCurrentOffset(0)
    setAllProducts([])
    setIsManualLoad(true)
    
    const brandEndpoint = buildEndpoint(0, newFilters)
    fetch(brandEndpoint)
      .then(response => {
        if (response.status === 429) {
          throw new Error('RATE_LIMITED')
        }
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        setAllProducts(data)
        setCurrentOffset(limit)
      })
      .catch(err => {
        console.error('Error filtering by brand:', err)
      })
  }, [currentFilters, buildEndpoint, limit])

  // Clear all filters
  const clearFilters = useCallback(() => {
    const newFilters = { category: undefined, brand: undefined, search: undefined }
    setCurrentFilters(newFilters)
    setCurrentOffset(0)
    setAllProducts([])
    setIsManualLoad(true)
    
    const clearEndpoint = buildEndpoint(0, newFilters)
    fetch(clearEndpoint)
      .then(response => {
        if (response.status === 429) {
          throw new Error('RATE_LIMITED')
        }
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        setAllProducts(data)
        setCurrentOffset(limit)
      })
      .catch(err => {
        console.error('Error clearing filters:', err)
      })
  }, [buildEndpoint, limit])

  return {
    products: allProducts.length > 0 ? allProducts : (data || []),
    isLoading: isLoading && !isManualLoad,
    isLoadingMore,
    hasMore,
    error: error?.message === 'RATE_LIMITED' ? 'Too many requests. Please wait a moment and try again.' : error?.message || null,
    isRateLimited,
    loadMore,
    refresh,
    searchProducts,
    filterByCategory,
    filterByBrand,
    clearFilters,
    loadProducts,
    isManualLoad
  }
}




