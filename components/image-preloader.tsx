"use client"

import { useEffect } from 'react'

interface ImagePreloaderProps {
  images: string[]
  priority?: boolean
}

/**
 * Image Preloader Component
 * 
 * Preloads images to reduce loading time and eliminate flicker
 */
export function ImagePreloader({ images, priority = false }: ImagePreloaderProps) {
  useEffect(() => {
    if (!priority) return

    // Preload critical images
    images.forEach((src) => {
      if (src && typeof src === 'string') {
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'image'
        link.href = src
        link.crossOrigin = 'anonymous'
        document.head.appendChild(link)
      }
    })

    // Cleanup function
    return () => {
      // Remove preload links when component unmounts
      const preloadLinks = document.querySelectorAll('link[rel="preload"][as="image"]')
      preloadLinks.forEach(link => {
        if (images.includes(link.getAttribute('href') || '')) {
          link.remove()
        }
      })
    }
  }, [images, priority])

  return null
}

/**
 * Hook to preload images programmatically
 */
export function useImagePreloader() {
  const preloadImage = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
      img.src = src
    })
  }

  const preloadImages = async (sources: string[]): Promise<void[]> => {
    return Promise.all(sources.map(preloadImage))
  }

  return { preloadImage, preloadImages }
}