"use client"

import React, { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

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

  useEffect(() => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    const element = elementRef.current
    if (!element || !hasMore || loading) return

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !loading) {
          onLoadMore()
        }
      },
      {
        rootMargin: '200px', // Trigger earlier for smoother experience
        threshold: 0.1
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
      
      {/* Trigger element at the bottom */}
      <div
        ref={elementRef}
        className={cn(
          "flex flex-col items-center justify-center py-8",
          className
        )}
      >
        {loading && (
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
            <span>Loading more products...</span>
          </div>
        )}
        
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



