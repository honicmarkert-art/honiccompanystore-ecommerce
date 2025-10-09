"use client"

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

/**
 * Performance Optimizer Component
 * 
 * This component implements various performance optimizations:
 * - Preloads critical resources
 * - Implements resource hints
 * - Optimizes loading strategies
 */
export function PerformanceOptimizer() {
  useEffect(() => {
    // Preload critical fonts
    const preloadFonts = () => {
      // Fonts are loaded from Google Fonts in layout.tsx, no need to preload local fonts
      const fontLinks: any[] = []
      
      fontLinks.forEach(font => {
        const link = document.createElement('link')
        link.rel = 'preload'
        link.href = font.href
        link.as = font.as
        link.type = font.type
        if (font.crossorigin) link.crossOrigin = font.crossorigin
        document.head.appendChild(link)
      })
    }

    // Add resource hints for external domains
    const addResourceHints = () => {
      const hints = [
        { rel: 'dns-prefetch', href: 'https://qobobocldfjhdkpjyuuq.supabase.co' },
        { rel: 'preconnect', href: 'https://api.clickpesa.com' },
        { rel: 'preconnect', href: 'https://www.google.com' },
      ]
      
      hints.forEach(hint => {
        const link = document.createElement('link')
        link.rel = hint.rel
        link.href = hint.href
        document.head.appendChild(link)
      })
    }

    // Optimize images loading
    const optimizeImageLoading = () => {
      // Add loading="lazy" to images that don't have it
      const images = document.querySelectorAll('img:not([loading])')
      images.forEach(img => {
        if (!img.hasAttribute('loading')) {
          img.setAttribute('loading', 'lazy')
        }
      })
    }

    // Run optimizations
    preloadFonts()
    addResourceHints()
    optimizeImageLoading()

    // Cleanup function
    return () => {
      // Remove any dynamically added elements if needed
    }
  }, [])

  return null // This component doesn't render anything
}

/**
 * Hook for performance monitoring
 */
export function usePerformanceMonitor() {
  useEffect(() => {
    // Monitor Core Web Vitals
    if (typeof window !== 'undefined' && 'performance' in window) {
      // Monitor Largest Contentful Paint (LCP)
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            logger.log('LCP:', entry.startTime)
          }
        }
      })
      
      try {
        observer.observe({ entryTypes: ['largest-contentful-paint'] })
      } catch (e) {
        // Performance Observer not supported
      }

      // Monitor First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'first-input') {
            logger.log('FID:', entry.processingStart - entry.startTime)
          }
        }
      })
      
      try {
        fidObserver.observe({ entryTypes: ['first-input'] })
      } catch (e) {
        // Performance Observer not supported
      }
    }
  }, [])
}
