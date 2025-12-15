'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/hooks/use-theme'
import { useCurrency } from '@/contexts/currency-context'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
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
import { ProductForm } from '@/app/siem-dashboard/products/product-form'

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
        throw new Error(`Failed to fetch plan: ${response.status}`)
      }
      const data = await response.json().catch(async (error) => {
        const text = await response.text()
        if (text.includes('<!DOCTYPE')) {
          throw new Error('Server returned HTML instead of JSON. The API endpoint may be misconfigured.')
        }
        throw error
      })
      if (data.success && data.plan) {
        // Fetch plan details with max_products
        const plansResponse = await fetch('/api/supplier-plans')
        if (!plansResponse.ok) {
          throw new Error(`Failed to fetch plans: ${plansResponse.status}`)
        }
        const plansData = await plansResponse.json().catch(async (error) => {
          const text = await plansResponse.text()
          if (text.includes('<!DOCTYPE')) {
            throw new Error('Server returned HTML instead of JSON. The API endpoint may be misconfigured.')
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
      console.error('Error fetching current plan:', error)
    }
  }

  const fetchProducts = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true)
      }
      const response = await fetch('/api/supplier/products?limit=1000', {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`)
      }
      const data = await response.json().catch(async (error) => {
        const text = await response.text()
        if (text.includes('<!DOCTYPE')) {
          throw new Error('Server returned HTML instead of JSON. The API endpoint may be misconfigured.')
        }
        throw error
      })
      
      if (data.success) {
        setProducts(data.products || [])
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch products',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch products',
        variant: 'destructive'
      })
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

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
      const data = await response.json()
      if (data.success && data.product) {
        return data.product
      }
      return null
    } catch (error) {
      console.error('Error fetching product details:', error)
      return null
    }
  }

  const handleEditProduct = async (product: Product) => {
    try {
      const refreshedProduct = await fetchProductDetails(product.id)
      setEditingProduct(refreshedProduct || product)
      setIsAddDialogOpen(true)
    } catch (error) {
      setEditingProduct(product)
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
          description: data.error || 'Failed to delete product',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete product',
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className={cn("text-2xl sm:text-3xl font-bold", themeClasses.mainText)}>Products</h1>
          <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
            Manage your product catalog and inventory
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          {/* Product Count Display */}
          {currentPlan && (
            <div className={cn("text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-md border text-center sm:text-left", themeClasses.cardBorder, themeClasses.cardBg)}>
              <span className={cn(themeClasses.textNeutralSecondary)}>
                Products limit: <span className={cn("font-semibold", themeClasses.mainText)}>{products.length}</span>
                {currentPlan.max_products !== null && (
                  <>
                    {' / '}
                    <span className={cn("font-semibold", 
                      products.length >= currentPlan.max_products 
                        ? "text-red-600 dark:text-red-400" 
                        : products.length >= currentPlan.max_products * 0.8
                        ? "text-yellow-600 dark:text-yellow-400"
                        : themeClasses.mainText
                    )}>
                      {currentPlan.max_products}
                    </span>
                  </>
                )}
                {currentPlan.max_products === null && (
                  <span className={cn("ml-1 text-green-600 dark:text-green-400")}>Unlimited</span>
                )}
              </span>
            </div>
          )}
          {/* Refresh Button */}
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="flex items-center gap-2 text-sm sm:text-base w-full sm:w-auto justify-center"
            title="Refresh products"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
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
            <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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
                    // Check product limit before saving (for all plans)
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
                                  throw new Error(errorData.error || `Server error: ${initiateResponse.status}`)
                                }
                                
                                const initiateData = await initiateResponse.json()
                                
                                if (!initiateData.success || !initiateData.upgrade) {
                                  throw new Error(initiateData.error || 'Failed to initiate upgrade')
                                }
                                
                                const { referenceId } = initiateData.upgrade
                                
                                // Redirect to payment page
                                window.location.href = `/supplier/payment?planId=${premiumPlan.id}&referenceId=${referenceId}`
                              } catch (error: any) {
                                console.error('Error initiating upgrade:', error)
                                toast({
                                  title: 'Error',
                                  description: error.message || 'Failed to initiate upgrade. Please try again.',
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
                        setIsAddDialogOpen(false)
                        setEditingProduct(null)
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
                        setIsAddDialogOpen(false)
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
                                    console.error('Error initiating upgrade:', error)
                                    toast({
                                      title: 'Error',
                                      description: error.message || 'Failed to initiate upgrade. Please try again.',
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
                    const errorMessage = error instanceof Error ? error.message : 'Failed to save product'
                    toast({
                      title: 'Error',
                      description: errorMessage,
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className={cn("text-xs sm:text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Total Products
            </CardTitle>
            <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className={cn("text-xs sm:text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Active Products
            </CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">{stats.activeProducts}</div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className={cn("text-xs sm:text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Total Views
            </CardTitle>
            <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">{stats.totalViews.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className={cn("text-xs sm:text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Avg Rating
            </CardTitle>
            <Star className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">{stats.avgRating}</div>
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

      {/* Products Table */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className={cn("text-base sm:text-lg", themeClasses.mainText)}>
            Products ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={cn("border-b", themeClasses.cardBorder)}>
                  <th className={cn("text-left py-2 sm:py-3 px-2 sm:px-4 font-medium w-8 sm:w-12 text-xs sm:text-sm", themeClasses.mainText)}>No.</th>
                  <th className={cn("text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Product</th>
                  <th className={cn("hidden sm:table-cell text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Category</th>
                  <th className={cn("hidden md:table-cell text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Brand</th>
                  <th className={cn("text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Price</th>
                  <th className={cn("hidden lg:table-cell text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Variants</th>
                  <th className={cn("hidden lg:table-cell text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Rating</th>
                  <th className={cn("hidden md:table-cell text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Views</th>
                  <th className={cn("text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm", themeClasses.mainText)}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <div className={cn("text-center", themeClasses.textNeutralSecondary)}>
                        <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-semibold mb-2">No products found</p>
                        <p className="text-sm">
                          {searchTerm || selectedBrand !== 'all' 
                            ? 'Try adjusting your filters' 
                            : 'Get started by adding your first product'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product, idx) => (
                    <tr key={product.id} className={cn("border-b", themeClasses.cardBorder)}>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 align-top text-xs sm:text-sm">{idx + 1}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          {product.image ? (
                            <Image
                              src={product.image}
                              alt={product.name}
                              width={40}
                              height={40}
                              className="rounded-md object-cover w-8 h-8 sm:w-10 sm:h-10"
                            />
                          ) : (
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-200 rounded-md flex items-center justify-center flex-shrink-0">
                              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={cn("font-medium text-xs sm:text-sm truncate", themeClasses.mainText)}>
                              {product.name}
                            </p>
                            <p className={cn("text-[10px] sm:text-xs", themeClasses.textNeutralSecondary)}>
                              SKU: {product.sku}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell py-2 sm:py-3 px-2 sm:px-4">
                        <Badge variant="secondary" className="text-xs">{product.category}</Badge>
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
                        <Badge variant="outline" className="text-xs">
                          {product.variants?.length || 0} variants
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                          <span className={themeClasses.mainText}>{product.rating || 0}</span>
                          <span className={cn("text-xs ml-1", themeClasses.textNeutralSecondary)}>
                            ({product.reviews || 0})
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={themeClasses.mainText}>
                          {(product.views || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
