"use client"

import React from 'react'
import { Star, ShoppingCart, Heart, Eye, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface HotPickProduct {
  id: string
  name: string
  price: number
  originalPrice?: number
  image: string
  rating: number
  reviews: number
  soldCount?: number
  badge?: string
  discount?: number
}

export interface AlibabaHotPicksSectionProps {
  products?: HotPickProduct[]
  themeClasses?: string
  onViewMore?: () => void
  onAddToCart?: (productId: string) => void
}

const DEFAULT_HOT_PICKS: HotPickProduct[] = [
  {
    id: '1',
    name: 'Premium Wireless Headphones',
    price: 45.99,
    originalPrice: 89.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop',
    rating: 4.8,
    reviews: 1240,
    soldCount: 5600,
    badge: 'Hot',
    discount: 49,
  },
  {
    id: '2',
    name: 'USB-C Fast Charging Cable',
    price: 12.99,
    originalPrice: 24.99,
    image: 'https://images.unsplash.com/photo-1625948515291-69613efd103f?w=300&h=300&fit=crop',
    rating: 4.7,
    reviews: 2341,
    soldCount: 12500,
    badge: 'Best Seller',
    discount: 48,
  },
  {
    id: '3',
    name: 'Portable Power Bank 20000mAh',
    price: 28.50,
    originalPrice: 59.99,
    image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=300&h=300&fit=crop',
    rating: 4.6,
    reviews: 1856,
    soldCount: 8900,
    badge: 'Trending',
    discount: 52,
  },
  {
    id: '4',
    name: 'LED Desk Lamp with USB Port',
    price: 22.99,
    originalPrice: 44.99,
    image: 'https://images.unsplash.com/photo-1565636192335-14eccf92000a?w=300&h=300&fit=crop',
    rating: 4.5,
    reviews: 942,
    soldCount: 3400,
    badge: 'New',
    discount: 49,
  },
  {
    id: '5',
    name: 'Wireless Mouse 2.4GHz',
    price: 15.99,
    originalPrice: 32.99,
    image: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=300&h=300&fit=crop',
    rating: 4.7,
    reviews: 2156,
    soldCount: 7800,
    badge: 'Best Seller',
    discount: 52,
  },
  {
    id: '6',
    name: 'Bluetooth Speaker Portable',
    price: 32.99,
    originalPrice: 69.99,
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&h=300&fit=crop',
    rating: 4.8,
    reviews: 3421,
    soldCount: 11200,
    badge: 'Hot',
    discount: 53,
  },
]

function ProductCard({ product, onAddToCart }: { product: HotPickProduct; onAddToCart?: (id: string) => void }) {
  return (
    <Link href={`/products/${product.id}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
        {/* Image Container */}
        <div className="relative overflow-hidden bg-gray-100 dark:bg-gray-700 aspect-square">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover hover:scale-110 transition-transform duration-300"
          />

          {/* Badge */}
          {product.badge && (
            <Badge className="absolute top-2 left-2 bg-orange-500 hover:bg-orange-600 text-white">
              {product.badge}
            </Badge>
          )}

          {/* Discount */}
          {product.discount && (
            <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold">
              -{product.discount}%
            </div>
          )}

          {/* Quick Actions Overlay */}
          <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors duration-300 flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
            <Button
              size="sm"
              className="bg-white text-orange-600 hover:bg-orange-50"
              onClick={(e) => {
                e.preventDefault()
                if (onAddToCart) onAddToCart(product.id)
              }}
            >
              <ShoppingCart className="w-4 h-4 mr-1" />
              Add
            </Button>
            <Button size="sm" variant="outline" className="bg-white/80">
              <Heart className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col">
          {/* Product Name */}
          <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-2 hover:text-orange-600 dark:hover:text-orange-400">
            {product.name}
          </h3>

          {/* Rating */}
          <div className="flex items-center gap-1 mb-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'w-3 h-3',
                    i < Math.floor(product.rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300 dark:text-gray-600'
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              ({product.reviews.toLocaleString()})
            </span>
          </div>

          {/* Price */}
          <div className="mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-orange-600">${product.price.toFixed(2)}</span>
              {product.originalPrice && (
                <span className="text-xs text-gray-500 line-through">
                  ${product.originalPrice.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Sold Count */}
          {product.soldCount && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {(product.soldCount / 1000).toFixed(1)}k+ sold
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

export function AlibabaHotPicksSection({
  products = DEFAULT_HOT_PICKS,
  themeClasses = '',
  onViewMore,
  onAddToCart,
}: AlibabaHotPicksSectionProps) {
  return (
    <div className={cn('w-full', themeClasses)}>
      {/* Section Header */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            🔥 Hot Picks
          </h2>
          <Button
            variant="outline"
            onClick={onViewMore}
            className="border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            View more
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-b border-gray-200 dark:border-gray-700" />
    </div>
  )
}
