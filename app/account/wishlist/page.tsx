"use client"

import { useState, useEffect } from 'react'
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
  Minus
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useCart } from '@/hooks/use-cart'
import { ProtectedRoute } from '@/components/protected-route'

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
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([])
  const [filteredItems, setFilteredItems] = useState<WishlistItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('date')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Mock wishlist data
    const mockWishlistItems: WishlistItem[] = [
      {
        id: '1',
        productId: '1',
        name: 'Arduino Uno R3 Development Board',
        price: 89.99,
        originalPrice: 99.99,
        image: '/placeholder.jpg',
        addedDate: new Date('2024-01-15'),
        isInStock: true,
        quantity: 1,
        category: 'Electronics',
        rating: 4.8,
        reviewCount: 1250
      },
      {
        id: '2',
        productId: '2',
        name: 'DHT22 Digital Temperature and Humidity Sensor',
        price: 34.50,
        image: '/placeholder.jpg',
        addedDate: new Date('2024-01-12'),
        isInStock: true,
        quantity: 2,
        category: 'Sensors',
        rating: 4.6,
        reviewCount: 890
      },
      {
        id: '3',
        productId: '3',
        name: 'SG90 Micro Servo Motor',
        price: 45.25,
        image: '/placeholder.jpg',
        addedDate: new Date('2024-01-10'),
        isInStock: false,
        quantity: 1,
        category: 'Motors',
        rating: 4.4,
        reviewCount: 567
      },
      {
        id: '4',
        productId: '4',
        name: 'Raspberry Pi 4 Model B 8GB RAM',
        price: 89.99,
        originalPrice: 119.99,
        image: '/placeholder.jpg',
        addedDate: new Date('2024-01-08'),
        isInStock: true,
        quantity: 1,
        category: 'Computers',
        rating: 4.9,
        reviewCount: 2100
      },
      {
        id: '5',
        productId: '5',
        name: 'LED Strip WS2812B Addressable RGB',
        price: 24.99,
        image: '/placeholder.jpg',
        addedDate: new Date('2024-01-05'),
        isInStock: true,
        quantity: 1,
        category: 'LEDs',
        rating: 4.7,
        reviewCount: 743
      },
      {
        id: '6',
        productId: '6',
        name: 'Breadboard Kit with Jumper Wires',
        price: 22.50,
        image: '/placeholder.jpg',
        addedDate: new Date('2024-01-03'),
        isInStock: true,
        quantity: 1,
        category: 'Accessories',
        rating: 4.5,
        reviewCount: 456
      }
    ]

    setWishlistItems(mockWishlistItems)
    setFilteredItems(mockWishlistItems)
    setIsLoading(false)
  }, [])

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
    addItem({
      id: item.productId,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity: item.quantity,
      selectedAttributes: {}
    })
  }

  const handleRemoveFromWishlist = (itemId: string) => {
    setWishlistItems(prev => prev.filter(item => item.id !== itemId))
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

  if (isLoading) {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Wish List</h1>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <div className="aspect-square bg-gray-200 relative">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover"
              />
              {item.originalPrice && item.originalPrice > item.price && (
                <Badge className="absolute top-2 left-2 bg-red-500">
                  -{getDiscountPercentage(item.originalPrice, item.price)}%
                </Badge>
              )}
              {!item.isInStock && (
                <Badge className="absolute top-2 right-2 bg-gray-500">
                  Out of Stock
                </Badge>
              )}
              <div className="absolute top-2 right-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFromWishlist(item.id)}
                  className="bg-white/80 hover:bg-white"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-sm line-clamp-2 mb-1">
                    {item.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold">${item.price.toFixed(2)}</span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="text-sm text-muted-foreground line-through">
                        ${item.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-sm text-yellow-600">★</span>
                    <span className="text-xs">{item.rating}</span>
                    <span className="text-xs text-muted-foreground">
                      ({item.reviewCount})
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Added {item.addedDate.toLocaleDateString()}
                  </span>
                  <div className="flex space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewProduct(item.productId)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      disabled={!item.isInStock}
                      onClick={() => handleAddToCart(item)}
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
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
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{wishlistItems.length}</p>
                <p className="text-sm text-muted-foreground">Total Items</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${wishlistItems.reduce((sum, item) => sum + item.price, 0).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">Total Value</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {wishlistItems.filter(item => item.isInStock).length}
                </p>
                <p className="text-sm text-muted-foreground">In Stock</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {getCategories().length}
                </p>
                <p className="text-sm text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function WishlistPage() {
  return (
    <ProtectedRoute>
      <WishlistPageContent />
    </ProtectedRoute>
  )
} 
 