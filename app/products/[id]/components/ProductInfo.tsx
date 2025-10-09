'use client'

import { Star, TruckIcon, ShieldCheck, Package, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Product } from '../types'

interface ProductInfoProps {
  product: Product
  formatPrice: (price: number) => string
  selectedVariantPrice?: number
}

export function ProductInfo({ product, formatPrice, selectedVariantPrice }: ProductInfoProps) {
  // Use variant price if selected, otherwise use product price
  const displayPrice = selectedVariantPrice || product.price
  const originalPrice = product.originalPrice

  const discountPercentage = originalPrice && originalPrice > displayPrice
    ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
          {product.name}
        </h1>
      </div>

      {/* Rating & Reviews */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={cn(
                "w-5 h-5",
                i < Math.floor(product.rating || 0)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              )}
            />
          ))}
          <span className="ml-2 text-lg font-semibold">
            {(product.rating || 0).toFixed(1)}
          </span>
        </div>

        <div className="h-4 w-px bg-gray-300" />

        <button className="text-sm text-muted-foreground hover:text-primary transition-colors">
          {product.reviews || 0} {product.reviews === 1 ? 'review' : 'reviews'}
        </button>

        <div className="h-4 w-px bg-gray-300" />

        <span className="text-sm text-muted-foreground">
          {product.views || 0} views
        </span>
      </div>

      {/* Price */}
      <div className="bg-accent/50 rounded-lg p-4 space-y-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl md:text-4xl font-bold text-primary">
            {formatPrice(displayPrice)}
          </span>
          
          {originalPrice && originalPrice > displayPrice && (
            <>
              <span className="text-xl text-muted-foreground line-through">
                {formatPrice(originalPrice)}
              </span>
              <Badge variant="destructive" className="text-base px-3 py-1">
                {discountPercentage}% OFF
              </Badge>
            </>
          )}
        </div>

        {discountPercentage > 0 && (
          <p className="text-sm text-green-600 font-medium">
            You save {formatPrice(originalPrice! - displayPrice)}!
          </p>
        )}
      </div>

      {/* Stock Status */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          {product.inStock ? (
            <>
              <Badge className="bg-green-500 hover:bg-green-600 text-white">
                ✓ In Stock
              </Badge>
              {product.stockQuantity !== null && product.stockQuantity !== undefined && (
                <span className="text-sm text-muted-foreground">
                  {product.stockQuantity > 10 
                    ? `${product.stockQuantity}+ units available`
                    : `Only ${product.stockQuantity} left in stock!`
                  }
                </span>
              )}
            </>
          ) : (
            <Badge variant="destructive">Out of Stock</Badge>
          )}
        </div>
      </div>

      {/* Quick Features */}
      <div className="border-t pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {product.freeDelivery && (
            <div className="flex items-start gap-3 text-sm">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TruckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="font-medium">Free Delivery</div>
                <div className="text-muted-foreground text-xs">
                  On orders over $50
                </div>
              </div>
            </div>
          )}

          {product.sameDayDelivery && (
            <div className="flex items-start gap-3 text-sm">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-medium">Same Day Delivery</div>
                <div className="text-muted-foreground text-xs">
                  Order before 2 PM
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 text-sm">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="font-medium">Buyer Protection</div>
              <div className="text-muted-foreground text-xs">
                Full refund if not satisfied
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 text-sm">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Package className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="font-medium">Easy Returns</div>
              <div className="text-muted-foreground text-xs">
                30-day return policy
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Brand & SKU */}
      <div className="border-t pt-4 space-y-2 text-sm">
        {product.brand && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Brand:</span>
            <span className="font-medium">{product.brand}</span>
          </div>
        )}
        {product.sku && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">SKU:</span>
            <span className="font-mono text-xs">{product.sku}</span>
          </div>
        )}
        {product.category && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Category:</span>
            <span className="font-medium">{product.category}</span>
          </div>
        )}
      </div>
    </div>
  )
}

