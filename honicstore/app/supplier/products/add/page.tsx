'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductForm } from '@/app/siem-dashboard/products/product-form'
import { useTheme } from '@/hooks/use-theme'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ArrowLeft, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function SupplierAddProductPage() {
  return <SupplierAddProductContent />
}

function SupplierAddProductContent() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false)
  
  // Video tutorial URL configuration
  // Set NEXT_PUBLIC_PRODUCT_TUTORIAL_VIDEO_URL in your .env.local file
  // Supports multiple formats:
  // - YouTube embed: 'https://www.youtube.com/embed/VIDEO_ID'
  // - YouTube watch: 'https://www.youtube.com/watch?v=VIDEO_ID' (auto-converted)
  // - YouTube Shorts: 'https://youtube.com/shorts/VIDEO_ID' or 'https://www.youtube.com/shorts/VIDEO_ID' (auto-converted)
  // - YouTube short: 'https://youtu.be/VIDEO_ID' (auto-converted)
  // - Vimeo: 'https://player.vimeo.com/video/VIDEO_ID'
  // - Direct MP4: 'https://example.com/video.mp4'
  const getVideoUrl = () => {
    const url = process.env.NEXT_PUBLIC_PRODUCT_TUTORIAL_VIDEO_URL || ''
    
    if (!url) return ''
    
    // Convert YouTube Shorts URL to embed URL
    if (url.includes('youtube.com/shorts/') || url.includes('youtu.be/shorts/')) {
      const videoId = url.split('shorts/')[1]?.split('?')[0]?.split('&')[0]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : ''
    }
    
    // Convert YouTube watch URL to embed URL
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : ''
    }
    
    // Convert YouTube short URL (youtu.be) to embed URL
    if (url.includes('youtu.be/') && !url.includes('shorts/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0]?.split('&')[0]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : ''
    }
    
    // If already embed URL or other format (Vimeo, direct video), use as-is
    return url
  }
  
  const tutorialVideoUrl = getVideoUrl()

  const handleSave = async (productData: any) => {
    try {
      setIsSubmitting(true)
      
      // Prepare data for supplier API
      const supplierProductData: any = {
        name: productData.name,
        description: productData.description || '',
        category: productData.category || '',
        brand: productData.brand || '',
        price: productData.price,
        originalPrice: productData.originalPrice || productData.price,
        image: productData.image || '',
        sku: productData.sku || '',
        inStock: productData.inStock !== false,
        stockQuantity: productData.stockQuantity || null,
        specifications: productData.specifications || {},
        variants: productData.variants || [],
        video: productData.video || '',
        view360: productData.view360 || '',
        importChina: productData.importChina || false
      }
      
      // Only include model if it has a value (avoid errors if column doesn't exist)
      if (productData.model && String(productData.model).trim().length > 0) {
        supplierProductData.model = String(productData.model).trim()
      }

      const response = await fetch('/api/supplier/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(supplierProductData)
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Product created successfully!',
        })
        router.push('/supplier/products')
        return result.product
      } else {
        throw new Error(result.error || 'Failed to create product')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create product'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/supplier/products')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className={cn("text-3xl font-bold mb-2", themeClasses.mainText)}>
                Add New Product
              </h1>
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                Create a new product listing for your store
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsVideoDialogOpen(true)}
              className={cn("flex items-center gap-2", themeClasses.borderNeutralSecondary)}
            >
              <Play className="w-4 h-4" />
              Watch Tutorial
            </Button>
          </div>
        </div>

        {/* Product Form */}
        <div className={cn("border-2 rounded-lg p-6", themeClasses.cardBg, themeClasses.cardBorder)}>
          <ProductForm
            onClose={() => router.push('/supplier/products')}
            onSave={handleSave}
            autoCloseOnSave={false}
            hideImportChina={true}
            restrictVariantType={true}
            hideAttributesAndVariants={true}
          />
        </div>

        {/* Video Tutorial Dialog */}
        <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
          <DialogContent className={cn("max-w-4xl max-h-[90vh]", themeClasses.cardBg)}>
            <DialogHeader>
              <DialogTitle className={cn(themeClasses.mainText)}>
                How to Add a Product - Video Tutorial
              </DialogTitle>
            </DialogHeader>
            {tutorialVideoUrl ? (
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={tutorialVideoUrl}
                  title="How to Add Product Tutorial"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                  style={{ border: 'none' }}
                />
              </div>
            ) : (
              <div className={cn("p-8 text-center", themeClasses.textNeutralSecondary)}>
                <p>No video yet</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
    </>
  )
}

