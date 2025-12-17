"use client"

import { useState, useCallback } from 'react'

interface ImageSearchResult {
  success: boolean
  products: any[]
  keywords: string[]
  searchType: string
  totalCount: number
}

interface UseImageSearchReturn {
  searchByImage: (file: File) => Promise<ImageSearchResult | null>
  isLoading: boolean
  error: string | null
  clearError: () => void
}

export function useImageSearch(): UseImageSearchReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchByImage = useCallback(async (file: File): Promise<ImageSearchResult | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/image-search', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result: ImageSearchResult = await response.json()
      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search by image'
      setError(errorMessage)
      console.error('Image search error:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    searchByImage,
    isLoading,
    error,
    clearError
  }
}
