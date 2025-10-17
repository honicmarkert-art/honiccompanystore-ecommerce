"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Product } from './use-products'

interface UseProductsByIdsReturn {
  products: Product[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useProductsByIds(productIds: number[]): UseProductsByIdsReturn {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Memoize the productIds to prevent unnecessary re-renders
  const memoizedProductIds = useMemo(() => productIds, [productIds.join(',')])

  const fetchProducts = useCallback(async () => {
    if (memoizedProductIds.length === 0) {
      setProducts([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/products/by-ids?ids=${memoizedProductIds.join(',')}`)
      if (!response.ok) {
        throw new Error('Failed to fetch products')
      }
      const data = await response.json()
      setProducts(data.products || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [memoizedProductIds])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return {
    products,
    loading,
    error,
    refetch: fetchProducts
  }
}
