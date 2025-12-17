"use client"

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { logger } from '@/lib/logger'

interface PerformanceMetrics {
  pageLoadTime: number
  navigationTime: number
  memoryUsage?: number
}

export function PerformanceMonitor() {
  const pathname = usePathname()
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    pageLoadTime: 0,
    navigationTime: 0,
  })

  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development') return

    const startTime = performance.now()

    // Measure page load time
    const measurePageLoad = () => {
      const loadTime = performance.now() - startTime
      
      // Get memory usage if available
      const memoryUsage = (performance as any).memory?.usedJSHeapSize

      setMetrics({
        pageLoadTime: loadTime,
        navigationTime: 0,
        memoryUsage: memoryUsage ? Math.round(memoryUsage / 1024 / 1024) : undefined,
      })

      // Log performance metrics
      logger.log(`🚀 Page Load Performance:`, {
        path: pathname,
        loadTime: `${loadTime.toFixed(2)}ms`,
        memoryUsage: memoryUsage ? `${Math.round(memoryUsage / 1024 / 1024)}MB` : 'N/A',
      })
    }

    // Use requestIdleCallback for better performance
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(measurePageLoad, { timeout: 1000 })
    } else {
      setTimeout(measurePageLoad, 100)
    }
  }, [pathname])

  // Only show in development
  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs z-50">
      <div>Load: {metrics.pageLoadTime.toFixed(0)}ms</div>
      {metrics.memoryUsage && (
        <div>Memory: {metrics.memoryUsage}MB</div>
      )}
    </div>
  )
}

// Hook for measuring navigation performance
export function useNavigationPerformance() {
  const [navigationStart, setNavigationStart] = useState<number | null>(null)

  const startNavigation = () => {
    setNavigationStart(performance.now())
  }

  const endNavigation = () => {
    if (navigationStart) {
      const navigationTime = performance.now() - navigationStart
      logger.log(`🧭 Navigation Time: ${navigationTime.toFixed(2)}ms`)
      setNavigationStart(null)
      return navigationTime
    }
    return 0
  }

  return { startNavigation, endNavigation }
} 