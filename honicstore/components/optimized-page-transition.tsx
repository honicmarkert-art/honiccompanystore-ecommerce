"use client"

import React, { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

/**
 * Optimized Page Transition Component
 * 
 * Provides smooth transitions between pages with loading states
 */
export function OptimizedPageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [previousPathname, setPreviousPathname] = useState(pathname)
  const transitionTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // Only trigger transition if pathname actually changed
    if (pathname !== previousPathname) {
      setIsTransitioning(true)
      
      // Clear any existing timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }

      // Set transition timeout
      transitionTimeoutRef.current = setTimeout(() => {
        setIsTransitioning(false)
        setPreviousPathname(pathname)
      }, 150) // Short transition duration
    }

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }
    }
  }, [pathname, previousPathname])

  return (
    <div 
      className={`transition-opacity duration-150 ease-in-out ${
        isTransitioning ? 'opacity-0' : 'opacity-100'
      } ${className || ''}`}
      suppressHydrationWarning={true}
    >
      {children}
    </div>
  )
}

/**
 * Loading indicator for page transitions
 */
export function PageTransitionLoader({ 
  isVisible, 
  className 
}: { 
  isVisible: boolean
  className?: string 
}) {
  if (!isVisible) return null

  return (
    <div className={`fixed top-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-700 z-50 ${className || ''}`}>
      <div className="h-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
    </div>
  )
}

/**
 * Hook for managing page transitions
 */
export function usePageTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionProgress, setTransitionProgress] = useState(0)
  const pathname = usePathname()
  const previousPathnameRef = useRef(pathname)

  useEffect(() => {
    if (pathname !== previousPathnameRef.current) {
      setIsTransitioning(true)
      setTransitionProgress(0)

      // Simulate progress
      const progressInterval = setInterval(() => {
        setTransitionProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval)
            setIsTransitioning(false)
            previousPathnameRef.current = pathname
            return 100
          }
          return prev + 10
        })
      }, 50)

      return () => clearInterval(progressInterval)
    }
  }, [pathname])

  return {
    isTransitioning,
    transitionProgress,
    pathname
  }
}

/**
 * Optimized page wrapper with transition effects
 */
export function OptimizedPageWrapper({ 
  children, 
  className 
}: { 
  children: React.ReactNode
  className?: string 
}) {
  const { isTransitioning, transitionProgress } = usePageTransition()

  return (
    <>
      <PageTransitionLoader isVisible={isTransitioning} />
      <OptimizedPageTransition className={className}>
        {children}
      </OptimizedPageTransition>
    </>
  )
}

/**
 * Scroll restoration component
 * Persists scroll positions across navigations using sessionStorage
 */
export function ScrollRestoration() {
  const pathname = usePathname()
  const isRestoringRef = useRef(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Save current scroll position before navigation
    const saveScrollPosition = () => {
      try {
        const scrollKey = `scroll_${pathname}`
        sessionStorage.setItem(scrollKey, window.scrollY.toString())
      } catch (e) {
        // Ignore storage errors
      }
    }

    // Restore scroll position after navigation
    const restoreScrollPosition = () => {
      try {
        const scrollKey = `scroll_${pathname}`
        const savedPosition = sessionStorage.getItem(scrollKey)
        
        if (savedPosition !== null) {
          const position = parseInt(savedPosition, 10)
          if (!isNaN(position) && position > 0) {
            isRestoringRef.current = true
            
            // Use requestAnimationFrame for smooth restoration
            requestAnimationFrame(() => {
              window.scrollTo({
                top: position,
                behavior: 'auto' // Instant scroll for restoration
              })
              
              // Clear the restoring flag after a short delay
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
              }
              scrollTimeoutRef.current = setTimeout(() => {
                isRestoringRef.current = false
              }, 100)
            })
            return
          }
        }
      } catch (e) {
        // Ignore storage errors
      }
      
      // Scroll to top for new pages
      if (!isRestoringRef.current) {
        window.scrollTo(0, 0)
      }
    }

    // Save scroll position on scroll (throttled)
    let scrollTimeout: NodeJS.Timeout
    const handleScroll = () => {
      if (isRestoringRef.current) return // Don't save while restoring
      
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        saveScrollPosition()
      }, 150) // Throttle scroll saves
    }

    // Restore on mount
    restoreScrollPosition()

    // Save on scroll
    window.addEventListener('scroll', handleScroll, { passive: true })
    
    // Save before navigation
    window.addEventListener('beforeunload', saveScrollPosition)
    
    // Save on visibility change (when tab becomes hidden)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveScrollPosition()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('beforeunload', saveScrollPosition)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (scrollTimeout) clearTimeout(scrollTimeout)
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    }
  }, [pathname])

  return null
}

/**
 * Performance monitoring for page transitions
 */
export function PageTransitionMonitor() {
  const pathname = usePathname()
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    const startTime = startTimeRef.current
    const endTime = Date.now()
    const transitionTime = endTime - startTime

    // Log performance metrics
    if (process.env.NODE_ENV === 'development') {
    }

    // Update start time for next transition
    startTimeRef.current = Date.now()
  }, [pathname])

  return null
}
