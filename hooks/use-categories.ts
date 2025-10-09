import { useState, useEffect, useCallback } from 'react'

interface UseCategoriesReturn {
  categories: string[]
  categoriesDetailed: { id: number | string; name: string; slug: string }[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<string[]>([])
  const [categoriesDetailed, setCategoriesDetailed] = useState<{ id: number | string; name: string; slug: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/categories', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        const raw = Array.isArray(data.categories) ? data.categories : []
        const detailed = raw.map((c: any, i: number) => ({
          id: c.id ?? i,
          name: c.name ?? String(c),
          slug: c.slug ?? (String(c.name ?? c).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
        }))
        setCategoriesDetailed(detailed)
        setCategories(detailed.map(c => c.name))
      } else {
        throw new Error(data.error || 'Failed to fetch categories')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch categories'
      setError(errorMessage)
      console.error('Categories fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  return {
    categories,
    categoriesDetailed,
    isLoading,
    error,
    refetch: fetchCategories
  }
}
