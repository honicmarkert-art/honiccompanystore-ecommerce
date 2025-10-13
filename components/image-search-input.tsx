"use client"

import React, { useRef, useState, useEffect } from 'react'
import { Camera, X, Upload, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useImageSearch } from '@/hooks/use-image-search'
import { Button } from '@/components/ui/button'

interface ImageSearchInputProps {
  onImageSearch: (products: any[], keywords: string[]) => void
  className?: string
  placeholder?: string
}

export function ImageSearchInput({ onImageSearch, className, placeholder = "Search by image..." }: ImageSearchInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const { searchByImage, isLoading, error, clearError } = useImageSearch()

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image file too large (max 10MB)')
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    clearError()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleSearch = async () => {
    if (!selectedFile) return

    const result = await searchByImage(selectedFile)
    if (result) {
      onImageSearch(result.products, result.keywords)
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    clearError()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Handle paste from clipboard (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      // Find image item in clipboard
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile()
          if (file) {
            handleFileSelect(file)
            e.preventDefault()
          }
          break
        }
      }
    }

    // Add paste event listener to document
    document.addEventListener('paste', handlePaste)
    
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [])

  return (
    <div className={cn("relative", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      {!selectedFile ? (
        <div
          className={cn(
            "flex items-center justify-center p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
            "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
          )}
          onClick={handleUploadClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="text-center py-2">
            <Camera className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Drag an image here
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              or
            </p>
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              className="mb-3"
              onClick={(e) => {
                e.stopPropagation()
                handleUploadClick()
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload a photo
            </Button>
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
              *For a quick search hit <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">CTRL+V</kbd> to paste an image
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Image Preview */}
          <div className="relative">
            <img
              src={previewUrl!}
              alt="Selected for search"
              className="w-full h-32 object-cover rounded-lg border"
            />
          </div>

          {/* Clear Image Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="w-full"
          >
            <X className="w-4 h-4 mr-2" />
            Clear Image
          </Button>

          {/* Search Button */}
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                "bg-blue-600 hover:bg-blue-700 text-white",
                "disabled:bg-gray-400 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search Products
                </>
              )}
            </button>
            
            <button
              onClick={handleUploadClick}
              className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}



