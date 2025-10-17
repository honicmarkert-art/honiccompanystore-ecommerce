"use client"

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useCompanyContext } from '@/components/company-provider'

interface PrefetchConfig {
  routes: string[]
  priority: 'high' | 'medium' | 'low'
  condition?: () => boolean
  delay?: number
}

/**
 * Advanced Route Prefetcher Component
 * 
 * Intelligently prefetches routes based on user behavior and context
 */
export function AdvancedRoutePrefetcher() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuth()
  const { companyName } = useCompanyContext()
  const prefetchedRoutes = useRef<Set<string>>(new Set())
  const prefetchTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Route configurations based on user state and current page
  const getRouteConfigs = useCallback((): PrefetchConfig[] => {
    const baseRoutes = [
      {
        routes: ['/products'], // Only prefetch products page
        priority: 'high' as const,
        condition: () => true,
        delay: 2000 // Increased delay to reduce API load
      }
    ]

    if (isAuthenticated) {
      baseRoutes.push(
        {
          routes: ['/profile'], // Only prefetch profile for authenticated users
          priority: 'medium' as const,
          condition: () => true,
          delay: 5000 // Much longer delay for authenticated routes
        }
      )
    }

    // Disable category and product detail prefetching to reduce API load
    // Only prefetch essential routes

    return baseRoutes
  }, [isAuthenticated, pathname])

  // Prefetch a single route
  const prefetchRoute = useCallback((route: string) => {
    if (prefetchedRoutes.current.has(route)) {
      return // Already prefetched
    }

    try {
      // Use Next.js router prefetch
      router.prefetch(route)
      prefetchedRoutes.current.add(route)
      
      // Also prefetch API routes if needed
      if (route.startsWith('/products')) {
        router.prefetch('/api/products')
      }
      if (route.startsWith('/cart')) {
        router.prefetch('/api/cart')
      }
      
    } catch (error) {
    }
  }, [router])

  // Prefetch routes with delay
  const prefetchWithDelay = useCallback((routes: string[], delay: number) => {
    routes.forEach(route => {
      const timeoutId = setTimeout(() => {
        prefetchRoute(route)
        prefetchTimeouts.current.delete(route)
      }, delay)
      
      prefetchTimeouts.current.set(route, timeoutId)
    })
  }, [prefetchRoute])

  // Intelligent prefetching based on user behavior
  const intelligentPrefetch = useCallback(() => {
    const configs = getRouteConfigs()
    
    configs.forEach(config => {
      if (config.condition && !config.condition()) {
        return // Skip if condition not met
      }

      const delay = config.delay || 0
      prefetchWithDelay(config.routes, delay)
    })
  }, [getRouteConfigs, prefetchWithDelay])

  // Prefetch on page load
  useEffect(() => {
    // Immediate prefetch for high priority routes
    const highPriorityConfigs = getRouteConfigs().filter(config => config.priority === 'high')
    highPriorityConfigs.forEach(config => {
      if (config.condition && config.condition()) {
        prefetchWithDelay(config.routes, config.delay || 0)
      }
    })

    // Delayed prefetch for medium and low priority routes
    const delayedConfigs = getRouteConfigs().filter(config => 
      config.priority === 'medium' || config.priority === 'low'
    )
    
    const delayedTimeout = setTimeout(() => {
      delayedConfigs.forEach(config => {
        if (config.condition && config.condition()) {
          prefetchWithDelay(config.routes, config.delay || 1000)
        }
      })
    }, 2000) // Start delayed prefetch after 2 seconds

    return () => {
      clearTimeout(delayedTimeout)
      // Clear all prefetch timeouts
      prefetchTimeouts.current.forEach(timeout => clearTimeout(timeout))
      prefetchTimeouts.current.clear()
    }
  }, [getRouteConfigs, prefetchWithDelay])

  // Prefetch on user interaction
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Prefetch routes when user moves mouse (indicating activity)
      const target = e.target as HTMLElement
      if (target && target.closest('a[href]')) {
        const link = target.closest('a[href]') as HTMLAnchorElement
        if (link && link.href) {
          const url = new URL(link.href)
          if (url.origin === window.location.origin) {
            const route = url.pathname + url.search
            if (!prefetchedRoutes.current.has(route)) {
              // Prefetch on hover with small delay
              setTimeout(() => prefetchRoute(route), 100)
            }
          }
        }
      }
    }

    const handleScroll = () => {
      // Prefetch more routes when user scrolls (indicating engagement)
      const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      if (scrollPercent > 50 && !prefetchedRoutes.current.has('scroll-triggered')) {
        prefetchedRoutes.current.add('scroll-triggered')
        // Prefetch additional routes on scroll
        const additionalRoutes = ['/support', '/about', '/contact']
        prefetchWithDelay(additionalRoutes, 500)
      }
    }

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [prefetchRoute, prefetchWithDelay])

  // Prefetch on visibility change (when user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // User returned to tab, prefetch current context routes
        intelligentPrefetch()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [intelligentPrefetch])

  // Prefetch on network status change
  useEffect(() => {
    const handleOnline = () => {
      // Network came back online, prefetch important routes
      const importantRoutes = ['/products', '/cart']
      prefetchWithDelay(importantRoutes, 0)
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [prefetchWithDelay])

  return null // This component doesn't render anything
}

/**
 * Hook for manual route prefetching
 */
export function useRoutePrefetch() {
  const router = useRouter()
  const prefetchedRoutes = useRef<Set<string>>(new Set())

  const prefetchRoute = useCallback((route: string, priority: 'high' | 'medium' | 'low' = 'medium') => {
    if (prefetchedRoutes.current.has(route)) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      try {
        router.prefetch(route)
        prefetchedRoutes.current.add(route)
        resolve()
      } catch (error) {
        resolve()
      }
    })
  }, [router])

  const prefetchMultiple = useCallback(async (routes: string[], priority: 'high' | 'medium' | 'low' = 'medium') => {
    const promises = routes.map(route => prefetchRoute(route, priority))
    await Promise.all(promises)
  }, [prefetchRoute])

  return {
    prefetchRoute,
    prefetchMultiple,
    isPrefetched: (route: string) => prefetchedRoutes.current.has(route)
  }
}
