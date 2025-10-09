"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useToast } from "@/hooks/use-toast"
import { MediaUpload } from "@/components/media/media-upload"
import { 
  Upload, 
  Image as ImageIcon, 
  Video, 
  Box, 
  Trash2, 
  Eye,
  Plus,
  Search,
  Filter
} from "lucide-react"
import Image from "next/image"

interface VariantImage {
  id?: string
  productId: number
  variantId?: number
  imageUrl: string
  attributes?: Record<string, string>
  createdAt?: string
}

interface Product {
  id: number
  name: string
  image?: string
  video?: string
  view360?: string
  variants: Array<{
    id: number
    sku: string
    variantType: string
    attributes: Record<string, any>
    primaryAttribute?: string
    primaryValues?: any[]
    multiValues?: Record<string, any>
  }>
}

export default function AdminMedia() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null)
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [variantImages, setVariantImages] = useState<VariantImage[]>([])
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [newImageUrl, setNewImageUrl] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Fetch products and their variants
  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Get selected product data
  const selectedProductData = useMemo(() => {
    return products.find(p => p.id === selectedProduct)
  }, [products, selectedProduct])

  // Get selected variant data
  const selectedVariantData = useMemo(() => {
    if (!selectedProductData) return null
    return selectedProductData.variants.find(v => v.id === selectedVariant)
  }, [selectedProductData, selectedVariant])

  // Get available attributes for selected variant
  const availableAttributes = useMemo(() => {
    if (!selectedVariantData) return {}
    
    const attrs: Record<string, string[]> = {}
    
    // Add primary attribute values
    if (selectedVariantData.primaryAttribute && selectedVariantData.primaryValues) {
      attrs[selectedVariantData.primaryAttribute] = selectedVariantData.primaryValues.map((pv: any) => pv.value || pv)
    }
    
    // Add multi-value attributes
    if (selectedVariantData.multiValues) {
      Object.entries(selectedVariantData.multiValues).forEach(([key, values]) => {
        if (Array.isArray(values)) {
          attrs[key] = values
        } else if (typeof values === 'string') {
          attrs[key] = values.split(',').map(v => v.trim())
        }
      })
    }
    
    return attrs
  }, [selectedVariantData])

  // Filter variant images based on search
  const filteredVariantImages = useMemo(() => {
    if (!searchTerm) return variantImages
    
    return variantImages.filter(img => {
      const product = products.find(p => p.id === img.productId)
      return product?.name.toLowerCase().includes(searchTerm.toLowerCase())
    })
  }, [variantImages, searchTerm, products])

  const handleImageUpload = async (url: string) => {
    if (!selectedProduct || !url) return

    const newVariantImage: VariantImage = {
      productId: selectedProduct,
      variantId: selectedVariant || undefined,
      imageUrl: url,
      attributes: selectedAttributes,
      createdAt: new Date().toISOString()
    }

    // In a real app, you would save this to the database
    setVariantImages(prev => [...prev, newVariantImage])
    
    toast({
      title: "Success",
      description: "Variant image uploaded successfully"
    })

    setIsUploadDialogOpen(false)
    setNewImageUrl("")
    setSelectedAttributes({})
  }

  const handleDeleteImage = (index: number) => {
    setVariantImages(prev => prev.filter((_, i) => i !== index))
    toast({
      title: "Success",
      description: "Image deleted successfully"
    })
  }

  const resetSelections = () => {
    setSelectedProduct(null)
    setSelectedVariant(null)
    setSelectedAttributes({})
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-2xl font-bold", themeClasses.mainText)}>
            Media Management
          </h1>
          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
            Manage all product media: main images, variant images, videos, and 3D models
          </p>
        </div>
        <Button
          onClick={() => setIsUploadDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Upload Variant Image
        </Button>
      </div>

      {/* Search and Filter */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader>
          <CardTitle className={cn("text-lg", themeClasses.mainText)}>
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search by Product Name</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products..."
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Selection */}
      {(selectedProduct || selectedVariant || Object.keys(selectedAttributes).length > 0) && (
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn("text-lg", themeClasses.mainText)}>
              Current Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedProduct && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">Product</Badge>
                <span className={cn("text-sm", themeClasses.mainText)}>
                  {selectedProductData?.name}
                </span>
              </div>
            )}
            {selectedVariant && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">Variant</Badge>
                <span className={cn("text-sm", themeClasses.mainText)}>
                  {selectedVariantData?.sku}
                </span>
              </div>
            )}
            {Object.keys(selectedAttributes).length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">Attributes</Badge>
                <span className={cn("text-sm", themeClasses.mainText)}>
                  {Object.entries(selectedAttributes).map(([key, value]) => `${key}: ${value}`).join(', ')}
                </span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={resetSelections}
              className="mt-2"
            >
              Clear Selection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Media Sections */}
      <div className="space-y-6">
        {/* Main Product Images */}
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn("text-lg flex items-center gap-2", themeClasses.mainText)}>
              <ImageIcon className="w-5 h-5" />
              Main Product Images
            </CardTitle>
            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
              Primary images for each product
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className={cn("text-sm mt-2", themeClasses.textNeutralSecondary)}>
                  Loading products...
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.filter(p => p.image).map((product) => (
                  <Card key={product.id} className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                    <CardContent className="p-4">
                      <div className="relative aspect-square overflow-hidden rounded-md bg-gray-100 mb-3">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className={cn("text-sm font-medium", themeClasses.mainText)}>
                            {product.name}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            Main Image
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(product.image, '_blank')}
                            className="flex-1"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {products.filter(p => p.image).length === 0 && (
                  <div className="col-span-full text-center py-8">
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      No main product images found
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Variant Images */}
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn("text-lg flex items-center gap-2", themeClasses.mainText)}>
              <ImageIcon className="w-5 h-5" />
              Variant Images ({filteredVariantImages.length})
            </CardTitle>
            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
              Images for specific product variants and attribute combinations
            </p>
          </CardHeader>
          <CardContent>
            {filteredVariantImages.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  No variant images uploaded yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVariantImages.map((img, index) => {
                  const product = products.find(p => p.id === img.productId)
                  return (
                    <Card key={index} className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                      <CardContent className="p-4">
                        <div className="relative aspect-square overflow-hidden rounded-md bg-gray-100 mb-3">
                          <Image
                            src={img.imageUrl}
                            alt="Variant image"
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className={cn("text-sm font-medium", themeClasses.mainText)}>
                              {product?.name}
                            </p>
                            {img.variantId && (
                              <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                                Variant ID: {img.variantId}
                              </p>
                            )}
                          </div>
                          {img.attributes && Object.keys(img.attributes).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(img.attributes).map(([key, value]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {value}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(img.imageUrl, '_blank')}
                              className="flex-1"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteImage(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Videos */}
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn("text-lg flex items-center gap-2", themeClasses.mainText)}>
              <Video className="w-5 h-5" />
              Product Videos
            </CardTitle>
            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
              Video content for products
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.filter(p => p.video).map((product) => (
                <Card key={product.id} className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                  <CardContent className="p-4">
                    <div className="relative aspect-video overflow-hidden rounded-md bg-gray-100 mb-3">
                      <video
                        src={product.video}
                        controls
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className={cn("text-sm font-medium", themeClasses.mainText)}>
                          {product.name}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          Product Video
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(product.video, '_blank')}
                          className="flex-1"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {products.filter(p => p.video).length === 0 && (
                <div className="col-span-full text-center py-8">
                  <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                    No product videos found
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 360° Views / 3D Models */}
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn("text-lg flex items-center gap-2", themeClasses.mainText)}>
              <Box className="w-5 h-5" />
              360° Views & 3D Models
            </CardTitle>
            <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
              3D models and 360° interactive views
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.filter(p => p.view360).map((product) => (
                <Card key={product.id} className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                  <CardContent className="p-4">
                    <div className="relative aspect-square overflow-hidden rounded-md bg-gray-100 mb-3 flex items-center justify-center">
                      <Box className="w-12 h-12 text-gray-400" />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className={cn("text-sm font-medium", themeClasses.mainText)}>
                          {product.name}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          3D Model / 360° View
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(product.view360, '_blank')}
                          className="flex-1"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {products.filter(p => p.view360).length === 0 && (
                <div className="col-span-full text-center py-8">
                  <Box className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                    No 3D models or 360° views found
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Variant Image</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Product Selection */}
            <div className="space-y-2">
              <Label>Select Product *</Label>
              <Select
                value={selectedProduct?.toString() || ""}
                onValueChange={(value) => {
                  setSelectedProduct(Number(value))
                  setSelectedVariant(null)
                  setSelectedAttributes({})
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Variant Selection */}
            {selectedProductData && (
              <div className="space-y-2">
                <Label>Select Variant (Optional)</Label>
                <Select
                  value={selectedVariant?.toString() || "__no_variant__"}
                  onValueChange={(value) => {
                    if (value === "__no_variant__") {
                      setSelectedVariant(null)
                    } else {
                      setSelectedVariant(Number(value))
                    }
                    setSelectedAttributes({})
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a variant (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__no_variant__">No specific variant</SelectItem>
                    {selectedProductData.variants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id.toString()}>
                        {variant.sku} ({variant.variantType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Attribute Selection */}
            {selectedVariantData && Object.keys(availableAttributes).length > 0 && (
              <div className="space-y-4">
                <Label>Select Attributes (Optional)</Label>
                {Object.entries(availableAttributes).map(([attrName, values]) => (
                  <div key={attrName} className="space-y-2">
                    <Label className="text-sm capitalize">{attrName}</Label>
                    <Select
                      value={selectedAttributes[attrName] || "__any__"}
                      onValueChange={(value) => {
                        if (value === "__any__") {
                          setSelectedAttributes(prev => {
                            const newAttrs = { ...prev }
                            delete newAttrs[attrName]
                            return newAttrs
                          })
                        } else {
                          setSelectedAttributes(prev => ({
                            ...prev,
                            [attrName]: value
                          }))
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Choose ${attrName}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">Any {attrName}</SelectItem>
                        {values.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Upload Image *</Label>
              <MediaUpload
                type="image"
                value={newImageUrl}
                onChange={setNewImageUrl}
                onRemove={() => setNewImageUrl("")}
                maxSize={10}
                aspectRatio={1}
                context="variant"
                label=""
                description=""
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUploadDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleImageUpload(newImageUrl)}
              disabled={!selectedProduct || !newImageUrl}
            >
              Upload Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
