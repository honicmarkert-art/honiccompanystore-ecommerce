"use client"

import React, { useState } from 'react'
import { Search, Camera, Upload, Shield, Zap, TrendingUp, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface AlibabaHeroSectionProps {
  onSearch?: (query: string) => void
  onImageSearch?: () => void
  searchQuery?: string
  themeClasses?: string
}

export function AlibabaHeroSection({
  onSearch,
  onImageSearch,
  searchQuery = '',
  themeClasses = ''
}: AlibabaHeroSectionProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [isImageSearchActive, setIsImageSearchActive] = useState(false)

  const handleSearch = () => {
    if (onSearch) {
      onSearch(localQuery)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className={cn(
      "w-full",
      themeClasses
    )}>
      {/* Hero Background */}
      <div className="relative w-full bg-gradient-to-b from-orange-50 to-transparent dark:from-orange-950 dark:to-transparent py-8 px-4">
        {/* Top Message */}
        <div className="max-w-6xl mx-auto mb-8">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Get ready for 2027
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Find quality products at the best prices
          </p>
        </div>

        {/* Search Bar Container */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-full shadow-lg p-1 flex items-center gap-2">
            {/* Search Icon */}
            <div className="pl-4">
              <Search className="w-5 h-5 text-gray-400" />
            </div>

            {/* Search Input */}
            <Input
              type="text"
              placeholder="Search products, categories, suppliers..."
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 border-0 bg-transparent focus:outline-none focus-visible:ring-0 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />

            {/* Search Options */}
            <div className="flex items-center gap-1 pr-2">
              {/* Image Search Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onImageSearch}
                className={cn(
                  "flex items-center gap-1.5 h-9 px-3",
                  isImageSearchActive
                    ? "bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                )}
                title="Search by image"
              >
                <Camera className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Image</span>
              </Button>

              {/* File Upload Button */}
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1.5 h-9 px-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                title="Search with file"
              >
                <Upload className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">File</span>
              </Button>

              {/* Search Button */}
              <Button
                onClick={handleSearch}
                className="h-9 px-6 bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white rounded-full font-medium transition-colors"
              >
                <Search className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Search</span>
              </Button>
            </div>
          </div>

          {/* Search Tips */}
          <div className="mt-3 flex flex-wrap gap-2 justify-center text-xs text-gray-600 dark:text-gray-400">
            <span>Popular searches:</span>
            <Link href="?q=electronics" className="text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 font-medium">
              Electronics
            </Link>
            <span className="text-gray-400">•</span>
            <Link href="?q=components" className="text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 font-medium">
              Components
            </Link>
            <span className="text-gray-400">•</span>
            <Link href="?q=supplies" className="text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 font-medium">
              Supplies
            </Link>
          </div>
        </div>
      </div>

      {/* Trust Badges Section */}
      <div className="max-w-6xl mx-auto px-4 py-8 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Badge 1: Verified Supplier */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Shield className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Verified Supplier
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Shop from verified sellers with proven production capabilities
              </p>
            </div>
          </div>

          {/* Badge 2: Order Protection */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Order Protection
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Secure transactions at every stage, from payment to delivery
              </p>
            </div>
          </div>

          {/* Badge 3: Best Prices */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Best Prices
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Factory-direct pricing across 40+ industries
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
