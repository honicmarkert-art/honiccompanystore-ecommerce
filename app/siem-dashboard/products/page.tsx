"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  Package,
  DollarSign,
  Star,
  Eye as EyeIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AdminAuthGuard } from "@/components/admin-auth-guard"
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
import { useProducts } from "@/hooks/use-products"
import { useCurrency } from "@/contexts/currency-context"
import { ProductForm } from "./product-form"
import { SecurityGuard } from "@/components/security-guard"

export default function AdminProducts() {
  return (
    <SecurityGuard requireAuth={true} requireAdmin={true}>
      <AdminProductsContent />
    </SecurityGuard>
  )
}

function AdminProductsContent() {
  const { themeClasses } = useTheme()
  const { products, addProduct, updateProduct, deleteProduct, resetToDefault, isLoading, fetchFullProducts } = useProducts()
  const { formatPrice } = useCurrency() // Use global currency context
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedBrand, setSelectedBrand] = useState<string>("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)

  // Fetch full products with variants when admin page loads
  useEffect(() => {
    fetchFullProducts()
  }, [fetchFullProducts])

  // Get unique categories and brands
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category))
    return Array.from(cats).sort()
  }, [products])

  const brands = useMemo(() => {
    const brs = new Set(products.map(p => p.brand))
    return Array.from(brs).sort()
  }, [products])

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === "all" || product.category === selectedCategory
      const matchesBrand = selectedBrand === "all" || product.brand === selectedBrand
      return matchesSearch && matchesCategory && matchesBrand
    })
  }, [products, searchTerm, selectedCategory, selectedBrand])

  const handleEditProduct = (product: any) => {
    setEditingProduct(product)
    setIsAddDialogOpen(true)
  }

  const handleDeleteProduct = async (productId: number) => {
    try {
      await deleteProduct(productId)
    } catch (error) {
    }
  }

  const stats = {
    totalProducts: products.length,
    activeProducts: products.filter(p => p.price > 0).length,
    totalViews: products.reduce((sum, p) => sum + (p.views || 0), 0),
    avgRating: products.length > 0 ? (products.reduce((sum, p) => sum + (p.rating || 0), 0) / products.length).toFixed(1) : "0.0",
  }

  if (isLoading) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-3xl font-bold", themeClasses.mainText)}>Products</h1>
          <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
            Manage your product catalog and inventory
          </p>
        </div>
        <div className="flex items-center gap-4">
          <AuthStatusIndicator />
          <MaterializedViewRefreshButton onRefresh={fetchFullProducts} />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </DialogTitle>
              </DialogHeader>
              <ProductForm 
                product={editingProduct}
                autoCloseOnSave={false}
                onClose={() => {
                  setIsAddDialogOpen(false)
                  setEditingProduct(null)
                }}
                onSave={async (productData) => {
                  try {
                    let updatedProduct = null
                    if (editingProduct) {
                      updatedProduct = await updateProduct(editingProduct.id, productData)
                      // Update the editingProduct with the returned data
                      setEditingProduct(updatedProduct)
                    } else {
                      updatedProduct = await addProduct(productData)
                    }
                    
                    // Force refresh the products list to ensure UI is up to date
                    await fetchFullProducts()
                    
                    // Return the updated product data so the form can refresh
                    return updatedProduct
                  } catch (error) {
                    console.error('Error saving product:', error)
                    
                    // Show user-friendly error message
                    const errorMessage = error instanceof Error ? error.message : 'Failed to save product'
                    
                    // If it's an authentication error, show a more helpful message
                    if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
                      alert('Your session has expired. Please log in again to continue.')
                      // Optionally redirect to login
                      window.location.href = '/auth/login'
                      return
                    }
                    
                    if (errorMessage.includes('Admin privileges required') || errorMessage.includes('403')) {
                      alert('You don\'t have admin privileges to update products.')
                      return
                    }
                    
                    // For other errors, show the error message
                    alert(`Error: ${errorMessage}`)
                    throw error
                  }
                }}
              />
            </DialogContent>
                    </Dialog>
          
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                await resetToDefault()
              } catch (error) {
              }
            }}
            className="flex items-center gap-2"
          >
            Reset to Default
          </Button>

          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const response = await fetch('/api/products/cleanup-value-raw', {
                  method: 'POST'
                })
                const result = await response.json()
                if (result.success) {
                  // Refresh the products list
                  window.location.reload()
                } else {
                }
              } catch (error) {
              }
            }}
            className="flex items-center gap-2"
          >
            Cleanup Value_raw
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Active Products
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeProducts}</div>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Total Views
            </CardTitle>
            <EyeIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</div>
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
            <div className="text-2xl font-bold">{stats.avgRating}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader>
          <CardTitle className={themeClasses.mainText}>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className={cn("text-sm font-medium", themeClasses.mainText)}>Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={cn("text-sm font-medium", themeClasses.mainText)}>Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm",
                  themeClasses.cardBg,
                  themeClasses.borderNeutralSecondary,
                  themeClasses.mainText
                )}
                suppressHydrationWarning
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className={cn("text-sm font-medium", themeClasses.mainText)}>Brand</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm",
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
              <label className={cn("text-sm font-medium", themeClasses.mainText)}>Actions</label>
              <Button variant="outline" className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader>
          <CardTitle className={themeClasses.mainText}>
            Products ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={cn("border-b", themeClasses.cardBorder)}>
                  <th className={cn("text-left py-3 px-4 font-medium", themeClasses.mainText)}>Product</th>
                  <th className={cn("text-left py-3 px-4 font-medium", themeClasses.mainText)}>Category</th>
                  <th className={cn("text-left py-3 px-4 font-medium", themeClasses.mainText)}>Brand</th>
                  <th className={cn("text-left py-3 px-4 font-medium", themeClasses.mainText)}>Price</th>
                  <th className={cn("text-left py-3 px-4 font-medium", themeClasses.mainText)}>Variants</th>
                  <th className={cn("text-left py-3 px-4 font-medium", themeClasses.mainText)}>Rating</th>
                  <th className={cn("text-left py-3 px-4 font-medium", themeClasses.mainText)}>Views</th>
                  <th className={cn("text-left py-3 px-4 font-medium", themeClasses.mainText)}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className={cn("border-b", themeClasses.cardBorder)}>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="rounded-md object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded-md flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className={cn("font-medium", themeClasses.mainText)}>
                            {product.name}
                          </p>
                          <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                            SKU: {product.sku}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">{product.category}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className={themeClasses.mainText}>{product.brand}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn("font-medium", themeClasses.mainText)}>
                        {formatPrice(product.price)}
                      </span>
                      {product.originalPrice > product.price && (
                        <span className={cn("text-xs line-through ml-1", themeClasses.textNeutralSecondary)}>
                          {formatPrice(product.originalPrice)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs">
                        {product.variants?.length || 0} variants
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                        <span className={themeClasses.mainText}>{product.rating}</span>
                        <span className={cn("text-xs ml-1", themeClasses.textNeutralSecondary)}>
                          ({product.reviews})
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
                            onClick={() => {
                              // Show variants in a dialog or expand the row
                            }}
                            className={themeClasses.buttonGhostHoverBg}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            View Variants ({product.variants?.length || 0})
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
        </CardContent>
      </Card>
    </div>
  )
} 