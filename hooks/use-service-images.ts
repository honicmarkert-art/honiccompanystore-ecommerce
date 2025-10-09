import { useState, useEffect } from 'react'

interface ServiceImage {
  name: string
  url: string
  size?: number
  createdAt: string
}

interface ServiceImagesResponse {
  success: boolean
  serviceId: string
  images: ServiceImage[]
  error?: string
}

export function useServiceImages(serviceId: string) {
  const [images, setImages] = useState<ServiceImage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchImages = async () => {
    if (!serviceId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/service-images?serviceId=${serviceId}`)
      const data: ServiceImagesResponse = await response.json()

      if (data.success) {
        setImages(data.images)
      } else {
        setError(data.error || 'Failed to fetch images')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const deleteImage = async (fileName: string) => {
    try {
      const response = await fetch(`/api/admin/service-images?serviceId=${serviceId}&fileName=${fileName}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      if (data.success) {
        // Remove the deleted image from state
        setImages(prev => prev.filter(img => img.name !== fileName))
        return true
      } else {
        setError(data.error || 'Failed to delete image')
        return false
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      return false
    }
  }

  useEffect(() => {
    fetchImages()
  }, [serviceId])

  return {
    images,
    loading,
    error,
    refetch: fetchImages,
    deleteImage
  }
}








