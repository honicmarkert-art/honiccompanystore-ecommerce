"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Package, 
  ArrowLeft,
  Download,
  RefreshCw,
  MapPin,
  CreditCard,
  Truck,
  CheckCircle,
  Clock,
  X,
  AlertCircle,
  Phone,
  Mail,
  Calendar,
  User,
  Home,
  ChevronRight,
  Eye
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { useOrders } from '@/hooks/use-orders'
import Link from 'next/link'
import Image from 'next/image'

interface Order {
  id: string
  orderNumber: string
  referenceId: string
  pickupId: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'ready_for_pickup' | 'picked_up'
  totalAmount: number
  currency: string
  itemCount: number
  totalItems: number
  createdAt: string
  updatedAt: string
  paymentMethod: string
  paymentStatus: 'pending' | 'paid' | 'failed' | 'unpaid'
  clickpesaTransactionId?: string
  paymentTimestamp?: string
  failureReason?: string
  deliveryOption: 'shipping' | 'pickup'
  trackingNumber?: string
  estimatedDelivery?: string
  isReceived?: boolean
  receivedAt?: string | null
  confirmedAt?: string | null
  shippingAddress: {
    fullName: string
    address: string
    address2?: string
    city: string
    state: string
    postalCode: string
    country: string
    phone: string
  }
  items: OrderItem[]
  notes?: string
}

interface OrderItem {
  id: string
  productId: string
  productName: string
  productImage: string
  variantName?: string
  variantAttributes?: any
  quantity: number
  unitPrice: number
  totalPrice: number
  supplierId?: string | null
  supplierName?: string | null
  trackingNumber?: string | null
  status?: string // Per-item status from confirmed_order_items
}

interface OrderStatus {
  status: string
  timestamp: string
  description: string
  location?: string
}

function OrderDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth()
  const router = useRouter()
  const { fetchOrderByNumber, getOrderStatusHistory } = useOrders()
  const [order, setOrder] = useState<Order | null>(null)
  const [statusHistory, setStatusHistory] = useState<OrderStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [downloadingInvoice, setDownloadingInvoice] = useState(false)
  const [markingReceived, setMarkingReceived] = useState(false)
  const [markingDelivered, setMarkingDelivered] = useState(false)

  useEffect(() => {
    const getOrderNumber = async () => {
      const resolvedParams = await params
      setOrderNumber(resolvedParams.id) // This will now be orderNumber from URL
    }
    getOrderNumber()
  }, [params])

  // Auto-refresh order details every 2 minutes (reduced frequency to avoid rate limits)
  useEffect(() => {
    if (!orderNumber) return

    // Initial fetch (with loading state)
    fetchOrderDetails(false)

    let intervalId: NodeJS.Timeout | null = null
    let isPageVisible = true

    // Pause refresh when page is not visible to reduce unnecessary requests
    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Set up interval to refresh every 2 minutes (background refresh, no loading state)
    // Only refresh if page is visible
    intervalId = setInterval(() => {
      if (isPageVisible) {
        fetchOrderDetails(true)
      }
    }, 120000) // 2 minutes = 120000 milliseconds (reduced to avoid rate limits)

    // Cleanup interval and event listener on unmount or when orderNumber changes
    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [orderNumber])

  const fetchOrderDetails = async (isBackgroundRefresh: boolean = false) => {
    // Don't fetch if orderNumber is not available
    if (!orderNumber) {
      return
    }

    try {
      // Only show loading state on initial load, not on background refreshes
      if (!isBackgroundRefresh) {
      setLoading(true)
        setError(null) // Clear any previous errors
      }
      
      // Fetch order details by order number
      const orderData = await fetchOrderByNumber(orderNumber)
      
      // If orderData is null, don't update state (order might not exist)
      if (!orderData) {
        if (!isBackgroundRefresh) {
          setLoading(false)
        }
        return
      }
      
      setOrder(orderData)
      
      // Debug: Log order data to see what status we're getting
      console.log('📦 Order Data:', {
        status: orderData?.status,
        deliveryOption: orderData?.deliveryOption,
        confirmedAt: orderData?.confirmedAt,
        updatedAt: orderData?.updatedAt
      })
      
      // Build dynamic status history from order data
      const dynamicStatusHistory: OrderStatus[] = []
      
      // Step 1: Order placed
      dynamicStatusHistory.push({
        status: 'pending',
        timestamp: orderData?.createdAt || new Date().toISOString(),
        description: 'Order placed and payment pending',
        location: 'Online'
      })
      
      // Step 2: Payment status
      if (orderData?.paymentStatus === 'paid') {
        dynamicStatusHistory.push({
          status: 'paid',
          timestamp: orderData?.paymentTimestamp || orderData?.updatedAt || new Date().toISOString(),
          description: `Payment ${orderData.paymentStatus === 'paid' ? 'completed successfully' : orderData.paymentStatus}`,
          location: 'Online'
        })
      } else if (orderData?.paymentStatus === 'failed') {
        dynamicStatusHistory.push({
          status: 'failed',
          timestamp: orderData?.paymentTimestamp || orderData?.updatedAt || new Date().toISOString(),
          description: `Payment ${orderData.paymentStatus}`,
          location: 'Online'
        })
      } else {
        dynamicStatusHistory.push({
          status: 'pending',
          timestamp: orderData?.updatedAt || new Date().toISOString(),
          description: 'Payment pending',
          location: 'Online'
        })
      }
      
      // Step 3: Confirmation status (always show if order is confirmed or beyond)
      if (orderData?.confirmedAt || 
          orderData?.status === 'confirmed' || 
          orderData?.status === 'shipped' || 
          orderData?.status === 'delivered' || 
          orderData?.status === 'ready_for_pickup' || 
          orderData?.status === 'picked_up') {
        dynamicStatusHistory.push({
          status: 'confirmed',
          timestamp: orderData?.confirmedAt || orderData?.updatedAt || new Date().toISOString(),
          description: 'Order confirmed by admin',
          location: 'Online'
        })
      }
      
      // Step 4: Shipped status - show when status is 'shipped' (regardless of delivery option)
      // Note: Admin may mark pickup orders as 'shipped' in some cases
      if (orderData?.status === 'shipped') {
        dynamicStatusHistory.push({
          status: 'shipped',
          timestamp: orderData?.updatedAt || orderData?.confirmedAt || new Date().toISOString(),
          description: orderData?.deliveryOption === 'pickup' 
            ? 'Order processed and ready' 
            : 'Order shipped and in transit',
          location: orderData?.deliveryOption === 'pickup' ? 'Store' : 'In Transit'
        })
      }
      
      // Step 4: Ready for pickup status (for pickup orders) - show separately from confirmation
      if (orderData?.deliveryOption === 'pickup') {
        if (orderData?.status === 'ready_for_pickup' || orderData?.status === 'picked_up') {
          dynamicStatusHistory.push({
            status: 'ready_for_pickup',
            timestamp: orderData?.updatedAt || orderData?.confirmedAt || new Date().toISOString(),
            description: 'Order ready for pickup',
            location: 'Store'
          })
        }
      }
      
      // Step 5: Delivered/Picked up status (customer marks when they receive the package)
      if (orderData?.status === 'delivered') {
        dynamicStatusHistory.push({
          status: 'delivered',
          timestamp: orderData?.updatedAt || new Date().toISOString(),
          description: 'Package delivered to customer',
          location: orderData?.shippingAddress?.city || 'Destination'
        })
      }
      
      if (orderData?.status === 'picked_up') {
        dynamicStatusHistory.push({
          status: 'picked_up',
          timestamp: orderData?.updatedAt || new Date().toISOString(),
          description: 'Package picked up by customer',
          location: 'Store'
        })
      }
      
      // Step 6: Received status (FINAL STEP - customer confirms they received the package)
      if (orderData?.isReceived && orderData?.receivedAt) {
        dynamicStatusHistory.push({
          status: 'received',
          timestamp: orderData.receivedAt,
          description: 'Order received successfully - Process completed',
          location: 'Customer'
        })
      }
      
      setStatusHistory(dynamicStatusHistory)
    } catch (error: any) {
      // Handle rate limit errors gracefully
      if (error?.status === 429 || error?.code === 'over_request_rate_limit') {
        if (!isBackgroundRefresh) {
          console.warn('Rate limit reached. Please wait a moment before refreshing.')
          setError('Too many requests. Please wait a moment and try again.')
      } else {
          // For background refreshes, just log and skip - don't show error
          console.debug('Rate limit reached during background refresh. Skipping this refresh cycle.')
        }
        return // Don't update loading state, just return
      }
      
      // Only show error on initial load, not on background refreshes
      if (!isBackgroundRefresh) {
        console.error('Error fetching order details:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch order details')
      } else {
        // Silently log background refresh errors for debugging
        console.debug('Background refresh error (silent):', error)
      }
    } finally {
      // Only update loading state on initial load, not on background refreshes
      if (!isBackgroundRefresh) {
      setLoading(false)
      }
    }
  }
  
  const handleMarkAsDelivered = async (itemIds?: string[]) => {
    if (!orderNumber || !order) return
    
    try {
      setMarkingDelivered(true)
      
      const response = await fetch(`/api/user/orders/${orderNumber}/mark-delivered`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemIds: itemIds || undefined
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to mark order')
      }
      
      const data = await response.json()
      
      // Update local order state based on API response
      const newStatus = data.status || (order.deliveryOption === 'pickup' && order.status === 'delivered' ? 'picked_up' : 'delivered')
      setOrder({
        ...order,
        status: newStatus,
        updatedAt: data.updated_at,
        isReceived: data.is_received || false,
        receivedAt: data.received_at || null
      })
      
      // Refresh status history (background refresh, no loading state)
      await fetchOrderDetails(true)
    } catch (error: any) {
      console.error('Error marking order as delivered/picked up:', error)
      alert(error.message || 'Failed to mark order. Please try again.')
    } finally {
      setMarkingDelivered(false)
    }
  }
  
  const handleMarkAsReceived = async () => {
    if (!orderNumber || !order) return
    
    try {
      setMarkingReceived(true)
      
      const response = await fetch(`/api/user/orders/${orderNumber}/mark-received`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('❌ [MARK-RECEIVED] API Error:', errorData)
        throw new Error(errorData.error || errorData.details || 'Failed to mark order as received')
      }
      
      const data = await response.json()
      console.log('✅ [MARK-RECEIVED] Success:', data)
      
      // Update local order state
      setOrder({
        ...order,
        isReceived: true,
        receivedAt: data.received_at
      })
      
      // Refresh status history (background refresh, no loading state)
      await fetchOrderDetails(true)
      
      alert('Order received successfully!')
    } catch (error: any) {
      console.error('❌ [MARK-RECEIVED] Full error:', error)
      console.error('❌ [MARK-RECEIVED] Error message:', error.message)
      console.error('❌ [MARK-RECEIVED] Error stack:', error.stack)
      const errorMessage = error.message || 'Failed to mark order as received. Please try again.'
      alert(`Error: ${errorMessage}\n\nPlease check the browser console for more details.`)
    } finally {
      setMarkingReceived(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'confirmed':
        return <Badge className="bg-blue-100 text-blue-800">Confirmed</Badge>
      case 'shipped':
        return <Badge className="bg-indigo-100 text-indigo-800">Shipped</Badge>
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800">Delivered</Badge>
      case 'ready_for_pickup':
        return <Badge className="bg-purple-100 text-purple-800">Ready for Pickup</Badge>
      case 'picked_up':
        return <Badge className="bg-green-100 text-green-800">Picked Up</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5" />
      case 'paid':
        return <CreditCard className="w-5 h-5" />
      case 'failed':
        return <X className="w-5 h-5" />
      case 'confirmed':
        return <CheckCircle className="w-5 h-5" />
      case 'shipped':
        return <Truck className="w-5 h-5" />
      case 'delivered':
        return <CheckCircle className="w-5 h-5" />
      case 'ready_for_pickup':
        return <Package className="w-5 h-5" />
      case 'picked_up':
        return <CheckCircle className="w-5 h-5" />
      case 'received':
        return <CheckCircle className="w-5 h-5" />
      case 'cancelled':
        return <X className="w-5 h-5" />
      default:
        return <Package className="w-5 h-5" />
    }
  }
  
  // Generate tracking timeline based on package status from confirmed_order_items.status
  // packageStatus comes from item.status column in confirmed_order_items table
  const getTrackingTimeline = (packageStatus: string, deliveryOption: string, isReceived: boolean, confirmedAt?: string | null) => {
    const timeline: Array<{ status: string; description: string; location: string; completed: boolean }> = []
    
    // Determine completion states based on package status from confirmed_order_items.status
    const isConfirmed = confirmedAt !== null && confirmedAt !== undefined || 
                        packageStatus === 'confirmed' || 
                        packageStatus === 'shipped' || 
                        packageStatus === 'delivered' || 
                        packageStatus === 'picked_up' || 
                        isReceived
    
    const isShipped = packageStatus === 'shipped' || 
                     packageStatus === 'delivered' || 
                     packageStatus === 'picked_up' || 
                     isReceived
    
    const isDelivered = packageStatus === 'delivered' || 
                       packageStatus === 'picked_up' || 
                       isReceived
    
    // Step 1: Order placed (always completed)
    timeline.push({
      status: 'placed',
      description: 'Order placed',
      location: 'Online',
      completed: true
    })
    
    // Step 2: Confirmed - Show as completed if order has been confirmed
    timeline.push({
      status: 'confirmed',
      description: 'Order confirmed',
      location: 'Store',
      completed: isConfirmed
    })
    
    // Step 3: Package shipped (for both shipping and pickup orders)
    // Always show this step if order is confirmed
    if (isConfirmed) {
      timeline.push({
        status: 'shipped',
        description: 'Package shipped',
        location: deliveryOption === 'pickup' ? 'Store' : 'Warehouse',
        completed: isShipped
      })
    }
    
    // Step 4: Shipping vs Pickup paths
    if (deliveryOption === 'shipping' && isShipped) {
      // Shipping: In transit (only show if shipped)
      timeline.push({
        status: 'transit',
        description: 'In transit',
        location: 'On the way',
        completed: isDelivered
      })
      
      // Shipping: Out for delivery (only show if shipped)
      timeline.push({
        status: 'out_for_delivery',
        description: 'Out for delivery',
        location: 'Local area',
        completed: isDelivered
      })
    }
    
    // Step 5: Package delivered (for both shipping and pickup orders)
    // Always show if order is confirmed
    if (isConfirmed) {
      timeline.push({
        status: 'delivered',
        description: 'Package delivered',
        location: deliveryOption === 'pickup' ? 'Store' : 'Destination',
        completed: packageStatus === 'delivered' || packageStatus === 'picked_up' || isReceived
      })
    }
    
    // Step 6: Package picked up (only for pickup orders, final step)
    // Show after delivered step for pickup orders - this is the final status
    if (isConfirmed && deliveryOption === 'pickup') {
      timeline.push({
        status: 'picked_up',
        description: 'Package picked up',
        location: 'Customer', // Changed from 'Store' to 'Customer' since customer picks it up
        completed: packageStatus === 'picked_up'
      })
    }
    
    // Step 7: Package received (final step - only for shipping orders)
    // Only show for shipping orders, not pickup orders
    if (isDelivered && deliveryOption === 'shipping') {
      timeline.push({
        status: 'received',
        description: 'Package received',
        location: 'Customer',
        completed: isReceived
      })
    }
    
    return timeline
  }

  const getStatusBadgeForTimeline = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Payment Successful</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>
      case 'confirmed':
        return <Badge className="bg-blue-100 text-blue-800">Confirmed</Badge>
      case 'shipped':
        return <Badge className="bg-indigo-100 text-indigo-800">Shipped</Badge>
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800">Delivered</Badge>
      case 'ready_for_pickup':
        return <Badge className="bg-purple-100 text-purple-800">Ready for Pickup</Badge>
      case 'picked_up':
        return <Badge className="bg-green-100 text-green-800">Picked Up</Badge>
      case 'received':
        return <Badge className="bg-green-100 text-green-800">Received</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Payment Successful</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>
      case 'unpaid':
        return <Badge className="bg-gray-100 text-gray-800">Unpaid</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number | undefined, currency: string = 'TZS') => {
    if (!amount) return `${currency} 0`
    return `${currency} ${amount.toLocaleString()}`
  }

  const handleDownloadInvoice = async (orderNumber?: string, format: 'html' | 'pdf' = 'html') => {
    const currentOrderNumber = orderNumber || order?.orderNumber
    
    if (!currentOrderNumber) return
    
    setDownloadingInvoice(true)
    try {
      const endpoint = format === 'pdf' 
        ? `/api/user/orders/${currentOrderNumber}/invoice-pdf`
        : `/api/user/orders/${currentOrderNumber}/invoice`
      
      const response = await fetch(endpoint)
      
      if (!response.ok) {
        throw new Error('Failed to generate invoice')
      }
      
      // Get the content
      const content = await response.text()
      
      // Create a blob and download it
      const mimeType = format === 'pdf' ? 'text/plain' : 'text/html'
      const fileExtension = format === 'pdf' ? 'txt' : 'html'
      
      const blob = new Blob([content], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `invoice-${currentOrderNumber || order?.orderNumber}.${fileExtension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
    } catch (error) {
      alert('Failed to download invoice. Please try again.')
    } finally {
      setDownloadingInvoice(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading order details...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="text-lg text-red-600 dark:text-red-400">{error}</div>
          <Button onClick={() => {
            setError(null)
            fetchOrderDetails(false)
          }}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-screen bg-background">
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Order Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The order you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Link href="/account/orders">
              <Button>Back to Orders</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/account/orders">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchOrderDetails(false)}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        {/* Order Header Card - Improved Layout */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
                  {getStatusBadge(order.status)}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(order.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-4 h-4" />
                    {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold">{formatCurrency(order.totalAmount, order.currency)}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Payment:</span>
                <span className="text-sm">{order.paymentMethod}</span>
                {getPaymentStatusBadge(order.paymentStatus)}
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Delivery:</span>
                <Badge variant={order.deliveryOption === 'pickup' ? 'secondary' : 'outline'}>
                  {order.deliveryOption === 'pickup' ? 'Pickup' : 'Delivery'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Action Button */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="outline" size="lg" className="w-full" onClick={() => handleDownloadInvoice()} disabled={downloadingInvoice}>
            <Download className="w-4 h-4 mr-2" />
            {downloadingInvoice ? 'Generating Invoice...' : 'Download Invoice'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Order Items ({order.itemCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {(() => {
                  // Group items by supplier
                  const groupedBySupplier = new Map<string | null, typeof order.items>()
                  
                  order.items.forEach(item => {
                    const supplierKey = item.supplierId || 'no-supplier'
                    if (!groupedBySupplier.has(supplierKey)) {
                      groupedBySupplier.set(supplierKey, [])
                    }
                    groupedBySupplier.get(supplierKey)!.push(item)
                  })
                  
                  return Array.from(groupedBySupplier.entries()).map(([supplierKey, items]) => {
                    const supplierName = items[0]?.supplierName || 'Honic Company'
                    const supplierId = items[0]?.supplierId
                    const groupTotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
                    // Get tracking number from first item (all items from same supplier should have same tracking number)
                    const trackingNumber = items[0]?.trackingNumber || items.find(item => item.trackingNumber)?.trackingNumber || null
                    // Get package status - use the most advanced status among items in this package
                    // Priority: delivered/picked_up > shipped > confirmed
                    const packageStatus = items.reduce((currentStatus, item) => {
                      const itemStatus = item.status || 'confirmed'
                      if (itemStatus === 'delivered' || itemStatus === 'picked_up') return itemStatus
                      if (itemStatus === 'shipped' && currentStatus !== 'delivered' && currentStatus !== 'picked_up') return itemStatus
                      if (itemStatus === 'confirmed' && currentStatus === 'confirmed') return itemStatus
                      return currentStatus
                    }, 'confirmed')
                    
                    return (
                      <div key={supplierKey} className="border rounded-lg p-4 space-y-4">
                        {/* Supplier Header */}
                        <div className="flex items-center justify-between pb-3 border-b">
                          <div>
                            <h3 className="font-semibold text-lg">{supplierName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {items.length} {items.length === 1 ? 'product' : 'products'} • Total: {formatCurrency(groupTotal)}
                            </p>
                            {trackingNumber && (
                              <div className="mt-2">
                                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                  Tracking: {trackingNumber}
                                </p>
                              </div>
                            )}
                          </div>
                          {/* Show button based on package status, not tracking number */}
                          {packageStatus === 'picked_up' ? (
                            <Button 
                              variant="outline" 
                              className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                              disabled
                            >
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              Package Picked Up
                            </Button>
                          ) : packageStatus === 'delivered' ? (
                            <Button 
                              variant="outline" 
                              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                              onClick={() => handleMarkAsDelivered(items.map(item => item.id))}
                              disabled={markingDelivered}
                            >
                              {markingDelivered ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                  <>
                                    <Package className="w-4 h-4" />
                                    Package Picked Up
                                  </>
                                )}
                              </Button>
                          ) : !trackingNumber ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              Tracking Pending
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              {packageStatus === 'confirmed' ? 'Awaiting Shipment' : packageStatus}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Tracking Timeline - Horizontal */}
                        {/* Show timeline if order is confirmed (has confirmedAt) - always show after confirmation */}
                        {order.confirmedAt && (
                          <div id={`tracking-timeline-${supplierKey}`} className="pt-4 border-t">
                            <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                              <Truck className="w-4 h-4" />
                              Package Tracking
                              {!trackingNumber && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Tracking Pending
                                </Badge>
                              )}
                            </h4>
                            <div className="overflow-x-auto pb-4">
                              <div className="flex items-start gap-2 min-w-max">
                                {getTrackingTimeline(packageStatus, order.deliveryOption, order.isReceived || false, order.confirmedAt).map((step, index, array) => {
                                  const isLastStep = index === array.length - 1
                                  
                                  return (
                                    <div key={index} className="flex items-start gap-2 flex-shrink-0">
                                      <div className="flex flex-col items-center">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                                          step.completed
                                            ? 'bg-green-500 border-green-500 text-white' 
                                            : isLastStep && !step.completed
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-muted border-muted-foreground'
                                        }`}>
                                          {step.completed ? (
                                            <CheckCircle className="w-4 h-4" />
                                          ) : (
                                            <Clock className="w-3.5 h-3.5" />
                                          )}
                                        </div>
                                        {!isLastStep && (
                                          <div className={`h-0.5 w-12 mt-2 ${
                                            step.completed ? 'bg-green-500' : 'bg-muted'
                                          }`} />
                                        )}
                                      </div>
                                      <div className="flex flex-col items-center min-w-[80px] max-w-[120px] pt-1">
                                        <div className="flex flex-col items-center gap-1">
                                          <span className={`text-xs font-medium text-center ${
                                            step.completed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                                          }`}>
                                            {step.description}
                                          </span>
                                          {step.completed && (
                                            <CheckCircle className="w-3 h-3 text-green-500" />
                                          )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground text-center mt-1">
                                          {step.location}
                                        </p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Products in this supplier group */}
                        <div className="space-y-3">
                          {items.map((item) => (
                            <div key={item.id} className="flex gap-4 p-3 bg-muted/50 rounded-lg">
                    <Image
                      src={item.productImage || '/placeholder.jpg'}
                      alt={item.productName || 'Product image'}
                                width={60}
                                height={60}
                      className="rounded-lg object-cover"
                    />
                    <div className="flex-1">
                                <h4 className="font-medium">{item.productName}</h4>
                      {item.variantName && (
                                  <p className="text-xs text-muted-foreground">Variant: {item.variantName}</p>
                                )}
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-sm text-muted-foreground">Qty: {item.quantity}</span>
                                  <span className="font-semibold text-sm">{formatCurrency(item.totalPrice)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons - Moved from Order Status section */}
          {/* For both shipping and pickup orders: Mark as Picked Up after delivered */}
          {order.status === 'delivered' && order.status !== 'picked_up' && (
          <Card>
              <CardContent className="pt-6">
                <Button 
                  onClick={handleMarkAsDelivered}
                  disabled={markingDelivered}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {markingDelivered ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4 mr-2" />
                      Package Picked Up
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
          
          {/* Congratulations message - Final status for both shipping and pickup orders */}
          {/* Only show when ALL packages are picked up */}
          {(() => {
            // Check if all items are picked up
            const allItemsPickedUp = order.items.every(item => item.status === 'picked_up')
            return allItemsPickedUp && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200 dark:border-green-800">
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">
                      Congratulations!
                    </h3>
                    <p className="text-lg text-green-600 dark:text-green-400 mb-1">
                      Your order has been successfully picked up!
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Thank you for your purchase. We hope you enjoy your products!
                    </p>
                    </div>
                </CardContent>
              </Card>
            )
          })()}
          
          {/* Success Messages */}
          {(order.status === 'delivered' || order.status === 'picked_up') && !order.isReceived && (
            <Card>
              <CardContent className="pt-6">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">
                      Package {order.status === 'picked_up' ? 'picked up' : 'delivered'}! Please confirm receipt above.
                        </span>
                      </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Final Success Message - Order Complete and Read-Only */}
          {order.isReceived && order.receivedAt && (
            <Card>
              <CardContent className="pt-6">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-300 dark:border-green-700">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="w-6 h-6" />
                    <div>
                      <p className="font-bold text-lg">Order Completed Successfully!</p>
                      <p className="text-sm">Confirmed on {formatDate(order.receivedAt)}</p>
                      <p className="text-xs mt-1 text-green-600 dark:text-green-400 italic">
                        This order is now read-only and cannot be modified.
                      </p>
                    </div>
                  </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Tracking Information */}
          {order.trackingNumber && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Tracking Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Tracking Number</label>
                    <p className="text-lg font-mono">{order.trackingNumber}</p>
                  </div>
                  {order.estimatedDelivery && (
                    <div>
                      <label className="text-sm font-medium">Estimated Delivery</label>
                      <p className="text-lg">{formatDate(order.estimatedDelivery)}</p>
                    </div>
                  )}
                  <Button variant="outline" className="w-full">
                    Track Package
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.totalAmount, order.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>TZS 0</span>
                </div>
                <hr />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(order.totalAmount, order.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Payment Method</label>
                  <p>{order.paymentMethod}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Payment Status</label>
                  <div className="mt-1">
                    {getPaymentStatusBadge(order.paymentStatus)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {order.deliveryOption === 'pickup' ? <Package className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                {order.deliveryOption === 'pickup' ? 'Pickup Information' : 'Delivery Information'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Delivery Method Badge */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <Badge className={`whitespace-nowrap ${order.deliveryOption === 'pickup' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {order.deliveryOption === 'pickup' ? 'Store Pickup' : 'Home Delivery'}
                  </Badge>
                  {order.deliveryOption === 'pickup' && (
                    <span className="text-sm text-muted-foreground text-center sm:text-left break-all sm:break-normal">
                      Pickup ID: <span className="font-mono">{order.pickupId}</span>
                    </span>
                  )}
                </div>
                
                {/* Address Information - Only show if there's an address for delivery orders */}
                {(order.deliveryOption === 'delivery' || order.deliveryOption === 'shipping') && order.shippingAddress && (
                  <div className="space-y-2">
                    {order.shippingAddress.fullName && (
                      <p className="font-medium">{order.shippingAddress.fullName}</p>
                    )}
                    {order.shippingAddress.address && (
                      <p>{order.shippingAddress.address}</p>
                    )}
                    {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
                    {(order.shippingAddress.city || order.shippingAddress.state) && (
                      <p>{[order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(', ')}</p>
                    )}
                    {(order.shippingAddress.postalCode || order.shippingAddress.country) && (
                      <p>{[order.shippingAddress.postalCode, order.shippingAddress.country].filter(Boolean).join(', ')}</p>
                    )}
                    {order.shippingAddress.phone && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        {order.shippingAddress.phone}
                      </p>
                    )}
                  </div>
                )}
                
                {/* For pickup orders, show pickup ID prominently if no address */}
                {order.deliveryOption === 'pickup' && (!order.shippingAddress || !order.shippingAddress.fullName) && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Pickup orders don't require a shipping address. Please collect from our store.
                    </p>
                  </div>
                )}

                {/* Pickup Instructions */}
                {order.deliveryOption === 'pickup' && (
                  <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Pickup Instructions</h4>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Please bring a valid ID and your pickup ID ({order.pickupId}) when collecting your order.
                      Our store hours are Monday-Friday 9AM-6PM, Saturday 9AM-4PM.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Billing Address */}
          {order.billingAddress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="w-5 h-5" />
                  Billing Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {order.billingAddress.fullName && (
                    <p className="font-medium">{order.billingAddress.fullName}</p>
                  )}
                  {order.billingAddress.address && (
                    <p>{order.billingAddress.address}</p>
                  )}
                  {(order.billingAddress.city || order.billingAddress.region) && (
                    <p>{[order.billingAddress.city, order.billingAddress.region].filter(Boolean).join(', ')}</p>
                  )}
                  {(order.billingAddress.postalCode || order.billingAddress.country) && (
                    <p>{[order.billingAddress.postalCode, order.billingAddress.country].filter(Boolean).join(', ')}</p>
                  )}
                  {order.billingAddress.phone && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      {order.billingAddress.phone}
                    </p>
                  )}
                  {order.billingAddress.email && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      {order.billingAddress.email}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Special Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    className="w-full" 
                    onClick={() => handleDownloadInvoice()}
                    disabled={downloadingInvoice}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {downloadingInvoice ? 'Generating...' : 'HTML Invoice'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleDownloadInvoice(order!.orderNumber, 'pdf')}
                    disabled={downloadingInvoice}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    PDF Invoice
                  </Button>
                </div>
                <Button variant="outline" className="w-full">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Status
                </Button>
                {order.status === 'delivered' && (
                  <Button variant="outline" className="w-full">
                    Leave Review
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProtectedRoute>
      <OrderDetailContent params={params} />
    </ProtectedRoute>
  )
}
