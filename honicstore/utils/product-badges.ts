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
 * Check if product is new based on update date or is_new flag
 * 
 * Logic:
 * 1. If is_new = true (explicitly marked as new) → Always show "New"
 * 2. If is_new = false but updated within threshold → Show "New" 
 * 3. If is_new = false and old update → No "New" badge
 */
export const isProductNew = (product: Product, daysThreshold: number = 30): boolean => {
  
  // Check explicit is_new flag first (highest priority)
  if (product.is_new === true) {
    return true
  }
  
  // Check update date for automatic "new" detection
  if (product.updated_at) {
    const updatedDate = new Date(product.updated_at)
    const thresholdDate = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000)
    const isNewByDate = updatedDate > thresholdDate
    return isNewByDate
  }
  
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
