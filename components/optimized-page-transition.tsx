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
 */
export function ScrollRestoration() {
  const pathname = usePathname()
  const scrollPositions = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    // Save scroll position before navigation
    const handleBeforeUnload = () => {
      scrollPositions.current.set(pathname, window.scrollY)
    }

    // Restore scroll position after navigation
    const savedPosition = scrollPositions.current.get(pathname)
    if (savedPosition !== undefined) {
      window.scrollTo(0, savedPosition)
    } else {
      // Scroll to top for new pages
      window.scrollTo(0, 0)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
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
