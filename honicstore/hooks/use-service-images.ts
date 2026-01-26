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
    // Admin API removed - service images not available without admin access
    setLoading(true)
    setError(null)
    setImages([])
    setLoading(false)
  }

  const deleteImage = async (fileName: string) => {
    // Admin API removed - service images not available without admin access
    return false
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








