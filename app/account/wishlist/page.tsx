"use client"

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Heart, 
  Search, 
  Filter,
  ShoppingCart,
  Trash2,
  Share2,
  Eye,
  Plus,
  Minus,
  Star
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useCart } from '@/hooks/use-cart'
import { useWishlist } from '@/hooks/use-wishlist'
import { useProductsByIds } from '@/hooks/use-products-by-ids'
import { Product } from '@/hooks/use-products'
import Image from 'next/image'
import Link from 'next/link'

interface WishlistItem {
  id: string
  productId: string
  name: string
  price: number
  originalPrice?: number
  image: string
  addedDate: Date
  isInStock: boolean
  quantity: number
  category: string
  rating: number
  reviewCount: number
}

function WishlistPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { addItem } = useCart()
  const { items: wishEntries, remove: removeFromWishlist } = useWishlist()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('date')
  
  // Get product IDs from wishlist entries - memoize to prevent infinite re-renders
  const productIds = useMemo(() => wishEntries.map(entry => entry.productId), [wishEntries])
  const { products, loading: productsLoading } = useProductsByIds(productIds)
  
  // Create wishlist items with full product data - memoize to prevent infinite re-renders
  const wishlistItems = useMemo(() => {
    return products.map(product => {
      const wishEntry = wishEntries.find(entry => entry.productId === product.id)
      return {
        id: String(product.id),
        productId: String(product.id),
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        addedDate: wishEntry ? new Date(wishEntry.addedAt) : new Date(),
        isInStock: product.inStock,
        quantity: 1,
        category: product.category,
        rating: product.rating,
        reviewCount: product.reviews,
        product: product
      }
    })
  }, [products, wishEntries])

  const [filteredItems, setFilteredItems] = useState<WishlistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setFilteredItems(wishlistItems)
    setIsLoading(false)
  }, [wishlistItems])

  // Filter and sort items
  useEffect(() => {
    let filtered = wishlistItems

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter)
    }

    // Sort items
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price
        case 'price-high':
          return b.price - a.price
        case 'name':
          return a.name.localeCompare(b.name)
        case 'rating':
          return b.rating - a.rating
        case 'date':
        default:
          return b.addedDate.getTime() - a.addedDate.getTime()
      }
    })

    setFilteredItems(filtered)
  }, [searchTerm, categoryFilter, sortBy, wishlistItems])

  const handleAddToCart = (item: WishlistItem) => {
    const qty = Math.max(1, item.quantity || 1)
    const price = item.price
    addItem(item.productId, qty, undefined, {}, price)
  }

  const handleRemoveFromWishlist = async (itemId: string) => {
    const productId = parseInt(itemId)
    if (!isNaN(productId)) {
      await removeFromWishlist(productId)
    }
  }

  const handleViewProduct = (productId: string) => {
    router.push(`/products/${productId}`)
  }

  const handleShareWishlist = () => {
    // In real app, this would share the wishlist
    navigator.clipboard.writeText(`${window.location.origin}/account/wishlist`)
  }

  const getCategories = () => {
    const categories = [...new Set(wishlistItems.map(item => item.category))]
    return categories
  }

  const getDiscountPercentage = (originalPrice: number, currentPrice: number) => {
    return Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
  }

  if (isLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading wishlist...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-4">
          <h1 className="text-3xl font-bold -mt-2">My Wish List</h1>
          <p className="text-muted-foreground">
            {wishlistItems.length} items in your wishlist
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleShareWishlist}>
            <Share2 className="w-4 h-4 mr-2" />
            Share Wishlist
          </Button>
          <Button onClick={() => router.push('/products')}>
            <Plus className="w-4 h-4 mr-2" />
            Browse Products
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search wishlist items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    // Search is already triggered by onChange, but we can add additional logic here if needed
                  }
                }}
                className="pl-10"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Categories</option>
              {getCategories().map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="date">Date Added</option>
              <option value="name">Name</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Rating</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Wishlist Items */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 px-1 sm:px-2 lg:px-3">
        {filteredItems.map((item) => (
          <Card 
            key={item.id} 
            className="flex flex-col overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '280px 380px' }}
          >
            <Link 
              href={`/products/${item.productId}`} 
              className="block relative aspect-square overflow-hidden" 
            >
              <Image
                src={item.image}
                alt={item.name}
                fill
                className="object-cover transition-transform duration-300 hover:scale-105"
                sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 20vw"
              />
              {/* Discount Badge */}
              {item.originalPrice && item.originalPrice > item.price && (
                <div className="absolute top-0 right-0 sm:top-0 sm:right-1.5 z-10">
                  <span className="bg-black/60 text-white text-[8px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-none shadow-sm sm:shadow-md">
                    {getDiscountPercentage(item.originalPrice, item.price).toFixed(0)}% OFF
                  </span>
                </div>
              )}
              {/* Out of Stock Badge */}
              {!item.isInStock && (
                <div className="absolute top-1 left-1 sm:top-2 sm:left-2 z-10">
                  <span className="bg-red-500 text-white text-[8px] sm:text-[10px] px-0.5 sm:px-1 py-0.5 rounded-none shadow-sm sm:shadow-md">
                    Out of Stock
                  </span>
                </div>
              )}
              {/* Remove Button */}
              <div className="absolute top-1 right-1 sm:top-2 sm:right-2 z-10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    handleRemoveFromWishlist(item.id)
                  }}
                  className="bg-white/80 hover:bg-white p-1 h-6 w-6"
                >
                  <Trash2 className="w-3 h-3 text-red-600" />
                </Button>
              </div>
            </Link>
            <CardContent className="p-3 flex-1 flex flex-col justify-between min-h-[120px]">
              <div className="flex-1">
                <Link href={`/products/${item.productId}`} className="block">
                  <h3 className="text-sm font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2 mb-2">
                    {item.name}
                  </h3>
                </Link>
                {/* Rating */}
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${
                        i < Math.floor(item.rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300 dark:text-gray-600"
                      }`}
                    />
                  ))}
                  <span>({item.reviewCount})</span>
                </div>
                {/* Price */}
                <div className="flex flex-wrap items-baseline gap-x-2 mb-3">
                  <div className="text-base font-bold">
                    TZS {item.price.toFixed(0)}
                  </div>
                  {item.originalPrice && item.originalPrice > item.price && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 line-through">
                      TZS {item.originalPrice.toFixed(0)}
                    </div>
                  )}
                </div>
              </div>
              {/* Action Buttons */}
              <div className="flex gap-2 mt-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewProduct(item.productId)}
                  className="flex-1 text-xs h-8"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </Button>
                <Button
                  size="sm"
                  disabled={!item.isInStock}
                  onClick={() => handleAddToCart(item)}
                  className="flex-1 text-xs h-8"
                >
                  <ShoppingCart className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchTerm || categoryFilter !== 'all' 
                ? 'No items found' 
                : 'Your wishlist is empty'
              }
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || categoryFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Start adding items to your wishlist to save them for later.'
              }
            </p>
            {!searchTerm && categoryFilter === 'all' && (
              <Button onClick={() => router.push('/products')}>
                Start Shopping
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {wishlistItems.length > 0 && (
        <Card className="mt-8">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xl font-bold">{wishlistItems.length}</p>
                <p className="text-xs text-muted-foreground">Total Items</p>
              </div>
              <div>
                <p className="text-xl font-bold">
                  TZS {wishlistItems.reduce((sum, item) => sum + item.price, 0).toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Value</p>
              </div>
              <div>
                <p className="text-xl font-bold">
                  {wishlistItems.filter(item => item.isInStock).length}
                </p>
                <p className="text-xs text-muted-foreground">In Stock</p>
              </div>
              <div>
                <p className="text-xl font-bold">
                  {getCategories().length}
                </p>
                <p className="text-xs text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function WishlistPage() {
  return <WishlistPageContent />
}
