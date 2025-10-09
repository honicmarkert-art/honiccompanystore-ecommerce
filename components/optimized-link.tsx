"use client"

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState, useEffect } from 'react'
import { useRoutePrefetch } from './advanced-route-prefetcher'

interface OptimizedLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  prefetch?: boolean | 'hover' | 'visible' | 'always'
  priority?: 'high' | 'medium' | 'low'
  onHover?: () => void
  onVisible?: () => void
  replace?: boolean
  scroll?: boolean
  shallow?: boolean
  [key: string]: any
}

/**
 * Optimized Link Component
 * 
 * Enhanced Next.js Link with intelligent prefetching and performance optimizations
 */
export function OptimizedLink({
  href,
  children,
  className,
  prefetch = 'hover',
  priority = 'medium',
  onHover,
  onVisible,
  replace = false,
  scroll = true,
  shallow = false,
  ...props
}: OptimizedLinkProps) {
  const router = useRouter()
  const { prefetchRoute } = useRoutePrefetch()
  const [isPrefetched, setIsPrefetched] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const prefetchTimeoutRef = useRef<NodeJS.Timeout>()

  // Handle prefetching based on strategy
  const handlePrefetch = useCallback(async () => {
    if (isPrefetched) return

    try {
      await prefetchRoute(href, priority)
      setIsPrefetched(true)
    } catch (error) {
      console.warn(`Failed to prefetch ${href}:`, error)
    }
  }, [href, priority, prefetchRoute, isPrefetched])

  // Handle mouse enter (hover prefetch)
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
    onHover?.()

    if (prefetch === 'hover' || prefetch === 'always') {
      // Small delay to avoid prefetching on accidental hovers
      prefetchTimeoutRef.current = setTimeout(() => {
        handlePrefetch()
      }, 100)
    }
  }, [prefetch, onHover, handlePrefetch])

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current)
    }
  }, [])

  // Handle click with prefetch
  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    // Ensure prefetch is complete before navigation
    if (!isPrefetched && (prefetch === 'always' || prefetch === true)) {
      e.preventDefault()
      handlePrefetch().then(() => {
        if (replace) {
          router.replace(href, { scroll })
        } else {
          router.push(href, { scroll })
        }
      })
    }
  }, [isPrefetched, prefetch, handlePrefetch, replace, router, href, scroll])

  // Intersection Observer for visible prefetch
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries
    if (entry.isIntersecting && (prefetch === 'visible' || prefetch === 'always')) {
      onVisible?.()
      handlePrefetch()
    }
  }, [prefetch, onVisible, handlePrefetch])

  // Set up intersection observer
  const setupIntersectionObserver = useCallback(() => {
    if (!linkRef.current || prefetch !== 'visible') return

    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: '50px', // Start prefetching 50px before visible
      threshold: 0.1
    })

    observer.observe(linkRef.current)

    return () => observer.disconnect()
  }, [prefetch, handleIntersection])

  // Initialize intersection observer
  useEffect(() => {
    const cleanup = setupIntersectionObserver()
    return cleanup
  }, [setupIntersectionObserver])

  // Immediate prefetch for high priority links
  useEffect(() => {
    if (prefetch === 'always' && priority === 'high') {
      handlePrefetch()
    }
  }, [prefetch, priority, handlePrefetch])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current)
      }
    }
  }, [])

  return (
    <Link
      ref={linkRef}
      href={href}
      className={className}
      replace={replace}
      scroll={scroll}
      shallow={shallow}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      data-prefetched={isPrefetched}
      data-priority={priority}
      data-hovered={isHovered}
      {...props}
    >
      {children}
    </Link>
  )
}

/**
 * Hook for programmatic navigation with prefetching
 */
export function useOptimizedNavigation() {
  const router = useRouter()
  const { prefetchRoute } = useRoutePrefetch()

  const navigateWithPrefetch = useCallback(async (
    href: string,
    options: {
      replace?: boolean
      scroll?: boolean
      prefetch?: boolean
      priority?: 'high' | 'medium' | 'low'
    } = {}
  ) => {
    const { replace = false, scroll = true, prefetch = true, priority = 'medium' } = options

    if (prefetch) {
      try {
        await prefetchRoute(href, priority)
      } catch (error) {
        console.warn(`Failed to prefetch ${href}:`, error)
      }
    }

    if (replace) {
      router.replace(href, { scroll })
    } else {
      router.push(href, { scroll })
    }
  }, [router, prefetchRoute])

  const prefetchAndNavigate = useCallback(async (
    href: string,
    delay: number = 0,
    options: {
      replace?: boolean
      scroll?: boolean
      priority?: 'high' | 'medium' | 'low'
    } = {}
  ) => {
    const { replace = false, scroll = true, priority = 'medium' } = options

    // Prefetch first
    try {
      await prefetchRoute(href, priority)
    } catch (error) {
      console.warn(`Failed to prefetch ${href}:`, error)
    }

    // Navigate after delay
    setTimeout(() => {
      if (replace) {
        router.replace(href, { scroll })
      } else {
        router.push(href, { scroll })
      }
    }, delay)
  }, [router, prefetchRoute])

  return {
    navigateWithPrefetch,
    prefetchAndNavigate
  }
}

/**
 * Batch prefetching utility
 */
export function useBatchPrefetch() {
  const { prefetchMultiple } = useRoutePrefetch()

  const prefetchRoutes = useCallback(async (
    routes: string[],
    priority: 'high' | 'medium' | 'low' = 'medium',
    delay: number = 0
  ) => {
    if (delay > 0) {
      setTimeout(() => {
        prefetchMultiple(routes, priority)
      }, delay)
    } else {
      await prefetchMultiple(routes, priority)
    }
  }, [prefetchMultiple])

  return { prefetchRoutes }
}