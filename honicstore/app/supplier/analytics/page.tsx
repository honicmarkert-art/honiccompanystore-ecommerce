'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/hooks/use-theme'
import { useCurrency } from '@/contexts/currency-context'
import { cn } from '@/lib/utils'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { TrendingUp, DollarSign, Package, ShoppingCart, Eye, Star, ArrowUp, ArrowDown, BarChart3, Users, Lightbulb, Calendar, Filter, AlertTriangle, FileText, TrendingUp as LineChartIcon, Target, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useToast } from '@/hooks/use-toast'

interface AnalyticsData {
  totalRevenue: number
  totalOrders: number
  totalProducts: number
  totalViews: number
  averageRating: number
  revenueChange: number
  ordersChange: number
  viewsChange: number
  recentOrders: Array<{
    id: string
    orderNumber: string
    total: number
    status: string
    createdAt: string
  }>
  topProducts: Array<{
    id: number
    name: string
    sales: number
    revenue: number
    views: number
    category?: string
  }>
  products: Array<{
    id: number
    name: string
    category?: string
    category_id?: string
    views: number
    price: number
    rating?: number
  }>
  orders: Array<{
    id: string
    orderNumber: string
    total: number
    status: string
    createdAt: string
    items: Array<{
      product_id: number
      product_name: string
      quantity: number
      price: number
      total_price: number
    }>
    user_id?: string
  }>
}

