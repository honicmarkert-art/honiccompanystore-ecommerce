"use client"

import React, { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ProductGridSkeleton } from '@/components/ui/skeleton'

interface InfiniteScrollTriggerProps {
  onLoadMore: () => void
  hasMore: boolean
  loading: boolean
  error?: string | null
  className?: string
  children?: React.ReactNode
}

export function InfiniteScrollTrigger({
  onLoadMore,
  hasMore,
  loading,
  error,
  className,
  children
}: InfiniteScrollTriggerProps) {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const elementRef = useRef<HTMLDivElement | null>(null)
  const hasScrolledRef = useRef(false)
  const initialMountRef = useRef(true)

  // Track user scroll to prevent immediate trigger on page load
  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined' && window.scrollY > 300) {
        hasScrolledRef.current = true
      }
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    const element = elementRef.current
    if (!element || !hasMore || loading) return

    // Mark initial mount as complete after first render
    if (initialMountRef.current) {
      // Delay to allow page to render and prevent immediate trigger
      const timer = setTimeout(() => {
        initialMountRef.current = false
      }, 1000)
      return () => clearTimeout(timer)
    }

    // Create observer with moderate early detection - triggers when user scrolls near bottom
    // This ensures products are fetched before user reaches the end, but not immediately on page load
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        // Trigger when element enters detection zone - only if user has scrolled (prevents immediate trigger on page load)
        if (entry.isIntersecting && hasMore && !loading && hasScrolledRef.current) {
          onLoadMore()
        }
      },
      {
        rootMargin: '500px', // Moderate: Triggers 500px before bottom (reduced from 2000px to prevent immediate load)
        threshold: 0.01 // Triggers when just 1% of trigger element enters detection zone
      }
    )

    observerRef.current.observe(element)

    // Cleanup on unmount or when dependencies change
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [onLoadMore, hasMore, loading])

  return (
    <div className="w-full">
      {children}
      
      {/* Loading skeleton - only show for load-more (when children exist means we already have products) */}
      {loading && children && (
        <div className="pt-4">
          <ProductGridSkeleton count={20} />
        </div>
      )}
      
      {/* Trigger element at the bottom */}
      <div
        ref={elementRef}
        className={cn(
          "flex flex-col items-center justify-center py-2",
          className
        )}
      >
        
        {error && !loading && (
          <div className="text-red-500 text-center">
            <p className="mb-2">Failed to load products</p>
            <button
              onClick={onLoadMore}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
        
        {!hasMore && !loading && !error && (
          <div className="text-gray-400 text-center">
            <p>No more products to load</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Alternative component with manual trigger button
export function InfiniteScrollButton({
  onLoadMore,
  hasMore,
  loading,
  error,
  className
}: Omit<InfiniteScrollTriggerProps, 'children'>) {
  if (!hasMore && !error) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>You've reached the end of the product list</p>
      </div>
    )
  }

  return (
    <div className={cn("flex justify-center py-8", className)}>
      <button
        onClick={onLoadMore}
        disabled={loading}
        className={cn(
          "px-6 py-3 rounded-lg font-medium transition-colors",
          loading
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : error
            ? "bg-red-500 text-white hover:bg-red-600"
            : "bg-orange-500 text-white hover:bg-orange-600"
        )}
      >
        {loading ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Loading...</span>
          </div>
        ) : error ? (
          'Try Again'
        ) : (
          'Load More Products'
        )}
      </button>
    </div>
  )
}



