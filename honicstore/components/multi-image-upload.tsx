"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { Upload, X, Plus, Image as ImageIcon, Link as LinkIcon } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface MultiImageUploadProps {
  label: string
  currentImages: string[]
  onImagesChange: (images: string[]) => void
  serviceId: string
}

export function MultiImageUpload({ label, currentImages, onImagesChange, serviceId }: MultiImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [showUrlInput, setShowUrlInput] = useState(false)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Please upload a valid image or video file",
        variant: "destructive",
      })
      return
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 10MB",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('serviceId', serviceId)

      const response = await fetch('/api/admin/service-image-upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        const newImages = [...currentImages, result.url]
        onImagesChange(newImages)
        toast({
          title: "Success",
          description: "Image uploaded successfully",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to upload image",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while uploading",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleAddUrl = () => {
    if (!urlInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      })
      return
    }

    const newImages = [...currentImages, urlInput.trim()]
    onImagesChange(newImages)
    setUrlInput("")
    setShowUrlInput(false)
    toast({
      title: "Success",
      description: "Image URL added successfully",
    })
  }

  const handleRemoveImage = (index: number) => {
    const newImages = currentImages.filter((_, i) => i !== index)
    onImagesChange(newImages)
    toast({
      title: "Success",
      description: "Image removed",
    })
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">{label}</Label>
      
      {/* Images Grid */}
      {currentImages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {currentImages.map((image, index) => (
            <Card key={index} className="relative group overflow-hidden">
              <CardContent className="p-0">
                <div className="relative aspect-video bg-gray-100 dark:bg-gray-800">
                  {image.endsWith('.mp4') || image.endsWith('.webm') ? (
                    <video
                      src={image}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <Image
                      src={image}
                      alt={`${label} ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  )}
                  {/* Image number badge */}
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    #{index + 1}
                  </div>
                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Image Buttons */}
      <div className="flex flex-wrap gap-2">
        <div>
          <input
            type="file"
            id={`file-upload-${serviceId}`}
            accept="image/*,video/mp4,video/webm"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isUploading}
          />
          <Label
            htmlFor={`file-upload-${serviceId}`}
            className={cn(
              "cursor-pointer inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm",
              isUploading && "opacity-50 cursor-not-allowed"
            )}
          >
            <Upload className="w-4 h-4" />
            <span>{isUploading ? "Uploading..." : "Upload Image"}</span>
          </Label>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-sm"
        >
          <LinkIcon className="w-4 h-4 mr-2" />
          Add URL
        </Button>
      </div>

      {/* URL Input */}
      {showUrlInput && (
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="Enter image or video URL..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddUrl()
              }
            }}
            className="flex-1"
          />
          <Button onClick={handleAddUrl} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {currentImages.length > 0 
          ? `${currentImages.length} image(s) added. Images will rotate automatically in the service card.`
          : "No images added yet. Click 'Upload Image' or 'Add URL' to add images."}
      </p>
    </div>
  )
}