export default function SupplierAnalyticsPage() {
  const { themeClasses } = useTheme()
  const { formatPrice } = useCurrency()
  const { toast } = useToast()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<{ slug: string } | null>(null)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)
  const [hasValidPremiumPayment, setHasValidPremiumPayment] = useState<boolean>(false)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [activeTab, setActiveTab] = useState<string>('overview')

  useEffect(() => {
    fetchAnalytics()
    fetchCurrentPlan()
  }, [])

  const fetchCurrentPlan = async () => {
    try {
      const response = await fetch('/api/user/current-plan', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success && data.plan) {
        setCurrentPlan(data.plan)
        setPendingPlanId(data.pendingPlanId || null)
        setHasValidPremiumPayment(data.hasValidPremiumPayment || false)
        setPaymentStatus(data.paymentStatus || null)
      }
    } catch (error) {
      }
  }

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      // Fetch products
      const productsResponse = await fetch('/api/supplier/products?limit=1000', {
        credentials: 'include'
      })
      const productsData = await productsResponse.json()

      // Fetch orders
      const ordersResponse = await fetch('/api/supplier/orders', {
        credentials: 'include'
      })
      const ordersData = await ordersResponse.json()

      if (productsData.success && ordersData.success) {
        const products = productsData.products || []
        const orders = ordersData.orders || []

        // Calculate analytics
        const totalRevenue = orders.reduce((sum: number, order: any) => {
          return sum + (parseFloat(order.supplier_total || order.total_amount || order.total_price || order.total || 0))
        }, 0)

        const totalOrders = orders.length
        const totalProducts = products.length
        const totalViews = products.reduce((sum: number, p: any) => sum + (p.views || 0), 0)
        
        // Calculate average rating
        const ratings = products.filter((p: any) => p.rating).map((p: any) => p.rating)
        const averageRating = ratings.length > 0 
          ? ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length 
          : 0

        // Get recent orders
        const recentOrders = orders
          .slice(0, 10)
          .map((order: any) => ({
            id: order.id,
            orderNumber: order.order_number || `ORD-${order.id}`,
            total: parseFloat(order.supplier_total || order.total_amount || order.total_price || order.total || 0),
            status: order.status || 'pending',
            createdAt: order.created_at || order.confirmed_at,
            paymentStatus: order.payment_status || 'pending',
            itemsCount: order.items_count || order.total_items || 0
          }))

        // Get top products by sales
        const productSales: Record<number, { sales: number; revenue: number; views: number; name: string }> = {}
        orders.forEach((order: any) => {
          const items = order.order_items || []
          items.forEach((item: any) => {
            const productId = item.product_id
            if (!productSales[productId]) {
              productSales[productId] = { sales: 0, revenue: 0, views: 0, name: item.product_name || 'Unknown' }
            }
            productSales[productId].sales += item.quantity || 1
            productSales[productId].revenue += parseFloat(item.price || 0) * (item.quantity || 1)
          })
        })

        // Add views to top products
        products.forEach((product: any) => {
          if (productSales[product.id]) {
            productSales[product.id].views = product.views || 0
            productSales[product.id].name = product.name
          }
        })

        // Add category info to products
        const productsWithCategory = products.map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.category || 'Uncategorized',
          category_id: p.category_id,
          views: p.views || 0,
          price: p.price || 0,
          rating: p.rating || 0
        }))

        // Add category to top products
        const topProducts = Object.entries(productSales)
          .map(([id, data]) => {
            const product = products.find((p: any) => p.id === parseInt(id))
            return {
              id: parseInt(id),
              name: data.name,
              sales: data.sales,
              revenue: data.revenue,
              views: data.views,
              category: product?.category || 'Uncategorized'
            }
          })
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5)

        // Calculate changes (simplified - compare first half vs second half)
        const sortedOrders = orders.sort((a: any, b: any) => 
          new Date(a.created_at || a.confirmed_at).getTime() - new Date(b.created_at || b.confirmed_at).getTime()
        )
        const midPoint = Math.floor(sortedOrders.length / 2)
        const firstHalf = sortedOrders.slice(0, midPoint)
        const secondHalf = sortedOrders.slice(midPoint)
        
        const firstHalfRevenue = firstHalf.reduce((sum: number, o: any) => sum + parseFloat(o.supplier_total || o.total_amount || 0), 0)
        const secondHalfRevenue = secondHalf.reduce((sum: number, o: any) => sum + parseFloat(o.supplier_total || o.total_amount || 0), 0)
        const revenueChange = firstHalfRevenue > 0 ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 : 0
        
        const ordersChange = firstHalf.length > 0 ? ((secondHalf.length - firstHalf.length) / firstHalf.length) * 100 : 0

        setAnalytics({
          totalRevenue,
          totalOrders,
          totalProducts,
          totalViews,
          averageRating,
          revenueChange: Math.round(revenueChange * 10) / 10,
          ordersChange: Math.round(ordersChange * 10) / 10,
          viewsChange: 0,
          recentOrders,
          topProducts,
          products: productsWithCategory,
          orders: orders.map((order: any) => ({
            id: order.id,
            orderNumber: order.order_number || `ORD-${order.id}`,
            total: parseFloat(order.supplier_total || order.total_amount || 0),
            status: order.status || 'pending',
            createdAt: order.created_at || order.confirmed_at,
            items: order.items || [],
            user_id: order.user_id
          }))
        })
      }
    } catch (error) {
      } finally {
      setLoading(false)
    }
  }

  const isPremiumPlan = currentPlan?.slug === 'premium' && hasValidPremiumPayment
  const isFreePlan = currentPlan?.slug === 'free'
  // Check if premium plan payment is pending - use payment_status directly
  const isPremiumPendingPayment = paymentStatus === 'pending'

  // Filter data by time range
  const filteredOrders = useMemo(() => {
    if (!analytics?.orders) return []
    const now = new Date()
    const cutoffDate = new Date()
    switch (timeRange) {
      case '7d':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case '30d':
        cutoffDate.setDate(now.getDate() - 30)
        break
      case '90d':
        cutoffDate.setDate(now.getDate() - 90)
        break
      default:
        return analytics.orders
    }
    return analytics.orders.filter(order => new Date(order.createdAt) >= cutoffDate)
  }, [analytics?.orders, timeRange])

  const statsCards = [
    {
      title: 'Total Revenue',
      value: loading ? '...' : formatPrice(analytics?.totalRevenue || 0),
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      change: analytics?.revenueChange || 0
    },
    {
      title: 'Total Orders',
      value: loading ? '...' : analytics?.totalOrders.toString() || '0',
      icon: ShoppingCart,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      change: analytics?.ordersChange || 0
    },
    {
      title: 'Total Products',
      value: loading ? '...' : analytics?.totalProducts.toString() || '0',
      icon: Package,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20'
    },
    {
      title: 'Total Views',
      value: loading ? '...' : analytics?.totalViews.toString() || '0',
      icon: Eye,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
      change: analytics?.viewsChange || 0
    },
    {
      title: 'Average Rating',
      value: loading ? '...' : analytics?.averageRating.toFixed(1) || '0.0',
      icon: Star,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className={cn("text-2xl sm:text-3xl font-bold", themeClasses.mainText)}>
            {isPremiumPlan ? 'Advanced Analytics' : 'Analytics'}
          </h1>
          <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
            {isPremiumPlan ? 'Advanced analytics and insights' : 'Basic analytics overview'}
          </p>
        </div>
        {isPremiumPlan ? (
          <Badge className="bg-yellow-500 text-black font-semibold text-xs sm:text-sm px-2 sm:px-3 w-fit">
            Advanced Analytics
          </Badge>
        ) : (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs sm:text-sm px-2 sm:px-3 w-fit">
            Free Plan - Basic Analytics
          </Badge>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {statsCards.map((stat, index) => (
          <Card key={index} className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={cn("p-1.5 sm:p-2 rounded-lg", stat.bgColor)}>
                  <stat.icon className={cn("w-4 h-4 sm:w-5 sm:h-5", stat.color)} />
                </div>
                {stat.change !== undefined && stat.change !== 0 && (
                  <div className={cn("flex items-center text-[10px] sm:text-xs", stat.change > 0 ? "text-green-600" : "text-red-600")}>
                    {stat.change > 0 ? <ArrowUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" /> : <ArrowDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />}
                    {Math.abs(stat.change)}%
                  </div>
                )}
              </div>
              <p className={cn("text-[10px] sm:text-xs lg:text-sm mb-1 truncate", themeClasses.textNeutralSecondary)}>
                {stat.title}
              </p>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                  {stat.value}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Orders */}
      <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className={cn("w-5 h-5", themeClasses.textNeutralSecondary)} />
              <CardTitle className={cn("text-xl", themeClasses.mainText)}>Recent Orders</CardTitle>
            </div>
            {analytics?.recentOrders.length ? (
              <Badge variant="outline" className={cn(themeClasses.borderNeutralSecondary)}>
                {analytics.recentOrders.length} {analytics.recentOrders.length === 1 ? 'order' : 'orders'}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : analytics?.recentOrders.length ? (
            <div className="space-y-3">
              {analytics.recentOrders.map((order) => {
                const getStatusColor = (status: string) => {
                  switch (status.toLowerCase()) {
                    case 'confirmed':
                    case 'completed':
                      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
                    case 'pending':
                      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                    case 'cancelled':
                    case 'rejected':
                      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
                    default:
                      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                  }
                }

                const getPaymentStatusColor = (status: string) => {
                  switch (status.toLowerCase()) {
                    case 'paid':
                    case 'completed':
                      return 'text-green-600 dark:text-green-400'
                    case 'pending':
                      return 'text-yellow-600 dark:text-yellow-400'
                    case 'failed':
                    case 'cancelled':
                      return 'text-red-600 dark:text-red-400'
                    default:
                      return themeClasses.textNeutralSecondary
                  }
                }

                return (
                  <div
                    key={order.id}
                    className={cn(
                      "group relative overflow-hidden rounded-lg border-2 transition-all duration-200 hover:shadow-md",
                      themeClasses.cardBorder,
                      themeClasses.cardBg,
                      "hover:border-yellow-400 dark:hover:border-yellow-600"
                    )}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left Section - Order Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={cn(
                              "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm",
                              "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black"
                            )}>
                              <ShoppingCart className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("font-bold text-base mb-1 truncate", themeClasses.mainText)}>
                                {order.orderNumber}
                              </p>
                              <div className="flex items-center gap-3 flex-wrap">
                                <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                                  {new Date(order.createdAt).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                {(order as any).itemsCount > 0 && (
                                  <span className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                                    • {(order as any).itemsCount} {(order as any).itemsCount === 1 ? 'item' : 'items'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Status Badges */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge className={cn("text-xs font-semibold border", getStatusColor(order.status))}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>
                            {(order as any).paymentStatus && (
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs font-semibold", getPaymentStatusColor((order as any).paymentStatus))}
                              >
                                {(order as any).paymentStatus.charAt(0).toUpperCase() + (order as any).paymentStatus.slice(1)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Right Section - Total */}
                        <div className="flex-shrink-0 text-right">
                          <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>Total</p>
                          <p className={cn("text-lg sm:text-xl font-bold", themeClasses.mainText)}>
                            {formatPrice(order.total)}
                          </p>
                          {order.total === 0 && (
                            <p className={cn("text-xs mt-1 text-red-600 dark:text-red-400")}>
                              No items
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Hover Effect Border */}
                    <div className={cn(
                      "absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-400 to-yellow-600",
                      "transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"
                    )} />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <ShoppingCart className={cn("w-16 h-16 mx-auto mb-4 opacity-50", themeClasses.textNeutralSecondary)} />
              <p className={cn("text-lg font-semibold mb-2", themeClasses.mainText)}>
                No orders yet
              </p>
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                Your recent orders will appear here once customers start purchasing your products
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
        <CardHeader>
          <CardTitle className={cn(themeClasses.mainText)}>Top Products</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : analytics?.topProducts.length ? (
            <div className="space-y-2">
              {analytics.topProducts.map((product, index) => (
                <div
                  key={product.id}
                  className={cn("flex items-center justify-between p-3 rounded-lg border", themeClasses.cardBorder, themeClasses.cardBg)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold", 
                      index === 0 ? "bg-yellow-500 text-black" : "bg-gray-200 dark:bg-gray-700"
                    )}>
                      {index + 1}
                    </div>
                    <div>
                      <p className={cn("font-semibold", themeClasses.mainText)}>{product.name}</p>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        {product.sales} sales • {product.views} views
                      </p>
                    </div>
                  </div>
                  <p className={cn("font-semibold", themeClasses.mainText)}>{formatPrice(product.revenue)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className={cn("text-center py-8", themeClasses.textNeutralSecondary)}>
              No product sales yet
            </p>
          )}
        </CardContent>
      </Card>

      {isPremiumPlan ? (
        <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className={cn("text-2xl font-bold mb-1", themeClasses.mainText)}>
                  Advanced Analytics Features
                </CardTitle>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  Comprehensive insights and data-driven decisions
                </p>
              </div>
              <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                <SelectTrigger className="w-full sm:w-40">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2 h-auto p-1 bg-muted/50">
                <TabsTrigger 
                  value="sales" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Sales Reports</span>
                  <span className="sm:hidden">Sales</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="trends"
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <LineChartIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Performance Trends</span>
                  <span className="sm:hidden">Trends</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="customers"
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Customer Insights</span>
                  <span className="sm:hidden">Customers</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="insights"
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden sm:inline">Business Intelligence</span>
                  <span className="sm:hidden">Insights</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="sales" className="space-y-4 mt-4">
                <DetailedSalesReports analytics={analytics} formatPrice={formatPrice} themeClasses={themeClasses} timeRange={timeRange} />
              </TabsContent>
              
              <TabsContent value="trends" className="space-y-4 mt-4">
                <PerformanceTrends analytics={analytics} formatPrice={formatPrice} themeClasses={themeClasses} timeRange={timeRange} />
              </TabsContent>
              
              <TabsContent value="customers" className="space-y-4 mt-4">
                <CustomerInsights analytics={analytics} formatPrice={formatPrice} themeClasses={themeClasses} />
              </TabsContent>
              
              <TabsContent value="insights" className="space-y-4 mt-4">
                <BusinessIntelligence analytics={analytics} formatPrice={formatPrice} themeClasses={themeClasses} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card className={cn("border-2 border-yellow-500", themeClasses.cardBg)}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={cn("text-lg font-semibold mb-2", themeClasses.mainText)}>
                  {isPremiumPendingPayment 
                    ? 'Complete Payment for Advanced Analytics'
                    : 'Upgrade to Premium for Advanced Analytics'}
                </h3>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  {isPremiumPendingPayment
                    ? 'Complete your premium plan payment to access detailed insights, sales reports, and business analytics'
                    : 'Get detailed insights, sales reports, and business analytics with Premium Plan'}
                </p>
              </div>
              <button
                onClick={async () => {
                  if (isPremiumPendingPayment && pendingPlanId) {
                    router.push(`/supplier/payment?planId=${pendingPlanId}`)
                    return
                  }
                  
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
                    router.push(`/supplier/payment?planId=${premiumPlan.id}&referenceId=${referenceId}`)
                  } catch (error: any) {
                    toast({
                      title: 'Error',
                      description: 'Failed',
                      variant: 'destructive'
                    })
                  }
                }}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-md font-semibold"
              >
                {isPremiumPendingPayment ? 'Complete Payment' : 'Upgrade Plan'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Detailed Sales Reports Component
function DetailedSalesReports({ analytics, formatPrice, themeClasses, timeRange }: { 
  analytics: AnalyticsData | null
  formatPrice: (amount: number) => string
  themeClasses: any
  timeRange: string
}) {
  const filteredOrders = useMemo(() => {
    if (!analytics?.orders) return []
    const now = new Date()
    const cutoffDate = new Date()
    switch (timeRange) {
      case '7d':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case '30d':
        cutoffDate.setDate(now.getDate() - 30)
        break
      case '90d':
        cutoffDate.setDate(now.getDate() - 90)
        break
      default:
        return analytics.orders
    }
    return analytics.orders.filter(order => new Date(order.createdAt) >= cutoffDate)
  }, [analytics?.orders, timeRange])

  // Sales by Product
  const salesByProduct = useMemo(() => {
    const productMap: Record<number, { name: string; sales: number; revenue: number; orders: number }> = {}
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productMap[item.product_id]) {
          productMap[item.product_id] = { name: item.product_name, sales: 0, revenue: 0, orders: 0 }
        }
        productMap[item.product_id].sales += item.quantity
        productMap[item.product_id].revenue += item.total_price
        productMap[item.product_id].orders += 1
      })
    })
    return Object.entries(productMap)
      .map(([id, data]) => ({ id: parseInt(id), ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  }, [filteredOrders])

  // Sales by Category
  const salesByCategory = useMemo(() => {
    const categoryMap: Record<string, { sales: number; revenue: number; orders: number }> = {}
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const product = analytics?.products.find(p => p.id === item.product_id)
        const category = product?.category || 'Uncategorized'
        if (!categoryMap[category]) {
          categoryMap[category] = { sales: 0, revenue: 0, orders: 0 }
        }
        categoryMap[category].sales += item.quantity
        categoryMap[category].revenue += item.total_price
        categoryMap[category].orders += 1
      })
    })
    return Object.entries(categoryMap)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [filteredOrders, analytics?.products])

  // Sales by Time Period
  const salesByPeriod = useMemo(() => {
    const periodMap: Record<string, { revenue: number; orders: number }> = {}
    filteredOrders.forEach(order => {
      const date = new Date(order.createdAt)
      const periodKey = timeRange === '7d' 
        ? date.toLocaleDateString('en-US', { weekday: 'short' })
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      
      if (!periodMap[periodKey]) {
        periodMap[periodKey] = { revenue: 0, orders: 0 }
      }
      periodMap[periodKey].revenue += order.total
      periodMap[periodKey].orders += 1
    })
    return Object.entries(periodMap)
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => {
        if (timeRange === '7d') {
          const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          return days.indexOf(a.period) - days.indexOf(b.period)
        }
        return new Date(a.period).getTime() - new Date(b.period).getTime()
      })
  }, [filteredOrders, timeRange])

  const chartData = salesByPeriod.map(item => ({
    name: item.period,
    revenue: item.revenue,
    orders: item.orders
  }))

  return (
    <div className="space-y-6">
      {/* Sales by Time Period Chart */}
      <Card className={cn("border", themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className={cn("w-5 h-5", themeClasses.textNeutralSecondary)} />
            <CardTitle className={cn("text-lg", themeClasses.mainText)}>Sales Over Time</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' } }}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Sales by Product */}
      <Card className={cn("border", themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Package className={cn("w-5 h-5", themeClasses.textNeutralSecondary)} />
            <CardTitle className={cn("text-lg", themeClasses.mainText)}>Top Products by Revenue</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {salesByProduct.length > 0 ? (
              salesByProduct.map((product, index) => (
                <div 
                  key={product.id} 
                  className={cn(
                    "group flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-sm",
                    themeClasses.cardBorder,
                    themeClasses.cardBg
                  )}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border-2",
                      index === 0 
                        ? "bg-primary/10 text-primary border-primary/20" 
                        : "bg-muted border-border"
                    )}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-semibold truncate", themeClasses.mainText)}>{product.name}</p>
                      <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                        {product.sales} units • {product.orders} orders
                      </p>
                    </div>
                  </div>
                  <p className={cn("font-bold text-lg ml-4", themeClasses.mainText)}>{formatPrice(product.revenue)}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Package className={cn("w-12 h-12 mx-auto mb-3 opacity-50", themeClasses.textNeutralSecondary)} />
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>No sales data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sales by Category */}
      <Card className={cn("border", themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className={cn("w-5 h-5", themeClasses.textNeutralSecondary)} />
            <CardTitle className={cn("text-lg", themeClasses.mainText)}>Sales by Category</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {salesByCategory.length > 0 ? (
              salesByCategory.map((cat) => (
                <div 
                  key={cat.category} 
                  className={cn(
                    "p-5 rounded-lg border transition-all hover:shadow-sm",
                    themeClasses.cardBorder,
                    themeClasses.cardBg
                  )}
                >
                  <h4 className={cn("font-semibold mb-3 text-base", themeClasses.mainText)}>{cat.category}</h4>
                  <p className={cn("text-2xl font-bold mb-2", themeClasses.mainText)}>{formatPrice(cat.revenue)}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={cn(themeClasses.textNeutralSecondary)}>
                      {cat.sales} units
                    </span>
                    <span className={cn("text-muted-foreground")}>•</span>
                    <span className={cn(themeClasses.textNeutralSecondary)}>
                      {cat.orders} orders
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 col-span-full">
                <Filter className={cn("w-12 h-12 mx-auto mb-3 opacity-50", themeClasses.textNeutralSecondary)} />
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>No category data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Performance Trends Component
function PerformanceTrends({ analytics, formatPrice, themeClasses, timeRange }: { 
  analytics: AnalyticsData | null
  formatPrice: (amount: number) => string
  themeClasses: any
  timeRange: string
}) {
  const filteredOrders = useMemo(() => {
    if (!analytics?.orders) return []
    const now = new Date()
    const cutoffDate = new Date()
    switch (timeRange) {
      case '7d':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case '30d':
        cutoffDate.setDate(now.getDate() - 30)
        break
      case '90d':
        cutoffDate.setDate(now.getDate() - 90)
        break
      default:
        return analytics.orders
    }
    return analytics.orders.filter(order => new Date(order.createdAt) >= cutoffDate)
  }, [analytics?.orders, timeRange])

  // Revenue trend
  const revenueTrend = useMemo(() => {
    const periodMap: Record<string, number> = {}
    filteredOrders.forEach(order => {
      const date = new Date(order.createdAt)
      const periodKey = timeRange === '7d' 
        ? date.toLocaleDateString('en-US', { weekday: 'short' })
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      
      if (!periodMap[periodKey]) periodMap[periodKey] = 0
      periodMap[periodKey] += order.total
    })
    return Object.entries(periodMap)
      .map(([period, revenue]) => ({ period, revenue }))
      .sort((a, b) => {
        if (timeRange === '7d') {
          const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          return days.indexOf(a.period) - days.indexOf(b.period)
        }
        return new Date(a.period).getTime() - new Date(b.period).getTime()
      })
  }, [filteredOrders, timeRange])

  // Orders trend
  const ordersTrend = useMemo(() => {
    const periodMap: Record<string, number> = {}
    filteredOrders.forEach(order => {
      const date = new Date(order.createdAt)
      const periodKey = timeRange === '7d' 
        ? date.toLocaleDateString('en-US', { weekday: 'short' })
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      
      if (!periodMap[periodKey]) periodMap[periodKey] = 0
      periodMap[periodKey] += 1
    })
    return Object.entries(periodMap)
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => {
        if (timeRange === '7d') {
          const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          return days.indexOf(a.period) - days.indexOf(b.period)
        }
        return new Date(a.period).getTime() - new Date(b.period).getTime()
      })
  }, [filteredOrders, timeRange])

  const chartData = revenueTrend.map((item, index) => ({
    name: item.period,
    revenue: item.revenue,
    orders: ordersTrend[index]?.count || 0
  }))

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0)
  const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0
  const growthRate = analytics?.revenueChange || 0

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="p-4">
            <p className={cn("text-sm mb-1", themeClasses.textNeutralSecondary)}>Total Revenue</p>
            <p className={cn("text-2xl font-bold", themeClasses.mainText)}>{formatPrice(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="p-4">
            <p className={cn("text-sm mb-1", themeClasses.textNeutralSecondary)}>Average Order Value</p>
            <p className={cn("text-2xl font-bold", themeClasses.mainText)}>{formatPrice(avgOrderValue)}</p>
          </CardContent>
        </Card>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="p-4">
            <p className={cn("text-sm mb-1", themeClasses.textNeutralSecondary)}>Growth Rate</p>
            <div className="flex items-center gap-2">
              <p className={cn("text-2xl font-bold", growthRate >= 0 ? "text-green-600" : "text-red-600")}>
                {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
              </p>
              {growthRate >= 0 ? <ArrowUp className="w-5 h-5 text-green-600" /> : <ArrowDown className="w-5 h-5 text-red-600" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader>
          <CardTitle className={cn(themeClasses.mainText)}>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' } }}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Orders Trend Chart */}
      <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader>
          <CardTitle className={cn(themeClasses.mainText)}>Orders Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ orders: { label: 'Orders', color: 'hsl(var(--chart-2))' } }}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="orders" fill="var(--color-orders)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}

// Customer Insights Component
function CustomerInsights({ analytics, formatPrice, themeClasses }: { 
  analytics: AnalyticsData | null
  formatPrice: (amount: number) => string
  themeClasses: any
}) {
  const customerData = useMemo(() => {
    if (!analytics?.orders) return { uniqueCustomers: 0, repeatCustomers: 0, customerOrders: {}, avgOrderValue: 0 }
    
    const customerOrders: Record<string, number[]> = {}
    analytics.orders.forEach(order => {
      if (order.user_id) {
        if (!customerOrders[order.user_id]) {
          customerOrders[order.user_id] = []
        }
        customerOrders[order.user_id].push(order.total)
      }
    })

    const uniqueCustomers = Object.keys(customerOrders).length
    const repeatCustomers = Object.values(customerOrders).filter(orders => orders.length > 1).length
    const allOrderValues = analytics.orders.map(o => o.total)
    const avgOrderValue = allOrderValues.length > 0 
      ? allOrderValues.reduce((sum, val) => sum + val, 0) / allOrderValues.length 
      : 0

    return { uniqueCustomers, repeatCustomers, customerOrders, avgOrderValue }
  }, [analytics?.orders])

  const topCustomers = useMemo(() => {
    if (!analytics?.orders) return []
    const customerMap: Record<string, { orders: number; totalSpent: number }> = {}
    analytics.orders.forEach(order => {
      if (order.user_id) {
        if (!customerMap[order.user_id]) {
          customerMap[order.user_id] = { orders: 0, totalSpent: 0 }
        }
        customerMap[order.user_id].orders += 1
        customerMap[order.user_id].totalSpent += order.total
      }
    })
    return Object.entries(customerMap)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5)
  }, [analytics?.orders])

  return (
    <div className="space-y-6">
      {/* Customer Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Unique Customers</p>
            </div>
            <p className={cn("text-2xl font-bold", themeClasses.mainText)}>{customerData.uniqueCustomers}</p>
          </CardContent>
        </Card>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="w-5 h-5 text-green-600" />
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Repeat Customers</p>
            </div>
            <p className={cn("text-2xl font-bold", themeClasses.mainText)}>{customerData.repeatCustomers}</p>
            <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>
              {customerData.uniqueCustomers > 0 
                ? `${((customerData.repeatCustomers / customerData.uniqueCustomers) * 100).toFixed(1)}% retention`
                : '0% retention'}
            </p>
          </CardContent>
        </Card>
        <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-yellow-600" />
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Avg Order Value</p>
            </div>
            <p className={cn("text-2xl font-bold", themeClasses.mainText)}>{formatPrice(customerData.avgOrderValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
      <Card className={cn("border", themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Target className={cn("w-5 h-5", themeClasses.textNeutralSecondary)} />
            <CardTitle className={cn("text-lg", themeClasses.mainText)}>Top Customers</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topCustomers.length > 0 ? (
              topCustomers.map((customer, index) => (
                <div 
                  key={customer.id} 
                  className={cn(
                    "group flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-sm",
                    themeClasses.cardBorder,
                    themeClasses.cardBg
                  )}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border-2",
                      index === 0 
                        ? "bg-primary/10 text-primary border-primary/20" 
                        : "bg-muted border-border"
                    )}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-semibold", themeClasses.mainText)}>Customer {customer.id.slice(0, 8)}...</p>
                      <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                        {customer.orders} orders
                      </p>
                    </div>
                  </div>
                  <p className={cn("font-bold text-lg ml-4", themeClasses.mainText)}>{formatPrice(customer.totalSpent)}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Users className={cn("w-12 h-12 mx-auto mb-3 opacity-50", themeClasses.textNeutralSecondary)} />
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>No customer data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Business Intelligence Component
function BusinessIntelligence({ analytics, formatPrice, themeClasses }: { 
  analytics: AnalyticsData | null
  formatPrice: (amount: number) => string
  themeClasses: any
}) {
  const insights = useMemo(() => {
    if (!analytics?.products || !analytics?.orders) return []

    const productPerformance: Array<{
      id: number
      name: string
      views: number
      sales: number
      revenue: number
      conversionRate: number
      recommendation: string
    }> = []

    // Calculate sales for each product
    const productSales: Record<number, number> = {}
    const productRevenue: Record<number, number> = {}
    analytics.orders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.product_id]) {
          productSales[item.product_id] = 0
          productRevenue[item.product_id] = 0
        }
        productSales[item.product_id] += item.quantity
        productRevenue[item.product_id] += item.total_price
      })
    })

    analytics.products.forEach(product => {
      const sales = productSales[product.id] || 0
      const revenue = productRevenue[product.id] || 0
      const conversionRate = product.views > 0 ? (sales / product.views) * 100 : 0
      
      let recommendation = ''
      if (product.views > 100 && sales === 0) {
        recommendation = 'High views but no sales - Consider price reduction or better description'
      } else if (product.views < 50 && sales > 0) {
        recommendation = 'Low views but good sales - Increase visibility with featured placement'
      } else if (conversionRate < 1 && product.views > 50) {
        recommendation = 'Low conversion rate - Optimize product images and descriptions'
      } else if (sales > 10 && conversionRate > 5) {
        recommendation = 'Top performer - Consider increasing stock or creating variants'
      } else if (product.views < 20) {
        recommendation = 'Low visibility - Add more keywords and improve SEO'
      }

      productPerformance.push({
        id: product.id,
        name: product.name,
        views: product.views,
        sales,
        revenue,
        conversionRate,
        recommendation
      })
    })

    return productPerformance.filter(p => p.recommendation).slice(0, 10)
  }, [analytics?.products, analytics?.orders])

  const lowPerformers = insights.filter(i => i.views > 50 && i.sales === 0)
  const highPerformers = insights.filter(i => i.sales > 10 && i.conversionRate > 5)
  const optimizationNeeded = insights.filter(i => i.conversionRate < 1 && i.views > 50)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={cn("border", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-muted")}>
                <AlertTriangle className={cn("w-5 h-5", themeClasses.textNeutralSecondary)} />
              </div>
              <div className="flex-1">
                <p className={cn("text-sm mb-1", themeClasses.textNeutralSecondary)}>Low Performers</p>
                <p className={cn("text-2xl font-bold", themeClasses.mainText)}>{lowPerformers.length}</p>
                <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>Products needing attention</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-muted")}>
                <Star className={cn("w-5 h-5", themeClasses.textNeutralSecondary)} />
              </div>
              <div className="flex-1">
                <p className={cn("text-sm mb-1", themeClasses.textNeutralSecondary)}>Top Performers</p>
                <p className={cn("text-2xl font-bold", themeClasses.mainText)}>{highPerformers.length}</p>
                <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>Products doing well</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-muted")}>
                <Lightbulb className={cn("w-5 h-5", themeClasses.textNeutralSecondary)} />
              </div>
              <div className="flex-1">
                <p className={cn("text-sm mb-1", themeClasses.textNeutralSecondary)}>Optimization Needed</p>
                <p className={cn("text-2xl font-bold", themeClasses.mainText)}>{optimizationNeeded.length}</p>
                <p className={cn("text-xs mt-1", themeClasses.textNeutralSecondary)}>Products to optimize</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actionable Insights */}
      <Card className={cn("border", themeClasses.cardBg, themeClasses.cardBorder)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className={cn("w-5 h-5", themeClasses.textNeutralSecondary)} />
            <CardTitle className={cn("text-lg", themeClasses.mainText)}>Actionable Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights.length > 0 ? (
              insights.map((insight) => (
                <div 
                  key={insight.id} 
                  className={cn(
                    "p-5 rounded-lg border transition-all hover:shadow-sm",
                    themeClasses.cardBorder,
                    themeClasses.cardBg
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h4 className={cn("font-semibold text-base flex-1", themeClasses.mainText)}>{insight.name}</h4>
                    <Badge 
                      variant={insight.sales === 0 ? "destructive" : insight.conversionRate > 5 ? "default" : "secondary"}
                      className="ml-3"
                    >
                      {insight.conversionRate.toFixed(2)}% conversion
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>Views</p>
                      <p className={cn("font-semibold text-lg", themeClasses.mainText)}>{insight.views}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>Sales</p>
                      <p className={cn("font-semibold text-lg", themeClasses.mainText)}>{insight.sales}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className={cn("text-xs mb-1", themeClasses.textNeutralSecondary)}>Revenue</p>
                      <p className={cn("font-semibold text-lg", themeClasses.mainText)}>{formatPrice(insight.revenue)}</p>
                    </div>
                  </div>
                  <div className={cn("p-4 rounded-lg bg-muted/50 border border-border")}>
                    <div className="flex items-start gap-3">
                      <Lightbulb className={cn("w-5 h-5 mt-0.5 flex-shrink-0", themeClasses.textNeutralSecondary)} />
                      <p className={cn("text-sm leading-relaxed", themeClasses.textNeutralSecondary)}>
                        {insight.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Sparkles className={cn("w-12 h-12 mx-auto mb-3 opacity-50", themeClasses.textNeutralSecondary)} />
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>No insights available yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

