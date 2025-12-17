"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useSWRProducts } from '@/hooks/use-swr-products'
import { Button } from '@/components/ui/button'
import { Package, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Product {
  id: number
  name: string
  description: string
  price: number
  originalPrice: number
  image: string
  gallery: string[]
  category: string
  brand: string
  rating: number
  reviews: number
  inStock: boolean
  freeDelivery?: boolean
  sameDayDelivery?: boolean
  specifications: Record<string, any>
  variants?: any[]
  variantImages?: any[]
  variantConfig?: any
  sku?: string
  model?: string
  views?: number
  video?: string
  view360?: string
}

interface Category {
  id: number
  name: string
  slug: string
  description?: string
  image?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ProductsClientPageProps {
  initialProducts: Product[]
  initialCategories: Category[]
  searchParams: {
    category?: string
    brand?: string
    search?: string
    page?: string
  }
}

/**
 * Client-side products page with on-demand loading
 * 
 * Features:
 * - Shows initial server-rendered data immediately
 * - Manual "Load Products" button for on-demand loading
 * - SWR-based rate limiting and caching
 * - Graceful 429 error handling
 */
export function ProductsClientPage({ 
  initialProducts, 
  initialCategories, 
  searchParams 
}: ProductsClientPageProps) {
  const [showInitialData, setShowInitialData] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)

  // SWR hook for on-demand loading
  const {
    products,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    isRateLimited,
    loadMore,
    refresh,
    searchProducts,
    filterByCategory,
    filterByBrand,
    clearFilters,
    loadProducts,
    isManualLoad
  } = useSWRProducts({
    category: searchParams.category,
    brand: searchParams.brand,
    search: searchParams.search,
    limit: 20,
    enabled: false // Start disabled for manual loading
  })

  // Show initial server data first
  const displayProducts = showInitialData ? initialProducts : products
  const displayCategories = initialCategories

  const handleLoadProducts = () => {
    setShowInitialData(false)
    setHasLoaded(true)
    loadProducts()
  }

  const handleRefresh = () => {
    if (hasLoaded) {
      refresh()
    } else {
      // If we haven't loaded yet, just reload the page to get fresh server data
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Products
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {showInitialData 
              ? `Showing ${initialProducts.length} products (server-rendered)`
              : `Showing ${products.length} products (client-loaded)`
            }
          </p>
        </div>

        {/* Load Products Button */}
        {!hasLoaded && (
          <div className="mb-8 text-center">
            <Button
              onClick={handleLoadProducts}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
            >
              <>
                <Package className="w-5 h-5 mr-2" />
                {isLoading ? 'Loading...' : 'Load Products'}
              </>
            </Button>
            <p className="text-sm text-gray-500 mt-2">
              Click to load products on-demand and enable filtering
            </p>
          </div>
        )}

        {/* Rate Limited State */}
        {isRateLimited && (
          <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center">
              <Package className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3" />
              <div>
                <h3 className="text-yellow-800 dark:text-yellow-200 font-medium">
                  Too Many Requests
                </h3>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                  Please wait a moment before trying again. This helps us provide better service to all users.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Button
                onClick={handleRefresh}
                disabled={isRateLimited}
                variant="outline"
                size="sm"
                className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isRateLimited && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <Package className="w-5 h-5 text-red-600 dark:text-red-400 mr-3" />
              <div>
                <h3 className="text-red-800 dark:text-red-200 font-medium">
                  Error Loading Products
                </h3>
                <p className="text-red-700 dark:text-red-300 text-sm">
                  {error}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Categories */}
        {displayCategories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Categories
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  if (hasLoaded) {
                    clearFilters()
                  }
                }}
                variant="outline"
                size="sm"
              >
                All
              </Button>
              {displayCategories.map((category) => (
                <Button
                  key={category.id}
                  onClick={() => {
                    if (hasLoaded) {
                      filterByCategory(category.slug)
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        {displayProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-square bg-gray-200 dark:bg-gray-700 relative">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {product.name}
                  </h3>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-2">
                    ${product.price}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {product.brand} • {product.category}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-yellow-500">★</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                        {product.rating} ({product.reviews})
                      </span>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      product.inStock 
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    )}>
                      {product.inStock ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Products Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {showInitialData 
                ? "No products available. Click 'Load Products' to fetch from the server."
                : "No products match your current filters."
              }
            </p>
          </div>
        )}

        {/* Load More Button */}
        {hasLoaded && hasMore && (
          <div className="mt-8 text-center">
            <Button
              onClick={loadMore}
              disabled={isLoadingMore}
              variant="outline"
              className="px-8 py-3"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Loading More...
                </>
              ) : (
                "Load More Products"
              )}
            </Button>
          </div>
        )}

        {/* Refresh Button */}
        <div className="mt-8 text-center">
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
          >
            Refresh Data
          </Button>
        </div>
      </div>
    </div>
  )
}




