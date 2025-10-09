"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useToast } from "@/hooks/use-toast"
import { useCategories } from "@/hooks/use-categories"
import { useBrands } from "@/hooks/use-brands"
import { SelectWithAddOption } from "@/components/select-with-add-option"
import { X, Plus, Upload, Image as ImageIcon, Eye, Trash2, Link } from "lucide-react"
import { MediaUpload } from "@/components/media/media-upload"
import { logger } from '@/lib/logger'

interface ProductFormProps {
  product?: any
  onClose: () => void
  onSave?: (productData: any) => void
  autoCloseOnSave?: boolean
}

export function ProductForm({ product, onClose, onSave, autoCloseOnSave = true }: ProductFormProps) {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const { categories: rawCategories, isLoading: categoriesLoading, error: categoriesError } = useCategories()
  const { brands: rawBrands, isLoading: brandsLoading, error: brandsError } = useBrands()
  
  // Ensure product's category/brand are in the options list when editing
  const categories = useMemo(() => {
    if (!product) return rawCategories
    const cat = product.category
    if (cat && !rawCategories.includes(cat)) {
      return [...rawCategories, cat]
    }
    return rawCategories
  }, [rawCategories, product])
  
  const brands = useMemo(() => {
    if (!product) return rawBrands
    const br = product.brand
    if (br && !rawBrands.includes(br)) {
      return [...rawBrands, br]
    }
    return rawBrands
  }, [rawBrands, product])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [showVariantImageDialog, setShowVariantImageDialog] = useState(false)
  const [selectedVariantForImage, setSelectedVariantForImage] = useState<number | null>(null)
  const [selectedAttributesForImage, setSelectedAttributesForImage] = useState<Array<{name: string, value: string}>>([])
  const [newVariantImageUrl, setNewVariantImageUrl] = useState("")

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    brand: "",
    price: "",
    originalPrice: "",
    rating: "",
    reviews: "",
    sku: "",
    model: "",
    image: "",
    specifications: {} as Record<string, string>,
    variants: [] as any[],
    video: "",
    view360: "",
    variantImages: [] as Array<{
      variantId?: number
      imageUrl: string
      attribute?: {name: string, value: string}
      attributes?: Array<{name: string, value: string}>
    }>,
    // Stock and delivery settings
    inStock: true,
    stockQuantity: "",
    freeDelivery: false,
    sameDayDelivery: false,
    variantConfig: {
      type: 'simple' as 'simple' | 'primary-dependent' | 'multi-dependent',
      primaryAttribute: '',
      primaryAttributes: [] as string[],
      attributeOrder: [] as string[],
      dependencies: {} as Record<string, string[]>
    }
  })

  // Predefined worldwide common attributes
  const commonAttributes = [
    "color",
    "size", 
    "weight",
    "storage",
    "material",
    "brand",
    "model",
    "capacity",
    "dimensions",
    "power",
    "voltage",
    "frequency",
    "connectivity",
    "compatibility",
    "warranty"
  ]

  // Attribute management state
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([])
  const [newAttribute, setNewAttribute] = useState("")

  // Dialog states for replacing prompts
  
  // Specification fields state
  const [specificationFields, setSpecificationFields] = useState<Array<{id: string, key: string, value: string}>>([])

  // Initialize form with product data if editing
  useEffect(() => {
    if (product && !categoriesLoading && !brandsLoading) {
      setFormData({
        name: product.name ?? "",
        description: product.description ?? "",
        category: product.category ?? "",
        brand: product.brand ?? "",
        price: product.price?.toString() ?? "",
        originalPrice: product.originalPrice?.toString() ?? "",
        rating: product.rating?.toString() ?? "",
        reviews: product.reviews?.toString() ?? "",
        sku: product.sku ?? "",
        model: product.model ?? "",
        image: product.image ?? "",
        specifications: product.specifications || {},
        variants: product.variants || [],
        video: product.video ?? "",
        view360: product.view360 ?? "",
        variantImages: product.variantImages || [],
        // Stock and delivery settings
        inStock: product.inStock !== undefined ? product.inStock : true,
        stockQuantity: product.stockQuantity?.toString() ?? "",
        freeDelivery: product.freeDelivery || false,
        sameDayDelivery: product.sameDayDelivery || false,
        variantConfig: product.variantConfig || {
          type: 'simple',
          primaryAttribute: '',
          primaryAttributes: [],
          attributeOrder: [],
          dependencies: {}
        }
      })

      // Initialize specification fields
      if (product.specifications) {
        const specFields = Object.entries(product.specifications).map(([key, value], index) => ({
          id: `spec-${index}`,
          key: key,
          value: value as string
        }))
        setSpecificationFields(specFields)
      }

      // Initialize selected attributes from variant config AND existing variants
      // This ensures all attributes used in variants are shown
      const allAttributes = new Set<string>()
      
      // Add attributes from variant config
      if (product.variantConfig) {
        if (product.variantConfig.primaryAttribute) {
          allAttributes.add(product.variantConfig.primaryAttribute)
        }
        if (product.variantConfig.primaryAttributes) {
          product.variantConfig.primaryAttributes.forEach((attr: string) => allAttributes.add(attr))
        }
        if (product.variantConfig.attributeOrder) {
          product.variantConfig.attributeOrder.forEach((attr: string) => allAttributes.add(attr))
        }
      }
      
      // Add attributes from existing variants
      if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
        
        product.variants.forEach((variant: any) => {
          // Add attributes from variant.attributes
          if (variant.attributes) {
            Object.keys(variant.attributes).forEach(attr => allAttributes.add(attr))
          }
          
          // Add attributes from primary_values
          if (variant.primaryValues) {
            variant.primaryValues.forEach((pv: any) => {
              if (pv.attribute) allAttributes.add(pv.attribute)
            })
          }
          
          // Add attributes from multi_values
          if (variant.multiValues) {
            Object.keys(variant.multiValues).forEach(attr => allAttributes.add(attr))
          }
        })
      }

      const attributesArray = Array.from(allAttributes)
      setSelectedAttributes(attributesArray)
    }
  }, [product, categoriesLoading, brandsLoading])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSpecificationChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      specifications: {
        ...prev.specifications,
        [key]: value
      }
    }))
  }

  const addSpecification = () => {
    const newField = {
      id: `spec-${Date.now()}`,
      key: "",
      value: ""
    }
    setSpecificationFields(prev => [...prev, newField])
  }

  const updateSpecificationField = (id: string, field: 'key' | 'value', value: string) => {
    setSpecificationFields(prev => {
      const updatedFields = prev.map(f => 
        f.id === id ? { ...f, [field]: value } : f
      )
      
      // Update formData specifications with the updated fields
      const newSpecs: Record<string, string> = {}
      updatedFields.forEach(f => {
        if (f.key.trim() && f.value.trim()) {
          newSpecs[f.key.trim()] = f.value.trim()
        }
      })
      
      setFormData(prevFormData => ({
        ...prevFormData,
        specifications: newSpecs
      }))
      
      return updatedFields
    })
  }

  const removeSpecificationField = (id: string) => {
    setSpecificationFields(prev => {
      const updatedFields = prev.filter(field => field.id !== id)
      
      // Update formData specifications with the updated fields
      const newSpecs: Record<string, string> = {}
      updatedFields.forEach(f => {
        if (f.key.trim() && f.value.trim()) {
          newSpecs[f.key.trim()] = f.value.trim()
        }
      })
      
      setFormData(prevFormData => ({
        ...prevFormData,
        specifications: newSpecs
      }))
      
      return updatedFields
    })
  }

  const removeSpecification = (key: string) => {
    setFormData(prev => {
      const newSpecs = { ...prev.specifications }
      delete newSpecs[key]
      return { ...prev, specifications: newSpecs }
    })
  }

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          id: prev.variants.length + 1, // Use simple sequential ID
          price: prev.price || 0, // Set default price to product price
          image: "",
          sku: "",
          attributes: {},
          primaryValues: [],
          multiValues: {}
        }
      ]
    }))
  }

  const updateVariant = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) => 
        i === index ? { ...variant, [field]: value } : variant
      )
    }))
  }

  const removeVariant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }))
  }


  // Variant image functions
  const handleAddVariantImage = () => {
    if (newVariantImageUrl.trim()) {
      setFormData(prev => ({
        ...prev,
        variantImages: [...prev.variantImages, {
          variantId: selectedVariantForImage || undefined,
          imageUrl: newVariantImageUrl.trim(),
          attributes: selectedAttributesForImage.length > 0 ? selectedAttributesForImage : undefined
        }]
      }))
      setNewVariantImageUrl("")
      setSelectedVariantForImage(null)
      setSelectedAttributesForImage([])
      setShowVariantImageDialog(false)
    }
  }

  // Automatic variant image addition when image is uploaded
  const handleVariantImageUpload = (imageUrl: string) => {
    if (imageUrl.trim()) {
      setFormData(prev => ({
        ...prev,
        variantImages: [...prev.variantImages, {
          variantId: selectedVariantForImage || undefined,
          imageUrl: imageUrl.trim(),
          attributes: selectedAttributesForImage.length > 0 ? selectedAttributesForImage : undefined
        }]
      }))
      
      // Clear the form
      setNewVariantImageUrl("")
      setSelectedVariantForImage(null)
      setSelectedAttributesForImage([])
      
      // Show success message
      toast({
        title: "✅ Variant Image Added!",
        description: "The variant image has been automatically added to your product.",
        duration: 3000,
      })
      
      // Close dialog after a short delay to let user see the success message
      setTimeout(() => {
        setShowVariantImageDialog(false)
      }, 1500)
    }
  }

  const removeVariantImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variantImages: prev.variantImages.filter((_, i) => i !== index)
    }))
  }

  // Delete variant image from both storage and database
  const deleteVariantImage = async (index: number) => {
    const variantImage = formData.variantImages[index]
    if (!variantImage || !product?.id) return

    // Show confirmation dialog
    const confirmed = window.confirm(
      'Are you sure you want to delete this variant image? This action cannot be undone and will remove the image from both storage and the database.'
    )

    if (!confirmed) return

    try {
      const response = await fetch('/api/variant-images/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          imageUrl: variantImage.imageUrl
        })
      })

      if (!response.ok) {
        throw new Error('Failed to delete variant image')
      }

      const result = await response.json()
      
      // Remove from form data
      setFormData(prev => ({
        ...prev,
        variantImages: prev.variantImages.filter((_, i) => i !== index)
      }))

      toast({
        title: "✅ Variant Image Deleted!",
        description: `Variant image deleted successfully. ${result.remainingImages} images remaining.`,
        duration: 3000,
      })

    } catch (error) {
      toast({
        title: "❌ Delete Failed",
        description: "Failed to delete variant image. Please try again.",
        variant: "destructive",
        duration: 3000,
      })
    }
  }

  // Attribute management functions
  const toggleAttribute = (attribute: string) => {
    setSelectedAttributes(prev => {
      if (prev.includes(attribute)) {
        // Remove attribute from all variants
        setFormData(prevForm => ({
          ...prevForm,
          variants: prevForm.variants.map(variant => {
            const newAttributes = { ...variant.attributes }
            delete newAttributes[attribute]
            return { ...variant, attributes: newAttributes }
          })
        }))
        return prev.filter(attr => attr !== attribute)
      } else {
        return [...prev, attribute]
      }
    })
  }

  const addCustomAttribute = () => {
    if (newAttribute.trim() && !selectedAttributes.includes(newAttribute.trim()) && !commonAttributes.includes(newAttribute.trim())) {
      setSelectedAttributes(prev => [...prev, newAttribute.trim()])
      setNewAttribute("")
    }
  }

  const removeAttribute = (attribute: string) => {
    setSelectedAttributes(prev => prev.filter(attr => attr !== attribute))
    // Also remove this attribute from all variants
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(variant => {
        const newAttributes = { ...variant.attributes }
        delete newAttributes[attribute]
        return { ...variant, attributes: newAttributes }
      })
    }))
  }

  const updateVariantAttribute = (variantIndex: number, attribute: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) => 
        index === variantIndex 
          ? { 
              ...variant, 
              attributes: { 
                ...variant.attributes, 
                [attribute]: value 
              } 
            }
          : variant
      )
    }))
  }

  // Helper functions for managing primary attribute values
  const addPrimaryValue = (variantIndex: number, attribute?: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) => 
        index === variantIndex 
          ? { 
              ...variant, 
              primaryValues: [...(variant.primaryValues || []), { 
                value: "", 
                price: "", 
                attribute: attribute || "" 
              }]
            }
          : variant
      )
    }))
  }

  const updatePrimaryValue = (variantIndex: number, valueIndex: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) => 
        index === variantIndex 
          ? { 
              ...variant, 
              primaryValues: variant.primaryValues?.map((primaryValue: any, vIndex: number) => 
                vIndex === valueIndex 
                  ? { ...primaryValue, [field]: value }
                  : primaryValue
              ) || []
            }
          : variant
      )
    }))
  }

  const removePrimaryValue = (variantIndex: number, valueIndex: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              primaryValues: variant.primaryValues?.filter((_: any, vIndex: number) => vIndex !== valueIndex) || []
            }
          : variant
      )
    }))
  }



  const addMultiValue = (variantIndex: number, attribute: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              multiValues: {
                ...variant.multiValues,
                [attribute]: [...(variant.multiValues?.[attribute] || []), ""]
              }
            }
          : variant
      )
    }))
  }

  const updateMultiValue = (variantIndex: number, attribute: string, valueIndex: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              multiValues: {
                ...variant.multiValues,
                [attribute]: variant.multiValues?.[attribute]?.map((val: string, vIndex: number) =>
                  vIndex === valueIndex ? value : val
                ) || []
              }
            }
          : variant
      )
    }))
  }

  const removeMultiValue = (variantIndex: number, attribute: string, valueIndex: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              multiValues: {
                ...variant.multiValues,
                [attribute]: variant.multiValues?.[attribute]?.filter((_: any, vIndex: number) => vIndex !== valueIndex) || []
              }
            }
          : variant
      )
    }))
  }

  const toggleMultiValueForVariant = (variantIndex: number, attribute: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              multiValues: variant.multiValues?.[attribute] !== undefined
                ? {
                    ...variant.multiValues,
                    [attribute]: undefined,
                    [`${attribute}_raw`]: undefined
                  }
                : {
                    ...variant.multiValues,
                    [attribute]: [],
                    [`${attribute}_raw`]: ""
                  }
            }
          : variant
      )
    }))
  }

  const updateMultiValueCommaSeparated = (variantIndex: number, attribute: string, value: string) => {
    // Store the raw input value for display
    const rawValue = value
    
    // Process the values for storage (only non-empty values)
    const values = value.split(',').map(v => v.trim()).filter(v => v.length > 0)
    
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              multiValues: {
                ...variant.multiValues,
                [attribute]: Array.isArray(values) ? values : [],
                [`${attribute}_raw`]: rawValue // Store raw value for display
              }
            }
          : variant
      )
    }))
  }



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validate required fields with stricter checks
      const nameTrimmed = (formData.name || '').trim()
      const priceNumber = parseFloat(formData.price as unknown as string)
      const invalidSentinelValues = new Set(["__loading__", "__error__", "__empty__", "__add_new__"])
      const isCategoryInvalid = !formData.category || invalidSentinelValues.has(formData.category)
      const isBrandInvalid = !formData.brand || invalidSentinelValues.has(formData.brand)

      if (!nameTrimmed) {
        toast({ title: "Validation Error", description: "Product name is required.", variant: "destructive" })
        return
      }

      if (Number.isNaN(priceNumber) || priceNumber <= 0) {
        toast({ title: "Validation Error", description: "Enter a valid price greater than 0.", variant: "destructive" })
        return
      }

      if (isCategoryInvalid) {
        toast({ title: "Validation Error", description: "Please select a category.", variant: "destructive" })
        return
      }

      if (isBrandInvalid) {
        toast({ title: "Validation Error", description: "Please select a brand.", variant: "destructive" })
        return
      }

      // Prepare product data
      const calculatedStock = (() => {
        // If product has no variants, use the manual stock field
        if (formData.variants.length === 0) {
          return parseInt(formData.stockQuantity as string) || 0
        }
        
        // Otherwise, auto-calculate from attribute quantities
        let total = 0
        formData.variants.forEach(variant => {
          if (Array.isArray(variant.primaryValues)) {
            variant.primaryValues.forEach((pv: any) => {
              const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
              total += qty
            })
          }
        })
        return total
      })()

      logger.log('🚀 Form Submit - Stock Data:', {
        hasVariants: formData.variants.length > 0,
        rawStockQuantity: formData.stockQuantity,
        calculatedStock,
        inStock: formData.inStock
      })

      // Normalize variant configuration so non-primary attributes are preserved
      const usedAttributesSet = new Set<string>()
      formData.variants.forEach((variant: any) => {
        if (variant?.attributes && typeof variant.attributes === 'object') {
          Object.keys(variant.attributes).forEach(a => a && usedAttributesSet.add(a))
        }
        if (Array.isArray(variant?.primaryValues)) {
          variant.primaryValues.forEach((pv: any) => {
            if (pv?.attribute) usedAttributesSet.add(pv.attribute)
          })
        }
        if (variant?.multiValues && typeof variant.multiValues === 'object') {
          Object.keys(variant.multiValues).forEach(a => {
            if (!a.endsWith('_raw')) usedAttributesSet.add(a)
          })
        }
      })

      const usedAttributes = Array.from(usedAttributesSet)
      const normalizedVariantConfig = (() => {
        const vc = { ...(formData.variantConfig || {}) }
        // Ensure a sensible type if attributes exist
        if (usedAttributes.length > 0 && (!vc.type || vc.type === 'simple')) {
          vc.type = 'multi-dependent'
        }
        // Primary-dependent: ensure primaryAttribute
        if (vc.type === 'primary-dependent' && !vc.primaryAttribute && usedAttributes.length > 0) {
          vc.primaryAttribute = usedAttributes[0]
        }
        // Multi-dependent: ensure primaryAttributes/attributeOrder include used attributes
        if (vc.type === 'multi-dependent') {
          vc.primaryAttributes = Array.isArray(vc.primaryAttributes) && vc.primaryAttributes.length > 0
            ? Array.from(new Set([...vc.primaryAttributes, ...usedAttributes]))
            : usedAttributes
        }
        vc.attributeOrder = Array.isArray(vc.attributeOrder) && vc.attributeOrder.length > 0
          ? Array.from(new Set([...vc.attributeOrder, ...usedAttributes]))
          : usedAttributes
        return vc
      })()

      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        originalPrice: parseFloat(formData.originalPrice) || parseFloat(formData.price),
        rating: parseFloat(formData.rating) || 0,
        reviews: parseInt(formData.reviews) || 0,
        views: product?.views || 0,
        video: formData.video || undefined,
        view360: formData.view360 || undefined,
        // Stock and delivery data
        stockQuantity: calculatedStock,
        inStock: (() => {
          // If product has no variants, use the manual in-stock toggle
          if (formData.variants.length === 0) {
            return formData.inStock
          }
          
          // Otherwise, auto-calculate from attribute quantities
          let total = 0
          formData.variants.forEach(variant => {
            if (Array.isArray(variant.primaryValues)) {
              variant.primaryValues.forEach((pv: any) => {
                const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                total += qty
              })
            }
          })
          return total > 0
        })(),
        freeDelivery: formData.freeDelivery,
        sameDayDelivery: formData.sameDayDelivery,
        variantConfig: normalizedVariantConfig,
        // Include variant images data
        variantImages: formData.variantImages,
        // Include variants data with proper price handling
        variants: formData.variants.map(variant => ({
          ...variant,
          price: parseFloat(variant.price) || parseFloat(formData.price) || 0
        }))
      }

      // Call onSave if provided
      if (onSave) {
        const updatedProduct: any = await onSave(productData)
        
        // If we got updated product data back, refresh the form data
        if (updatedProduct && typeof updatedProduct === 'object') {
          
          // Clear any pending variant image selections
          setSelectedVariantForImage(null)
          setSelectedAttributesForImage([])
          setNewVariantImageUrl("")
          
          setFormData(prev => ({
            ...prev,
            name: updatedProduct.name ?? prev.name,
            description: updatedProduct.description ?? prev.description,
            category: updatedProduct.category ?? prev.category,
            brand: updatedProduct.brand ?? prev.brand,
            price: updatedProduct.price?.toString() ?? prev.price,
            originalPrice: updatedProduct.originalPrice?.toString() ?? prev.originalPrice,
            rating: updatedProduct.rating?.toString() ?? prev.rating,
            reviews: updatedProduct.reviews?.toString() ?? prev.reviews,
            sku: updatedProduct.sku ?? prev.sku,
            model: updatedProduct.model ?? prev.model,
            image: updatedProduct.image ?? prev.image,
            specifications: updatedProduct.specifications || prev.specifications,
            variants: updatedProduct.variants || prev.variants,
            video: updatedProduct.video ?? prev.video,
            view360: updatedProduct.view360 ?? prev.view360,
            variantImages: updatedProduct.variantImages || prev.variantImages,
            // Stock and delivery settings
            inStock: updatedProduct.inStock ?? prev.inStock,
            stockQuantity: updatedProduct.stockQuantity?.toString() ?? prev.stockQuantity,
            freeDelivery: updatedProduct.freeDelivery ?? prev.freeDelivery,
            sameDayDelivery: updatedProduct.sameDayDelivery ?? prev.sameDayDelivery,
            // Variant configuration
            variantConfig: updatedProduct.variantConfig || prev.variantConfig
          }))
        }
      }

      // Show success message
      toast({
        title: "✅ Success!",
        description: product ? "Product updated successfully! Media section refreshed with latest data." : "Product created successfully!",
        duration: 4000, // Show for 4 seconds
      })

      // Set success state for visual feedback
      setIsSuccess(true)
      setTimeout(() => setIsSuccess(false), 2000) // Reset after 2 seconds

      // Only close if autoCloseOnSave is true
      if (autoCloseOnSave) {
        onClose()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save product. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6" suppressHydrationWarning>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter product name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <SelectWithAddOption
                value={formData.category}
                onValueChange={(value) => {
                  if (value !== "__add_new__" && 
                      value !== "__loading__" && 
                      value !== "__error__" && 
                      value !== "__empty__") {
                    handleInputChange("category", value)
                  }
                }}
                placeholder="Select a category"
                options={categories}
                isLoading={categoriesLoading}
                error={categoriesError}
                emptyMessage="No categories found"
                onAddNew={(newCategory) => {
                  handleInputChange("category", newCategory)
                  toast({
                    title: "New Category Added",
                    description: `"${newCategory}" has been added to the form.`,
                    duration: 2000,
                  })
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              <SelectWithAddOption
                value={formData.brand}
                onValueChange={(value) => {
                  if (value !== "__add_new__" && 
                      value !== "__loading__" && 
                      value !== "__error__" && 
                      value !== "__empty__") {
                    handleInputChange("brand", value)
                  }
                }}
                placeholder="Select a brand"
                options={brands}
                isLoading={brandsLoading}
                error={brandsError}
                emptyMessage="No brands found"
                onAddNew={(newBrand) => {
                  handleInputChange("brand", newBrand)
                  toast({
                    title: "New Brand Added",
                    description: `"${newBrand}" has been added to the form.`,
                    duration: 2000,
                  })
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => handleInputChange("sku", e.target.value)}
                placeholder="Stock Keeping Unit"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => handleInputChange("model", e.target.value)}
                placeholder="Product model"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rating">Rating</Label>
              <Input
                id="rating"
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={formData.rating}
                onChange={(e) => handleInputChange("rating", e.target.value)}
                placeholder="4.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter product description..."
              rows={4}
            />
          </div>

          {/* Stock and Delivery Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Stock & Delivery Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  {formData.variants.length > 0 ? (
                    <>
                      <Label>Stock Quantity (Auto-Calculated)</Label>
                      <div className="text-3xl font-bold text-green-600">
                        {(() => {
                          let total = 0
                          formData.variants.forEach(variant => {
                            if (Array.isArray(variant.primaryValues)) {
                              variant.primaryValues.forEach((pv: any) => {
                                const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                                total += qty
                              })
                            }
                          })
                          return total
                        })()} units
                      </div>
                      <p className="text-xs text-gray-600">
                        Calculated by summing all attribute quantities from variants.
                      </p>
                    </>
                  ) : (
                    <>
                      <Label htmlFor="stockQuantity">Stock Quantity *</Label>
                      <Input
                        id="stockQuantity"
                        type="number"
                        min="0"
                        value={formData.stockQuantity}
                        onChange={(e) => handleInputChange("stockQuantity", e.target.value)}
                        placeholder="Enter stock quantity"
                      />
                      <p className="text-xs text-gray-600">
                        Set stock for this product (no variants defined).
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>In Stock</Label>
                    <p className="text-sm text-muted-foreground">
                      {(() => {
                        if (formData.variants.length === 0) {
                          const qty = parseInt(formData.stockQuantity as string) || 0
                          return qty > 0 ? `${qty} units available` : 'Out of stock (toggle to override)'
                        }
                        
                        let total = 0
                        formData.variants.forEach(variant => {
                          if (Array.isArray(variant.primaryValues)) {
                            variant.primaryValues.forEach((pv: any) => {
                              const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                              total += qty
                            })
                          }
                        })
                        return total > 0 ? `Auto-calculated: ${total} units available` : 'Auto-calculated: Out of stock (override if needed)'
                      })()}
                    </p>
                  </div>
                  <Switch
                    checked={formData.inStock}
                    onCheckedChange={(checked) => handleInputChange("inStock", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Free Delivery</Label>
                    <p className="text-sm text-muted-foreground">Offer free shipping on this product</p>
                  </div>
                  <Switch
                    checked={formData.freeDelivery}
                    onCheckedChange={(checked) => handleInputChange("freeDelivery", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Same Day Delivery</Label>
                    <p className="text-sm text-muted-foreground">Available for same day delivery</p>
                  </div>
                  <Switch
                    checked={formData.sameDayDelivery}
                    onCheckedChange={(checked) => handleInputChange("sameDayDelivery", checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Price * (in TZS)</Label>
              <div className="relative">
                <Input
                  id="price"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleInputChange("price", e.target.value)}
                  placeholder="500"
                  required
                  className="pr-12"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                  TZS
                </div>
              </div>
              <p className="text-xs text-gray-500">Enter price in Tanzanian Shillings (minimum 500 TZS)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="originalPrice">Original Price (in TZS)</Label>
              <div className="relative">
                <Input
                  id="originalPrice"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.originalPrice}
                  onChange={(e) => handleInputChange("originalPrice", e.target.value)}
                  placeholder="1000"
                  className="pr-12"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                  TZS
                </div>
              </div>
              <p className="text-xs text-gray-500">Original price before discount (optional)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reviews">Number of Reviews</Label>
              <Input
                id="reviews"
                type="number"
                min="0"
                value={formData.reviews}
                onChange={(e) => handleInputChange("reviews", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

                     {/* Attribute Management */}
           <Card>
             <CardHeader>
               <div className="flex items-center justify-between">
                 <CardTitle>Product Attributes</CardTitle>
                 <div className="flex items-center gap-2">
                   <Input
                     placeholder="Add custom attribute"
                     value={newAttribute}
                     onChange={(e) => setNewAttribute(e.target.value)}
                     onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAttribute())}
                     className="w-48"
                   />
                   <Button type="button" onClick={addCustomAttribute} size="sm">
                     <Plus className="h-4 w-4 mr-2" />
                     Add Custom
                   </Button>
                 </div>
               </div>
             </CardHeader>
             <CardContent>
               <div className="space-y-4">
                 {/* Common Attributes */}
                 <div>
                   <Label className="text-sm font-medium mb-2 block">Common Attributes (Click to select)</Label>
                   <div className="flex flex-wrap gap-2">
                     {commonAttributes.map(attribute => (
                       <Button
                         key={attribute}
                         type="button"
                         variant={selectedAttributes.includes(attribute) ? "default" : "outline"}
                         size="sm"
                         onClick={() => toggleAttribute(attribute)}
                         className="capitalize"
                       >
                         {attribute}
                       </Button>
                     ))}
                   </div>
                 </div>

                 {/* Selected Attributes */}
                 {selectedAttributes.length > 0 && (
                   <div>
                     <Label className="text-sm font-medium mb-2 block">Selected Attributes</Label>
                     <div className="flex flex-wrap gap-2">
                       {selectedAttributes.filter(attribute => !/^\d+$/.test(attribute) && !attribute.endsWith('_raw')).map(attribute => (
                         <Badge key={attribute} variant="secondary" className="flex items-center gap-1 capitalize">
                           {attribute}
                           <Button
                             type="button"
                             variant="ghost"
                             size="sm"
                             onClick={() => removeAttribute(attribute)}
                             className="h-4 w-4 p-0 hover:bg-red-100"
                           >
                             <X className="h-3 w-3" />
                           </Button>
                         </Badge>
                       ))}
                     </div>
                   </div>
                 )}

                 {selectedAttributes.length === 0 && (
                   <p className="text-sm text-muted-foreground">No attributes selected. Select attributes to create variants.</p>
                 )}


               </div>
             </CardContent>
           </Card>

          {/* Variant Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Variant Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Variant Logic Type</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={formData.variantConfig.type === 'simple' ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleInputChange("variantConfig", { ...formData.variantConfig, type: 'simple' })}
                    >
                      Simple (No Price Impact)
                    </Button>
                    <Button
                      type="button"
                      variant={formData.variantConfig.type === 'primary-dependent' ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleInputChange("variantConfig", { ...formData.variantConfig, type: 'primary-dependent' })}
                    >
                      Primary-Dependent (One Attribute Affects Price)
                    </Button>
                    <Button
                      type="button"
                      variant={formData.variantConfig.type === 'multi-dependent' ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleInputChange("variantConfig", { ...formData.variantConfig, type: 'multi-dependent' })}
                    >
                      Multi-Dependent (Step-by-Step Selection)
                    </Button>
                  </div>
                </div>

                {/* Primary Attribute Selection for Primary-Dependent Logic */}
                {formData.variantConfig.type === 'primary-dependent' && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Primary Attribute (Affects Price)</Label>
                    <select
                      value={formData.variantConfig.primaryAttribute}
                      onChange={(e) => handleInputChange("variantConfig", { 
                        ...formData.variantConfig, 
                        primaryAttribute: e.target.value 
                      })}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="">Select Primary Attribute</option>
                      {selectedAttributes.filter(attribute => !/^\d+$/.test(attribute) && !attribute.endsWith('_raw')).map(attribute => (
                        <option key={attribute} value={attribute}>
                          {attribute.charAt(0).toUpperCase() + attribute.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Primary Attribute Selection for Multi-Dependent Logic */}
                {formData.variantConfig.type === 'multi-dependent' && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Primary Attributes (Affect Price)</Label>
                    <div className="space-y-2">
                      {selectedAttributes.filter(attribute => !/^\d+$/.test(attribute) && !attribute.endsWith('_raw')).map((attribute) => (
                        <div key={attribute} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`primary-${attribute}`}
                            checked={formData.variantConfig.primaryAttributes?.includes(attribute) || false}
                            onChange={(e) => {
                              const currentPrimaryAttributes = formData.variantConfig.primaryAttributes || []
                              const newPrimaryAttributes = e.target.checked
                                ? [...currentPrimaryAttributes, attribute]
                                : currentPrimaryAttributes.filter(attr => attr !== attribute)
                              handleInputChange("variantConfig", { 
                                ...formData.variantConfig, 
                                primaryAttributes: newPrimaryAttributes 
                              })
                            }}
                            className="rounded"
                          />
                          <label htmlFor={`primary-${attribute}`} className="flex-1 capitalize text-sm">
                            {attribute}
                          </label>
                        </div>
                      ))}
                    </div>
                    {formData.variantConfig.primaryAttributes?.length > 0 && (
                      <div className="mt-2 p-2 bg-orange-50 rounded-md">
                        <span className="text-sm font-medium text-orange-700">Primary Attributes: </span>
                        <span className="text-sm text-orange-600">
                          {formData.variantConfig.primaryAttributes.map((attr, index) => (
                            <span key={attr}>
                              {index > 0 ? ", " : ""}{attr.charAt(0).toUpperCase() + attr.slice(1)}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Attribute Order for Multi-Dependent Logic */}
                {formData.variantConfig.type === 'multi-dependent' && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Attribute Selection Order</Label>
                    <div className="space-y-2">
                      {selectedAttributes.filter(attribute => !/^\d+$/.test(attribute) && !attribute.endsWith('_raw')).map((attribute, index) => (
                        <div key={attribute} className="flex items-center gap-2">
                          <span className="text-sm font-medium w-8">{index + 1}.</span>
                          <span className="flex-1 capitalize">{attribute}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newOrder = [...formData.variantConfig.attributeOrder]
                              const currentIndex = newOrder.indexOf(attribute)
                              if (currentIndex === -1) {
                                newOrder.push(attribute)
                              } else {
                                newOrder.splice(currentIndex, 1)
                              }
                              handleInputChange("variantConfig", { 
                                ...formData.variantConfig, 
                                attributeOrder: newOrder 
                              })
                            }}
                          >
                            {formData.variantConfig.attributeOrder.includes(attribute) ? "Remove" : "Add"}
                          </Button>
                        </div>
                      ))}
                    </div>
                    {formData.variantConfig.attributeOrder.length > 0 && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-md">
                        <span className="text-sm font-medium">Current Order: </span>
                        <span className="text-sm">
                          {formData.variantConfig.attributeOrder.map((attr, index) => (
                            <span key={attr}>
                              {index > 0 ? " → " : ""}{attr.charAt(0).toUpperCase() + attr.slice(1)}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Configuration Summary */}
                <div className={cn("p-3 rounded-md", themeClasses.cardBg, themeClasses.cardBorder)}>
                  <h4 className={cn("font-medium mb-2", themeClasses.mainText)}>Configuration Summary</h4>
                  <div className={cn("text-sm space-y-1", themeClasses.textNeutralSecondary)}>
                    <div><strong>Logic Type:</strong> {formData.variantConfig.type}</div>
                    {formData.variantConfig.type === 'primary-dependent' && formData.variantConfig.primaryAttribute && (
                      <div><strong>Primary Attribute:</strong> {formData.variantConfig.primaryAttribute}</div>
                    )}
                    {formData.variantConfig.type === 'multi-dependent' && formData.variantConfig.primaryAttributes?.length > 0 && (
                      <div><strong>Primary Attributes:</strong> {formData.variantConfig.primaryAttributes.join(", ")}</div>
                    )}
                    {formData.variantConfig.type === 'multi-dependent' && formData.variantConfig.attributeOrder.length > 0 && (
                      <div><strong>Selection Order:</strong> {formData.variantConfig.attributeOrder.join(" → ")}</div>
                    )}
                    <div><strong>Selected Attributes:</strong> {selectedAttributes.filter(attribute => !/^\d+$/.test(attribute) && !attribute.endsWith('_raw')).length}</div>
                    <div><strong>Variants Created:</strong> {formData.variants.length}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                <CardTitle>Product Variants</CardTitle>
                  {formData.variants.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Total Stock: <span className="font-bold text-green-600">
                        {(() => {
                          let total = 0
                          formData.variants.forEach(variant => {
                            if (Array.isArray(variant.primaryValues)) {
                              variant.primaryValues.forEach((pv: any) => {
                                const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                                total += qty
                              })
                            }
                          })
                          return total
                        })()}
                      </span> units (auto-calculated from all attribute quantities)
                    </p>
                  )}
                </div>
                <Button type="button" onClick={addVariant} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variant
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.variants.map((variant, index) => (
                <div key={variant.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">
                      {variant.sku ? `Variant: ${variant.sku}` : `Variant ${index + 1}`}
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariant(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>SKU</Label>
                      <Input
                        value={variant.sku ?? ""}
                        onChange={(e) => updateVariant(index, "sku", e.target.value)}
                        placeholder="Variant SKU"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Price (TZS)</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={variant.price ?? ""}
                          onChange={(e) => updateVariant(index, "price", parseFloat(e.target.value) || 0)}
                          placeholder="500"
                          className="pr-12"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                          TZS
                        </div>
                      </div>
                    </div>
                  </div>


                                     {/* Dynamic Attributes */}
                   {(selectedAttributes.length > 0 || variant.attributes || variant.primaryValues || variant.multiValues) && (
                     <div className="space-y-3">
                       <Label className="text-sm font-medium">Attributes</Label>
                       <div className="grid gap-3 md:grid-cols-2">
                         {(selectedAttributes.length > 0 ? selectedAttributes : Object.keys(variant.attributes || {})).filter(attribute => !/^\d+$/.test(attribute) && !attribute.endsWith('_raw')).map(attribute => {
                           const isPrimary = attribute === formData.variantConfig.primaryAttribute || 
                                           (formData.variantConfig.type === 'multi-dependent' && 
                                            formData.variantConfig.primaryAttributes?.includes(attribute))
                           const isMultiValue = variant.multiValues?.[attribute] !== undefined
                           
                           return (
                             <div key={attribute} className="space-y-1">
                               <div className="flex items-center justify-between">
                                 <Label className="text-xs capitalize flex items-center gap-2">
                                   {attribute}
                                   {isPrimary && (
                                     <span className="text-xs text-orange-600 font-medium">
                                       {formData.variantConfig.type === 'multi-dependent' ? '(Primary - Affects Price)' : '(Primary - Affects Price)'}
                                     </span>
                                   )}
                                   {isMultiValue && !isPrimary && (
                                     <span className="text-xs text-blue-600 font-medium">(Multi-Value)</span>
                                   )}
                                 </Label>
                                 {!isPrimary && (
                                   <Button
                                     type="button"
                                     variant={isMultiValue ? "default" : "outline"}
                                     size="sm"
                                     onClick={() => toggleMultiValueForVariant(index, attribute)}
                                     className="text-xs h-6 px-2"
                                   >
                                     {isMultiValue ? "Single" : "Multi"}
                                   </Button>
                                 )}
                               </div>
                               
                               {isPrimary ? (
                                 /* Primary Attribute - Multiple Values with Individual Prices */
                                 <div className="space-y-2">
                                   {variant.primaryValues?.filter((pv: any) => 
                                     formData.variantConfig.type === 'multi-dependent' 
                                       ? pv.attribute === attribute 
                                       : true
                                   ).map((primaryValue: any, valueIndex: number) => {
                                     // Get all primary values for this attribute to find the correct index
                                     const attributePrimaryValues = variant.primaryValues?.filter((pv: any) => 
                                       formData.variantConfig.type === 'multi-dependent' 
                                         ? pv.attribute === attribute 
                                         : true
                                     ) || []
                                     
                                     // Find the actual index in the full primaryValues array
                                     const actualIndex = variant.primaryValues?.findIndex((pv: any, idx: number) => 
                                       formData.variantConfig.type === 'multi-dependent' 
                                         ? pv.attribute === attribute && pv === attributePrimaryValues[valueIndex]
                                         : idx === valueIndex
                                     ) || valueIndex
                                     
                                     return (
                                      <div key={valueIndex} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-2 border rounded-md">
                                         <Input
                                           value={primaryValue.value ?? ""}
                                           onChange={(e) => updatePrimaryValue(index, actualIndex, "value", e.target.value)}
                                           placeholder={`Enter ${attribute} value`}
                                         />
                                        <div className="relative">
                                          <Input
                                            type="number"
                                            step="1"
                                            min="0"
                                            value={primaryValue.price ?? ""}
                                            onChange={(e) => updatePrimaryValue(index, actualIndex, "price", e.target.value)}
                                            placeholder="500"
                                            className="pr-8"
                                          />
                                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                                            TZS
                                          </div>
                                        </div>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={primaryValue.quantity ?? ""}
                                          onChange={(e) => updatePrimaryValue(index, actualIndex, "quantity", e.target.value === '' ? '' : String(parseInt(e.target.value) || 0))}
                                          placeholder="Qty"
                                        />
                                        <div className="flex items-center">
                                         <Button
                                           type="button"
                                           variant="ghost"
                                           size="sm"
                                           onClick={() => removePrimaryValue(index, actualIndex)}
                                         >
                                           <X className="h-3 w-3" />
                                         </Button>
                                        </div>
                                       </div>
                                     )
                                   })}
                                   <Button
                                     type="button"
                                     variant="outline"
                                     size="sm"
                                     onClick={() => addPrimaryValue(index, attribute)}
                                   >
                                     <Plus className="h-3 w-3 mr-1" />
                                     Add {attribute} Value
                                   </Button>
                                 </div>
                               ) : isMultiValue ? (
                                 /* Multi-Value Attribute - Comma Separated Input */
                                 <div className="space-y-2">
                                   <Input
                                     value={variant.multiValues?.[`${attribute}_raw`] ?? (Array.isArray(variant.multiValues?.[attribute]) ? variant.multiValues[attribute].join(", ") : "") ?? ""}
                                     onChange={(e) => updateMultiValueCommaSeparated(index, attribute, e.target.value)}
                                     placeholder={`Enter ${attribute} values separated by commas (e.g., 1k, 2k, 3k, 4k, 5k)`}
                                     className="w-full"
                                   />
                                   <p className="text-xs text-muted-foreground">
                                     Separate multiple values with commas
                                   </p>
                                 </div>
                               ) : (
                                 /* Regular Attribute - Single Value */
                                 <Input
                                   value={variant.attributes?.[attribute] ?? ""}
                                   onChange={(e) => updateVariantAttribute(index, attribute, e.target.value)}
                                   placeholder={`Enter ${attribute} (leave blank if not applicable)`}
                                 />
                               )}
                             </div>
                           )
                         })}
                       </div>
                     </div>
                   )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="space-y-4">
          <MediaUpload
            type="image"
              value={formData.image}
            onChange={(url) => handleInputChange("image", url)}
            onRemove={() => handleInputChange("image", "")}
            maxSize={10}
            aspectRatio={1}
            context="product"
            label="Main Product Image"
            description="Upload the main product image or provide a URL"
            productId={product?.id}
          />

          <MediaUpload
            type="video"
              value={formData.video}
            onChange={(url) => handleInputChange("video", url)}
            onRemove={async () => {
              try {
                if (product?.id && formData.video) {
                  const response = await fetch('/api/media/delete', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: product.id, type: 'video', url: formData.video })
                  })
                  
                  if (!response.ok) {
                    const error = await response.json()
                    toast({
                      title: "Delete failed",
                      description: error.error || "Failed to delete video",
                      variant: "destructive"
                    })
                    return
                  }
                  
                  toast({
                    title: "Video deleted",
                    description: "Video has been removed successfully"
                  })
                }
              } catch (error) {
                toast({
                  title: "Delete failed",
                  description: "Failed to delete video",
                  variant: "destructive"
                })
                return
              }
              handleInputChange("video", "")
            }}
            maxSize={50}
            context="product"
            label="Product Video"
            description="Upload a product video or provide a URL"
            productId={product?.id}
          />

          <MediaUpload
            type="model3d"
              value={formData.view360}
            onChange={(url) => handleInputChange("view360", url)}
            onRemove={async () => {
              try {
                if (product?.id && formData.view360) {
                  const response = await fetch('/api/media/delete', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: product.id, type: 'model3d', url: formData.view360 })
                  })
                  
                  if (!response.ok) {
                    const error = await response.json()
                    toast({
                      title: "Delete failed",
                      description: error.error || "Failed to delete 360° view",
                      variant: "destructive"
                    })
                    return
                  }
                  
                  toast({
                    title: "360° view deleted",
                    description: "360° view has been removed successfully"
                  })
                }
              } catch (error) {
                toast({
                  title: "Delete failed",
                  description: "Failed to delete 360° view",
                  variant: "destructive"
                })
                return
              }
              handleInputChange("view360", "")
            }}
            maxSize={100}
            context="product"
            label="3D Model / 360° View"
            description="Upload a 3D model file or provide a URL for 360° view"
            productId={product?.id}
          />

          {/* Variant Images Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Variant Images
                    {formData.variantImages.length > 0 && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {formData.variantImages.length} saved
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Upload images for specific product variants and attribute combinations
                  </p>
                </div>
                <Button 
                  type="button" 
                  onClick={() => setShowVariantImageDialog(true)} 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Variant Image
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              
              {formData.variantImages && formData.variantImages.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  {formData.variantImages.map((variantImg, index) => (
                    <div key={index} className="flex gap-4 p-4 border rounded-lg">
                      {/* Image Preview Container - Left Side */}
                      <div className="flex-shrink-0">
                        <div className="relative w-32 h-32 overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-50">
                          <img
                            src={variantImg.imageUrl}
                            alt="Variant image"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div 
                            className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500 text-xs"
                            style={{ display: 'none' }}
                          >
                            <div className="text-center">
                              <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                              <div>Image not found</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions Section - Right Side */}
                      <div className="flex-1 space-y-3">
                        {/* Variant Info */}
                        <div>
                          <h4 className="font-medium text-sm">
                            Variant Image {index + 1}
                          </h4>
                          <div className="text-xs text-gray-500 space-y-1">
                            {variantImg.variantId && (
                              <p>Variant ID: {variantImg.variantId}</p>
                            )}
                            {variantImg.attribute && (
                              <p>Attribute: {variantImg.attribute.name}: {variantImg.attribute.value}</p>
                            )}
                            {variantImg.attributes && variantImg.attributes.length > 0 && (
                              <div>
                                <p className="text-xs font-medium">Attributes:</p>
                                {variantImg.attributes.map((attr: any, index: number) => (
                                  <p key={index} className="text-xs">
                                    • {attr.name}: {attr.value || "any"}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                          {/* View Button */}
                    <Button
                      type="button"
                            variant="outline"
                      size="sm"
                            onClick={() => window.open(variantImg.imageUrl, '_blank')}
                            className="text-xs"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>

                          {/* Edit Button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newUrl = prompt('Enter new variant image URL:', variantImg.imageUrl)
                              if (newUrl && newUrl.trim()) {
                                const updatedImages = [...formData.variantImages]
                                updatedImages[index] = { ...updatedImages[index], imageUrl: newUrl.trim() }
                                setFormData(prev => ({ ...prev, variantImages: updatedImages }))
                              }
                            }}
                            className="text-xs"
                          >
                            <Link className="w-3 h-3 mr-1" />
                            Edit
                          </Button>

                          {/* URLs Button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newUrl = prompt('Enter variant image URL:')
                              if (newUrl && newUrl.trim()) {
                                const updatedImages = [...formData.variantImages]
                                updatedImages[index] = { ...updatedImages[index], imageUrl: newUrl.trim() }
                                setFormData(prev => ({ ...prev, variantImages: updatedImages }))
                              }
                            }}
                            className="text-xs"
                          >
                            <Link className="w-3 h-3 mr-1" />
                            URLs
                          </Button>

                          {/* Delete Button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => deleteVariantImage(index)}
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                    </Button>
                        </div>

                        {/* Status Info */}
                        <div className="text-xs text-gray-500">
                          <Badge variant="secondary" className="text-xs">
                            Variant Image
                          </Badge>
                          <span className="ml-2">Current file loaded</span>
                        </div>
                      </div>
                  </div>
                ))}
              </div>
              ) : (
                <div className="text-center py-8">
                  <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600">
                    No variant images uploaded yet
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Click "Add Variant Image" to upload images for specific variants. Images will be automatically added when uploaded.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Specifications</CardTitle>
                <Button type="button" onClick={addSpecification} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Specification
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {specificationFields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No specifications added yet.</p>
                  <p className="text-sm">Click "Add Specification" to get started.</p>
                </div>
              )}
              
              {specificationFields.map((field) => (
                <div key={field.id} className="flex items-center gap-2">
                  <Input
                    value={field.key ?? ""}
                    onChange={(e) => updateSpecificationField(field.id, 'key', e.target.value)}
                    placeholder="Specification key (e.g., Color, Size, Material)"
                    className="w-1/3"
                  />
                  <Input
                    value={field.value ?? ""}
                    onChange={(e) => updateSpecificationField(field.id, 'value', e.target.value)}
                    placeholder="Specification value"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSpecificationField(field.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting}
          className={isSuccess ? "bg-green-600 hover:bg-green-700" : ""}
        >
          {isSubmitting ? "Saving..." : isSuccess ? "✅ Updated!" : (product ? "Update Product" : "Create Product")}
        </Button>
      </div>
    </form>




    {/* Variant Image Dialog */}
    <Dialog open={showVariantImageDialog} onOpenChange={setShowVariantImageDialog}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Variant Image</DialogTitle>
          <DialogDescription>
            Upload an image for a product variant. The image will be automatically added to your product when uploaded. You can optionally assign it to specific attributes, or leave it unassigned to apply to the entire variant.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 pr-2">
          {/* Variant Selection */}
          <div className="space-y-2">
            <Label>Select Variant (Optional)</Label>
            <Select
              value={selectedVariantForImage?.toString() || "none"}
              onValueChange={(value) => {
                setSelectedVariantForImage(value === "none" ? null : Number(value))
                setSelectedAttributesForImage([])
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a variant (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific variant</SelectItem>
                {formData.variants.map((variant, index) => (
                  <SelectItem key={variant.id} value={variant.id.toString()}>
                    {variant.sku || `Variant ${index + 1}`} {variant.variantType ? `(${variant.variantType})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Multiple Attribute Selection */}
          {selectedVariantForImage && (() => {
            const selectedVariant = formData.variants.find(v => v.id === selectedVariantForImage)
            if (!selectedVariant) return null

            const availableAttributes: Array<{name: string, values: string[], isPrimary?: boolean}> = []
            
            // Add simple attributes (variant.attributes)
            if (selectedVariant.attributes) {
              Object.keys(selectedVariant.attributes).forEach(attr => {
                if (!attr.endsWith('_raw')) {
                  const value = selectedVariant.attributes[attr]
                  
                  // Check if this is a primary attribute from the config
                  const isPrimaryAttribute = formData.variantConfig.primaryAttribute === attr ||
                    (formData.variantConfig.type === 'multi-dependent' && 
                     formData.variantConfig.primaryAttributes?.includes(attr))
                  
                  availableAttributes.push({
                    name: attr,
                    values: [value].filter(Boolean), // Convert single value to array
                    isPrimary: isPrimaryAttribute
                  })
                }
              })
            }
            
            // Add primary attribute values from variant config
            if (formData.variantConfig.primaryAttribute && selectedVariant.primaryValues) {
              availableAttributes.push({
                name: formData.variantConfig.primaryAttribute,
                values: selectedVariant.primaryValues.map((pv: any) => pv.value || pv)
              })
            }
            
            // Add primary attributes from variant config (for multi-dependent)
            if (formData.variantConfig.type === 'multi-dependent' && formData.variantConfig.primaryAttributes) {
              formData.variantConfig.primaryAttributes.forEach(primaryAttr => {
                // Check if this variant has values for this primary attribute
                const variantPrimaryValues = selectedVariant.primaryValues?.filter((pv: any) => 
                  pv.attribute === primaryAttr
                ) || []
                
                if (variantPrimaryValues.length > 0) {
                  availableAttributes.push({
                    name: primaryAttr,
                    values: variantPrimaryValues.map((pv: any) => pv.value || pv)
                  })
                }
              })
            }
            
            // Add variant-specific primary attribute (fallback)
            if (selectedVariant.primaryAttribute && selectedVariant.primaryValues) {
              // Only add if not already added from variant config
              const alreadyAdded = availableAttributes.some(attr => attr.name === selectedVariant.primaryAttribute)
              if (!alreadyAdded) {
                availableAttributes.push({
                  name: selectedVariant.primaryAttribute,
                  values: selectedVariant.primaryValues.map((pv: any) => pv.value || pv)
                })
              }
            }
            
            // Add multi-value attributes
            if (selectedVariant.multiValues) {
              Object.entries(selectedVariant.multiValues).forEach(([key, values]) => {
                // Filter out _raw attributes
                if (!key.endsWith('_raw')) {
                  if (Array.isArray(values)) {
                    availableAttributes.push({
                      name: key,
                      values: values
                    })
                  } else if (typeof values === 'string') {
                    availableAttributes.push({
                      name: key,
                      values: values.split(',').map(v => v.trim())
                    })
                  }
                }
              })
            }


            return (
        <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Select Attributes (Optional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAttributesForImage([])}
                    disabled={selectedAttributesForImage.length === 0}
                  >
                    Clear All
                  </Button>
                </div>
                <p className="text-xs text-gray-600">
                  Choose one or more attributes to associate with this image, or leave empty to apply to the entire variant.
                </p>
                
                {availableAttributes.length > 0 ? (
                  <div className="space-y-4">
                    {/* Add New Attribute Dropdown */}
          <div className="space-y-2">
                      <Label className="text-sm">Add Attribute</Label>
                      <div className="flex gap-2">
                        <Select
                          value=""
                          onValueChange={(attrName) => {
                            if (attrName && !selectedAttributesForImage.some(sa => sa.name === attrName)) {
                              setSelectedAttributesForImage(prev => [
                                ...prev,
                                { name: attrName, value: "" }
                              ])
                            }
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select an attribute to add" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableAttributes
                              .filter(attr => !selectedAttributesForImage.some(sa => sa.name === attr.name))
                              .map((attr) => (
                                <SelectItem key={attr.name} value={attr.name}>
                                  {attr.name} {attr.isPrimary ? '(Primary)' : ''} ({attr.values.length} value{attr.values.length !== 1 ? 's' : ''})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Selected Attributes List */}
                    {selectedAttributesForImage.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Selected Attributes:</Label>
                        {selectedAttributesForImage.map((selectedAttr, index) => {
                          const attrInfo = availableAttributes.find(a => a.name === selectedAttr.name)
                          
                          return (
                            <div key={index} className="p-3 border rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">
                                  {selectedAttr.name} 
                                  {attrInfo?.isPrimary && <span className="text-xs text-blue-600 ml-1">(Primary)</span>}
                                </Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedAttributesForImage(prev => 
                                      prev.filter((_, i) => i !== index)
                                    )
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-xs">Value for {selectedAttr.name}</Label>
                                <Select
                                  value={selectedAttr.value || "any"}
                                  onValueChange={(value) => {
                                    setSelectedAttributesForImage(prev => 
                                      prev.map((sa, i) => 
                                        i === index 
                                          ? { ...sa, value: value === "any" ? "" : value }
                                          : sa
                                      )
                                    )
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={`Choose ${selectedAttr.name} value`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="any">Any {selectedAttr.name}</SelectItem>
                                    {attrInfo?.values.map((value) => (
                                      <SelectItem key={value} value={value}>
                                        {value}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Show selected attributes summary */}
                    {selectedAttributesForImage.length > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <Label className="text-sm font-medium text-blue-800">Summary:</Label>
                        <div className="mt-2 space-y-1">
                          {selectedAttributesForImage.map((attr, index) => (
                            <div key={index} className="text-xs text-blue-700">
                              • {attr.name}: {attr.value || "any"}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>No attributes found for this variant.</strong>
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      This variant doesn't have any attributes defined. You can still upload an image without specifying any attributes.
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Upload Image *</Label>
            <MediaUpload
              type="image"
              value={newVariantImageUrl}
              onChange={handleVariantImageUpload}
              onRemove={() => setNewVariantImageUrl("")}
              maxSize={10}
              aspectRatio={1}
              context="variant"
              productId={product?.id}
              label=""
              description=""
            />
          </div>
        </div>

        {/* Simple close button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setShowVariantImageDialog(false)
              setNewVariantImageUrl("")
              setSelectedVariantForImage(null)
              setSelectedAttributesForImage([])
            }}
          >
            Close
          </Button>
        </div>

      </DialogContent>
    </Dialog>
    </>
  )
} 