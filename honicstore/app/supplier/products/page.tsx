'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/hooks/use-theme'
import { useCurrency } from '@/contexts/currency-context'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { Plus, Search, Edit, Trash2, Package, DollarSign, Star, Eye, MoreHorizontal, Filter, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import Image from 'next/image'
import { ProductForm } from './product-form'

interface Product {
  id: number
  name: string
  description: string
  price: number
  original_price: number | null
  image: string
  category: string
  brand: string
  in_stock: boolean
  stock_quantity: number | null
  rating: number
  reviews: number
  sku: string
  views?: number
  variants?: any[]
  created_at: string
  updated_at: string
}

export default function SupplierProductsPage() {
  return <SupplierProductsContent />
}

function SupplierProductsContent() {
  const { themeClasses } = useTheme()
  const { formatPrice } = useCurrency()
  const { toast } = useToast()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBrand, setSelectedBrand] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [currentPlan, setCurrentPlan] = useState<{ slug: string; max_products: number | null } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    fetchProducts()
    fetchCurrentPlan()
  }, [])

  const fetchCurrentPlan = async () => {
    try {
      const response = await fetch('/api/user/current-plan', {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error(getFriendlyErrorMessage(response.status, 'Unable to load plan. Please try again.'))
      }
      const data = await response.json().catch(async (error) => {
        const text = await response.text()
        if (text.includes('<!DOCTYPE')) {
          throw new Error(getFriendlyErrorMessage(text, 'Something went wrong. Please try again.'))
        }
        throw error
      })
      if (data.success && data.plan) {
        // Fetch plan details with max_products
        const plansResponse = await fetch('/api/supplier-plans')
        if (!plansResponse.ok) {
          throw new Error(getFriendlyErrorMessage(plansResponse.status, 'Unable to load plans. Please try again.'))
        }
        const plansData = await plansResponse.json().catch(async (error) => {
          const text = await plansResponse.text()
          if (text.includes('<!DOCTYPE')) {
            throw new Error(getFriendlyErrorMessage(text, 'Something went wrong. Please try again.'))
          }
          throw error
        })
        if (plansData.success && plansData.plans) {
          const planDetails = plansData.plans.find((p: any) => p.slug === data.plan.slug)
          if (planDetails) {
            setCurrentPlan({
              slug: planDetails.slug,
              max_products: planDetails.max_products
            })
          }
        }
      }
    } catch (error) {
      }
  }

  // Security: Debounce function to prevent excessive API calls
  const fetchTimeoutRef = useRef<NodeJS.Timeout>()
  
  const fetchProducts = useCallback(async (showLoading = true) => {
    // Clear any pending fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }
    
    // For initial load, execute immediately; for refreshes, debounce
    const executeFetch = async () => {
      try {
        if (showLoading) {
          setLoading(true)
        }
        const response = await fetch('/api/supplier/products?limit=1000', {
          credentials: 'include'
        })
        if (!response.ok) {
          throw new Error(getFriendlyErrorMessage(response.status, 'Unable to load products. Please try again.'))
        }
        const data = await response.json().catch(async (error) => {
          const text = await response.text()
          if (text.includes('<!DOCTYPE')) {
            throw new Error(getFriendlyErrorMessage(text, 'Something went wrong. Please try again.'))
          }
          throw error
        })
        
        if (data.success) {
          setProducts(data.products || [])
        } else {
          toast({
            title: 'Error',
            description: 'Something went wrong. Please try again.',
            variant: 'destructive'
          })
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: getFriendlyErrorMessage(error, 'Unable to load products. Please try again.'),
          variant: 'destructive'
        })
      } finally {
        if (showLoading) {
          setLoading(false)
        }
      }
    }
    
    // Debounce non-loading calls (like refresh)
    if (!showLoading) {
      fetchTimeoutRef.current = setTimeout(executeFetch, 300)
    } else {
      await executeFetch()
    }
  }, [toast])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        fetchProducts(false),
        fetchCurrentPlan()
      ])
      toast({
        title: 'Success',
        description: 'Products refreshed successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh products',
        variant: 'destructive'
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const fetchProductDetails = async (id: number) => {
    try {
      const response = await fetch(`/api/supplier/products/${id}`, {
        credentials: 'include'
      })
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        if (text.includes('<!DOCTYPE')) {
          return null
        }
        return null
      }
      
      if (!response.ok) {
        return null
      }
      
      const data = await response.json()
      if (data.success && data.product) {
        return data.product
      }
      return null
    } catch (error) {
      return null
    }
  }

  const handleEditProduct = async (product: Product) => {
    try {
      const refreshedProduct = await fetchProductDetails(product.id)
      // Transform product to ensure variants use simplified structure for suppliers
      const transformedProduct = refreshedProduct || product
      if (transformedProduct && transformedProduct.variants) {
        transformedProduct.variants = transformedProduct.variants.map((variant: any) => ({
          id: variant.id,
          variant_name: variant.variant_name || '',
          price: variant.price || 0,
          stock_quantity: variant.stock_quantity || variant.stockQuantity || 0,
          stockQuantity: variant.stock_quantity || variant.stockQuantity || 0
        }))
      }
      setEditingProduct(transformedProduct)
      setIsAddDialogOpen(true)
    } catch (error) {
      // Transform product even on error
      const transformedProduct = { ...product }
      if (transformedProduct.variants) {
        transformedProduct.variants = transformedProduct.variants.map((variant: any) => ({
          id: variant.id,
          variant_name: variant.variant_name || '',
          price: variant.price || 0,
          stock_quantity: variant.stock_quantity || variant.stockQuantity || 0,
          stockQuantity: variant.stock_quantity || variant.stockQuantity || 0
        }))
      }
      setEditingProduct(transformedProduct)
      setIsAddDialogOpen(true)
    }
  }

  const handleDeleteProduct = async (productId: number) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return
    }

    try {
      setDeletingId(productId)
      const response = await fetch(`/api/supplier/products/${productId}`, {
        method: 'DELETE',
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
      
      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Product deleted successfully'
        })
        fetchProducts()
      } else {
        toast({
          title: 'Error',
          description: 'Failed',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed',
        variant: 'destructive'
      })
    } finally {
      setDeletingId(null)
    }
  }

  const brands = useMemo(() => {
    const brs = new Set(products.map(p => p.brand).filter(Boolean))
    return Array.from(brs).sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesBrand = selectedBrand === 'all' || product.brand === selectedBrand
      return matchesSearch && matchesBrand
    })
  }, [products, searchTerm, selectedBrand])

  const stats = {
    totalProducts: products.length,
    activeProducts: products.filter(p => p.price > 0).length,
    totalViews: products.reduce((sum, p) => sum + (p.views || 0), 0),
    avgRating: products.length > 0 ? (products.reduce((sum, p) => sum + (p.rating || 0), 0) / products.length).toFixed(1) : '0.0',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className={cn("text-lg", themeClasses.mainText)}>Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-x-hidden px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className={cn("text-2xl sm:text-3xl font-bold", themeClasses.mainText)}>Products</h1>
          <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
            Manage your product catalog and inventory
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          {/* Product Count Display and Refresh Button - In one row on mobile */}
          <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
            {currentPlan && (
              <div className={cn("text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-md border flex-1 sm:flex-initial text-center sm:text-left", themeClasses.cardBorder, themeClasses.cardBg)}>
                <div className={cn("flex flex-col gap-0.5", themeClasses.textNeutralSecondary)}>
                  <span>
                    Products limit: <span className={cn("font-semibold", 
                      currentPlan.max_products === null 
                        ? "text-green-600 dark:text-green-400" 
                        : themeClasses.mainText
                    )}>
                      {currentPlan.max_products === null ? 'Unlimited' : currentPlan.max_products}
                    </span>
                  </span>
                  <span>
                    Current product: <span className={cn("font-semibold", themeClasses.mainText)}>{products.length}</span>
                  </span>
                </div>
              </div>
            )}
            {/* Refresh Button */}
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="flex items-center gap-2 text-sm sm:text-base flex-shrink-0 justify-center h-auto py-1.5 px-3"
              title="Refresh products"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <Button 
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-neutral-950 text-sm sm:text-base w-full sm:w-auto justify-center"
              onClick={() => {
                setEditingProduct(null)
                setIsAddDialogOpen(true)
              }}
              disabled={currentPlan ? (currentPlan.max_products !== null && currentPlan.max_products !== undefined && products.length >= currentPlan.max_products) : false}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Product</span>
              <span className="sm:hidden">Add</span>
            </Button>
            <DialogContent className={cn("max-w-[calc(100vw-1rem)] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-xl bg-white dark:bg-neutral-900", themeClasses.cardBorder)}>
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-base sm:text-lg">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </DialogTitle>
              </DialogHeader>
              <ProductForm 
                key={editingProduct?.id || 'new'}
                product={editingProduct}
                autoCloseOnSave={false}
                hideImportChina={true}
                restrictVariantType={true}
                onClose={() => {
                  setIsAddDialogOpen(false)
                  setEditingProduct(null)
                }}
                onSave={async (productData) => {
                  try {
                    // OPTIMISTIC UI CHECK: This provides immediate feedback but is NOT a security measure.
                    // The server enforces the actual limit. Users cannot bypass this by modifying client-side code.
                    // This check is for UX only - the API will reject requests that exceed limits.
                    const productCount = products.length
                    const planSlug = currentPlan?.slug
                    const maxProducts = currentPlan?.max_products
                    
                    // Only check limit if plan has a limit (not Premium with unlimited)
                    // Premium plan with max_products = null means unlimited
                    if (maxProducts !== null && maxProducts !== undefined && !editingProduct && productCount >= maxProducts) {
                      let planName = 'your plan'
                      if (planSlug === 'free') planName = 'Free Plan'
                      else if (planSlug === 'winga') planName = 'Winga Plan'
                      else if (planSlug === 'premium') planName = 'Premium Plan'
                      else planName = 'your plan'
                      
                      toast({
                        title: 'Product Limit Reached',
                        description: `You have reached the limit of ${maxProducts} products for the ${planName}. Upgrade to Premium for unlimited products.`,
                        variant: 'destructive',
                        action: (
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                // Fetch premium plan
                                const plansResponse = await fetch('/api/supplier-plans', {
                                  credentials: 'include'
                                })
                                const plansData = await plansResponse.json()
                                
                                if (!plansData.success || !plansData.plans) {
                                  throw new Error('Failed to fetch plans')
                                }
                                
                                const premiumPlan = plansData.plans.find((p: any) => p.slug === 'premium')
                                if (!premiumPlan) {
                                  throw new Error('Premium plan not found')
                                }
                                
                                // Initiate upgrade to get referenceId
                                const initiateResponse = await fetch('/api/supplier/upgrade/initiate', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  credentials: 'include',
                                  body: JSON.stringify({
                                    planId: premiumPlan.id,
                                    amount: premiumPlan.price
                                  })
                                })
                                
                                // Check response status before parsing JSON
                                if (!initiateResponse.ok) {
                                  if (initiateResponse.status === 401) {
                                    throw new Error('Your session has expired. Please refresh the page and try again.')
                                  }
                                  const errorData = await initiateResponse.json().catch(() => ({ error: 'Failed to initiate upgrade' }))
                                  throw new Error(getFriendlyErrorMessage(errorData.error || initiateResponse.status, 'Something went wrong. Please try again.'))
                                }
                                
                                const initiateData = await initiateResponse.json()
                                
                                if (!initiateData.success || !initiateData.upgrade) {
                                  throw new Error(initiateData.error || 'Failed to initiate upgrade')
                                }
                                
                                const { referenceId } = initiateData.upgrade
                                
                                // Redirect to payment page
                                window.location.href = `/supplier/payment?planId=${premiumPlan.id}&referenceId=${referenceId}`
                              } catch (error: any) {
                                toast({
                                  title: 'Error',
                                  description: getFriendlyErrorMessage(error, 'Something went wrong. Please try again.'),
                                  variant: 'destructive'
                                })
                              }
                            }}
                          >
                            Upgrade Now
                          </Button>
                        )
                      })
                      return
                    }
                    if (editingProduct) {
                      const response = await fetch(`/api/supplier/products/${editingProduct.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(productData)
                      })
                      const result = await response.json()
                      if (result.success) {
                        toast({ title: 'Product updated successfully' })
                        await fetchProducts()
                        
                        // Update the editing product with the latest data from server
                        if (result.product) {
                          const updatedProduct = result.product
                          // Transform product to match expected format
                          if (updatedProduct.variants) {
                            updatedProduct.variants = updatedProduct.variants.map((variant: any) => ({
                              ...variant,
                              stockQuantity: variant.stock_quantity || variant.stockQuantity || 0,
                              stock_quantity: variant.stock_quantity || variant.stockQuantity || 0
                            }))
                          }
                          setEditingProduct(updatedProduct)
                        }
                        // Don't close dialog - keep form open for further edits
                        // setIsAddDialogOpen(false)
                        // setEditingProduct(null)
                      } else {
                        throw new Error(result.error || 'Failed to update product')
                      }
                    } else {
                      const response = await fetch('/api/supplier/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(productData)
                      })
                      const result = await response.json()
                      if (result.success) {
                        toast({ title: 'Product created successfully' })
                        await fetchProducts()
                        await fetchCurrentPlan() // Refresh plan info
                        
                        // Load the newly created product into the form for further editing
                        if (result.product) {
                          const newProduct = result.product
                          // Transform product to match expected format
                          if (newProduct.variants) {
                            newProduct.variants = newProduct.variants.map((variant: any) => ({
                              ...variant,
                              stockQuantity: variant.stock_quantity || variant.stockQuantity || 0,
                              stock_quantity: variant.stock_quantity || variant.stockQuantity || 0
                            }))
                          }
                          setEditingProduct(newProduct)
                        }
                        // Don't close dialog - keep form open for further edits
                        // setIsAddDialogOpen(false)
                      } else {
                        // Handle product limit error
                        if (result.maxProducts !== undefined) {
                          toast({
                            title: 'Product Limit Reached',
                            description: result.error || `You have reached the limit of ${result.maxProducts} products. Upgrade to Premium for unlimited products.`,
                            variant: 'destructive',
                            action: (
                              <Button
                                size="sm"
                                onClick={async () => {
                                  try {
                                    // Fetch premium plan
                                    const plansResponse = await fetch('/api/supplier-plans', {
                                      credentials: 'include'
                                    })
                                    const plansData = await plansResponse.json()
                                    
                                    if (!plansData.success || !plansData.plans) {
                                      throw new Error('Failed to fetch plans')
                                    }
                                    
                                    const premiumPlan = plansData.plans.find((p: any) => p.slug === 'premium')
                                    if (!premiumPlan) {
                                      throw new Error('Premium plan not found')
                                    }
                                    
                                    // Initiate upgrade to get referenceId
                                    const initiateResponse = await fetch('/api/supplier/upgrade/initiate', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      credentials: 'include',
                                      body: JSON.stringify({
                                        planId: premiumPlan.id,
                                        amount: premiumPlan.price
                                      })
                                    })
                                    
                                    const initiateData = await initiateResponse.json()
                                    
                                    if (!initiateData.success || !initiateData.upgrade) {
                                      throw new Error(initiateData.error || 'Failed to initiate upgrade')
                                    }
                                    
                                    const { referenceId } = initiateData.upgrade
                                    
                                    // Redirect to payment page
                                    window.location.href = `/supplier/payment?planId=${premiumPlan.id}&referenceId=${referenceId}`
                                  } catch (error: any) {
                                    toast({
                                      title: 'Error',
                                      description: getFriendlyErrorMessage(error, 'Something went wrong. Please try again.'),
                                      variant: 'destructive'
                                    })
                                  }
                                }}
                              >
                                Upgrade Now
                              </Button>
                            )
                          })
                          return
                        }
                        throw new Error(result.error || 'Failed to create product')
                      }
                    }
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: getFriendlyErrorMessage(error, 'Something went wrong. Please try again.'),
                      variant: 'destructive'
                    })
                    throw error
                  }
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 w-full">
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder, "w-full overflow-hidden")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className={cn("text-xs sm:text-sm font-medium truncate flex-1", themeClasses.textNeutralSecondary)}>
              Total Products
            </CardTitle>
            <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0 ml-2" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{stats.totalProducts}</div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder, "w-full overflow-hidden")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className={cn("text-xs sm:text-sm font-medium truncate", themeClasses.textNeutralSecondary)}>
              Active Products
            </CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0 ml-2" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{stats.activeProducts}</div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder, "w-full overflow-hidden")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className={cn("text-xs sm:text-sm font-medium truncate", themeClasses.textNeutralSecondary)}>
              Total Views
            </CardTitle>
            <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0 ml-2" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{stats.totalViews.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder, "w-full overflow-hidden")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className={cn("text-xs sm:text-sm font-medium truncate flex-1", themeClasses.textNeutralSecondary)}>
              Avg Rating
            </CardTitle>
            <Star className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0 ml-2" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{stats.avgRating}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className={cn("text-base sm:text-lg", themeClasses.mainText)}>Filters</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className={cn("text-xs sm:text-sm font-medium", themeClasses.mainText)}>Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3 w-3 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 sm:pl-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={cn("text-xs sm:text-sm font-medium", themeClasses.mainText)}>Brand</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-xs sm:text-sm",
                  themeClasses.cardBg,
                  themeClasses.borderNeutralSecondary,
                  themeClasses.mainText
                )}
                suppressHydrationWarning
              >
                <option value="all">All Brands</option>
                {brands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className={cn("text-xs sm:text-sm font-medium", themeClasses.mainText)}>Actions</label>
              <Button variant="outline" className="w-full text-xs sm:text-sm">
                <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table - Desktop / Mobile Cards */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className={cn("text-base sm:text-lg", themeClasses.mainText)}>
            Products ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center">
              <div className={cn("text-center", themeClasses.textNeutralSecondary)}>
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold mb-2">No products found</p>
                <p className="text-sm">
                  {searchTerm || selectedBrand !== 'all' 
                    ? 'Try adjusting your filters' 
                    : 'Get started by adding your first product'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block sm:hidden">
                <div className="space-y-3 p-3 sm:p-4">
                  {filteredProducts.map((product, idx) => (
                    <div 
                      key={product.id} 
                      className={cn(
                        "border rounded-lg p-3 sm:p-4 space-y-3 w-full",
                        "overflow-hidden",
                        themeClasses.cardBorder, 
                        themeClasses.cardBg
                      )}
                      style={{ marginBottom: '0.75rem' }}
                    >
                      <div className="flex items-start gap-3 w-full">
                        {/* Product Image - Responsive */}
                        <div className="flex-shrink-0">
                          {product.image ? (
                            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-md overflow-hidden bg-gray-100">
                              <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="(max-width: 640px) 64px, 80px"
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center flex-shrink-0">
                              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                        
                        {/* Product Info - Flexible */}
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                          <p className={cn("font-medium text-sm sm:text-base leading-tight line-clamp-2", themeClasses.mainText)}>
                            {product.name}
                          </p>
                          <p className={cn("text-xs sm:text-sm truncate", themeClasses.textNeutralSecondary)}>
                            SKU: {product.sku || 'N/A'}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("font-semibold text-sm sm:text-base", themeClasses.mainText)}>
                              {formatPrice(product.price)}
                            </span>
                            {product.original_price && product.original_price > product.price && (
                              <span className={cn("text-xs sm:text-sm line-through", themeClasses.textNeutralSecondary)}>
                                {formatPrice(product.original_price)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Actions Menu */}
                        <div className="flex-shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
                                <MoreHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                              <DropdownMenuItem
                                onClick={() => handleEditProduct(product)}
                                className={themeClasses.buttonGhostHoverBg}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteProduct(product.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      {/* Footer Info */}
                      <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t" style={{ borderColor: 'inherit', opacity: 0.3 }}>
                        <span className={cn("truncate flex-1", themeClasses.textNeutralSecondary)}>
                          {product.category}
                        </span>
                        <span className={cn("ml-2 flex-shrink-0", themeClasses.textNeutralSecondary)}>
                          Views: {(product.views || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto max-w-full">
                <table className="w-full">
                  <thead>
                    <tr className={cn("border-b", themeClasses.cardBorder)}>
                      <th className={cn("text-left py-2 sm:py-3 px-2 sm:px-4 font-medium w-8 sm:w-12 text-xs sm:text-sm", themeClasses.mainText)}>No.</th>
                      <th className={cn("text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm w-32 sm:w-48", themeClasses.mainText)}>Product</th>
                      <th className={cn("hidden sm:table-cell text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Category</th>
                      <th className={cn("hidden md:table-cell text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Brand</th>
                      <th className={cn("text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Price</th>
                      <th className={cn("hidden lg:table-cell text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Variants</th>
                      <th className={cn("hidden md:table-cell text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Views</th>
                      <th className={cn("text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product, idx) => (
                      <tr key={product.id} className={cn("border-b", themeClasses.cardBorder)}>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 align-top text-xs sm:text-sm">{idx + 1}</td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 w-32 sm:w-48">
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            {product.image ? (
                              <Image
                                src={product.image}
                                alt={product.name}
                                width={32}
                                height={32}
                                className="rounded-md object-cover w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-200 rounded-md flex items-center justify-center flex-shrink-0">
                                <Package className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <p className={cn("font-medium text-xs truncate", themeClasses.mainText)}>
                                {product.name}
                              </p>
                              <p className={cn("text-[9px] sm:text-[10px] truncate", themeClasses.textNeutralSecondary)}>
                                SKU: {product.sku}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell py-2 sm:py-3 px-2 sm:px-4">
                          <span className={cn("text-xs sm:text-sm", themeClasses.mainText)}>{product.category}</span>
                        </td>
                        <td className="hidden md:table-cell py-2 sm:py-3 px-2 sm:px-4">
                          <span className={cn("text-xs sm:text-sm", themeClasses.mainText)}>{product.brand}</span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <span className={cn("font-medium text-xs sm:text-sm", themeClasses.mainText)}>
                            {formatPrice(product.price)}
                          </span>
                          {product.original_price && product.original_price > product.price && (
                            <span className={cn("text-[10px] sm:text-xs line-through ml-1 block sm:inline", themeClasses.textNeutralSecondary)}>
                              {formatPrice(product.original_price)}
                            </span>
                          )}
                        </td>
                        <td className="hidden lg:table-cell py-2 sm:py-3 px-2 sm:px-4">
                          <span className={cn("text-xs sm:text-sm", themeClasses.mainText)}>
                            {(() => {
                              // Count only valid variants (those with id and variant_name or sku)
                              if (!product.variants || !Array.isArray(product.variants)) {
                                return 0
                              }
                              return product.variants.filter((v: any) => 
                                v && v.id && (v.variant_name || v.sku)
                              ).length
                            })()}
                          </span>
                        </td>
                        <td className="hidden md:table-cell py-2 sm:py-3 px-2 sm:px-4">
                          <span className={cn("text-xs sm:text-sm", themeClasses.mainText)}>
                            {(product.views || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                              <DropdownMenuItem
                                onClick={() => handleEditProduct(product)}
                                className={themeClasses.buttonGhostHoverBg}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteProduct(product.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
