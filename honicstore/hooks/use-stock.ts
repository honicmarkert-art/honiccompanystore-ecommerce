"use client"

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

interface StockData {
  id: number
  name: string
  inStock: boolean
  stockQuantity: number | null
  availableStock: number
  effectiveInStock: boolean
}

interface UseStockReturn {
  stockData: Map<number, StockData>
  isLoading: boolean
  error: string | null
  fetchStock: (productIds: number[]) => Promise<void>
  getStock: (productId: number) => StockData | null
  isInStock: (productId: number) => boolean
  getAvailableQuantity: (productId: number) => number
  refreshStock: (productId: number) => Promise<void>
}

// Global cache for stock data
let globalStockCache: Map<number, { data: StockData, timestamp: number }> = new Map()
const CACHE_DURATION = 30 * 1000 // 30 seconds

export function useStock(): UseStockReturn {
  const [stockData, setStockData] = useState<Map<number, StockData>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchStock = useCallback(async (productIds: number[]) => {
    if (productIds.length === 0) return

    setIsLoading(true)
    setError(null)

    try {
      const now = Date.now()
      const uncachedIds: number[] = []
      const cachedResults: StockData[] = []

      // Check global cache first
      for (const id of productIds) {
        const cached = globalStockCache.get(id)
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          cachedResults.push(cached.data)
        } else {
          uncachedIds.push(id)
        }
      }

      // Fetch uncached items from API
      let fetchedResults: StockData[] = []
      if (uncachedIds.length > 0) {
        const response = await fetch(`/api/stock?ids=${uncachedIds.join(',')}`, {
          headers: {
            'Cache-Control': 'no-cache'
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch stock data: ${response.status}`)
        }

        const result = await response.json()
        
        if (result.success) {
          fetchedResults = result.stock || []
          // Update global cache
          for (const stock of fetchedResults) {
            globalStockCache.set(stock.id, { data: stock, timestamp: now })
          }
        }
      }

      // Update local state with all results
      setStockData(prev => {
        const newMap = new Map(prev)
        for (const stock of [...cachedResults, ...fetchedResults]) {
          newMap.set(stock.id, stock)
        }
        return newMap
      })

    } catch (err) {
      console.error('Error fetching stock:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch stock data')
      toast({
        title: "Stock Error",
        description: "Failed to load stock information. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const getStock = useCallback((productId: number): StockData | null => {
    return stockData.get(productId) || null
  }, [stockData])

  const isInStock = useCallback((productId: number): boolean => {
    const stock = stockData.get(productId)
    return stock ? stock.effectiveInStock : false
  }, [stockData])

  const getAvailableQuantity = useCallback((productId: number): number => {
    const stock = stockData.get(productId)
    return stock ? stock.availableStock : 0
  }, [stockData])

  const refreshStock = useCallback(async (productId: number) => {
    // Remove from cache to force fresh fetch
    globalStockCache.delete(productId)
    await fetchStock([productId])
  }, [fetchStock])

  return {
    stockData,
    isLoading,
    error,
    fetchStock,
    getStock,
    isInStock,
    getAvailableQuantity,
    refreshStock
  }
}

// Hook for single product stock
export function useProductStock(productId: number) {
  const { getStock, isInStock, getAvailableQuantity, refreshStock, fetchStock, isLoading } = useStock()
  
  useEffect(() => {
    if (productId) {
      fetchStock([productId])
    }
  }, [productId, fetchStock])

  return {
    stock: getStock(productId),
    isInStock: isInStock(productId),
    availableQuantity: getAvailableQuantity(productId),
    refresh: () => refreshStock(productId),
    isLoading
  }
}











