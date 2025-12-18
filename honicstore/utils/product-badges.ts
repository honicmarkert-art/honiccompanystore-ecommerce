/**
 * Utility functions for determining product badges
 */

export interface ProductBadge {
  type: 'popular' | 'new' | 'discount' | 'free-shipping' | 'featured' | 'none'
  text: string
  className: string
  customStyle?: React.CSSProperties
}

export interface Product {
  id: number
  reviews?: number
  is_new?: boolean
  is_featured?: boolean
  updated_at?: string | Date
  price?: number
  originalPrice?: number
  original_price?: string  // Note: actual field name from database
  free_delivery?: boolean  // Note: actual field name from database
  same_day_delivery?: boolean  // Note: actual field name from database
  // Legacy support for old field names
  freeDelivery?: boolean
  sameDayDelivery?: boolean
}

/**
 * Calculate discount percentage
 */
export const calculateDiscountPercentage = (price: number, originalPrice: number): number => {
  if (!originalPrice || originalPrice <= 0 || price >= originalPrice) {
    return 0
  }
  
  return Math.round(((originalPrice - price) / originalPrice) * 100)
}

/**
 * Check if product is new based ONLY on the is_new flag.
 *
 * Behaviour:
 * - If DB provides is_new (any non-null/undefined value), we trust it:
 *   - truthy  → ALWAYS show "New"
 *   - falsy   → NEVER show "New"
 * - If is_new is missing (null/undefined), we treat as NOT new
 *   and DO NOT auto-mark by updated_at date.
 */
export const isProductNew = (product: Product, daysThreshold: number = 30): boolean => {
  const flag = (product as any).is_new

  // If DB explicitly sent an is_new value (including 0 / 1 / "0" / "1"),
  // use its truthiness and skip automatic date-based detection.
  if (flag !== undefined && flag !== null) {
    // Normalize different possible representations coming from DB / API
    if (flag === true) return true
    if (flag === false) return false

    if (typeof flag === 'number') {
      return flag === 1
    }

    if (typeof flag === 'string') {
      const normalized = flag.trim().toLowerCase()
      if (normalized === 'true' || normalized === '1') return true
      if (normalized === 'false' || normalized === '0' || normalized === '') return false
      // Any other non-empty string should be treated as false to avoid
      // accidentally showing "New" when the DB flag is effectively false.
      return false
    }

    // Fallback: for any other type, be conservative and treat as false
    return false
  }

  // If is_new is missing (undefined/null), do NOT auto-mark as new by date.
  // This gives you FULL manual control via the DB flag.
  return false
}

/**
 * Check if product is popular based on review count
 */
export const isProductPopular = (product: Product, reviewThreshold: number = 100): boolean => {
  const reviewCount = product.reviews || 0
  return reviewCount > reviewThreshold
}

/**
 * Get the appropriate badge for a product
 */
// Get left side badge (Featured vs Popular vs Free Shipping)
export const getLeftBadge = (product: Product): ProductBadge => {
  // Featured has highest priority on left side
  if (product.is_featured) {
    return {
      type: 'featured',
      text: 'Featured',
      className: 'bg-yellow-500 text-black text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.5 rounded-tl-sm shadow-sm'
    }
  }
  
  // Free Shipping has priority over Popular on left side
  if (product.free_delivery || product.same_day_delivery || product.freeDelivery || product.sameDayDelivery) {
    return {
      type: 'free-shipping',
      text: 'Free Shipping',
      className: 'bg-purple-600 text-white text-[8px] sm:text-[9px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-tl-sm shadow-sm'
    }
  }
  
  // Popular badge if no free shipping
  if (isProductPopular(product)) {
    return {
      type: 'popular',
      text: 'Popular',
      className: 'bg-green-600 text-white text-[8px] sm:text-[9px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-tl-sm shadow-sm'
    }
  }
  
  return { type: 'none', text: '', className: '' }
}

// Get right side badge (New vs Discount)
export const getRightBadge = (product: Product): ProductBadge => {
  const discountPercentage = calculateDiscountPercentage(
    product.price || 0, 
    parseFloat(product.original_price || '0') || product.originalPrice || 0
  )
  
  
  // New has priority over Discount on right side
  if (isProductNew(product)) {
    return {
      type: 'new',
      text: 'New',
      className: 'bg-blue-600 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-none shadow-sm sm:shadow-md',
      customStyle: {
        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
      }
    }
  }
  
  // Discount badge if not new
  if (discountPercentage > 0) {
    return {
      type: 'discount',
      text: `${discountPercentage}% OFF`,
      className: 'bg-red-600 text-white text-[8px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-none shadow-sm sm:shadow-md'
    }
  }
  
  return { type: 'none', text: '', className: '' }
}

// Legacy function for backward compatibility
export const getProductBadge = (product: Product): ProductBadge => {
  // Return left badge for backward compatibility
  return getLeftBadge(product)
}

/**
 * Get badge configuration for different badge types
 */
export const getBadgeConfig = (type: string) => {
  const configs = {
    popular: {
      text: 'Popular',
      className: 'bg-green-600 text-white',
      priority: 1
    },
    new: {
      text: 'New',
      className: 'bg-blue-600 text-white',
      priority: 2
    },
    discount: {
      text: 'OFF',
      className: 'bg-red-600 text-white',
      priority: 3
    },
    'free-shipping': {
      text: 'Free Shipping',
      className: 'bg-purple-600 text-white',
      priority: 4
    }
  }
  
  return configs[type as keyof typeof configs] || null
}
