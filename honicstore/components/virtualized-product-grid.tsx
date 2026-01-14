"use client"

import React, { useMemo, useCallback, useEffect, useState } from 'react'
import { ProductCard } from './product-card'
import { useGridColumns } from '@/hooks/use-grid-columns'

// Type for FixedSizeGrid
type FixedSizeGridType = React.ComponentType<{
  columnCount: number
  columnWidth: number
  height: number
  rowCount: number
  rowHeight: number
  width: number
  onItemsRendered?: (props: any) => void
  overscanRowCount?: number
  overscanColumnCount?: number
  style?: React.CSSProperties
  children: (props: any) => React.ReactNode
}>

interface Product {
  id: number
  name: string
  price: number
  [key: string]: any
}

interface VirtualizedProductGridProps {
  products: Product[]
  themeClasses: {
    cardBg: string
    mainText: string
    textNeutralSecondary: string
  }
  formatPrice: (price: number) => string
  isInCart: (productId: number, variantId?: string) => boolean
  handleAddToCart: (productId: number, productName: string, productPrice: number, productVariants?: any[]) => void
  pathname: string
  urlSearchParams?: URLSearchParams | null
  onHover?: () => void
  className?: string
  gap?: number
  onItemsRendered?: (startIndex: number, stopIndex: number) => void
}

// Calculate column width based on container width and columns
const getColumnWidth = (containerWidth: number, columns: number, gap: number, padding: number = 0): number => {
  const totalGap = gap * (columns - 1)
  const totalPadding = padding * 2 // Left and right padding
  return Math.floor((containerWidth - totalGap - totalPadding) / columns)
}

// Calculate row height (product cards are roughly square + content)
const ROW_HEIGHT = 420 // Approximate height of product card

