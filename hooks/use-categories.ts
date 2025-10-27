import { useState, useEffect, useCallback } from 'react'

interface UseCategoriesReturn {
  categories: string[]
  categoriesDetailed: { 
    id: number | string; 
    name: string; 
    slug: string;
    parent_id?: number;
    parent_name?: string;
    is_main: boolean;
  }[]
  mainCategories: { id: number | string; name: string; slug: string }[]
  subCategories: { id: number | string; name: string; slug: string; parent_name?: string }[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<string[]>([])
  const [categoriesDetailed, setCategoriesDetailed] = useState<{ 
    id: number | string; 
    name: string; 
    slug: string;
    parent_id?: number;
    parent_name?: string;
    is_main: boolean;
  }[]>([])
  const [mainCategories, setMainCategories] = useState<{ id: number | string; name: string; slug: string }[]>([])
  const [subCategories, setSubCategories] = useState<{ id: number | string; name: string; slug: string; parent_name?: string }[]>([])
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
          slug: c.slug ?? (String(c.name ?? c).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')),
          parent_id: c.parent_id,
          parent_name: c.parent_name,
          is_main: c.is_main ?? !c.parent_id
        }))
        setCategoriesDetailed(detailed)
        setCategories(detailed.map(c => c.name))
        
        // Separate main categories and subcategories
        const mainCats = detailed.filter(c => c.is_main).map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug
        }))
        const subCats = detailed.filter(c => !c.is_main).map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          parent_name: c.parent_name
        }))
        
        setMainCategories(mainCats)
        setSubCategories(subCats)
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
    mainCategories,
    subCategories,
    isLoading,
    error,
    refetch: fetchCategories
  }
}
