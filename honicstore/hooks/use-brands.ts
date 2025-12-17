import { useState, useEffect, useCallback } from 'react'

interface UseBrandsReturn {
  brands: string[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useBrands(): UseBrandsReturn {
  const [brands, setBrands] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBrands = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/brands', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        setBrands(data.brands || [])
      } else {
        throw new Error(data.error || 'Failed to fetch brands')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch brands'
      setError(errorMessage)
      console.error('Brands fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBrands()
  }, [fetchBrands])

  return {
    brands,
    isLoading,
    error,
    refetch: fetchBrands
  }
}



