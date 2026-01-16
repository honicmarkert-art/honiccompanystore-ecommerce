'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ProductForm } from '@/app/siem-dashboard/products/product-form'
import { useTheme } from '@/hooks/use-theme'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SupplierEditProductPage() {
  return <SupplierEditProductContent />
}

function SupplierEditProductContent() {
  const { themeClasses } = useTheme()
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [productKey, setProductKey] = useState(0) // Key to force form re-render when product updates

  useEffect(() => {
    if (productId) {
      fetchProduct()
    }
  }, [productId])

  const fetchProduct = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
      }
      const response = await fetch(`/api/supplier/products/${productId}`, {
        credentials: 'include'
      })
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        if (text.includes('<!DOCTYPE')) {
          throw new Error('Server returned HTML instead of JSON. The API endpoint may be misconfigured.')
        }
        throw new Error('Invalid response format from server')
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch product: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()


      if (data.success && data.product) {
        // Transform product data to match form format
        // Form expects numbers for originalPrice/stockQuantity (it converts to string internally)
        const transformedProduct = {
          ...data.product,
          // Use camelCase from API if available, otherwise fallback to snake_case
          // Keep as numbers (form will convert to strings internally)
          originalPrice: (data.product.originalPrice !== null && data.product.originalPrice !== undefined)
            ? Number(data.product.originalPrice)
            : (data.product.original_price !== null && data.product.original_price !== undefined 
              ? Number(data.product.original_price)
              : null),
          stockQuantity: (data.product.stockQuantity !== null && data.product.stockQuantity !== undefined)
            ? Number(data.product.stockQuantity)
            : (data.product.stock_quantity !== null && data.product.stock_quantity !== undefined 
              ? Number(data.product.stock_quantity)
              : null),
          inStock: data.product.inStock !== undefined ? data.product.inStock : (data.product.in_stock !== undefined ? data.product.in_stock : true),
          view360: data.product.view360 || data.product.view_360 || '',
          importChina: data.product.importChina !== undefined ? data.product.importChina : (data.product.import_china || false),
          // Ensure variants use simplified structure for suppliers
          variants: (data.product.variants || []).map((variant: any) => ({
            id: variant.id,
            variant_name: variant.variant_name || '',
            price: variant.price || 0,
            stock_quantity: variant.stock_quantity || variant.stockQuantity || 0,
            stockQuantity: variant.stock_quantity || variant.stockQuantity || 0
          }))
        }
        
        
        setProduct(transformedProduct)
      } else {
        toast({
          title: 'Error',
          description: 'Failed',
          variant: 'destructive'
        })
        router.push('/supplier/products')
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to load product'
      toast({
        title: 'Error',
        description: 'Failed',
        variant: 'destructive'
      })
      router.push('/supplier/products')
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

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


      const response = await fetch(`/api/supplier/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(supplierProductData)
      })

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        if (text.includes('<!DOCTYPE')) {
          throw new Error('Server returned HTML instead of JSON. The API endpoint may be misconfigured.')
        }
        throw new Error('Invalid response format from server')
      }

      const result = await response.json()


      if (result.success) {
        toast({
          title: 'Success',
          description: 'Product updated successfully!',
        })
        
        // Update local product state with saved data (no page refresh/navigation)
        // Transform the response to match form format - form expects numbers, not strings
        if (result.product) {
          const updatedProduct = {
            ...result.product,
            // Use camelCase from API if available, otherwise fallback to snake_case
            // Keep as numbers (form converts to strings internally)
            originalPrice: (result.product.originalPrice !== null && result.product.originalPrice !== undefined)
              ? Number(result.product.originalPrice)
              : (result.product.original_price !== null && result.product.original_price !== undefined 
                ? Number(result.product.original_price)
                : null),
            stockQuantity: (result.product.stockQuantity !== null && result.product.stockQuantity !== undefined)
              ? Number(result.product.stockQuantity)
              : (result.product.stock_quantity !== null && result.product.stock_quantity !== undefined 
                ? Number(result.product.stock_quantity)
                : null),
            inStock: result.product.inStock !== undefined ? result.product.inStock : (result.product.in_stock !== undefined ? result.product.in_stock : true),
            view360: result.product.view360 || result.product.view_360 || '',
            importChina: result.product.importChina !== undefined ? result.product.importChina : (result.product.import_china || false),
            variants: (result.product.variants || result.product.product_variants || []).map((variant: any) => ({
              id: variant.id,
              variant_name: variant.variant_name || '',
              price: variant.price || 0,
              stock_quantity: variant.stock_quantity || variant.stockQuantity || 0,
              stockQuantity: variant.stock_quantity || variant.stockQuantity || 0
            }))
          }
          
          
          // Update state - form's useEffect will detect the change and update smoothly
          setProduct(updatedProduct)
        }
        
        // Return product with camelCase fields for form's internal update
        const transformedForForm = result.product ? {
          ...result.product,
          originalPrice: (result.product.originalPrice !== null && result.product.originalPrice !== undefined)
            ? Number(result.product.originalPrice)
            : (result.product.original_price !== null && result.product.original_price !== undefined 
              ? Number(result.product.original_price)
              : null),
          stockQuantity: (result.product.stockQuantity !== null && result.product.stockQuantity !== undefined)
            ? Number(result.product.stockQuantity)
            : (result.product.stock_quantity !== null && result.product.stock_quantity !== undefined 
              ? Number(result.product.stock_quantity)
              : null),
          inStock: result.product.inStock !== undefined ? result.product.inStock : (result.product.in_stock !== undefined ? result.product.in_stock : true),
          view360: result.product.view360 || result.product.view_360 || null,
          importChina: result.product.importChina !== undefined ? result.product.importChina : (result.product.import_china || false)
        } : result.product
        
        // Don't navigate away - stay on edit page
        return transformedForForm
      } else {
        throw new Error(result.error || 'Failed to update product')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update product'
      toast({
        title: 'Error',
        description: 'Failed',
        variant: 'destructive'
      })
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", themeClasses.mainBg)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className={cn("mt-4", themeClasses.mainText)}>Loading product...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return null
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
          <h1 className={cn("text-3xl font-bold mb-2", themeClasses.mainText)}>
            Edit Product
          </h1>
          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
            Update your product information
          </p>
        </div>

        {/* Product Form */}
        <div className={cn("border-2 rounded-lg p-6", themeClasses.cardBg, themeClasses.cardBorder)}>
          {product && (
            <ProductForm
              key={`product-${productId}`}
              product={product}
              onClose={() => router.push('/supplier/products')}
              onSave={handleSave}
              autoCloseOnSave={false}
              hideImportChina={true}
              restrictVariantType={true}
              hideAttributesAndVariants={true}
            />
          )}
        </div>
    </>
  )
}

