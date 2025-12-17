"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { logger } from '@/lib/logger'
import { Label } from "@/components/ui/label"
import { Upload, X, Image as ImageIcon } from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"

// Helper function to detect if a file is a video
const isVideoFile = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv']
  return videoExtensions.some(ext => url.toLowerCase().includes(ext))
}

interface ImageUploadProps {
  label: string
  currentImage?: string
  onImageChange: (imageUrl: string) => void
  placeholder?: string
  className?: string
  serviceId?: string
}

export function ImageUpload({ 
  label, 
  currentImage, 
  onImageChange, 
  placeholder = "Upload image or video...",
  className = "",
  serviceId
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentImage || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, GIF, etc.)",
        variant: "destructive"
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive"
      })
      return
    }

    setIsUploading(true)

    try {
      // Create FormData
      const formData = new FormData()
      formData.append('file', file)
      if (serviceId) {
        formData.append('serviceId', serviceId)
      }

      // Upload to Supabase storage
      const response = await fetch('/api/admin/service-image-upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()
      
      if (result.success && result.url) {
        setPreview(result.url)
        onImageChange(result.url)
        toast({
          title: "Success",
          description: "Image uploaded successfully",
        })
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveImage = () => {
    setPreview(null)
    onImageChange('')
    toast({
      title: "Image removed",
      description: "Image has been removed",
    })
  }

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const url = event.target.value
    setPreview(url)
    onImageChange(url)
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      
      {/* Image Preview */}
      <div className="flex items-center space-x-4">
        <div className="relative w-24 h-16 border border-gray-200 rounded-md overflow-hidden bg-gray-50">
          {preview && preview.trim() !== '' && (preview.startsWith('http') || preview.startsWith('data:')) ? (
            isVideoFile(preview) ? (
              <video
                src={preview}
                className="object-cover w-full h-full"
                muted
                loop
                playsInline
                onError={(e) => {
                  logger.log('Admin ImageUpload: Video failed to load:', preview)
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <Image
                src={preview}
                alt={label}
                width={96}
                height={64}
                className="object-cover w-full h-full"
                onError={(e) => {
                  logger.log('Admin ImageUpload: Image failed to load:', preview)
                  e.currentTarget.style.display = 'none'
                }}
              />
            )
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1 space-y-2">
          {/* File Upload */}
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>{isUploading ? "Uploading..." : "Upload"}</span>
            </Button>
            
            {preview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveImage}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* URL Input */}
          <Input
            placeholder={placeholder}
            value={preview || ''}
            onChange={handleUrlChange}
            className="text-sm"
          />
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  )
}
