"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

interface ImagePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  imageAlt: string
  title?: string
}

export function ImagePreviewModal({ 
  isOpen, 
  onClose, 
  imageUrl, 
  imageAlt, 
  title = "Image Preview" 
}: ImagePreviewModalProps) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5))
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const handleReset = () => {
    setScale(1)
    setRotation(0)
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `hero-background-${Date.now()}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] p-0 bg-black/95 border-gray-800">
        <DialogHeader className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white text-lg">{title}</DialogTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                className="text-white hover:bg-gray-800"
                disabled={scale <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-white text-sm min-w-[60px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                className="text-white hover:bg-gray-800"
                disabled={scale >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRotate}
                className="text-white hover:bg-gray-800"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-white hover:bg-gray-800"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-white hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden relative">
          <div className="w-full h-full flex items-center justify-center p-4">
            <div 
              className="relative transition-transform duration-200 ease-in-out"
              style={{
                transform: `scale(${scale}) rotate(${rotation}deg)`,
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            >
              <Image
                src={imageUrl}
                alt={imageAlt}
                width={1200}
                height={600}
                className="max-w-full max-h-full object-contain rounded-lg"
                priority
              />
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Use mouse wheel to zoom, drag to pan</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-gray-400 border-gray-600 hover:bg-gray-800"
            >
              Reset View
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}








