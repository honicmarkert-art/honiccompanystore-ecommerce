"use client"

import { useState, useEffect } from 'react'

/**
 * Hook to detect current grid columns based on Tailwind breakpoints
 * Grid layout: 3 cols (mobile) → 8 cols (3xl)
 * Breakpoints: sm:640px, md:768px, lg:1024px, xl:1280px, 2xl:1536px, 3xl:1920px
 */
export function useGridColumns() {
  const [columns, setColumns] = useState(3) // Default: mobile (3 cols)

  useEffect(() => {
    // Guard: Only run on client
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const updateColumns = () => {
      const width = window.innerWidth
      
      if (width >= 1920) {
        // 3xl: 8 cols
        setColumns(8)
      } else if (width >= 1536) {
        // 2xl: 8 cols
        setColumns(8)
      } else if (width >= 1280) {
        // xl: 7 cols
        setColumns(7)
      } else if (width >= 1024) {
        // lg: 6 cols
        setColumns(6)
      } else if (width >= 768) {
        // md: 5 cols
        setColumns(5)
      } else if (width >= 640) {
        // sm: 3 cols
        setColumns(3)
      } else {
        // Default: 3 cols
        setColumns(3)
      }
    }

    // Set initial value
    updateColumns()

    // Listen for resize events
    window.addEventListener('resize', updateColumns)
    
    // Use ResizeObserver for more accurate detection
    const resizeObserver = new ResizeObserver(() => {
      updateColumns()
    })
    
    resizeObserver.observe(document.documentElement)

    return () => {
      window.removeEventListener('resize', updateColumns)
      resizeObserver.disconnect()
    }
  }, [])

  return columns
}

/**
 * Calculate products needed to fill N rows
 */
export function useProductsForRows(rows: number = 4) {
  const columns = useGridColumns()
  return columns * rows
}