export function VirtualizedProductGrid({
  products,
  themeClasses,
  formatPrice,
  isInCart,
  handleAddToCart,
  pathname,
  urlSearchParams,
  onHover,
  className = '',
  gap = 4,
  onItemsRendered
}: VirtualizedProductGridProps) {
  // ALL HOOKS MUST BE CALLED FIRST - BEFORE ANY CONDITIONAL RETURNS
  const columns = useGridColumns()
  const [containerWidth, setContainerWidth] = useState(0)
  const [gridHeight, setGridHeight] = useState(800)
  const [FixedSizeGrid, setFixedSizeGrid] = useState<FixedSizeGridType | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Load react-window dynamically on client side
  useEffect(() => {
    if (typeof window === 'undefined') return

    import('react-window')
      .then((mod) => {
        setFixedSizeGrid(() => mod.FixedSizeGrid)
      })
      .catch((err) => {
        console.error('Failed to load react-window:', err)
      })
  }, [])

  // Update container width on resize
  useEffect(() => {
    if (!containerRef.current) return

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    // Initial width
    updateWidth()

    // ResizeObserver for more accurate width tracking
    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(containerRef.current)

    // Also listen to window resize as fallback
    window.addEventListener('resize', updateWidth)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  // Calculate dynamic height based on viewport
  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateHeight = () => {
      // Calculate available height (viewport - header/footer - padding)
      const headerHeight = 80 // Approximate header height
      const footerHeight = 200 // Approximate footer height
      const padding = 40 // Top/bottom padding
      const availableHeight = window.innerHeight - headerHeight - footerHeight - padding
      setGridHeight(Math.max(availableHeight, 600)) // Minimum 600px
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  // Calculate padding based on screen size (matches Tailwind classes: px-1 sm:px-2 lg:px-3)
  const padding = useMemo(() => {
    if (typeof window === 'undefined') return 8
    if (window.innerWidth >= 1024) return 12 // lg:px-3
    if (window.innerWidth >= 640) return 8 // sm:px-2
    return 4 // px-1
  }, [containerWidth])

  // Calculate grid dimensions
  const { columnWidth, rowCount } = useMemo(() => {
    if (containerWidth === 0 || products.length === 0) {
      return { columnWidth: 150, rowCount: 0 }
    }

    const colWidth = getColumnWidth(containerWidth, columns, gap, padding)
    const rows = Math.ceil(products.length / columns)

    return {
      columnWidth: colWidth,
      rowCount: rows
    }
  }, [containerWidth, columns, products.length, gap, padding])

  // Cell renderer for virtualized grid
  const Cell = useCallback(({ columnIndex, rowIndex, style }: any) => {
    const index = rowIndex * columns + columnIndex
    
    // Don't render if index is out of bounds
    if (index >= products.length) {
      return <div style={style} />
    }

    const product = products[index]

    return (
      <div
        style={{
          ...style,
          paddingLeft: columnIndex === 0 ? 0 : gap / 2,
          paddingRight: columnIndex === columns - 1 ? 0 : gap / 2,
          paddingTop: rowIndex === 0 ? 0 : gap / 2,
          paddingBottom: gap / 2,
        }}
      >
        <ProductCard
          key={`${product.id}-${index}`}
          product={product}
          index={index}
          themeClasses={themeClasses}
          formatPrice={formatPrice}
          isInCart={isInCart}
          handleAddToCart={handleAddToCart}
          pathname={pathname}
          urlSearchParams={urlSearchParams}
          onHover={onHover}
          priority={index < 6} // Priority for first 6 images
        />
      </div>
    )
  }, [products, columns, gap, themeClasses, formatPrice, isInCart, handleAddToCart, pathname, urlSearchParams, onHover])

  // Handle items rendered callback for infinite scroll
  const handleItemsRendered = useCallback(({
    visibleRowStartIndex,
    visibleRowStopIndex,
    visibleColumnStartIndex,
    visibleColumnStopIndex,
  }: any) => {
    if (onItemsRendered) {
      const startIndex = visibleRowStartIndex * columns + visibleColumnStartIndex
      const stopIndex = visibleRowStopIndex * columns + visibleColumnStopIndex
      onItemsRendered(startIndex, Math.min(stopIndex, products.length - 1))
    }
  }, [columns, products.length, onItemsRendered])

  // Don't render if no products
  if (products.length === 0) {
    return (
      <div className={className}>
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-8 gap-1 px-1 sm:px-2 lg:px-3">
          {/* Empty state */}
        </div>
      </div>
    )
  }

  // If FixedSizeGrid is not loaded yet, show regular grid as fallback
  if (!FixedSizeGrid) {
    return (
      <div ref={containerRef} className={className}>
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-8 gap-1 px-1 sm:px-2 lg:px-3">
          {products.map((product: any, index: number) => (
            <ProductCard
              key={`${product.id}-${index}`}
              product={product}
              index={index}
              themeClasses={themeClasses}
              formatPrice={formatPrice}
              isInCart={isInCart}
              handleAddToCart={handleAddToCart}
              pathname={pathname}
              urlSearchParams={urlSearchParams}
              onHover={onHover}
              priority={index < 6}
            />
          ))}
        </div>
      </div>
    )
  }

  // Show loading state while container width is being calculated - but show some products
  if (containerWidth === 0) {
    return (
      <div ref={containerRef} className={className}>
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-8 gap-1 px-1 sm:px-2 lg:px-3">
          {products.slice(0, 30).map((product: any, index: number) => (
            <ProductCard
              key={`${product.id}-${index}`}
              product={product}
              index={index}
              themeClasses={themeClasses}
              formatPrice={formatPrice}
              isInCart={isInCart}
              handleAddToCart={handleAddToCart}
              pathname={pathname}
              urlSearchParams={urlSearchParams}
              onHover={onHover}
              priority={index < 6}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef} 
      className={className}
      style={{ 
        width: '100%',
        minHeight: gridHeight,
      }}
    >
      <FixedSizeGrid
        columnCount={columns}
        columnWidth={columnWidth}
        height={gridHeight}
        rowCount={rowCount}
        rowHeight={ROW_HEIGHT + gap}
        width={containerWidth}
        onItemsRendered={handleItemsRendered}
        overscanRowCount={3} // Render 3 extra rows above/below for smooth scrolling
        overscanColumnCount={1} // Render 1 extra column on each side
        style={{ overflowX: 'hidden' }} // Prevent horizontal scroll
      >
        {Cell}
      </FixedSizeGrid>
    </div>
  )
}
