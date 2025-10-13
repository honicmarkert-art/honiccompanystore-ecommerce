"use client"

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LazyImage } from "@/components/lazy-image"
import { X, ShoppingCart, Star, Truck, Clock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Product {
  id: number
  name: string
  price: number
  image: string
  rating?: number
  reviews?: number
  inStock?: boolean
  original_price?: number
  stock_quantity?: number
  brand?: string
  category?: string
}

interface PromotionalCartPopupProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
}

export function PromotionalCartPopup({ isOpen, onClose, products }: PromotionalCartPopupProps) {
  const router = useRouter()
  const [currentProductIndex, setCurrentProductIndex] = useState(0)


  // Auto-rotate products every 3 seconds
  useEffect(() => {
    if (!isOpen || products.length <= 1) return

    const interval = setInterval(() => {
      setCurrentProductIndex((prev) => (prev + 1) % products.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [isOpen, products.length])

  const currentProduct = products[currentProductIndex]

  const handleProductClick = (product: Product) => {
    onClose()
    // Navigate to products page with the product name as search term
    router.push(`/products?search=${encodeURIComponent(product.name)}`)
  }

  const handleShopNow = () => {
    onClose()
    router.push('/products')
  }

  // If no products, show a simple message
  if (!products || products.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-4">
          <DialogHeader className="pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              Special Offer!
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-gray-600 mb-4">Discover our amazing products!</p>
            <Button onClick={handleShopNow} className="bg-blue-600 hover:bg-blue-700">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Shop Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xs sm:max-w-md max-h-[80vh] overflow-y-auto p-3">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              Special Offer!
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 hover:bg-gray-100"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-3">
          {/* Small Image Container */}
          <div className="text-center">
            <div className="relative w-full h-24 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg overflow-hidden mx-auto">
              {currentProduct && (
                <LazyImage
                  src={currentProduct.image || '/placeholder.png'}
                  alt={currentProduct.name}
                  fill
                  className="object-contain p-2"
                  priority
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              )}
            </div>
            {currentProduct && (
              <div className="mt-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {currentProduct.name}
                </h3>
                <p className="text-xs text-blue-600 font-semibold">
                  TZS {currentProduct.price.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Compact Product Grid */}
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              Featured Products
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {products.map((product, index) => (
                <Card 
                  key={product.id}
                  className="cursor-pointer transition-all hover:shadow-md border border-gray-200"
                  onClick={() => handleProductClick(product)}
                >
                  <CardContent className="p-2">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                        <LazyImage
                          src={product.image || '/placeholder.png'}
                          alt={product.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-contain"
                          sizes="48px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-xs text-gray-900 dark:text-gray-100 truncate">
                          {product.name}
                        </h5>
                        <div className="flex items-center gap-1 mt-1">
                          <p className="text-xs font-semibold text-blue-600">
                            TZS {product.price.toLocaleString()}
                          </p>
                          {product.original_price && product.original_price > product.price && (
                            <p className="text-xs text-gray-500 line-through">
                              TZS {product.original_price.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {product.rating && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <span>{product.rating}</span>
                            </div>
                          )}
                          {product.brand && (
                            <p className="text-xs text-gray-500 truncate">{product.brand}</p>
                          )}
                        </div>
                      </div>
                      {(product.inStock || (product.stock_quantity && product.stock_quantity > 0)) && (
                        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Compact Action Buttons */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 text-xs py-2 h-8"
            >
              Maybe Later
            </Button>
            <Button
              onClick={handleShopNow}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs py-2 h-8"
            >
              Shop Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}