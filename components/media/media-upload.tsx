"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useToast } from "@/hooks/use-toast"
import { 
  Upload, 
  Image as ImageIcon, 
  Video, 
  Box, 
  Link, 
  X, 
  RotateCw, 
  Trash2,
  Eye,
  Check
} from "lucide-react"
import NextImage from "next/image"

interface MediaUploadProps {
  type: 'image' | 'video' | 'model3d'
  value?: string
  onChange: (url: string) => void
  onRemove?: () => void
  maxSize?: number // in MB
  acceptedFormats?: string[]
  aspectRatio?: number
  className?: string
  label?: string
  description?: string
  context?: 'category' | 'product' | 'variant' // Context for bucket selection
  productId?: number // Product ID for product-specific uploads
}


export function MediaUpload({
  type,
  value,
  onChange,
  onRemove,
  maxSize = 10,
  acceptedFormats = [],
  aspectRatio,
  className,
  label,
  description,
  context = 'product',
  productId
}: MediaUploadProps) {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isUploading, setIsUploading] = useState(false)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Get default accepted formats based on type
  const getDefaultFormats = () => {
    switch (type) {
      case 'image':
        return ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      case 'video':
        return ['video/mp4', 'video/webm', 'video/ogg']
      case 'model3d':
        return ['model/gltf+json', 'model/gltf-binary', 'application/octet-stream']
      default:
        return []
    }
  }

  const formats = acceptedFormats.length > 0 ? acceptedFormats : getDefaultFormats()

  const handleFileSelect = useCallback(async (file: File) => {
    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `File size must be less than ${maxSize}MB`,
        variant: "destructive"
      })
      return
    }

    // Validate file type
    if (!formats.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: `Please select a ${type} file`,
        variant: "destructive"
      })
      return
    }

    setOriginalFile(file)
    
    if (type === 'image') {
      // For images, show preview first instead of editor
      const url = URL.createObjectURL(file)
      setPendingImage(url)
      setShowPreview(true)
    } else {
      // For videos and 3D models, upload directly
      await uploadFile(file)
    }
  }, [maxSize, formats, type, toast])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }


  const uploadFile = async (file: File) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      formData.append('context', context)
      
      // Include product ID if available for product-specific uploads
      if (productId && (context === 'product' || context === 'variant')) {
        formData.append('productId', productId.toString())
      }
      
      const response = await fetch(`/api/media/upload?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()
      onChange(result.url)
      
      toast({
        title: "Upload successful",
        description: `${type} uploaded successfully`
      })
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload file",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
    }
  }


  const getTypeIcon = () => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-5 h-5" />
      case 'video':
        return <Video className="w-5 h-5" />
      case 'model3d':
        return <Box className="w-5 h-5" />
      default:
        return <Upload className="w-5 h-5" />
    }
  }

  const getTypeLabel = () => {
    switch (type) {
      case 'image':
        return 'Image'
      case 'video':
        return 'Video'
      case 'model3d':
        return '3D Model'
      default:
        return 'Media'
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {label && (
        <Label className={cn("text-sm font-medium", themeClasses.mainText)}>
          {label}
        </Label>
      )}
      
      {description && (
        <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
          {description}
        </p>
      )}

      {/* New Layout: Image Preview on Left, Actions on Right */}
      <div className="flex gap-4">
        {/* Image Preview Container - Left Side */}
        <div className="flex-shrink-0">
          {value ? (
            <div className="relative w-32 h-32 overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-50">
              {type === 'image' && (
                <NextImage
                  src={value}
                  alt="Current media"
                  fill
                  className="object-contain"
                  style={{ objectFit: 'contain' }}
                />
              )}
              {type === 'video' && (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  {value.includes('youtube.com') || value.includes('youtu.be') ? (
                    <div className="text-center">
                      <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">YouTube Video</p>
                    </div>
                  ) : (
                    <video
                      src={value}
                      controls
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}
              {type === 'model3d' && (
                <div className="flex items-center justify-center h-full bg-gray-100">
                  {value.includes('youtube.com') || value.includes('youtu.be') ? (
                    <div className="text-center">
                      <Box className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">YouTube 360°</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Box className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">3D Model</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No {getTypeLabel()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions Section - Right Side */}
        <div className="flex-1 space-y-3">
          {/* Product Name and Type */}
          <div>
            <h4 className={cn("font-medium text-sm", themeClasses.mainText)}>
              {label || `${getTypeLabel()} Media`}
            </h4>
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              {type === 'image' ? 'Main product image' : `${getTypeLabel()} file`}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Insert Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-xs"
            >
              <Upload className="w-3 h-3 mr-1" />
              Insert
            </Button>

            {/* Edit Button - Only show if there's a value */}
            {value && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const promptText = type === 'image' ? 'Enter new image URL:' : 
                                   type === 'video' ? 'Enter new video URL:' : 
                                   'Enter new 360° view URL:'
                  const newUrl = prompt(promptText, value)
                  if (newUrl && newUrl.trim()) {
                    onChange(newUrl.trim())
                  }
                }}
                className="text-xs"
              >
                <Link className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}

            {/* URLs Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const promptText = type === 'image' ? 'Enter image URL:' : 
                                 type === 'video' ? 'Enter video URL (YouTube or direct file):' : 
                                 'Enter 360° view URL (YouTube or 3D model):'
                const newUrl = prompt(promptText)
                if (newUrl && newUrl.trim()) {
                  onChange(newUrl.trim())
                }
              }}
              className="text-xs"
            >
              <Link className="w-3 h-3 mr-1" />
              URLs
            </Button>

            {/* Delete Button - Only show if there's a value */}
            {value && onRemove && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRemove}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            )}

            {/* View Button - Only show if there's a value */}
            {value && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(value, '_blank')}
                className="text-xs"
              >
                <Eye className="w-3 h-3 mr-1" />
                View
              </Button>
            )}
          </div>

          {/* Status Info */}
          {value && (
            <div className="text-xs text-gray-500">
              <Badge variant="secondary" className="text-xs">
                {getTypeLabel()}
              </Badge>
              <span className="ml-2">Current file loaded</span>
            </div>
          )}
        </div>
      </div>

      {/* Preview Container - Show before applying */}
      {showPreview && pendingImage && (
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="pb-3">
            <CardTitle className={cn("text-sm flex items-center gap-2", themeClasses.mainText)}>
              <Eye className="w-4 h-4" />
              Preview Image
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preview Image */}
            <div className="relative w-full max-w-md mx-auto aspect-square overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-50">
              <NextImage
                src={pendingImage}
                alt="Preview"
                fill
                className="object-contain"
                style={{ objectFit: 'contain' }}
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-center gap-3">
              <Button
                onClick={async () => {
                  if (originalFile) {
                    await uploadFile(originalFile)
                    setShowPreview(false)
                    setPendingImage(null)
                    setOriginalFile(null)
                  }
                }}
                disabled={isUploading}
                className="px-6"
              >
                {isUploading ? (
                  <>
                    <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Apply Image
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreview(false)
                  setPendingImage(null)
                  setOriginalFile(null)
                  if (pendingImage) {
                    URL.revokeObjectURL(pendingImage)
                  }
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
            
            <p className="text-xs text-center text-gray-500">
              Preview your image before applying. Original resolution will be maintained.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hidden file input for Insert button */}
      <input
        ref={fileInputRef}
        type="file"
        accept={formats.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
      />

    </div>
  )
}
