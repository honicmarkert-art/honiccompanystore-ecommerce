"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { logger } from '@/lib/logger'

export interface Product {
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
  variants?: ProductVariant[]
  variantImages?: Array<{
    variantId?: number
    imageUrl: string
    attribute?: {name: string, value: string}
    attributes?: Array<{name: string, value: string}>
  }>
  variantConfig?: {
    type: 'simple' | 'primary-dependent' | 'multi-dependent'
    primaryAttribute?: string
    primaryAttributes?: string[]
    attributeOrder?: string[]
  }
  sku?: string
  model?: string
  views?: number
  video?: string
  view360?: string
}

export interface ProductVariant {
  id: string
  price: number
  originalPrice: number
  image?: string
  attributes?: Record<string, string>
  multiValues?: Record<string, string[]>
  primaryValues?: Array<{ attribute: string; value: string; price?: string }>
  inStock: boolean
  sku?: string
  model?: string
  variantType?: string
  primaryAttribute?: string
  dependencies?: Record<string, any>
}

interface UseProductsReturn {
  products: Product[]
  isLoading: boolean
  error: string | null
  retry: () => void
  preloadProducts: () => Promise<void>
  getProductById: (id: number) => Product | undefined
  getProductsByCategory: (category: string) => Product[]
  getProductsByBrand: (brand: string) => Product[]
  fetchFullProductDetails: (productId: number) => Promise<Product | null>
  fetchFullProducts: () => Promise<Product[] | null>
  addProduct: (productData: Omit<Product, 'id'>) => Promise<void>
  updateProduct: (id: number, productData: Partial<Product>) => Promise<void>
  deleteProduct: (id: number) => Promise<void>
  resetToDefault: () => Promise<void>
}

