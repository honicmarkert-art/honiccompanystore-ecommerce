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

  useEffect(() => {
    if (productId) {
      fetchProduct()
    }
  }, [productId])

  const fetchProduct = async () => {
    try {
      setLoading(true)
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
        const transformedProduct = {
          ...data.product,
          originalPrice: data.product.original_price,
          inStock: data.product.in_stock,
          stockQuantity: data.product.stock_quantity,
          view360: data.product.view_360,
          importChina: data.product.import_china,
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
          description: data.error || 'Product not found',
          variant: 'destructive'
        })
        router.push('/supplier/products')
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to load product'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      router.push('/supplier/products')
    } finally {
      setLoading(false)
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
        router.push('/supplier/products')
        return result.product
      } else {
        throw new Error(result.error || 'Failed to update product')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update product'
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
          <ProductForm
            product={product}
            onClose={() => router.push('/supplier/products')}
            onSave={handleSave}
            autoCloseOnSave={false}
            hideImportChina={true}
            restrictVariantType={true}
            hideAttributesAndVariants={true}
          />
        </div>
    </>
  )
}

