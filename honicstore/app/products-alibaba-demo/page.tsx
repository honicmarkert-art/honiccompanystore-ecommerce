"use client"

import React, { useState } from 'react'
import { AlibabaHeroSection } from '@/components/alibaba-hero-section'
import { AlibabaCategoriesSection } from '@/components/alibaba-categories-section'
import { AlibabaHotPicksSection, type HotPickProduct } from '@/components/alibaba-hot-picks-section'
import { useTheme } from '@/hooks/use-theme'
import { useToast } from '@/hooks/use-toast'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AlibabaProductDemoPage() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')

  // Sample featured products
  const featuredProducts: HotPickProduct[] = [
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

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    toast({
      title: 'Search',
      description: `Searching for: ${query}`,
    })
  }

  const handleImageSearch = () => {
    toast({
      title: 'Image Search',
      description: 'Image search feature coming soon!',
    })
  }

  const handleCategoryClick = (categoryId: string) => {
    toast({
      title: 'Category Selected',
      description: `You selected: ${categoryId}`,
    })
  }

  const handleViewMore = () => {
    toast({
      title: 'View More',
      description: 'Viewing more hot picks...',
    })
  }

  const handleAddToCart = (productId: string) => {
    toast({
      title: 'Added to Cart',
      description: `Product ${productId} added to your cart!`,
    })
  }

  return (
    <div className={themeClasses}>
      {/* Header Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/products">
              <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Products
              </Button>
            </Link>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Alibaba-Style Demo
          </h1>
          <div className="w-32" /> {/* Spacer for center alignment */}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-gray-900 min-h-screen">
        {/* Alibaba Hero Section */}
        <AlibabaHeroSection
          onSearch={handleSearch}
          onImageSearch={handleImageSearch}
          searchQuery={searchQuery}
          themeClasses={themeClasses}
        />

        {/* Categories Section */}
        <AlibabaCategoriesSection
          onCategoryClick={handleCategoryClick}
          themeClasses={themeClasses}
        />

        {/* Hot Picks Section */}
        <AlibabaHotPicksSection
          products={featuredProducts}
          onViewMore={handleViewMore}
          onAddToCart={handleAddToCart}
          themeClasses={themeClasses}
        />

        {/* Additional Info Section */}
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
              🎨 Demo Page Information
            </h2>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
              This is a demo page showcasing the new Alibaba-style components. To integrate these components into your main product page, please refer to the <strong>ALIBABA_DESIGN_INTEGRATION.md</strong> file.
            </p>
            <div className="bg-white dark:bg-gray-800 rounded p-4 text-xs text-gray-700 dark:text-gray-300 font-mono space-y-2">
              <p>✓ AlibabaHeroSection - Search + Trust Badges</p>
              <p>✓ AlibabaCategoriesSection - Category Grid</p>
              <p>✓ AlibabaHotPicksSection - Featured Products</p>
              <p>✓ Full dark mode support</p>
              <p>✓ Mobile responsive design</p>
              <p>✓ All components integrated and working</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  )
}
