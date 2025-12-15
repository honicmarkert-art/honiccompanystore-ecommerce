'use client'

import { useState, useEffect, Suspense } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/contexts/auth-context'
import { useCurrency } from '@/contexts/currency-context'
import { useSearchParams, useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Building2, Package, TrendingUp, DollarSign, Users, ShoppingCart, ArrowRight, CreditCard, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import Link from 'next/link'
import Image from 'next/image'

function SupplierDashboardContent() {
  const { themeClasses } = useTheme()
  const { user } = useAuth()
  const { formatPrice } = useCurrency()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [currentPlan, setCurrentPlan] = useState<{ slug: string } | null>(null)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)
  const [hasValidPremiumPayment, setHasValidPremiumPayment] = useState<boolean>(false)
  const [planPaymentStatus, setPlanPaymentStatus] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [showPaymentAlert, setShowPaymentAlert] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | null>(null)
  const [paymentReferenceId, setPaymentReferenceId] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    inStockProducts: 0,
    outOfStockProducts: 0
  })
  const [loading, setLoading] = useState(true)
  const [topProducts, setTopProducts] = useState<Array<{
    id: number
    name: string
    image: string
    price: number
    sales: number
    revenue: number
    views: number
  }>>([])
  const [recentOrders, setRecentOrders] = useState<Array<{
    id: string
    order_number: string
    total_amount: number
    status: string
    payment_status: string
    created_at: string
    items_count: number
  }>>([])
  const [loadingSections, setLoadingSections] = useState(true)

  useEffect(() => {
    // Check for payment return parameters first (before fetching data)
    const paymentParam = searchParams.get('payment')
    const referenceId = searchParams.get('referenceId')
    
    if (paymentParam && referenceId) {
      setPaymentStatus(paymentParam as 'success' | 'cancelled')
      setPaymentReferenceId(referenceId)
      setShowPaymentAlert(true)
      
      // Show toast notification
      if (paymentParam === 'success') {
        toast({
          title: 'Payment Successful!',
          description: 'Your plan has been updated successfully. Enjoy your new features!',
          duration: 5000
        })
        // Refresh plan data after a short delay to allow webhook to process
        setTimeout(() => {
          fetchCurrentPlan()
        }, 2000)
      } else if (paymentParam === 'cancelled') {
        toast({
          title: 'Payment Cancelled',
          description: 'Your payment was cancelled. You can try again anytime.',
          variant: 'destructive',
          duration: 5000
        })
      }
      
      // Remove query parameters from URL after showing alert
      setTimeout(() => {
        router.replace('/supplier/dashboard', { scroll: false })
        setShowPaymentAlert(false)
      }, 10000) // Show alert for 10 seconds
    }
    
    // Fetch data in parallel for faster loading
    Promise.all([
      fetchDashboardStats(),
      fetchTopProductsAndOrders(),
      fetchCurrentPlan()
    ]).catch(error => {
      console.error('Error loading dashboard data:', error)
    })
  }, [searchParams, router, toast])

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
        setPlanPaymentStatus(data.paymentStatus || null)
      }
    } catch (error) {
      console.error('Error fetching current plan:', error)
    } finally {
      setLoadingPlan(false)
    }
  }

  const isWingaPlan = currentPlan?.slug === 'winga'

  // Check if user has pending premium plan (only show if payment is not completed)
  const hasPendingPremiumPlan = !!pendingPlanId && !hasValidPremiumPayment

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      // Fetch products with timeout for faster loading
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout
      
      const productsResponse = await fetch('/api/supplier/products?limit=100', {
        credentials: 'include',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      const productsData = await productsResponse.json()

      if (productsData.success) {
        const products = productsData.products || []
        const totalProducts = products.length
        const inStockProducts = products.filter((p: any) => p.in_stock).length
        const outOfStockProducts = totalProducts - inStockProducts
        const totalRevenue = products.reduce((sum: number, p: any) => sum + (p.price || 0), 0)

        setStats({
          totalProducts,
          totalOrders: 0, // TODO: Fetch from orders API when available
          totalRevenue,
          totalCustomers: 0, // TODO: Fetch from orders API when available
          inStockProducts,
          outOfStockProducts
        })
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTopProductsAndOrders = async () => {
    try {
      setLoadingSections(true)
      
      // Fetch products and orders in parallel with timeout for faster loading
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const [productsResponse, ordersResponse] = await Promise.all([
        fetch('/api/supplier/products?limit=100', { credentials: 'include', signal: controller.signal }),
        fetch('/api/supplier/orders?limit=10', { credentials: 'include', signal: controller.signal })
      ])
      
      clearTimeout(timeoutId)

      const productsData = await productsResponse.json()
      const ordersData = await ordersResponse.json()

      if (productsData.success && ordersData.success) {
        const products = productsData.products || []
        const orders = ordersData.orders || []

        // Calculate top products by sales
        const productSales: Record<number, { sales: number; revenue: number; views: number; name: string; image: string; price: number }> = {}
        
        orders.forEach((order: any) => {
          const items = order.items || []
          items.forEach((item: any) => {
            const productId = item.product_id
            if (!productSales[productId]) {
              const product = products.find((p: any) => p.id === productId)
              productSales[productId] = {
                sales: 0,
                revenue: 0,
                views: product?.views || 0,
                name: item.product_name || product?.name || 'Unknown',
                image: product?.image || '/placeholder-product.jpg',
                price: parseFloat(item.price || 0)
              }
            }
            productSales[productId].sales += item.quantity || 1
            productSales[productId].revenue += parseFloat(item.price || 0) * (item.quantity || 1)
          })
        })

        // Add products with views but no sales yet
        products.forEach((product: any) => {
          if (!productSales[product.id] && product.views > 0) {
            productSales[product.id] = {
              sales: 0,
              revenue: 0,
              views: product.views || 0,
              name: product.name,
              image: product.image || '/placeholder-product.jpg',
              price: product.price || 0
            }
          }
        })

        // Sort by sales first, then by views, and take top 5
        const topProductsList = Object.entries(productSales)
          .map(([id, data]) => ({
            id: parseInt(id),
            name: data.name,
            image: data.image,
            price: data.price,
            sales: data.sales,
            revenue: data.revenue,
            views: data.views
          }))
          .sort((a, b) => {
            // Sort by sales first, then by views
            if (b.sales !== a.sales) return b.sales - a.sales
            return b.views - a.views
          })
          .slice(0, 5)

        setTopProducts(topProductsList)

        // Get recent orders (last 5)
        const recentOrdersList = orders
          .slice(0, 5)
          .map((order: any) => ({
            id: order.id,
            order_number: order.order_number,
            total_amount: order.total_amount || order.supplier_total || 0,
            status: order.status,
            payment_status: order.payment_status,
            created_at: order.created_at || order.confirmed_at,
            items_count: order.items_count || order.total_items || 0
          }))

        setRecentOrders(recentOrdersList)
      }
    } catch (error) {
      console.error('Error fetching top products and orders:', error)
    } finally {
      setLoadingSections(false)
    }
  }

  const statsCards = [
    {
      title: 'Total Products',
      value: loading ? '...' : stats.totalProducts.toString(),
      icon: Package,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20'
    },
    {
      title: 'In Stock',
      value: loading ? '...' : stats.inStockProducts.toString(),
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20'
    },
    {
      title: 'Total Revenue',
      value: loading ? '...' : formatPrice(stats.totalRevenue),
      icon: DollarSign,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20'
    },
    {
      title: 'Out of Stock',
      value: loading ? '...' : stats.outOfStockProducts.toString(),
      icon: Package,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/20'
    }
  ]

  const quickActions = [
    {
      title: isWingaPlan ? 'Connect Product' : 'Add Product',
      description: isWingaPlan ? 'List a product you can help customers find' : 'List a new product',
      icon: Package,
      href: '/supplier/products/add',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: 'View Products',
      description: isWingaPlan ? 'Manage your connected products' : 'Manage your products',
      icon: TrendingUp,
      href: '/supplier/products',
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: 'View Orders',
      description: isWingaPlan ? 'See orders from customers you helped' : 'Check your orders',
      icon: ShoppingCart,
      href: '/supplier/orders',
      color: 'bg-yellow-500 hover:bg-yellow-600'
    },
    {
      title: isWingaPlan ? 'Winga Business Info' : 'Company Info',
      description: isWingaPlan ? 'Update your broker/connector details' : 'Update business details',
      icon: Building2,
      href: isWingaPlan ? '/winga/business-info' : '/supplier/company-info',
      color: 'bg-purple-500 hover:bg-purple-600'
    }
  ]

  return (
    <>
      {/* Payment Status Alert */}
      {showPaymentAlert && paymentStatus && (
        <Alert className={cn(
          "mb-4 sm:mb-6",
          paymentStatus === 'success' 
            ? "border-green-500 bg-green-50 dark:bg-green-950/20" 
            : "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
        )}>
          {paymentStatus === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <XCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          )}
          <AlertTitle className={cn(
            "font-semibold",
            paymentStatus === 'success' 
              ? "text-green-900 dark:text-green-100" 
              : "text-orange-900 dark:text-orange-100"
          )}>
            {paymentStatus === 'success' ? 'Payment Successful!' : 'Payment Cancelled'}
          </AlertTitle>
          <AlertDescription className={cn(
            "mt-1",
            paymentStatus === 'success' 
              ? "text-green-800 dark:text-green-200" 
              : "text-orange-800 dark:text-orange-200"
          )}>
            {paymentStatus === 'success' 
              ? 'Your plan has been updated successfully. You can now enjoy all premium features!'
              : 'Your payment was cancelled. You can complete your payment anytime from the upgrade page.'}
            {paymentReferenceId && (
              <p className="mt-2 text-xs font-mono opacity-75">
                Reference: {paymentReferenceId}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className={cn("text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2", themeClasses.mainText)}>
          Dashboard
        </h1>
        <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
          Welcome back, {user?.name || user?.email || 'Supplier'}!
        </p>
      </div>

      {/* Pending Premium Plan Banner - Only show when payment_status is 'pending' (premium selected but payment not initiated yet) */}
      {/* When payment_status is null, it means free/winga plan - no banner needed */}
      {hasPendingPremiumPlan && planPaymentStatus === 'pending' && (
        <Alert className="mb-4 sm:mb-6 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CreditCard className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertTitle className="text-orange-900 dark:text-orange-100 font-semibold">
            Upgrading to Premium Plan
          </AlertTitle>
          <AlertDescription className="text-orange-800 dark:text-orange-200 mt-1">
            You have selected the Premium plan. Proceed to payment to unlock unlimited products and premium features.
            <div className="mt-3">
              <Link href={`/supplier/payment?planId=${pendingPlanId}`}>
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                  Proceed to Payment
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
            {statsCards.map((stat, index) => (
              <Card key={index} className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
                <CardContent className="p-3 sm:p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[10px] sm:text-xs lg:text-sm mb-1 truncate", themeClasses.textNeutralSecondary)}>
                        {stat.title}
                      </p>
                      <p className={cn("text-lg sm:text-xl lg:text-2xl font-bold truncate", themeClasses.mainText)}>
                        {stat.value}
                      </p>
                    </div>
                    <div className={cn("p-2 sm:p-2.5 lg:p-3 rounded-lg flex-shrink-0", stat.bgColor)}>
                      <stat.icon className={cn("w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6", stat.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

      {/* Quick Actions */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
            <h2 className={cn("text-lg sm:text-xl font-semibold mb-3 sm:mb-4", themeClasses.mainText)}>
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {quickActions.map((action, index) => (
                <Link key={index} href={action.href}>
                  <Card className={cn("border-2 cursor-pointer transition-all hover:shadow-lg hover:scale-105", themeClasses.cardBorder, themeClasses.cardBg)}>
                    <CardContent className="p-4 sm:p-5 lg:p-6">
                      <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mb-3 sm:mb-4", action.color)}>
                        <action.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <h3 className={cn("text-sm sm:text-base font-semibold mb-1", themeClasses.mainText)}>
                        {action.title}
                      </h3>
                      <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                        {action.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

      {/* Top Products and Recent Orders - Same Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6 lg:mb-8">
        {/* Top Products */}
        <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
          <CardHeader className="flex flex-row items-center justify-between pb-3 sm:pb-4">
            <CardTitle className={cn("text-base sm:text-lg font-semibold", themeClasses.mainText)}>
              Top Products
            </CardTitle>
            <Link href="/supplier/products">
              <Button variant="ghost" size="sm" className={cn("text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3", themeClasses.mainText)}>
                View All
                <ArrowRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingSections ? (
              <div className={cn("text-center py-8", themeClasses.textNeutralSecondary)}>
                <p className="text-xs sm:text-sm">Loading...</p>
              </div>
            ) : topProducts.length === 0 ? (
              <div className={cn("text-center py-8", themeClasses.textNeutralSecondary)}>
                <p className="text-xs sm:text-sm">No products yet</p>
                <p className="text-[10px] sm:text-xs mt-2">Start by adding your first product!</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {topProducts.map((product, index) => (
                  <Link key={product.id} href={`/products/${product.id}`}>
                    <div className={cn("flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg hover:bg-opacity-50 transition-colors cursor-pointer", themeClasses.cardBg)}>
                      <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 48px, 64px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs sm:text-sm font-medium truncate mb-0.5", themeClasses.mainText)}>
                          {product.name}
                        </p>
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <span className={cn("text-[10px] sm:text-xs font-semibold", themeClasses.mainText)}>
                            {formatPrice(product.price)}
                          </span>
                          {product.sales > 0 && (
                            <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5">
                              {product.sales} sold
                            </Badge>
                          )}
                          {product.views > 0 && (
                            <span className={cn("text-[9px] sm:text-[10px]", themeClasses.textNeutralSecondary)}>
                              {product.views} views
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={cn("text-xs sm:text-sm font-bold", themeClasses.textNeutralSecondary)}>
                          #{index + 1}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
          <CardHeader className="flex flex-row items-center justify-between pb-3 sm:pb-4">
            <CardTitle className={cn("text-base sm:text-lg font-semibold", themeClasses.mainText)}>
              Recent Orders
            </CardTitle>
            <Link href="/supplier/orders">
              <Button variant="ghost" size="sm" className={cn("text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3", themeClasses.mainText)}>
                View All
                <ArrowRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingSections ? (
              <div className={cn("text-center py-8", themeClasses.textNeutralSecondary)}>
                <p className="text-xs sm:text-sm">Loading...</p>
              </div>
            ) : recentOrders.length === 0 ? (
              <div className={cn("text-center py-8", themeClasses.textNeutralSecondary)}>
                <p className="text-xs sm:text-sm">No orders yet</p>
                <p className="text-[10px] sm:text-xs mt-2">Orders will appear here when customers purchase your products</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {recentOrders.map((order) => (
                  <Link key={order.id} href={`/supplier/orders`}>
                    <div className={cn("flex items-center justify-between p-2 sm:p-3 rounded-lg hover:bg-opacity-50 transition-colors cursor-pointer", themeClasses.cardBg)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={cn("text-xs sm:text-sm font-medium truncate", themeClasses.mainText)}>
                            {order.order_number}
                          </p>
                          <Badge
                            variant={order.payment_status === 'paid' ? 'default' : 'secondary'}
                            className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5"
                          >
                            {order.payment_status === 'paid' ? 'Paid' : order.payment_status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <span className={cn("text-[10px] sm:text-xs font-semibold", themeClasses.mainText)}>
                            {formatPrice(order.total_amount)}
                          </span>
                          <span className={cn("text-[9px] sm:text-[10px]", themeClasses.textNeutralSecondary)}>
                            {order.items_count} item{order.items_count !== 1 ? 's' : ''}
                          </span>
                          <span className={cn("text-[9px] sm:text-[10px]", themeClasses.textNeutralSecondary)}>
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5",
                            order.status === 'delivered' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            order.status === 'shipped' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            order.status === 'processing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          )}
                        >
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default function SupplierDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    }>
      <SupplierDashboardContent />
    </Suspense>
  )
}

