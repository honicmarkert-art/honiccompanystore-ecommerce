/**
 * Shared types for Product Detail Page components
 */

import type { Product, ProductVariant } from '@/hooks/use-products'

export interface ProductDetailProps {
  product: Product
  isLoading?: boolean
}

export interface VariantSelection {
  [attribute: string]: string
}

export interface ProductActions {
  onAddToCart: (variantId: string | null, quantity: number) => Promise<void>
  onBuyNow: () => void
  onAddToWishlist: () => void
  onShare: () => void
}

export interface GalleryImage {
  url: string
  alt: string
  type: 'image' | 'video' | '360'
}

export interface ReviewData {
  id: string
  userId: string
  userName: string
  rating: number
  comment: string
  date: string
  helpful: number
  images?: string[]
}

export interface ShippingOption {
  id: string
  name: string
  price: number
  estimatedDays: string
  description: string
}

export type { Product, ProductVariant }

