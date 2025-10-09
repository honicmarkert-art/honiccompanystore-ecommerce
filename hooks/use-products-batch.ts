import { useState, useEffect, useCallback, useMemo } from 'react'

interface Product {
  id: number
  name: string
  price: number
  original_price?: number
  description?: string
  short_description?: string
  image_url?: string
  thumbnail_url?: string
  category?: string
  brand?: string
  in_stock: boolean
  stock_quantity?: number
  rating?: number
  review_count?: number
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

interface BatchProductsResponse {
  products: Product[]
  count: number
  requested: number
  cached: boolean
}

interface UseProductsBatchOptions {
  batchSize?: number
  cacheTime?: number
  enabled?: boolean
}

interface UseProductsBatchReturn {
  products: Product[]
  isLoading: boolean
  error: string | null
  fetchProducts: (ids: number[]) => Promise<void>
  getProduct: (id: number) => Product | undefined
  clearCache: () => void
}

// Simple in-memory cache
const cache = new Map<string, { data: Product[]; timestamp: number }>()

export function useProductsBatch(options: UseProductsBatchOptions = {}): UseProductsBatchReturn {
  const { batchSize = 50, cacheTime = 5 * 60 * 1000, enabled = true } = options
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Clear expired cache entries
  const clearExpiredCache = useCallback(() => {
    const now = Date.now()
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > cacheTime) {
        cache.delete(key)
      }
    }
  }, [cacheTime])

  // Generate cache key for a batch of IDs
  const getCacheKey = useCallback((ids: number[]) => {
    return `batch:${ids.sort().join(',')}`
  }, [])

  // Fetch products by IDs with batching and caching
  const fetchProducts = useCallback(async (ids: number[]) => {
    if (!enabled || ids.length === 0) return

    clearExpiredCache()
    setIsLoading(true)
    setError(null)

    try {
      // Check cache first
      const cacheKey = getCacheKey(ids)
      const cached = cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < cacheTime) {
        setProducts(cached.data)
        setIsLoading(false)
        return
      }

      // Batch requests if needed
      const batches: number[][] = []
      for (let i = 0; i < ids.length; i += batchSize) {
        batches.push(ids.slice(i, i + batchSize))
      }

      const allProducts: Product[] = []
      
      // Process batches in parallel
      const batchPromises = batches.map(async (batch) => {
        const response = await fetch(`/api/products/batch?ids=${batch.join(',')}`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch batch: ${response.statusText}`)
        }
        
        const data: BatchProductsResponse = await response.json()
        return data.products
      })

      const batchResults = await Promise.all(batchPromises)
      
      // Flatten results
      batchResults.forEach(batchProducts => {
        allProducts.push(...batchProducts)
      })

      // Cache the results
      cache.set(cacheKey, {
        data: allProducts,
        timestamp: Date.now()
      })

      setProducts(allProducts)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products'
      setError(errorMessage)
      console.error('Batch products fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [enabled, batchSize, cacheTime, clearExpiredCache, getCacheKey])

  // Get a single product by ID from current products
  const getProduct = useCallback((id: number): Product | undefined => {
    return products.find(product => product.id === id)
  }, [products])

  // Clear all cache
  const clearCache = useCallback(() => {
    cache.clear()
    setProducts([])
  }, [])

  // Memoized return value
  const returnValue = useMemo(() => ({
    products,
    isLoading,
    error,
    fetchProducts,
    getProduct,
    clearCache
  }), [products, isLoading, error, fetchProducts, getProduct, clearCache])

  return returnValue
}

// Hook for fetching a single product with automatic batching
export function useProduct(id: number, options: UseProductsBatchOptions = {}) {
  const { products, isLoading, error, fetchProducts, getProduct } = useProductsBatch(options)
  const [product, setProduct] = useState<Product | undefined>()

  useEffect(() => {
    if (id && !isLoading) {
      const foundProduct = getProduct(id)
      if (foundProduct) {
        setProduct(foundProduct)
      } else {
        // Fetch this single product
        fetchProducts([id])
      }
    }
  }, [id, products, isLoading, getProduct, fetchProducts])

  useEffect(() => {
    if (products.length > 0) {
      const foundProduct = getProduct(id)
      setProduct(foundProduct)
    }
  }, [products, id, getProduct])

  return {
    product,
    isLoading,
    error
  }
}

// Hook for prefetching products on hover
export function useProductPrefetch() {
  const { fetchProducts } = useProductsBatch({ enabled: false })

  const prefetchProduct = useCallback((id: number) => {
    fetchProducts([id])
  }, [fetchProducts])

  const prefetchProducts = useCallback((ids: number[]) => {
    fetchProducts(ids)
  }, [fetchProducts])

  return {
    prefetchProduct,
    prefetchProducts
  }
}



