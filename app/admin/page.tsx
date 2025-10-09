"use client"

import { useState } from "react"
import {
  Package,
  Users,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Eye,
  Star,
  Plus,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  Minus,
  Tag,
  BarChart3,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { useCurrency } from "@/contexts/currency-context"
import Link from "next/link"
import Image from "next/image"
import { useProducts } from "@/hooks/use-products"
import { useAuth } from "@/contexts/auth-context"

export default function AdminDashboard() {
  const { themeClasses } = useTheme()
  const { products, isLoading: productsLoading } = useProducts()
  const { user } = useAuth()
  const { formatPrice } = useCurrency() // Use global currency context
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d")
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedStats, setEditedStats] = useState({
    totalProducts: products.length,
    totalUsers: 1247,
    totalRevenue: 45678.90,
    totalOrders: 892,
    recentOrders: 23,
    activeUsers: 156,
    conversionRate: 3.2,
    avgOrderValue: 89.45,
  })

  // Calculate stats from real data
  const totalViews = products.reduce((sum, p) => sum + p.views, 0)
  const avgRating = products.length > 0 ? (products.reduce((sum, p) => sum + p.rating, 0) / products.length).toFixed(1) : "0.0"
  const activeProducts = products.filter(p => p.inStock !== false).length
  const productsWithDiscounts = products.filter(p => p.originalPrice > p.price).length

  // Mock data - in real app, this would come from API
  const stats = isEditMode ? editedStats : {
    totalProducts: products.length,
    totalUsers: 1247,
    totalRevenue: 45678.90,
    totalOrders: 892,
    recentOrders: 23,
    activeUsers: 156,
    conversionRate: 3.2,
    avgOrderValue: 89.45,
  }

  const recentProducts = products.slice(0, 5)

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
    setIsEditMode(false)
    // In real app, you would save to API here
  }

  const handleCancel = () => {
    setIsEditMode(false)
    setEditedStats({
      totalProducts: products.length,
      totalUsers: 1247,
      totalRevenue: 45678.90,
      totalOrders: 892,
      recentOrders: 23,
      activeUsers: 156,
      conversionRate: 3.2,
      avgOrderValue: 89.45,
    })
  }

  const handleEdit = () => {
    setIsEditMode(true)
  }

  if (productsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className={cn("text-lg", themeClasses.mainText)}>Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-4xl font-bold", themeClasses.mainText)}>Dashboard</h1>
          <p className={cn("text-base", themeClasses.textNeutralSecondary)}>
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}! Here's what's happening with your store today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditMode ? (
            <Button
              onClick={handleEdit}
              className="bg-yellow-500 text-white hover:bg-yellow-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Edit Dashboard
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
          <Button
            variant={timeRange === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("7d")}
          >
            7D
          </Button>
          <Button
            variant={timeRange === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("30d")}
          >
            30D
          </Button>
          <Button
            variant={timeRange === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("90d")}
          >
            90D
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isEditMode ? (
              <input
                type="number"
                value={editedStats.totalProducts}
                onChange={(e) => setEditedStats(prev => ({ ...prev, totalProducts: parseInt(e.target.value) || 0 }))}
                className={cn(
                  "text-2xl font-bold w-full bg-transparent border-b border-gray-300 focus:border-yellow-500 focus:outline-none",
                  themeClasses.mainText
                )}
              />
            ) : (
              <div className="text-2xl font-bold">{products.length}</div>
            )}
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              <span className="text-green-600">{activeProducts}</span> active products
            </p>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isEditMode ? (
              <input
                type="number"
                step="0.01"
                value={editedStats.totalRevenue}
                onChange={(e) => setEditedStats(prev => ({ ...prev, totalRevenue: parseFloat(e.target.value) || 0 }))}
                className={cn(
                  "text-2xl font-bold w-full bg-transparent border-b border-gray-300 focus:border-yellow-500 focus:outline-none",
                  themeClasses.mainText
                )}
              />
            ) : (
              <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            )}
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              <span className="text-green-600">+8%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Total Orders
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              <span className="text-green-600">+5.2%</span> from last month
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
            <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              <span className="text-green-600">+{productsWithDiscounts}</span> products with discounts
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
            <div className="text-2xl font-bold">{avgRating}</div>
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              <span className="text-green-600">{products.filter(p => p.rating >= 4).length}</span> highly rated
            </p>
          </CardContent>
        </Card>

        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
              Active Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className={cn("text-xs", themeClasses.textNeutralSecondary)}>
              <span className="text-red-600">-2.1%</span> from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        <Card className={cn("lg:col-span-2", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn("text-xl font-bold", themeClasses.mainText)}>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={cn("h-10 w-10 rounded-full", themeClasses.cardBg)} />
                    <div>
                      <p className={cn("text-base font-medium", themeClasses.mainText)}>
                        Order #{Math.floor(Math.random() * 10000)}
                      </p>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        {Math.floor(Math.random() * 24)} hours ago
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-base font-medium", themeClasses.mainText)}>
                      {formatPrice(Math.random() * 200 + 50)}
                    </p>
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      {Math.floor(Math.random() * 5) + 1} items
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={cn("lg:col-span-1", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn("text-xl font-bold", themeClasses.mainText)}>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentProducts.map((product) => (
                <div key={product.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                      {product.image && (
                      <Image
                        src={product.image}
                        alt={product.name}
                        width={48}
                                            height={48}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-base font-medium truncate", themeClasses.mainText)}>
                      {product.name}
                    </p>
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      {product.views} views • {product.category}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn("text-base font-medium", themeClasses.mainText)}>
                      ${product.price}
                    </p>
                    <div className="flex items-center text-sm">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className={themeClasses.textNeutralSecondary}>{product.rating}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader>
          <CardTitle className={cn("text-xl font-bold", themeClasses.mainText)}>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-4">
            <Link href="/admin/products/new">
              <Button className="flex items-center gap-3 w-full h-12 text-base">
                <Plus className="h-5 w-5" />
                Add Product
              </Button>
            </Link>
            <Button variant="outline" className="flex items-center gap-3 h-12 text-base">
              <Package className="h-5 w-5" />
              Manage Inventory
            </Button>
            <Button variant="outline" className="flex items-center gap-3 h-12 text-base">
              <Users className="h-5 w-5" />
              View Customers
            </Button>
            <Button variant="outline" className="flex items-center gap-3 h-12 text-base">
              <TrendingUp className="h-5 w-5" />
              View Analytics
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Management */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn("text-xl font-bold flex items-center gap-2", themeClasses.mainText)}>
              <Package className="w-6 h-6" />
              Inventory Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Low Stock Alerts */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <span className="text-base font-medium text-red-700">Low Stock Alert</span>
                </div>
                <span className="text-base text-red-600">5 items</span>
              </div>

              {/* Out of Stock */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Minus className="w-5 h-5 text-orange-500" />
                  <span className="text-base font-medium text-orange-700">Out of Stock</span>
                </div>
                <span className="text-base text-orange-600">2 items</span>
              </div>

              {/* Restocking Soon */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <span className="text-base font-medium text-blue-700">Restocking Soon</span>
                </div>
                <span className="text-base text-blue-600">8 items</span>
              </div>

              {/* In Stock */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-base font-medium text-green-700">In Stock</span>
                </div>
                <span className="text-base text-green-600">156 items</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <Button className="w-full h-12 text-base bg-yellow-500 text-white hover:bg-yellow-600">
                <BarChart3 className="w-5 h-5 mr-2" />
                View Full Inventory
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Product Badges */}
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader>
            <CardTitle className={cn("text-xl font-bold flex items-center gap-2", themeClasses.mainText)}>
              <Tag className="w-6 h-6" />
              Product Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Popular Products */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  <span className="text-base font-medium text-purple-700">Popular</span>
                </div>
                <span className="text-base text-purple-600">12 products</span>
              </div>

              {/* New Arrivals */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Plus className="w-5 h-5 text-blue-500" />
                  <span className="text-base font-medium text-blue-700">New Arrivals</span>
                </div>
                <span className="text-base text-blue-600">8 products</span>
              </div>

              {/* Best Sellers */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-green-500" />
                  <span className="text-base font-medium text-green-700">Best Sellers</span>
                </div>
                <span className="text-base text-green-600">15 products</span>
              </div>

              {/* Featured */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 transition-colors">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-yellow-500" />
                  <span className="text-base font-medium text-yellow-700">Featured</span>
                </div>
                <span className="text-base text-yellow-600">6 products</span>
              </div>

              {/* Sale Items */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Tag className="w-5 h-5 text-red-500" />
                  <span className="text-base font-medium text-red-700">On Sale</span>
                </div>
                <span className="text-base text-red-600">23 products</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <Button className="w-full h-12 text-base bg-yellow-500 text-white hover:bg-yellow-600">
                <Tag className="w-5 h-5 mr-2" />
                Manage Badges
              </Button>
            </div>
          </CardContent>
        </Card>


      </div>
    </div>
  )
} 