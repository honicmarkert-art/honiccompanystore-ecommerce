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
import { HierarchicalCategorySelector } from "@/components/hierarchical-category-selector"
import { X, Plus, Upload, Image as ImageIcon, Eye, Trash2, Link } from "lucide-react"
import { MediaUpload } from "@/components/media/media-upload"
import { logger } from '@/lib/logger'

interface ProductFormProps {
  product?: any
  onClose: () => void
  onSave?: (productData: any) => void
  autoCloseOnSave?: boolean
  hideImportChina?: boolean // Hide "Import from China" field for suppliers
  restrictVariantType?: boolean // Restrict variant type to primary-dependent for suppliers
}

export function ProductForm({ product, onClose, onSave, autoCloseOnSave = true, hideImportChina = false, restrictVariantType = false }: ProductFormProps) {
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
  // Attributes removed - simplified variant system
  const [newVariantImageUrl, setNewVariantImageUrl] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [retryCount, setRetryCount] = useState(0)

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
    specificationImages: [] as string[],
    // Stock and delivery settings
    inStock: true,
    stockQuantity: "",
    freeDelivery: false,
    sameDayDelivery: false,
    importChina: false,
    variantConfig: {
      type: (restrictVariantType ? 'primary-dependent' : 'simple') as 'simple' | 'primary-dependent' | 'multi-dependent',
      primaryAttribute: '',
      primaryAttributes: [] as string[],
      attributeOrder: [] as string[],
      dependencies: {} as Record<string, string[]>
    },
    hasBeenUpdated: false
  })

  // Attributes removed - simplified variant system

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
        variants: (product.variants || []).map((variant: any) => {
          // Use the new stock_quantities structure
          const quantities = variant.quantities || {}
          const attributes = variant.attributes ? { ...variant.attributes } : {}
          
          // Clean attributes by removing any remaining _quantity fields
          Object.keys(attributes).forEach(key => {
            if (key.endsWith('_quantity') || key === '_quantities' || key === 'quantities') {
              delete attributes[key]
            }
          })
          
          return {
            ...variant,
            attributes: attributes, // Clean attributes
            quantities: quantities // Quantities from stock_quantities column
          }
        }),
        video: product.video ?? "",
        view360: product.view360 ?? "",
        variantImages: product.variantImages || [],
        specificationImages: product.specificationImages || product.specification_images || [],
        // Stock and delivery settings
        inStock: product.inStock !== undefined ? product.inStock : true,
        stockQuantity: product.stockQuantity?.toString() ?? "",
        freeDelivery: product.freeDelivery || false,
        importChina: product.importChina || product.import_china || false,
        sameDayDelivery: product.sameDayDelivery || false,
        variantConfig: product.variantConfig || {
          type: restrictVariantType ? 'primary-dependent' : 'simple',
          primaryAttribute: '',
          primaryAttributes: [],
          attributeOrder: [],
          dependencies: {}
        },
        hasBeenUpdated: false
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

      // Attributes removed - simplified variant system
    }
    }, [product, categoriesLoading, brandsLoading])

  // Attributes removed - simplified variant system

  // Auto-refresh product data after updating (5 seconds, one-time)
  useEffect(() => {
    if (!product?.id || !formData.hasBeenUpdated) return

    const refreshProductData = async () => {
      try {
        if (!product?.id) return
        const response = await fetch(`/api/products/${product.id}`)
        if (response.ok) {
          const freshProduct = await response.json()
          
          // Update form data with fresh stock information
          setFormData(prev => ({
            ...prev,
            stockQuantity: freshProduct.stockQuantity?.toString() ?? prev.stockQuantity,
            inStock: freshProduct.inStock !== undefined ? freshProduct.inStock : prev.inStock,
            variants: freshProduct.variants || prev.variants,
            hasBeenUpdated: false // Reset the flag
          }))
        }
      } catch (error) {
      }
    }

    // Set up 5-second delay, then refresh once
    const timeout = setTimeout(refreshProductData, 5000)
    
    // Cleanup timeout on unmount
    return () => {
      clearTimeout(timeout)
    }
  }, [product?.id, formData.hasBeenUpdated])

  const handleInputChange = (field: string, value: any) => {
    
    // Special handling for variant config changes
    if (field === 'variantConfig') {
      
      // If changing from simple to multi-dependent, check if variants exist
      if (formData.variantConfig?.type === 'simple' && value?.type === 'multi-dependent') {
        if (formData.variants.length > 0) {
          // Variants exist during type change - this might cause issues
        }
      }
      
      // If changing from multi-dependent to simple, warn about variant data
      if (formData.variantConfig?.type === 'multi-dependent' && value?.type === 'simple') {
        if (formData.variants.length > 0) {
          // Variants exist during type change - variant data will be preserved but not used
        }
      }
    }
    
    setFormData(prev => {
      const newData = {
      ...prev,
      [field]: value
      }
      
      
      return newData
    })
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
          name: "",
          image: "",
          price: parseFloat(prev.price) || 0, // Set default price to product price
          sku: "",
          stock_quantity: 0
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
          attributes: undefined // Attributes removed - simplified variant system
        }]
      }))
      setNewVariantImageUrl("")
      setSelectedVariantForImage(null)
      // Attributes removed
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
          attributes: undefined // Attributes removed - simplified variant system
        }]
      }))
      
      // Clear the form
      setNewVariantImageUrl("")
      setSelectedVariantForImage(null)
      // Attributes removed
      
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
          productId: product?.id,
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

  // Attribute management functions - REMOVED: Simplified variant system
  // All attribute-related functions removed - variants now only have SKU, price, and stock_quantity

  // Removed functions: updateVariantAttribute, updateVariantQuantity, addPrimaryValue, updatePrimaryValue, 
  // removePrimaryValue, addMultiValue, updateSmartAttribute, handleAttributeBlur, updateSmartQuantity

  const _unused = () => {
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

  // Separate function for updating quantity fields
  const updateVariantQuantity = (variantIndex: number, attribute: string, quantity: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) => 
        index === variantIndex 
          ? { 
              ...variant, 
              quantities: { 
                ...variant.quantities, 
                [attribute]: quantity 
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


  // Smart attribute update - stores comma-separated values as arrays of objects in attributes
  const updateSmartAttribute = (variantIndex: number, attribute: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              // Store value in attributes - keep as string while typing, convert on blur
              attributes: {
                ...variant.attributes,
                [attribute]: value // Keep as string for now, convert on blur
              }
            }
          : variant
      )
    }))
  }

  // Convert comma-separated string to array of objects on blur
  const handleAttributeBlur = (variantIndex: number, attribute: string) => {
    const variant = formData.variants[variantIndex]
    const value = variant.attributes?.[attribute]
    
    if (typeof value === 'string' && value.includes(',')) {
      setFormData(prev => ({
        ...prev,
        variants: prev.variants.map((variant, index) =>
          index === variantIndex
            ? {
                ...variant,
                attributes: {
                  ...variant.attributes,
                  [attribute]: value.split(',').map(v => v.trim()).filter(v => v).map(v => ({ value: v }))
                }
              }
            : variant
        )
      }))
    }
  }

  // Smart quantity update - stores quantity in quantities
  const updateSmartQuantity = (variantIndex: number, attribute: string, quantity: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              quantities: {
                ...variant.quantities,
                [attribute]: quantity
              }
            }
          : variant
      )
    }))
  }



  // Comprehensive validation function
  const validateForm = (): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {}
    
    // Name validation
    const nameTrimmed = (formData.name || '').trim()
    if (!nameTrimmed) {
      errors.name = "Product name is required"
    } else if (nameTrimmed.length < 2) {
      errors.name = "Product name must be at least 2 characters"
    } else if (nameTrimmed.length > 255) {
      errors.name = "Product name must be less than 255 characters"
    }
    
    // Price validation
    const priceNumber = parseFloat(String(formData.price || 0))
    if (Number.isNaN(priceNumber) || priceNumber <= 0) {
      errors.price = "Enter a valid price greater than 0"
    } else if (priceNumber > 999999999) {
      errors.price = "Price is too large (maximum: 999,999,999)"
    }
    
    // Original price validation (if provided)
    if (formData.originalPrice) {
      const originalPriceNumber = parseFloat(String(formData.originalPrice))
      if (!Number.isNaN(originalPriceNumber) && originalPriceNumber > 0) {
        if (originalPriceNumber <= priceNumber) {
          errors.originalPrice = "Original price must be greater than current price"
        }
      }
    }
    
    // Category validation
    const invalidSentinelValues = new Set(["__loading__", "__error__", "__empty__", "__add_new__", "__add_new_main__", "__add_new_sub__", "__no_subs__"])
    if (!formData.category || invalidSentinelValues.has(formData.category)) {
      errors.category = "Please select a valid category"
    }
    
    // Category ID validation for new products
    if (!product && !(formData as any).category_id) {
      errors.category = "Please select a subcategory (it assigns the UUID)"
    }
    
    // Brand validation
    if (!formData.brand || invalidSentinelValues.has(formData.brand)) {
      errors.brand = "Please select a valid brand"
    }
    
    // SKU validation (optional but if provided, should be valid)
    if (formData.sku && String(formData.sku).trim().length > 100) {
      errors.sku = "SKU must be less than 100 characters"
    }
    
    // Description validation (optional but if provided, should be reasonable)
    if (formData.description && String(formData.description).length > 10000) {
      errors.description = "Description is too long (maximum: 10,000 characters)"
    }
    
    // Variant validation
    if (formData.variants && Array.isArray(formData.variants)) {
      formData.variants.forEach((variant, index) => {
        // Variant name validation
        if (!variant.name && !variant.variant_name) {
          errors[`variant_${index}_name`] = `Variant ${index + 1} name is required`
        }
        
        // Variant price validation
        const variantPrice = parseFloat(String(variant.price || 0))
        if (Number.isNaN(variantPrice) || variantPrice < 0) {
          errors[`variant_${index}_price`] = `Variant ${index + 1} price must be a valid number`
        }
        
        // Variant stock validation
        const variantStock = parseInt(String(variant.stock_quantity || variant.stockQuantity || 0))
        if (Number.isNaN(variantStock) || variantStock < 0) {
          errors[`variant_${index}_stock`] = `Variant ${index + 1} stock must be a valid number`
        }
      })
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setValidationErrors({})
    setIsSubmitting(true)
    setRetryCount(0)

    try {
      // Comprehensive validation
      const validation = validateForm()
      if (!validation.isValid) {
        setValidationErrors(validation.errors)
        const firstError = Object.values(validation.errors)[0]
        toast({ 
          title: "Validation Error", 
          description: firstError || "Please check the form for errors", 
          variant: "destructive" 
        })
        setIsSubmitting(false)
        return
      }

      // Prepare product data with defensive programming
      const calculatedStock = (() => {
        try {
          // If product has no variants, use the manual stock field
          if (!formData.variants || formData.variants.length === 0) {
            const stock = parseInt(String(formData.stockQuantity || 0))
            return isNaN(stock) ? 0 : Math.max(0, stock)
          }
          
          // Otherwise, auto-calculate from variant stock quantities
          let total = 0
          if (Array.isArray(formData.variants)) {
            formData.variants.forEach(variant => {
              if (variant && typeof variant === 'object') {
                // Use simplified variant structure: stock_quantity or stockQuantity
                const qty = variant.stock_quantity || variant.stockQuantity || 0
                const parsedQty = typeof qty === 'number' ? qty : parseInt(String(qty)) || 0
                total += Math.max(0, parsedQty) // Ensure non-negative
              }
            })
          }
          return total
        } catch (error) {
          return parseInt(String(formData.stockQuantity || 0)) || 0
        }
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
      })

      const usedAttributes = Array.from(usedAttributesSet)
      const normalizedVariantConfig = (() => {
        const vc = { ...(formData.variantConfig || {}) }
        
        
        // Only auto-change type if no type is set and attributes exist
        // If user explicitly chose 'simple', respect their choice even with attributes
        if (usedAttributes.length > 0 && !vc.type) {
          vc.type = 'multi-dependent'
        } else if (usedAttributes.length > 0 && vc.type === 'simple') {
          // Explicitly ensure the type stays 'simple'
          vc.type = 'simple'
        }
        // Primary-dependent: ensure primaryAttribute
        if (vc.type === 'primary-dependent' && !vc.primaryAttribute && usedAttributes.length > 0) {
          vc.primaryAttribute = usedAttributes[0]
        }
        // For suppliers (restrictVariantType), set ALL used attributes as primaryAttributes even in primary-dependent mode
        if (vc.type === 'primary-dependent' && restrictVariantType && usedAttributes.length > 0) {
          vc.primaryAttributes = Array.from(new Set([...usedAttributes]))
          // Ensure primaryAttribute is set to first attribute
          if (!vc.primaryAttribute) {
            vc.primaryAttribute = usedAttributes[0]
          }
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

      // Sanitize and prepare product data with defensive checks
      const productData = {
        ...formData,
        // Sanitize numeric fields
        price: Math.max(0, parseFloat(String(formData.price || 0)) || 0),
        originalPrice: formData.originalPrice 
          ? Math.max(0, parseFloat(String(formData.originalPrice)) || 0)
          : Math.max(0, parseFloat(String(formData.price || 0)) || 0),
        rating: Math.max(0, Math.min(5, parseFloat(String(formData.rating || 0)) || 0)), // Clamp 0-5
        reviews: Math.max(0, parseInt(String(formData.reviews || 0)) || 0),
        views: Math.max(0, parseInt(String(product?.views || 0)) || 0),
        
        // Sanitize string fields
        name: String(formData.name || '').trim(),
        description: String(formData.description || '').trim(),
        category: String(formData.category || '').trim(),
        brand: String(formData.brand || '').trim(),
        sku: String(formData.sku || '').trim(),
        model: formData.model && String(formData.model).trim().length > 0 
          ? String(formData.model).trim() 
          : undefined, // Only include if has value
        image: String(formData.image || '').trim(),
        video: formData.video && String(formData.video).trim().length > 0 
          ? String(formData.video).trim() 
          : undefined,
        view360: formData.view360 && String(formData.view360).trim().length > 0 
          ? String(formData.view360).trim() 
          : undefined,
        
        // Stock and delivery data
        stockQuantity: Math.max(0, calculatedStock),
        inStock: (() => {
          try {
            // If product has no variants, use the manual in-stock toggle
            if (!formData.variants || formData.variants.length === 0) {
              return formData.inStock !== false
            }
            
            // Otherwise, auto-calculate from variant stock quantities
            let total = 0
            if (Array.isArray(formData.variants)) {
              formData.variants.forEach(variant => {
                if (variant && typeof variant === 'object') {
                  const qty = variant.stock_quantity || variant.stockQuantity || 0
                  const parsedQty = typeof qty === 'number' ? qty : parseInt(String(qty)) || 0
                  total += Math.max(0, parsedQty)
                }
              })
            }
            return total > 0
          } catch (error) {
            return formData.inStock !== false
          }
        })(),
        freeDelivery: Boolean(formData.freeDelivery),
        importChina: Boolean(formData.importChina),
        sameDayDelivery: Boolean(formData.sameDayDelivery),
        variantConfig: normalizedVariantConfig,
        
        // Include variant images data (ensure array)
        variantImages: Array.isArray(formData.variantImages) ? formData.variantImages : [],
        specificationImages: Array.isArray(formData.specificationImages) ? formData.specificationImages : [],
        
        // Include variants data with proper price handling and validation
        variants: Array.isArray(formData.variants) 
          ? formData.variants
              .filter(variant => variant && typeof variant === 'object') // Filter invalid variants
              .map(variant => {
                const variantPrice = parseFloat(String(variant.price || formData.price || 0)) || 0
                return {
                  ...variant,
                  name: variant.name || variant.variant_name || '',
                  price: Math.max(0, variantPrice),
                  stock_quantity: Math.max(0, parseInt(String(variant.stock_quantity || variant.stockQuantity || 0)) || 0),
                  sku: variant.sku ? String(variant.sku).trim() : undefined,
                  image: variant.image && String(variant.image).trim().length > 0 
                    ? String(variant.image).trim() 
                    : undefined
                }
              })
          : []
      }


      // Call onSave if provided with retry logic and timeout
      if (onSave) {
        const MAX_RETRIES = 2
        const TIMEOUT_MS = 30000 // 30 seconds
        
        let lastError: Error | null = null
        
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            setRetryCount(attempt)
            
            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS)
            })
            
            // Race between the save operation and timeout
            const updatedProduct: any = await Promise.race([
              onSave(productData),
              timeoutPromise
            ]) as any
            
            // If we got updated product data back, refresh the form data
            if (updatedProduct && typeof updatedProduct === 'object') {
          
          // Clear any pending variant image selections
          setSelectedVariantForImage(null)
          // Attributes removed
          setNewVariantImageUrl("")
          
          
          setFormData(prev => ({
            ...prev,
            name: updatedProduct.name ?? prev.name,
            description: updatedProduct.description ?? prev.description,
            hasBeenUpdated: true, // Set flag to trigger auto-refresh
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
            variants: (updatedProduct.variants || prev.variants).map((variant: any) => {
              // Use the new stock_quantities structure
              const quantities = variant.quantities || {}
              const attributes = variant.attributes ? { ...variant.attributes } : {}
              
              // Clean attributes by removing any remaining _quantity fields
              Object.keys(attributes).forEach(key => {
                if (key.endsWith('_quantity') || key === '_quantities' || key === 'quantities') {
                  delete attributes[key]
                }
              })
              
              return {
                ...variant,
                attributes: attributes, // Clean attributes
                quantities: quantities // Quantities from stock_quantities column
              }
            }),
            video: updatedProduct.video ?? prev.video,
            view360: updatedProduct.view360 ?? prev.view360,
            variantImages: updatedProduct.variantImages || prev.variantImages,
            // Stock and delivery settings
            inStock: updatedProduct.inStock ?? prev.inStock,
            stockQuantity: updatedProduct.stockQuantity?.toString() ?? prev.stockQuantity,
            freeDelivery: updatedProduct.freeDelivery ?? prev.freeDelivery,
            sameDayDelivery: updatedProduct.sameDayDelivery ?? prev.sameDayDelivery,
            importChina: updatedProduct.importChina ?? prev.importChina,
            // Variant configuration
              variantConfig: updatedProduct.variantConfig || prev.variantConfig
            }))
            
            }
            
            // Success - break out of retry loop
            break
            
          } catch (error: any) {
            lastError = error
            
            // Check if it's a network error or timeout that we should retry
            const isRetryableError = 
              error?.message?.includes('timeout') ||
              error?.message?.includes('network') ||
              error?.message?.includes('fetch') ||
              error?.code === 'ECONNRESET' ||
              error?.code === 'ETIMEDOUT' ||
              (error?.response?.status >= 500 && error?.response?.status < 600)
            
            if (attempt < MAX_RETRIES && isRetryableError) {
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
              continue
            }
            
            // Not retryable or max retries reached
            throw error
          }
        }
        
        if (lastError) {
          throw lastError
        }
      }

      // Show success message
      toast({
        title: "✅ Success!",
        description: product ? "Product updated successfully! Media section refreshed with latest data." : "Product created successfully!",
        duration: 4000,
      })

      // Set success state for visual feedback
      setIsSuccess(true)
      setTimeout(() => setIsSuccess(false), 2000)

      // Only close if autoCloseOnSave is true
      if (autoCloseOnSave) {
        onClose()
      }
    } catch (error: any) {
      // Determine user-friendly error message
      let errorMessage = "Failed to save product. Please try again."
      
      if (error?.message?.includes('timeout')) {
        errorMessage = "Request timed out. Please check your connection and try again."
      } else if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
        errorMessage = "Network error. Please check your internet connection and try again."
      } else if (error?.response?.status === 401) {
        errorMessage = "Your session has expired. Please log in again."
      } else if (error?.response?.status === 403) {
        errorMessage = "You don't have permission to perform this action."
      } else if (error?.response?.status === 429) {
        errorMessage = "Too many requests. Please wait a moment and try again."
      } else if (error?.response?.status >= 500) {
        errorMessage = "Server error. Please try again in a few moments."
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      setSubmitError(errorMessage)
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      })
    } finally {
      setIsSubmitting(false)
      setRetryCount(0)
    }
  }

  return (
    <>
      {/* Error Display */}
      {submitError && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{submitError}</p>
              {retryCount > 0 && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  Retry attempt {retryCount} of 2
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSubmitError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6" suppressHydrationWarning>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="basic" className="text-xs sm:text-sm px-2 sm:px-4 py-2">Basic Info</TabsTrigger>
            <TabsTrigger value="pricing" className="text-xs sm:text-sm px-2 sm:px-4 py-2">Pricing</TabsTrigger>
            <TabsTrigger value="media" className="text-xs sm:text-sm px-2 sm:px-4 py-2">Media</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs sm:text-sm px-2 sm:px-4 py-2">Specifications</TabsTrigger>
          </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  handleInputChange("name", e.target.value)
                  // Clear validation error when user types
                  if (validationErrors.name) {
                    setValidationErrors(prev => {
                      const next = { ...prev }
                      delete next.name
                      return next
                    })
                  }
                }}
                placeholder="Enter product name"
                required
                className={validationErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
                maxLength={255}
              />
              {validationErrors.name && (
                <p className="text-xs text-red-500">{validationErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <HierarchicalCategorySelector
                value={formData.category}
                onValueChange={(value) => {
                  if (value !== "__add_new_main__" && 
                      value !== "__add_new_sub__" &&
                      value !== "__loading__" && 
                      value !== "__error__" && 
                      value !== "__empty__" &&
                      value !== "__no_subs__") {
                    handleInputChange("category", value)
                  }
                }}
                onSelect={(selection) => {
                  // Persist the leaf (subcategory) UUID as category_id; fallback to main if no sub
                  const target = selection.sub || selection.main
                  if (target) {
                    handleInputChange("category_id", target.id)
                  }
                }}
                placeholder="Select a category"
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

            {!hideImportChina && (
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
            )}
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
                            // Check primaryValues quantities
                            if (Array.isArray(variant.primaryValues)) {
                              variant.primaryValues.forEach((pv: any) => {
                                const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                                total += qty
                              })
                            }
                            
                            
                            // Check quantities object
                            if (variant.quantities && typeof variant.quantities === 'object') {
                              Object.keys(variant.quantities).forEach(key => {
                                const qty = parseInt(variant.quantities[key]) || 0
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
                          // Count primary values quantities
                          if (Array.isArray(variant.primaryValues)) {
                            variant.primaryValues.forEach((pv: any) => {
                              const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                              total += qty
                            })
                          }
                          
                          // Count quantities object
                          if (variant.quantities) {
                            Object.keys(variant.quantities).forEach(attr => {
                              const qty = parseInt(variant.quantities[attr]) || 0
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

        {!hideImportChina && (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Import from China</Label>
              <p className="text-sm text-muted-foreground">Mark if this product is imported from China</p>
            </div>
            <Switch
              checked={formData.importChina}
              onCheckedChange={(checked) => handleInputChange("importChina", checked)}
            />
          </div>
        )}

        {!hideImportChina && (
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
        )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="originalPrice" className="text-xs sm:text-sm lg:text-base">Original Price (in TZS)</Label>
              <div className="relative">
                <Input
                  id="originalPrice"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.originalPrice}
                  onChange={(e) => handleInputChange("originalPrice", e.target.value)}
                  placeholder="1000"
                  className="pr-10 sm:pr-12 text-sm sm:text-base h-9 sm:h-10"
                />
                <div className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-[10px] sm:text-xs text-gray-500 pointer-events-none">
                  TZS
                </div>
              </div>
              <p className="text-[9px] sm:text-[10px] text-gray-500 leading-tight">Original price before discount (optional)</p>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="price" className="text-xs sm:text-sm lg:text-base">Price after offer * (in TZS)</Label>
              <div className="relative">
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  max="999999999"
                  value={formData.price}
                  onChange={(e) => {
                    const value = e.target.value
                    // Only allow positive numbers
                    if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                      handleInputChange("price", value)
                      if (validationErrors.price) {
                        setValidationErrors(prev => {
                          const next = { ...prev }
                          delete next.price
                          return next
                        })
                      }
                    }
                  }}
                  placeholder="500"
                  required
                  className={cn(
                    "pr-10 sm:pr-12 text-sm sm:text-base h-9 sm:h-10",
                    validationErrors.price ? "border-red-500 focus-visible:ring-red-500" : ""
                  )}
                />
                <div className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-[10px] sm:text-xs text-gray-500 pointer-events-none">
                  TZS
                </div>
              </div>
              {validationErrors.price ? (
                <p className="text-xs text-red-500">{validationErrors.price}</p>
              ) : (
                <p className="text-[9px] sm:text-[10px] text-gray-500 leading-tight">Enter price in Tanzanian Shillings (minimum 500 TZS)</p>
              )}
            </div>

            <div className="space-y-1.5 sm:space-y-2 sm:col-span-2">
              <Label htmlFor="reviews" className="text-xs sm:text-sm lg:text-base">Number of Reviews</Label>
              <Input
                id="reviews"
                type="number"
                min="0"
                value={formData.reviews}
                onChange={(e) => handleInputChange("reviews", e.target.value)}
                placeholder="0"
                className="text-sm sm:text-base h-9 sm:h-10"
              />
            </div>
          </div>

                     {/* Attribute Management - REMOVED: Simplified variant system without attributes */}

          {/* Variants */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                <CardTitle className="text-base sm:text-lg">Product Variants</CardTitle>
                  {formData.variants.length > 0 && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                      Total Stock: <span className="font-bold text-green-600">
                        {formData.variants.reduce((sum, v) => sum + (parseInt(v.stock_quantity || v.stockQuantity || 0) || 0), 0)}
                      </span> units
                    </p>
                  )}
                </div>
                <Button type="button" onClick={addVariant} size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Add Variant
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              {formData.variants.map((variant, index) => (
                <div key={variant.id} className="border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-sm sm:text-base truncate flex-1 min-w-0">
                      {variant.name || variant.variant_name || (variant.sku ? `Variant: ${variant.sku}` : `Variant ${index + 1}`)}
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariant(index)}
                      className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0"
                    >
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-4">
                    {/* Variant Name */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Variant Name *</Label>
                      <Input
                        value={variant.name ?? variant.variant_name ?? ""}
                        onChange={(e) => updateVariant(index, "name", e.target.value)}
                        placeholder="e.g., Red, Large, 256GB"
                        className="text-sm sm:text-base h-9 sm:h-10"
                        required
                      />
                    </div>

                    {/* Variant Image */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Variant Image (Optional)</Label>
                      <MediaUpload
                        type="image"
                        value={variant.image ?? ""}
                        onChange={(url) => updateVariant(index, "image", url)}
                        onRemove={() => updateVariant(index, "image", "")}
                        maxSize={10}
                        aspectRatio={1}
                        context="variant"
                        productId={product?.id}
                        label=""
                        description=""
                      />
                    </div>

                    {/* Variant Details Grid */}
                    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">SKU</Label>
                        <Input
                          value={variant.sku ?? ""}
                          onChange={(e) => updateVariant(index, "sku", e.target.value)}
                          placeholder="Variant SKU"
                          className="text-sm sm:text-base h-9 sm:h-10"
                        />
                      </div>
                      
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">Price (TZS)</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            value={variant.price ?? ""}
                            onChange={(e) => updateVariant(index, "price", parseFloat(e.target.value) || 0)}
                            placeholder="500"
                            className="pr-10 sm:pr-12 text-sm sm:text-base h-9 sm:h-10"
                          />
                          <div className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-[10px] sm:text-xs text-gray-500 pointer-events-none">
                            TZS
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label className="text-xs sm:text-sm">Stock Quantity</Label>
                        <Input
                          type="number"
                          min="0"
                          value={variant.stock_quantity ?? variant.stockQuantity ?? ""}
                          onChange={(e) => updateVariant(index, "stock_quantity", parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="text-sm sm:text-base h-9 sm:h-10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Attributes removed - simplified variant system */}
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
            onRemove={async () => {
              try {
                const currentUrl = formData.image || product?.image
                if (currentUrl) {
                  const fileName = (currentUrl.split('/').pop() || '').trim()
                  if (fileName) {
                  await fetch(`/api/media/delete?fileName=${encodeURIComponent(fileName)}&type=image&context=product${product?.id ? `&productId=${product.id}` : ''}`, {
                      method: 'DELETE'
                    })
                  }
                }
              } catch (e) {
                // Ignore delete failures; user can re-upload
              } finally {
                handleInputChange("image", "")
              }
            }}
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
                  body: JSON.stringify({ productId: product?.id, type: 'video', url: formData.video })
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
                  body: JSON.stringify({ productId: product?.id, type: 'model3d', url: formData.view360 })
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
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                    <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    Variant Images
                    {formData.variantImages.length > 0 && (
                      <span className="text-[10px] sm:text-xs bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                        {formData.variantImages.length} saved
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Upload images for specific product variants and attribute combinations
                  </p>
                </div>
                <Button 
                  type="button" 
                  onClick={() => setShowVariantImageDialog(true)} 
                  size="sm"
                  className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm w-full sm:w-auto justify-center"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  Add Variant Image
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              
              {formData.variantImages && formData.variantImages.length > 0 ? (
                <div className="space-y-3 sm:space-y-4 max-h-96 overflow-y-auto pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  {formData.variantImages.map((variantImg, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg">
                      {/* Image Preview Container - Left Side */}
                      <div className="flex-shrink-0 mx-auto sm:mx-0">
                        <div className="relative w-24 h-24 sm:w-32 sm:h-32 overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-50">
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
                      <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
                        {/* Variant Info */}
                        <div>
                          <h4 className="font-medium text-xs sm:text-sm">
                            Variant Image {index + 1}
                          </h4>
                          <div className="text-[10px] sm:text-xs text-gray-500 space-y-0.5 sm:space-y-1">
                            {variantImg.variantId && (
                              <p className="truncate">Variant ID: {variantImg.variantId}</p>
                            )}
                            {variantImg.attribute && (
                              <p className="truncate">Attribute: {variantImg.attribute.name}: {variantImg.attribute.value}</p>
                            )}
                            {variantImg.attributes && variantImg.attributes.length > 0 && (
                              <div>
                                <p className="text-[10px] sm:text-xs font-medium">Attributes:</p>
                                {variantImg.attributes.map((attr: any, attrIndex: number) => (
                                  <p key={attrIndex} className="text-[10px] sm:text-xs truncate">
                                    • {attr.name}: {attr.value || "any"}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {/* View Button */}
                    <Button
                      type="button"
                            variant="outline"
                      size="sm"
                            onClick={() => window.open(variantImg.imageUrl, '_blank')}
                            className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                          >
                            <Eye className="w-3 h-3 mr-0.5 sm:mr-1" />
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
                            className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                          >
                            <Link className="w-3 h-3 mr-0.5 sm:mr-1" />
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
                            className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                          >
                            <Link className="w-3 h-3 mr-0.5 sm:mr-1" />
                            URLs
                          </Button>

                          {/* Delete Button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => deleteVariantImage(index)}
                            className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3 mr-0.5 sm:mr-1" />
                            Delete
                    </Button>
                        </div>

                        {/* Status Info */}
                        <div className="text-[10px] sm:text-xs text-gray-500 flex flex-wrap items-center gap-1 sm:gap-2">
                          <Badge variant="secondary" className="text-[10px] sm:text-xs">
                            Variant Image
                          </Badge>
                          <span>Current file loaded</span>
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
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <CardTitle className="text-base sm:text-lg">Specifications</CardTitle>
                <Button type="button" onClick={addSpecification} size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Add Specification
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              {specificationFields.length === 0 && (
                <div className="text-center py-6 sm:py-8 text-muted-foreground">
                  <p className="text-sm sm:text-base">No specifications added yet.</p>
                  <p className="text-xs sm:text-sm mt-1">Click "Add Specification" to get started.</p>
                </div>
              )}
              
              {specificationFields.map((field) => (
                <div key={field.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border rounded-lg p-3 sm:p-4">
                  <Input
                    value={field.key ?? ""}
                    onChange={(e) => updateSpecificationField(field.id, 'key', e.target.value)}
                    placeholder="Specification key"
                    className="w-full sm:w-1/3 text-sm sm:text-base"
                  />
                  <Input
                    value={field.value ?? ""}
                    onChange={(e) => updateSpecificationField(field.id, 'value', e.target.value)}
                    placeholder="Specification value"
                    className="flex-1 text-sm sm:text-base"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSpecificationField(field.id)}
                    className="text-red-500 hover:text-red-700 h-8 sm:h-10 w-full sm:w-auto"
                  >
                    <X className="h-4 w-4 mr-1 sm:mr-0" />
                    <span className="sm:hidden">Remove</span>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Specification Images - Separate Section */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                  <CardTitle className="text-base sm:text-lg">Specification Images</CardTitle>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Upload images to illustrate product specifications
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs sm:text-sm">Add Specification Image</Label>
                  <span className="text-xs text-gray-500">
                    {formData.specificationImages?.length || 0} / 3 images
                  </span>
                </div>
                {formData.specificationImages && formData.specificationImages.length >= 3 ? (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
                      Maximum 3 specification images allowed. Remove an image to add a new one.
                    </p>
                  </div>
                ) : (
                  <MediaUpload
                    type="image"
                    value=""
                    onChange={(url) => {
                      // Add to specification_images array (max 3)
                      setFormData(prev => {
                        const currentImages = prev.specificationImages || []
                        if (currentImages.length >= 3) {
                          return prev // Don't add if limit reached
                        }
                        return {
                          ...prev,
                          specificationImages: [...currentImages, url]
                        }
                      })
                    }}
                    onRemove={() => {}}
                    maxSize={10}
                    aspectRatio={1}
                    context="product"
                    productId={product?.id}
                    label=""
                    description=""
                  />
                )}
              </div>
              
              {formData.specificationImages && formData.specificationImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {formData.specificationImages.map((imageUrl, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={imageUrl} 
                        alt={`Specification ${index + 1}`}
                        className="w-full h-32 sm:h-40 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            specificationImages: prev.specificationImages?.filter((_, i) => i !== index) || []
                          }))
                        }}
                        className="absolute top-2 right-2 h-6 w-6 p-0 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto text-sm sm:text-base order-2 sm:order-1">
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting}
          className={cn(
            isSuccess ? "bg-green-600 hover:bg-green-700" : "",
            "w-full sm:w-auto text-sm sm:text-base order-1 sm:order-2"
          )}
        >
          {isSubmitting ? "Saving..." : isSuccess ? "✅ Updated!" : (product ? "Update Product" : "Create Product")}
        </Button>
      </div>
    </form>




    {/* Variant Image Dialog */}
    <Dialog open={showVariantImageDialog} onOpenChange={setShowVariantImageDialog}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-base sm:text-lg">Add Variant Image</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Upload an image for a product variant. The image will be automatically added to your product when uploaded. You can optionally assign it to specific attributes, or leave it unassigned to apply to the entire variant.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 sm:space-y-6 pr-1 sm:pr-2">
          {/* Variant Selection */}
          {!restrictVariantType && (
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">Select Variant (Optional)</Label>
              <Select
                value={selectedVariantForImage?.toString() || "none"}
                onValueChange={(value) => {
                  setSelectedVariantForImage(value === "none" ? null : Number(value))
                  // Attributes removed
                }}
              >
                <SelectTrigger className="text-sm sm:text-base h-9 sm:h-10">
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
          )}

          {/* Attributes removed - simplified variant system */}

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
              // Attributes removed
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