"use client"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import {
  Search,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  Package,
  DollarSign,
  Star,
  RefreshCw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthStatusIndicator } from "@/components/auth-status-indicator"
import { MaterializedViewRefreshButton } from "@/components/materialized-view-refresh-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useProducts, type Product } from "@/hooks/use-products"
import { useCategories } from "@/hooks/use-categories"
import { useCurrency } from "@/contexts/currency-context"
import { useToast } from "@/hooks/use-toast"
import { ProductForm } from "../product-form"
import { SecurityGuard } from "@/components/security-guard"

export default function AdminOutOfStockProducts() {
  return (
    <SecurityGuard requireAuth={true} requireAdmin={true}>
      <AdminOutOfStockProductsContent />
    </SecurityGuard>
  )
}

function AdminOutOfStockProductsContent() {
  const { themeClasses } = useTheme()
  const { products, updateProduct, deleteProduct, isLoading, fetchFullProducts, fetchFullProductDetails } = useProducts()
  const { mainCategories, subCategories } = useCategories()
  const { formatPrice } = useCurrency()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedMainCategoryId, setSelectedMainCategoryId] = useState<string>("all")
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>("all")
  const [selectedBrand, setSelectedBrand] = useState<string>("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  
  // Batch loading state
  const BATCH_SIZE = 30
  const [loadedProducts, setLoadedProducts] = useState<Product[]>([])
  const [currentOffset, setCurrentOffset] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  // Fetch out-of-stock products directly from API
  const fetchOutOfStockProducts = async (limit: number, offset: number) => {
    try {
      const params = new URLSearchParams()
      params.append('limit', (limit * 2).toString()) // Fetch more to account for filtering
      params.append('offset', offset.toString())
      params.append('t', Date.now().toString())
      
      const response = await fetch(`/api/products?${params.toString()}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      const productsArray = Array.isArray(data) ? data : (data?.products || [])
      
      // Filter for out-of-stock products
      const outOfStockProducts = productsArray.filter((product: any) => {
        const stockQty = product.stockQuantity || product.stock_quantity || 0
        const inStock = product.inStock !== undefined ? product.inStock : (product.in_stock !== undefined ? product.in_stock : stockQty > 0)
        return !inStock || stockQty === 0
      })
      
      const pagination = !Array.isArray(data) ? data.pagination : null
      
      return {
        products: outOfStockProducts,
        pagination: pagination ? {
          ...pagination,
          total: outOfStockProducts.length // Approximate total
        } : null
      }
    } catch (error) {
      return null
    }
  }

  // Initial fetch on mount
  useEffect(() => {
    const loadInitialBatch = async () => {
      setIsInitialLoading(true)
      try {
        const result = await fetchOutOfStockProducts(BATCH_SIZE, 0)
        if (result) {
          setLoadedProducts(result.products || [])
          if (result.pagination) {
            setTotalCount(result.pagination.total || result.products.length)
            setHasMore(result.pagination.hasMore !== undefined ? result.pagination.hasMore : result.products.length >= BATCH_SIZE)
          } else {
            setHasMore(result.products.length >= BATCH_SIZE)
          }
          setCurrentOffset(BATCH_SIZE)
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load out-of-stock products",
          variant: "destructive"
        })
      } finally {
        setIsInitialLoading(false)
      }
    }
    loadInitialBatch()
  }, [fetchFullProducts, toast])

  // Load more products function
  const loadMoreProducts = async () => {
    if (isLoadingMore || !hasMore) return
    
    setIsLoadingMore(true)
    try {
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const result = await fetchOutOfStockProducts(BATCH_SIZE, currentOffset)
      if (result && result.products) {
        // Filter out duplicates before adding
        setLoadedProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const newProducts = result.products.filter((p: Product) => !existingIds.has(p.id))
          return [...prev, ...newProducts]
        })
        if (result.pagination) {
          setTotalCount(result.pagination.total || loadedProducts.length + result.products.length)
          setHasMore(result.pagination.hasMore !== undefined ? result.pagination.hasMore : result.products.length >= BATCH_SIZE)
        } else {
          setHasMore(result.products.length >= BATCH_SIZE)
        }
        setCurrentOffset(prev => prev + BATCH_SIZE)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load more products",
        variant: "destructive"
      })
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Refresh function - reset and reload from beginning
  const handleRefresh = async () => {
    setIsInitialLoading(true)
    setCurrentOffset(0)
    setLoadedProducts([])
    try {
      const result = await fetchOutOfStockProducts(BATCH_SIZE, 0)
      if (result) {
        setLoadedProducts(result.products || [])
        if (result.pagination) {
          setTotalCount(result.pagination.total || result.products.length)
          setHasMore(result.pagination.hasMore !== undefined ? result.pagination.hasMore : result.products.length >= BATCH_SIZE)
        } else {
          setHasMore(result.products.length >= BATCH_SIZE)
        }
        setCurrentOffset(BATCH_SIZE)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh products",
        variant: "destructive"
      })
    } finally {
      setIsInitialLoading(false)
    }
  }

  // Initialize filters from URL (persist across refresh)
  useEffect(() => {
    const q = searchParams.get('q') || ''
    const main = searchParams.get('main') || 'all'
    const sub = searchParams.get('sub') || 'all'
    const brand = searchParams.get('brand') || 'all'
    
    setSearchTerm(q)
    setSelectedMainCategoryId(main)
    setSelectedSubCategoryId(sub)
    setSelectedBrand(brand)
  }, [])

  const updateQuery = (next: { q?: string; main?: string; sub?: string; brand?: string }) => {
    const q = new URLSearchParams(Array.from(searchParams.entries()))
    if (next.q !== undefined) {
      if (next.q) q.set('q', next.q); else q.delete('q')
    }
    if (next.main !== undefined) {
      if (next.main && next.main !== 'all') q.set('main', next.main); else q.delete('main')
    }
    if (next.sub !== undefined) {
      if (next.sub && next.sub !== 'all') q.set('sub', next.sub); else q.delete('sub')
    }
    if (next.brand !== undefined) {
      if (next.brand && next.brand !== 'all') q.set('brand', next.brand); else q.delete('brand')
    }
    const query = q.toString()
    router.replace(`/siem-dashboard/products/out-of-stock${query ? `?${query}` : ''}`)
  }

  // Filter subcategories based on selected main
  const filteredSubs = useMemo(() => {
    if (selectedMainCategoryId === "all") return subCategories
    return subCategories.filter(s => String((s as any).parent_id || s.parent_name) && s.parent_name === (mainCategories.find(m => String(m.id) === String(selectedMainCategoryId))?.name))
  }, [subCategories, mainCategories, selectedMainCategoryId])

  // Use loadedProducts and filter for out-of-stock
  const adminProducts = useMemo(() => {
    if (loadedProducts.length > 0) {
      // Use Map to ensure unique products by ID
      const uniqueProducts = new Map<number, Product>()
      loadedProducts.forEach(product => {
        if (!uniqueProducts.has(product.id)) {
          uniqueProducts.set(product.id, product)
        }
      })
      // Filter for out-of-stock products
      return Array.from(uniqueProducts.values()).filter((product: Product) => {
        const stockQty = product.stockQuantity || product.stock_quantity || 0
        const inStock = product.inStock !== undefined ? product.inStock : (product.in_stock !== undefined ? product.in_stock : stockQty > 0)
        return !inStock || stockQty === 0
      })
    }
    return []
  }, [loadedProducts])

  const brands = useMemo(() => {
    const brs = new Set(adminProducts.map(p => p.brand))
    return Array.from(brs).sort()
  }, [adminProducts])

  // Filter products
  const filteredProducts = useMemo(() => {
    return adminProducts.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesBrand = selectedBrand === "all" || product.brand === selectedBrand

      // Match by main category (parent) and/or subcategory (leaf) using IDs when available
      const productCategoryId = String((product as any).category_id || "")
      const productParentId = String((product as any).category_parent_id || "")

      const matchesMain = selectedMainCategoryId === "all"
        || productParentId === String(selectedMainCategoryId)
        || productCategoryId === String(selectedMainCategoryId)

      const matchesSub = selectedSubCategoryId === "all"
        || productCategoryId === String(selectedSubCategoryId)

      return matchesSearch && matchesBrand && matchesMain && matchesSub
    })
  }, [adminProducts, searchTerm, selectedBrand, selectedMainCategoryId, selectedSubCategoryId])

  const handleEditProduct = async (product: any) => {
    try {
      const refreshedProduct = await fetchFullProductDetails(product.id)
      setEditingProduct(refreshedProduct)
    } catch (error) {
      setEditingProduct(product)
    }
    setIsAddDialogOpen(true)
  }

  const handleDeleteProduct = async (productId: number) => {
    try {
      await deleteProduct(productId)
      toast({
        title: "Success",
        description: "Product deleted successfully"
      })
      handleRefresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive"
      })
    }
  }

  const stats = {
    totalProducts: adminProducts.length,
    outOfStockProducts: adminProducts.filter(p => {
      const stockQty = p.stockQuantity || p.stock_quantity || 0
      const inStock = p.inStock !== undefined ? p.inStock : (p.in_stock !== undefined ? p.in_stock : stockQty > 0)
      return !inStock || stockQty === 0
    }).length,
    totalViews: adminProducts.reduce((sum, p) => sum + (p.views || 0), 0),
    avgRating: adminProducts.length > 0 ? (adminProducts.reduce((sum, p) => sum + (p.rating || 0), 0) / adminProducts.length).toFixed(1) : "0.0",
  }

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className={cn("text-lg", themeClasses.mainText)}>Loading out-of-stock products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-3xl font-bold", themeClasses.mainText)}>Out of Stock Products</h1>
          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
            Manage products that are currently out of stock
          </p>
        </div>
        <div className="flex items-center gap-4">
          <AuthStatusIndicator />
          <MaterializedViewRefreshButton onRefresh={handleRefresh} />
          {hasMore && (
            <Button
              variant="outline"
              onClick={loadMoreProducts}
              disabled={isLoadingMore || isInitialLoading}
              className="min-w-[120px]"
            >
              {isLoadingMore ? "Loading..." : "See More"}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Total Out of Stock
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", themeClasses.mainText)}>{stats.outOfStockProducts}</div>
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              Products currently unavailable
            </p>
          </CardContent>
        </Card>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", themeClasses.mainText)}>{stats.totalProducts}</div>
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              All out-of-stock items
            </p>
          </CardContent>
        </Card>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Total Views
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", themeClasses.mainText)}>{stats.totalViews}</div>
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              Combined product views
            </p>
          </CardContent>
        </Card>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Avg Rating
            </CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", themeClasses.mainText)}>{stats.avgRating}</div>
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              Average product rating
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader>
          <CardTitle className={cn(themeClasses.mainText)}>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={cn("text-sm font-medium mb-2 block", themeClasses.textNeutralSecondary)}>
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    updateQuery({ q: e.target.value })
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className={cn("text-sm font-medium mb-2 block", themeClasses.textNeutralSecondary)}>
                Main Category
              </label>
              <select
                value={selectedMainCategoryId}
                onChange={(e) => {
                  setSelectedMainCategoryId(e.target.value)
                  updateQuery({ main: e.target.value })
                }}
                className={cn("w-full px-3 py-2 border rounded-md", themeClasses.cardBg, themeClasses.cardBorder)}
              >
                <option value="all">All Categories</option>
                {mainCategories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={cn("text-sm font-medium mb-2 block", themeClasses.textNeutralSecondary)}>
                Sub Category
              </label>
              <select
                value={selectedSubCategoryId}
                onChange={(e) => {
                  setSelectedSubCategoryId(e.target.value)
                  updateQuery({ sub: e.target.value })
                }}
                className={cn("w-full px-3 py-2 border rounded-md", themeClasses.cardBg, themeClasses.cardBorder)}
              >
                <option value="all">All Subcategories</option>
                {filteredSubs.map((sub: any) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={cn("text-sm font-medium mb-2 block", themeClasses.textNeutralSecondary)}>
                Brand
              </label>
              <select
                value={selectedBrand}
                onChange={(e) => {
                  setSelectedBrand(e.target.value)
                  updateQuery({ brand: e.target.value })
                }}
                className={cn("w-full px-3 py-2 border rounded-md", themeClasses.cardBg, themeClasses.cardBorder)}
              >
                <option value="all">All Brands</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader>
          <CardTitle className={cn(themeClasses.mainText)}>
            Out of Stock Products ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={cn("border-b", themeClasses.cardBorder)}>
                  <th className={cn("text-left py-3 px-4 font-semibold", themeClasses.mainText)}>#</th>
                  <th className={cn("text-left py-3 px-4 font-semibold", themeClasses.mainText)}>Product</th>
                  <th className={cn("text-left py-3 px-4 font-semibold", themeClasses.mainText)}>Category</th>
                  <th className={cn("text-left py-3 px-4 font-semibold", themeClasses.mainText)}>Brand</th>
                  <th className={cn("text-left py-3 px-4 font-semibold", themeClasses.mainText)}>Price</th>
                  <th className={cn("text-left py-3 px-4 font-semibold", themeClasses.mainText)}>Stock</th>
                  <th className={cn("text-left py-3 px-4 font-semibold", themeClasses.mainText)}>Rating</th>
                  <th className={cn("text-left py-3 px-4 font-semibold", themeClasses.mainText)}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={cn("text-center py-8", themeClasses.textNeutralSecondary)}>
                      {isInitialLoading ? "Loading..." : "No out-of-stock products found"}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product, idx) => {
                    const productNumber = idx + 1
                    const stockQty = product.stockQuantity || product.stock_quantity || 0
                    const inStock = product.inStock !== undefined ? product.inStock : (product.in_stock !== undefined ? product.in_stock : stockQty > 0)
                    
                    return (
                      <tr key={product.id} className={cn("border-b", themeClasses.cardBorder)}>
                        <td className="py-3 px-4 align-top">{productNumber}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            {product.image && (
                              <Image
                                src={product.image}
                                alt={product.name}
                                width={50}
                                height={50}
                                className="rounded object-cover"
                              />
                            )}
                            <div>
                              <div className={cn("font-medium", themeClasses.mainText)}>{product.name}</div>
                              {product.sku && (
                                <div className={cn("text-xs", themeClasses.textNeutralSecondary)}>SKU: {product.sku}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">{product.category || '-'}</td>
                        <td className="py-3 px-4">{product.brand || '-'}</td>
                        <td className="py-3 px-4">{formatPrice(product.price)}</td>
                        <td className="py-3 px-4">
                          <Badge variant={inStock ? "default" : "destructive"}>
                            {stockQty} ({inStock ? "In Stock" : "Out of Stock"})
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span>{product.rating?.toFixed(1) || "0.0"}</span>
                            <span className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                              ({product.reviews || 0})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteProduct(product.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="flex justify-center mt-4 pb-4">
              <Button
                variant="outline"
                onClick={loadMoreProducts}
                disabled={isLoadingMore || isInitialLoading}
                className="min-w-[120px]"
              >
                {isLoadingMore ? "Loading..." : "See More"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <ProductForm
              product={editingProduct}
              categories={mainCategories}
              subCategories={subCategories}
              onSave={async (productData) => {
                try {
                  if (editingProduct.id) {
                    await updateProduct(editingProduct.id, productData)
                    toast({ title: 'Product updated successfully' })
                    
                    // Refresh the product data after update
                    await new Promise(resolve => setTimeout(resolve, 100))
                    const refreshedProduct = await fetchFullProductDetails(editingProduct.id)
                    if (refreshedProduct) {
                      setEditingProduct(refreshedProduct)
                    }
                  }
                  
                  // Force refresh the products list
                  await handleRefresh()
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : 'Failed to save product'
                  toast({
                    title: 'Error',
                    description: errorMessage,
                    variant: 'destructive'
                  })
                }
              }}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
