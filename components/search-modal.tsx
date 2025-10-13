"use client"

import React, { useState, useEffect } from 'react'
import { Search, Camera, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ImageSearchInput } from '@/components/image-search-input'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  onTextSearch: (query: string) => void
  onImageSearch: (products: any[], keywords: string[]) => void
  currentSearchTerm: string
  onSearchTermChange: (term: string) => void
  className?: string
  initialTab?: 'text' | 'image'
}

export function SearchModal({
  isOpen,
  onClose,
  onTextSearch,
  onImageSearch,
  currentSearchTerm,
  onSearchTermChange,
  className,
  initialTab = 'text'
}: SearchModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'image'>(initialTab)

  // Update activeTab when initialTab changes (when modal opens)
  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const handleTextSearch = () => {
    if (currentSearchTerm.trim()) {
      onTextSearch(currentSearchTerm.trim())
      onClose()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTextSearch()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn("sm:max-w-md", className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Products
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tab Navigation - Only show for text search */}
          {activeTab === 'text' && (
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('text')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-4 font-medium transition-colors",
                  activeTab === 'text'
                    ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400"
                    : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                )}
              >
                <Search className="w-4 h-4" />
                Text Search
              </button>
              <button
                onClick={() => setActiveTab('image')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-4 font-medium transition-colors",
                  activeTab === 'image'
                    ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400"
                    : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                )}
              >
                <Camera className="w-4 h-4" />
                Image Search
              </button>
            </div>
          )}

          {/* Content */}
          {activeTab === 'text' ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search for products..."
                  value={currentSearchTerm}
                  onChange={(e) => onSearchTermChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                />
              </div>
              <Button 
                onClick={handleTextSearch}
                disabled={!currentSearchTerm.trim()}
                className="w-full"
              >
                Search
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Image Search Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Camera className="w-4 h-4" />
                  Image Search
                </div>
                <button
                  onClick={() => setActiveTab('text')}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                >
                  ← Back to Text Search
                </button>
              </div>
              <ImageSearchInput
                onImageSearch={(products, keywords) => {
                  onImageSearch(products, keywords)
                  onClose()
                }}
                placeholder="Upload an image to find similar products"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}



