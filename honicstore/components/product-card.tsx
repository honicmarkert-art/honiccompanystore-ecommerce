"use client"

import React, { useMemo } from 'react'
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { OptimizedLink } from "@/components/optimized-link"
import { getLeftBadge, getRightBadge } from "@/utils/product-badges"
import { ShoppingCart, Star, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Product {
  id: number
  name: string
  price: number
  original_price?: number
  originalPrice?: number
  image?: string
  thumbnail_url?: string
  slug?: string
  variants?: Array<{
    id: number | string
    name?: string
    price: number | string
    stock_quantity?: number
    stockQuantity?: number
    in_stock?: boolean
    inStock?: boolean
  }>
  rating?: number
  reviews?: number
  views?: number
  in_stock?: boolean
  inStock?: boolean
  free_delivery?: boolean
  freeDelivery?: boolean
  same_day_delivery?: boolean
  sameDayDelivery?: boolean
  import_china?: boolean
  importChina?: boolean
  sold_count?: number
  is_new?: boolean
  is_featured?: boolean
  [key: string]: any
}

interface ProductCardProps {
  product: Product
  index: number
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
  priority?: boolean // For above-the-fold images
}

// Helper function to calculate minimum price from variants
function getMinimumPrice(productPrice: number, variants?: any[]): number {
  if (!variants || variants.length === 0) {
    return productPrice
  }

  let minPrice = productPrice

  // Check variant prices (simplified variant system)
  variants.forEach((variant: any) => {
    if (variant.price) {
      const variantPrice = parseFloat(String(variant.price))
      if (variantPrice < minPrice) {
        minPrice = variantPrice
      }
    }
  })

  return minPrice
}

// Generate blur placeholder for images (browser-safe)
const generateBlurDataURL = (): string => {
  // Base64 encoded 1x1 gray SVG placeholder
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHBhdGggZD0iTTAgMGgyMDB2MjAwSDB6IiBmaWxsPSIjZTZlN2ViIi8+PC9zdmc+'
}

// Memoized ProductCard component with optimized re-render logic
export const ProductCard = React.memo<ProductCardProps>(({
  product,
  index,
  themeClasses,
  formatPrice,
  isInCart,
  handleAddToCart,
  pathname,
  urlSearchParams,
  onHover,
  priority = false
}) => {
  // Calculate effective price from variants
  const effectivePrice = useMemo(() => 
    getMinimumPrice(product.price, product.variants),
    [product.price, product.variants]
  )

  // Calculate original price and discount
  const originalPrice = useMemo(() => 
    product.originalPrice || product.original_price || effectivePrice,
    [product.originalPrice, product.original_price, effectivePrice]
  )

  const discountPercentage = useMemo(() => 
    originalPrice > effectivePrice 
      ? ((originalPrice - effectivePrice) / originalPrice) * 100 
      : 0,
    [originalPrice, effectivePrice]
  )

  // Check if product is in cart
  const productInCart = useMemo(() => 
    isInCart(product.id, product.variants?.[0]?.id),
    [isInCart, product.id, product.variants]
  )

  // Check free shipping
  const hasFreeShipping = useMemo(() => 
    product.free_delivery === true ||
    product.freeDelivery === true ||
    (product as any)?.free_shipping === true ||
    (product as any)?.freeShipping === true,
    [product]
  )

  // Get badges
  const leftBadge = useMemo(() => getLeftBadge(product), [product])
  const rightBadge = useMemo(() => getRightBadge(product), [product])
  const hasChinaBadge = useMemo(() => 
    product.importChina || product.import_china,
    [product]
  )

  // Build product URL
  const productUrl = useMemo(() => {
    const slug = product.slug || product.name || 'product'
    const returnTo = urlSearchParams?.toString() 
      ? `${pathname}?${urlSearchParams.toString()}` 
      : pathname || window.location.href
    return `/products/${product.id}-${encodeURIComponent(slug)}?returnTo=${encodeURIComponent(returnTo)}`
  }, [product.id, product.slug, product.name, pathname, urlSearchParams])

  // Stock and sold count
  const isOutOfStock = useMemo(() => 
    !product.inStock && !product.in_stock,
    [product.inStock, product.in_stock]
  )

  const soldCount = useMemo(() => product.sold_count || 0, [product.sold_count])

  const soldCountText = useMemo(() => {
    if (soldCount > 0) {
      return soldCount >= 1000 
        ? `${(soldCount / 1000).toFixed(1)}k+` 
        : `${soldCount}+`
    }
    return '000'
  }, [soldCount])

  // Rating display
  const rating = useMemo(() => product.rating || 0, [product.rating])
  const hasRating = useMemo(() => rating > 0, [rating])

  // Image optimization settings
  const imagePriority = useMemo(() => priority || index < 6, [priority, index])
  const blurDataURL = useMemo(() => {
    // Use thumbnail_url if available, otherwise generate blur placeholder
    if (product.thumbnail_url) {
      return product.thumbnail_url
    }
    return generateBlurDataURL()
  }, [product.thumbnail_url])

  // Optimized sizes for responsive grid layout
  // Mobile (3 cols): ~33vw, Tablet (5 cols): ~20vw, Desktop (6-8 cols): ~12-16vw
  const imageSizes = useMemo(() => 
    "(max-width: 640px) 33vw, (max-width: 768px) 33vw, (max-width: 1024px) 20vw, (max-width: 1280px) 16vw, (max-width: 1536px) 14vw, 12vw",
    []
  )

  // Check if image is from Supabase (may need unoptimized)
  const isSupabaseImage = useMemo(() => 
    typeof product.image === 'string' && (
      product.image.includes('supabase.co') || 
      product.image.includes('/storage/v1/object/public/')
    ),
    [product.image]
  )

  return (
    <Card
      key={`${product.id}-${index}`}
      data-product-id={product.id}
      onMouseEnter={onHover}
      onFocus={onHover}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border-0 shadow-none",
        "transform transition-all duration-300 ease-in-out",
        "hover:scale-105 hover:shadow-xl hover:shadow-gray-300/60 dark:hover:shadow-gray-700/60",
        "hover:z-10 relative hover:ring-2 hover:ring-blue-500/20",
        themeClasses.cardBg,
        themeClasses.mainText,
      )}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '320px 420px' }}
      suppressHydrationWarning
    >
      <OptimizedLink 
        href={productUrl}
        className="block relative aspect-square overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600" 
        prefetch={false}
        priority="low"
        suppressHydrationWarning
      >
        {product.image && (
          <div className="relative w-full h-full">
            <Image
              src={product.image}
              alt={product.name}
              fill
              className={cn(
                "object-cover transition-transform duration-300 hover:scale-110",
                isOutOfStock && "opacity-75"
              )}
              priority={imagePriority}
              placeholder="blur"
              blurDataURL={blurDataURL}
              quality={75}
              sizes={imageSizes}
              loading={imagePriority ? undefined : "lazy"}
              unoptimized={isSupabaseImage}
              onError={(e) => {
                // Fallback to placeholder on error
                const target = e.target as HTMLImageElement
                if (target.src !== blurDataURL) {
                  target.src = blurDataURL
                }
              }}
            />
          </div>
        )}
        
        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
            <span className="bg-red-600 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-md shadow-lg uppercase tracking-wide">
              Out of Stock
            </span>
          </div>
        )}
        
        {/* Corner decoration */}
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-orange-500 z-20"></div>

        {/* Badges */}
        {(() => {
          const hasRightBadge = rightBadge.type !== 'none'
          const chinaBadgeTop = hasRightBadge ? 'top-6 sm:top-7' : 'top-0'
          
          return (
            <>
              {/* Left side badge (Popular vs Free Shipping) */}
              {leftBadge.type !== 'none' && (
                <div className="absolute top-0 left-0 sm:top-0 sm:left-1.5 z-10" suppressHydrationWarning>
                  <span className={leftBadge.className} suppressHydrationWarning>
                    {leftBadge.text}
                  </span>
                </div>
              )}
              
              {/* Right side badge (New vs Discount) */}
              {rightBadge.type !== 'none' && (
                <div className="absolute top-0 right-0 sm:top-0 sm:right-1.5 z-10" suppressHydrationWarning>
                  <span 
                    className={rightBadge.className} 
                    style={rightBadge.customStyle}
                    suppressHydrationWarning
                  >
                    {rightBadge.text}
                  </span>
                </div>
              )}
              
              {/* China badge - Right side, below New/Discount badge */}
              {hasChinaBadge && (
                <div className={`absolute ${chinaBadgeTop} right-0 sm:right-1.5 z-10`} suppressHydrationWarning>
                  <span 
                    className="bg-red-600 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-none shadow-sm sm:shadow-md"
                    suppressHydrationWarning
                  >
                    China
                  </span>
                </div>
              )}
            </>
          )
        })()}
      </OptimizedLink>

      <CardContent className="p-1 md:p-0.5 lg:p-1 flex-1 flex flex-col justify-between" suppressHydrationWarning>
        <OptimizedLink 
          href={productUrl}
          className="block"
          prefetch={false}
          priority="low"
        >
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <h3 className="text-xs font-semibold sm:text-xs md:text-[11px] lg:text-base hover:text-blue-600 dark:hover:text-blue-400 hover:scale-105 transition-all duration-300 line-clamp-2 overflow-hidden cursor-pointer" suppressHydrationWarning>
                  {product.name}
                </h3>
              </TooltipTrigger>
              <TooltipContent 
                className="text-xs max-w-xs sm:max-w-sm break-words !z-[99999]" 
                side="top" 
                align="start"
                sideOffset={8}
                avoidCollisions={true}
                collisionPadding={8}
              >
                <p className="whitespace-normal">{product.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </OptimizedLink>

        {/* Stock/Sold status - on new line above ratings on mobile */}
        <div className="sm:hidden text-[10px] mt-0" suppressHydrationWarning>
          {isOutOfStock ? (
            <span className="text-red-600 dark:text-red-400 font-semibold" suppressHydrationWarning>
              Out of Stock
            </span>
          ) : (
            <span className={themeClasses.textNeutralSecondary} suppressHydrationWarning>
              {soldCountText} sold
            </span>
          )}
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center gap-0.5 text-[10px] mt-0 sm:text-xs min-h-[1.5rem]",
            themeClasses.textNeutralSecondary,
          )}
          suppressHydrationWarning
        >
          {/* Stock/Sold status - inline on desktop */}
          {isOutOfStock ? (
            <span className="hidden sm:inline text-xs whitespace-nowrap text-red-600 dark:text-red-400 font-semibold" suppressHydrationWarning>
              Out of Stock
            </span>
          ) : (
            <>
              <span className="hidden sm:inline text-xs whitespace-nowrap" suppressHydrationWarning>
                {soldCountText} sold
              </span>
              <span className="hidden sm:inline mx-0.5 text-[8px]" suppressHydrationWarning>•</span>
            </>
          )}

          {/* Rating: Show empty stars if rating is 0, filled stars if rating > 0 */}
          <div className="flex items-center gap-0 flex-shrink-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 flex-shrink-0 ${
                  hasRating && i < Math.floor(rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : themeClasses.textNeutralSecondary
                }`}
                suppressHydrationWarning
              />
            ))}
            {/* Show reviews count if > 0, otherwise show (0) */}
            <span className="whitespace-nowrap ml-0.5" suppressHydrationWarning>
              ({product.reviews || 0})
            </span>
            {/* Show views count: (0) if zero */}
            {product.views !== undefined && product.views !== null && (
              <>
                <span className="hidden sm:inline mx-0.5 text-[8px]" suppressHydrationWarning>•</span>
                <span className="whitespace-nowrap" suppressHydrationWarning>
                  ({product.views || 0})
                </span>
              </>
            )}
          </div>
        </div>

        {hasFreeShipping && (
          <div
            className="text-[10px] sm:text-xs font-semibold text-red-600 uppercase tracking-wide mt-1 flex items-center gap-1"
            suppressHydrationWarning
          >
            <span aria-hidden="true">•</span>
            <span>Free Shipping</span>
          </div>
        )}

        <div className="flex flex-wrap items-baseline gap-x-1.5 mt-0" suppressHydrationWarning>
          {/* Main Price */}
          <div className="text-sm font-bold sm:text-sm md:text-xs lg:text-lg" suppressHydrationWarning>
            {formatPrice(effectivePrice)}
          </div>
          
          {/* Original Price and Discount - Always show for all products */}
          {originalPrice > effectivePrice && (
            <>
              <div className={cn("text-[10px] line-through sm:text-xs", themeClasses.textNeutralSecondary)} suppressHydrationWarning>
                {formatPrice(originalPrice)}
              </div>
              <div className="text-[10px] font-medium text-green-600" suppressHydrationWarning>
                {discountPercentage.toFixed(0)}% OFF
              </div>
            </>
          )}
        </div>
      </CardContent>

      <CardFooter className="px-1 pb-1 pt-0 flex flex-col gap-1" suppressHydrationWarning>
        {isOutOfStock ? (
          <Button
            className="w-full text-xs py-1 h-auto sm:text-sm lg:text-base bg-gray-400 text-white cursor-not-allowed rounded-b-sm rounded-t-none"
            disabled
            suppressHydrationWarning
          >
            <X className="w-4 h-4 mr-2" suppressHydrationWarning /> Out of Stock
          </Button>
        ) : (
          <Button
            className={cn(
              "w-full text-xs py-1 h-auto sm:text-sm lg:text-base rounded-b-sm rounded-t-none transform transition-all duration-200 hover:scale-105 hover:shadow-md",
              (product.importChina || product.import_china) 
                ? "bg-red-800 text-white hover:bg-red-900" 
                : "bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
            )}
            onClick={() => handleAddToCart(product.id, product.name, product.price, product.variants)}
            suppressHydrationWarning
          >
            <ShoppingCart className="w-4 h-4 mr-2" suppressHydrationWarning /> Add to Cart
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if these change
  // This prevents unnecessary re-renders when parent component updates
  const prev = prevProps.product
  const next = nextProps.product
  
  // Quick reference check - if same object, skip detailed comparison
  if (prev === next) return true
  
  // Compare critical product properties that affect rendering
  const productChanged = (
    prev.id !== next.id ||
    prev.price !== next.price ||
    prev.originalPrice !== next.originalPrice ||
    prev.original_price !== next.original_price ||
    prev.inStock !== next.inStock ||
    prev.in_stock !== next.in_stock ||
    prev.rating !== next.rating ||
    prev.reviews !== next.reviews ||
    prev.sold_count !== next.sold_count ||
    prev.image !== next.image ||
    prev.name !== next.name ||
    prev.slug !== next.slug ||
    prev.views !== next.views ||
    prev.importChina !== next.importChina ||
    prev.import_china !== next.import_china ||
    prev.free_delivery !== next.free_delivery ||
    prev.freeDelivery !== next.freeDelivery
  )
  
  if (productChanged) return false
  
  // Compare variants (only if they exist)
  if (prev.variants || next.variants) {
    if (!prev.variants || !next.variants || prev.variants.length !== next.variants.length) {
      return false
    }
    // Check first variant ID (used for cart check)
    if (prev.variants[0]?.id !== next.variants[0]?.id) {
      return false
    }
  }
  
  // Compare cart status (only if product data is same)
  const prevVariantId = prev.variants?.[0]?.id ? String(prev.variants[0].id) : undefined
  const nextVariantId = next.variants?.[0]?.id ? String(next.variants[0].id) : undefined
  const prevInCart = prevProps.isInCart(prev.id, prevVariantId)
  const nextInCart = nextProps.isInCart(next.id, nextVariantId)
  if (prevInCart !== nextInCart) return false
  
  // Compare function references (should be stable from hooks)
  if (prevProps.formatPrice !== nextProps.formatPrice) return false
  if (prevProps.handleAddToCart !== nextProps.handleAddToCart) return false
  if (prevProps.isInCart !== nextProps.isInCart) return false
  
  // Compare theme classes (should be stable from useTheme hook)
  if (prevProps.themeClasses !== nextProps.themeClasses) return false
  
  // Compare other props
  if (prevProps.pathname !== nextProps.pathname) return false
  if (prevProps.index !== nextProps.index) return false
  
  // All checks passed - don't re-render
  return true
})

ProductCard.displayName = 'ProductCard'