// Enhanced cache for products data
let productsCache: Product[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes (increased for better performance)
let preloadPromise: Promise<Product[]> | null = null
let isInitialized = false

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Rate limiting state
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const hasFetchedRef = useRef(false)

  // Optimized fetch with parameters
  const fetchProductsOptimized = useCallback(async (options: {
    category?: string
    brand?: string
    search?: string
    limit?: number
    offset?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    useMaterializedView?: boolean
    enriched?: boolean
  } = {}) => {
    try {
      setIsLoading(true)
      setError(null)

      const {
        category,
        brand,
        search,
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc',
        useMaterializedView = false,
        enriched = false
      } = options

      let url = '/api/products'
      if (useMaterializedView) {
        url = '/api/products/optimized'
      }

      const params = new URLSearchParams()
      if (category) params.append('category', category)
      if (brand) params.append('brand', brand)
      if (search) params.append('search', search)
      if (limit) params.append('limit', limit.toString())
      if (offset) params.append('offset', offset.toString())
      if (sortBy) params.append('sort_by', sortBy)
      if (sortOrder) params.append('sort_order', sortOrder)
      if (enriched) params.append('enriched', 'true')

      const response = await fetch(`${url}?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setProducts(data.products || [])
      setLastFetchTime(Date.now())
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products'
      setError(errorMessage)
      console.error('Optimized products fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      // Rate limiting check
      const now = Date.now()
      const timeSinceLastFetch = now - lastFetchTime
      const minInterval = 1000 // 1 second minimum between requests

      if (timeSinceLastFetch < minInterval) {
        logger.log('Rate limiting: Too soon since last fetch')
        return
      }

      // Check if we're currently rate limited
      if (isRateLimited) {
        logger.log('Rate limited: Skipping fetch')
        return
      }

      // Don't show loading if we have cached data
      if (productsCache && (now - cacheTimestamp) < CACHE_DURATION) {
        setProducts(productsCache)
        setIsLoading(false)
        setError(null)
        return
      }

      // Only show loading on first fetch or when cache is expired
      if (!isInitialized || !productsCache) {
        setIsLoading(true)
      }
      setError(null)
      setLastFetchTime(now)

      // Check if there's already a preload promise
      if (preloadPromise) {
        const data = await preloadPromise
        // Handle both old (array) and new (object with products array) API response formats
        const productsArray = Array.isArray(data) ? data : (data?.products || [])
        setProducts(productsArray)
        setIsLoading(false)
        return
      }

      // Create new fetch promise with timeout and minimal payload for better performance
      // For admin pages, we need full data including variants
      const isAdminPage = window.location.pathname.startsWith('/admin')
      const apiUrl = isAdminPage ? '/api/products' : '/api/products?minimal=true'
      
      preloadPromise = Promise.race([
        fetch(`${apiUrl}${apiUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        )
      ])
        .then((response: any) => {
          if (response.status === 429) {
            // Handle rate limiting gracefully - don't throw error
            setIsRateLimited(true)
            setError('Too many requests. Please wait a moment and try again.')
            
            // Reset rate limit after 60 seconds
            setTimeout(() => {
              setIsRateLimited(false)
              setError(null)
            }, 60000)
            
            return null // Return null instead of throwing
          }
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          return response.json()
        })
        .then(data => {
          // If data is null (rate limited), don't update cache or state
          if (data === null) {
            return null
          }
          
          // Handle both old (array) and new (object with products array) API response formats
          const productsArray = Array.isArray(data) ? data : (data?.products || [])
          
          // Update cache
          productsCache = productsArray
          cacheTimestamp = now
          preloadPromise = null
          isInitialized = true
          return productsArray
        })

      const data = await preloadPromise
      if (data !== null) {
        // Handle both old (array) and new (object with products array) API response formats
        const productsArray = Array.isArray(data) ? data : (data?.products || [])
        setProducts(productsArray)
        setIsLoading(false)
      } else {
        // If rate limited, still set loading to false
        setIsLoading(false)
      }
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
      preloadPromise = null
      
      // Fallback data removed - relying on API only
    } finally {
      setIsLoading(false)
    }
  }, [lastFetchTime, isRateLimited])

  const retry = useCallback(() => {
    fetchProducts()
  }, [fetchProducts])

  const preloadProducts = useCallback(async () => {
    // Start preloading if not already cached
    const now = Date.now()
    if (!productsCache || (now - cacheTimestamp) >= CACHE_DURATION) {
      if (!preloadPromise) {
        preloadPromise = fetch('/api/products?minimal=true', {
          headers: {
            'Cache-Control': 'max-age=1800' // 30 minutes
          }
        })
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`)
            }
            return response.json()
          })
          .then(data => {
            // Handle both old (array) and new (object with products array) API response formats
            const productsArray = Array.isArray(data) ? data : (data?.products || [])
            productsCache = productsArray
            cacheTimestamp = now
            preloadPromise = null
            isInitialized = true
            return productsArray
          })
          .catch(err => {
            console.error('Error preloading products:', err)
            preloadPromise = null
            throw err
          })
      }
    }
  }, [])

  // Admin functions
  const addProduct = useCallback(async (productData: Omit<Product, 'id'>) => {
    // Optimistic insert with temporary ID; rollback on failure
    const prevProducts = products
    const tempId = -Date.now()
    const tempProduct: Product = {
      id: tempId,
      name: productData.name,
      description: productData.description,
      price: productData.price,
      originalPrice: productData.originalPrice,
      image: productData.image,
      gallery: productData.gallery,
      category: productData.category,
      brand: productData.brand,
      rating: productData.rating,
      reviews: productData.reviews,
      inStock: productData.inStock,
      freeDelivery: productData.freeDelivery,
      sameDayDelivery: productData.sameDayDelivery,
      specifications: productData.specifications,
      variants: productData.variants,
      variantImages: productData.variantImages,
      variantConfig: productData.variantConfig,
      sku: productData.sku,
      model: productData.model,
      views: productData.views,
      video: productData.video,
      view360: productData.view360,
    }
    setProducts(prev => [...prev, tempProduct])

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(productData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const newProduct = await response.json()
      // Replace temp with server product
      setProducts(prev => prev.map(p => (p.id === tempId ? newProduct : p)))
      
      // Clear cache to force refresh (but keep it for a short time to avoid immediate refetch)
      setTimeout(() => {
        productsCache = null
      }, 1000)
    } catch (err) {
      console.error('Error adding product:', err)
      // Rollback optimistic insert
      setProducts(prevProducts)
      throw err
    }
  }, [])

  const updateProduct = useCallback(async (id: number, productData: Partial<Product>) => {
    // Optimistic update; rollback on failure
    const prevProducts = products
    setProducts(prev => prev.map(product => (
      product.id === id ? { ...product, ...productData } as Product : product
    )))

    try {
      const response = await fetch(`/api/products/${id}?t=${Date.now()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include',
        body: JSON.stringify(productData),
      })

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`
        
        if (response.status === 401) {
          errorMessage = 'Authentication required. Please log in to update products.'
        } else if (response.status === 403) {
          errorMessage = 'Admin privileges required to update products.'
        } else if (response.status === 404) {
          errorMessage = 'Product not found.'
        } else if (response.status >= 500) {
          errorMessage = 'Server error. Please try again later.'
        }
        
        throw new Error(errorMessage)
      }

      const updatedProduct = await response.json()
      setProducts(prev => prev.map(product => 
        product.id === id ? updatedProduct : product
      ))
      
      // Clear cache to force refresh (but keep it for a short time to avoid immediate refetch)
      setTimeout(() => {
        productsCache = null
      }, 1000)
      
      return updatedProduct
    } catch (err) {
      console.error('Error updating product:', err)
      // Rollback optimistic update
      setProducts(prevProducts)
      throw err
    }
  }, [])

  const deleteProduct = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      setProducts(prev => prev.filter(product => product.id !== id))
      
      // Clear cache to force refresh (but keep it for a short time to avoid immediate refetch)
      setTimeout(() => {
        productsCache = null
      }, 1000)
    } catch (err) {
      console.error('Error deleting product:', err)
      throw err
    }
  }, [])

  const resetToDefault = useCallback(async () => {
    try {
      const response = await fetch('/api/products/reset', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Refresh products after reset
      await fetchProducts()
    } catch (err) {
      console.error('Error resetting products:', err)
      throw err
    }
  }, [fetchProducts])

  // Memoized helper functions
  const getProductById = useCallback((id: number) => {
    return products.find(product => product.id === id)
  }, [products])

  const getProductsByCategory = useCallback((category: string) => {
    return products.filter(product => product.category === category)
  }, [products])

  const getProductsByBrand = useCallback((brand: string) => {
    return products.filter(product => product.brand === brand)
  }, [products])

  // Fetch full product details when needed (for product detail pages)
  const fetchFullProductDetails = useCallback(async (productId: number) => {
    try {
      // Rate limiting check
      const now = Date.now()
      const timeSinceLastFetch = now - lastFetchTime
      const minInterval = 1000 // 1 second minimum between requests

      if (timeSinceLastFetch < minInterval) {
        logger.log('Rate limiting: Too soon since last fetch for product details')
        return null
      }

      // Check if we're currently rate limited
      if (isRateLimited) {
        logger.log('Rate limited: Skipping product details fetch')
        return null
      }

      setLastFetchTime(now)

      const response = await fetch(`/api/products/${productId}`)
      
      if (response.status === 429) {
        // Handle rate limiting
        setIsRateLimited(true)
        setError('Too many requests. Please wait a moment and try again.')
        
        // Reset rate limit after 60 seconds
        setTimeout(() => {
          setIsRateLimited(false)
          setError(null)
        }, 60000)
        
        return null
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error fetching full product details:', error)
      return null
    }
  }, [lastFetchTime, isRateLimited])

  // Fetch products with full data (including variants) for admin pages
  const fetchFullProducts = useCallback(async () => {
    try {
      const response = await fetch(`/api/products?t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      // Handle both old (array) and new (object with products array) API response formats
      const productsArray = Array.isArray(data) ? data : (data?.products || [])
      setProducts(productsArray)
      productsCache = productsArray
      cacheTimestamp = Date.now()
      return productsArray
    } catch (error) {
      console.error('Error fetching full products:', error)
      return null
    }
  }, [])

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true
      fetchProducts()
    }
  }, [fetchProducts])

  return {
    products,
    isLoading,
    error,
    retry,
    preloadProducts,
    getProductById,
    getProductsByCategory,
    getProductsByBrand,
    fetchFullProductDetails,
    fetchFullProducts,
    fetchProductsOptimized,
    addProduct,
    updateProduct,
    deleteProduct,
    resetToDefault,
  }
} 