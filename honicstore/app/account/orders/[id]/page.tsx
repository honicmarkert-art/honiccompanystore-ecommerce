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
  // id: string // REMOVED: UUID should never be exposed to client
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
  // id: string // REMOVED: UUID should never be exposed to client
  itemKey?: string // Safe, non-UUID identifier for client-side operations
  productId: string
  productName: string
  productImage: string
  variantName?: string
  variantAttributes?: any
  quantity: number
  unitPrice: number
  totalPrice: number
  // supplierId?: string | null // REMOVED: UUID should never be exposed to client
  supplierName?: string | null // Only display name, never UUID
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
          setError('Too many requests. Please wait a moment and try again.')
        }
        return // Don't update loading state, just return
      }
      
      // Only show error on initial load, not on background refreshes
      if (!isBackgroundRefresh) {
        setError(error instanceof Error ? error.message : 'Failed to fetch order details')
      }
    } finally {
      // Only update loading state on initial load, not on background refreshes
      if (!isBackgroundRefresh) {
      setLoading(false)
      }
    }
  }
  
  const handleMarkAsDelivered = async () => {
    if (!orderNumber || !order) return
    
    try {
      setMarkingDelivered(true)
      
      const response = await fetch(`/api/user/orders/${orderNumber}/mark-delivered`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        // SECURITY: Don't send UUIDs. API will handle updating items by supplier group server-side
        body: JSON.stringify({}),
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
        throw new Error(errorData.error || errorData.details || 'Failed to mark order as received')
      }
      
      const data = await response.json()
      
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
      const errorMessage = error.message || 'Failed to mark order as received. Please try again.'
      alert(`Error: ${errorMessage}`)
    } finally {
      setMarkingReceived(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">Pending</Badge>
      case 'confirmed':
        return <Badge className="bg-blue-100 text-blue-800 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">Confirmed</Badge>
      case 'shipped':
        return <Badge className="bg-indigo-100 text-indigo-800 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">Shipped</Badge>
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">Delivered</Badge>
      case 'ready_for_pickup':
        return <Badge className="bg-purple-100 text-purple-800 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">Ready for Pickup</Badge>
      case 'picked_up':
        return <Badge className="bg-green-100 text-green-800 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">Picked Up</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">Cancelled</Badge>
      default:
        return <Badge variant="outline" className="text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">{status}</Badge>
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
      location: 'honic',
      completed: isConfirmed
    })
    
    // Step 3: Package shipped (for both shipping and pickup orders)
    // Always show this step if order is confirmed
    if (isConfirmed) {
      timeline.push({
        status: 'shipped',
        description: 'Package shipped',
        location: 'seller',
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
        location: 'seller',
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
        return <Badge className="bg-green-100 text-green-800 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">Payment Successful</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">Pending</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">Failed</Badge>
      case 'unpaid':
        return <Badge className="bg-gray-100 text-gray-800 text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">Unpaid</Badge>
      default:
        return <Badge variant="outline" className="text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1">{status}</Badge>
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
      <div className="flex items-center justify-center h-64 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <div className="text-sm sm:text-base">Loading order details...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] gap-3 sm:gap-4">
          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-600 dark:text-red-400" />
          <div className="text-sm sm:text-base text-red-600 dark:text-red-400 text-center px-4">{error}</div>
          <Button onClick={() => {
            setError(null)
            fetchOrderDetails(false)
          }} className="h-10 sm:h-11 text-sm sm:text-base px-6">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 min-h-screen bg-background">
        <Card className="shadow-sm border-0 sm:border">
          <CardContent className="p-6 sm:p-8 text-center">
            <Package className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium mb-2">Order Not Found</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4 px-4">
              The order you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Link href="/account/orders">
              <Button className="h-10 sm:h-11 text-sm sm:text-base px-6">Back to Orders</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
      {/* Header - Mobile Optimized */}
      <div className="mb-4 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
          <Link href="/account/orders">
            <Button variant="outline" size="sm" className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm">
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Back to Orders</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchOrderDetails(false)}
            disabled={loading}
            className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
        
        {/* Order Header Card - Mobile Native Style */}
        <Card className="mb-4 sm:mb-6 shadow-sm border-0 sm:border">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex flex-col gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                    <h1 className="text-lg sm:text-2xl font-bold truncate">{order.orderNumber}</h1>
                    <div className="flex-shrink-0">{getStatusBadge(order.status)}</div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate">{formatDate(order.createdAt)}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xl sm:text-2xl font-bold">{formatCurrency(order.totalAmount, order.currency)}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-3 pt-3 sm:pt-4 border-t">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">Payment:</span>
                <span className="truncate">{order.paymentMethod}</span>
                <div className="flex-shrink-0">{getPaymentStatusBadge(order.paymentStatus)}</div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">Delivery:</span>
                <Badge variant={order.deliveryOption === 'pickup' ? 'secondary' : 'outline'} className="text-xs">
                  {order.deliveryOption === 'pickup' ? 'Pickup' : 'Delivery'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Action Button - Mobile Optimized */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <Button variant="outline" size="lg" className="w-full h-11 sm:h-12 text-sm sm:text-base" onClick={() => handleDownloadInvoice()} disabled={downloadingInvoice}>
            <Download className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            {downloadingInvoice ? 'Generating Invoice...' : 'Download Invoice'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Order Items - Mobile Native Style */}
          <Card className="shadow-sm border-0 sm:border">
            <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                Order Items ({order.itemCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-6">
                {(() => {
                  // Group items by supplier
                  const groupedBySupplier = new Map<string | null, typeof order.items>()
                  
                  order.items.forEach(item => {
                    // SECURITY: Use supplier name as key instead of UUID
                    const supplierKey = item.supplierName || 'no-supplier'
                    if (!groupedBySupplier.has(supplierKey)) {
                      groupedBySupplier.set(supplierKey, [])
                    }
                    groupedBySupplier.get(supplierKey)!.push(item)
                  })
                  
                  return Array.from(groupedBySupplier.entries()).map(([supplierKey, items]) => {
                    const supplierName = items[0]?.supplierName || 'Honic Company'
                    // supplierId removed - UUID should never be exposed to client
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
                      <div key={supplierKey} className="border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 bg-white dark:bg-gray-900">
                        {/* Supplier Header - Mobile Optimized */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm sm:text-lg truncate">{supplierName}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                              {items.length} {items.length === 1 ? 'product' : 'products'} • Total: {formatCurrency(groupTotal)}
                            </p>
                            {trackingNumber && (
                              <div className="mt-2">
                                <p className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 break-all">
                                  Tracking: {trackingNumber}
                                </p>
                              </div>
                            )}
                          </div>
                          {/* Show status badge only - button moved to bottom */}
                          <div className="flex-shrink-0">
                            {packageStatus === 'picked_up' ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs px-2 py-1">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Picked Up
                              </Badge>
                            ) : packageStatus === 'delivered' ? (
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs px-2 py-1">
                                Delivered
                              </Badge>
                            ) : !trackingNumber ? (
                              <Badge variant="outline" className="text-muted-foreground text-xs px-2 py-1">
                                Tracking Pending
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-xs px-2 py-1">
                                {packageStatus === 'confirmed' ? 'Awaiting Shipment' : packageStatus}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Tracking Timeline - Horizontal - Mobile Optimized */}
                        {/* Show timeline if order is confirmed (has confirmedAt) - always show after confirmation */}
                        {order.confirmedAt && (
                          <div id={`tracking-timeline-${supplierKey}`} className="pt-3 sm:pt-4 border-t">
                            <h4 className="text-xs sm:text-sm font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                              <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              Package Tracking
                              {!trackingNumber && (
                                <Badge variant="outline" className="ml-1.5 sm:ml-2 text-[10px] sm:text-xs px-1.5 py-0.5">
                                  Tracking Pending
                                </Badge>
                              )}
                            </h4>
                            <div className="overflow-x-auto pb-2 sm:pb-4 -mx-3 sm:mx-0 px-3 sm:px-0">
                              <div className="flex items-start gap-1.5 sm:gap-2 min-w-max">
                                {getTrackingTimeline(packageStatus, order.deliveryOption, order.isReceived || false, order.confirmedAt).map((step, index, array) => {
                                  const isLastStep = index === array.length - 1
                                  
                                  return (
                                    <div key={index} className="flex items-start gap-1.5 sm:gap-2 flex-shrink-0">
                                      <div className="flex flex-col items-center">
                                        <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border-2 ${
                                          step.completed
                                            ? 'bg-green-500 border-green-500 text-white' 
                                            : isLastStep && !step.completed
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-muted border-muted-foreground'
                                        }`}>
                                          {step.completed ? (
                                            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                          ) : (
                                            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                          )}
                                        </div>
                                        {!isLastStep && (
                                          <div className={`h-0.5 w-8 sm:w-12 mt-1.5 sm:mt-2 ${
                                            step.completed ? 'bg-green-500' : 'bg-muted'
                                          }`} />
                                        )}
                                      </div>
                                      <div className="flex flex-col items-center min-w-[70px] sm:min-w-[80px] max-w-[100px] sm:max-w-[120px] pt-0.5 sm:pt-1">
                                        <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                                          <span className={`text-[10px] sm:text-xs font-medium text-center leading-tight ${
                                            step.completed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                                          }`}>
                                            {step.description}
                                          </span>
                                          {step.completed && (
                                            <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-500" />
                                          )}
                                        </div>
                                        <p className="text-[9px] sm:text-[10px] text-muted-foreground text-center mt-0.5 sm:mt-1 leading-tight">
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
                        
                        {/* Products in this supplier group - Mobile Native Style */}
                        <div className="space-y-2 sm:space-y-3">
                          {items.map((item) => (
                            <div key={item.itemKey || `${item.productId}-${item.variantName || 'default'}`} className="flex gap-2.5 sm:gap-4 p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                              <Image
                                src={item.productImage || '/placeholder.jpg'}
                                alt={item.productName || 'Product image'}
                                width={60}
                                height={60}
                                className="rounded-lg object-cover w-14 h-14 sm:w-[60px] sm:h-[60px] flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm sm:text-base truncate">{item.productName}</h4>
                                {item.variantName && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">Variant: {item.variantName}</p>
                                )}
                                <div className="flex items-center justify-between mt-1.5 sm:mt-2 gap-2">
                                  <span className="text-xs sm:text-sm text-muted-foreground">Qty: {item.quantity}</span>
                                  <span className="font-semibold text-xs sm:text-sm flex-shrink-0">{formatCurrency(item.totalPrice)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Pickup Confirmation Section - Show when package is delivered */}
                        {packageStatus === 'delivered' && (
                          <div className="pt-3 sm:pt-4 border-t space-y-3">
                            <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="flex items-start gap-2 sm:gap-3">
                                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 space-y-2">
                                  <h4 className="font-semibold text-sm sm:text-base text-blue-900 dark:text-blue-100">
                                    Package Delivered from {supplierName}
                                  </h4>
                                  <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                                    Your package has been delivered. Please pick it up and confirm to complete your order.
                                  </p>
                                  <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                      <span className="font-semibold">Auto-confirmation:</span> If you don't confirm within 5 days, 
                                      your order will be automatically confirmed and refund requests will not be considered.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <Button 
                              variant="default" 
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white border-purple-600 h-11 sm:h-12 text-sm sm:text-base font-semibold shadow-sm"
                              onClick={() => handleMarkAsDelivered(items.map(item => item.itemKey || `${item.productId}-${item.variantName || 'default'}`))}
                              disabled={markingDelivered}
                            >
                              {markingDelivered ? (
                                <>
                                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                                  Confirming Pickup...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                                  Confirm Package Pickup
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            </CardContent>
          </Card>

          
          {/* Congratulations message - Mobile Optimized */}
          {/* Only show when ALL packages are picked up */}
          {(() => {
            // Check if all items are picked up
            const allItemsPickedUp = order.items.every(item => item.status === 'picked_up')
            return allItemsPickedUp && (
              <Card className="shadow-sm border-0 sm:border">
                <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="text-center p-4 sm:p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200 dark:border-green-800">
                    <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-600 mx-auto mb-3 sm:mb-4" />
                    <h3 className="text-lg sm:text-2xl font-bold text-green-700 dark:text-green-300 mb-2">
                      Congratulations!
                    </h3>
                    <p className="text-sm sm:text-lg text-green-600 dark:text-green-400 mb-1">
                      Your order has been successfully picked up!
                    </p>
                    <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
                      Thank you for your purchase. We hope you enjoy your products!
                    </p>
                    </div>
                </CardContent>
              </Card>
            )
          })()}
          
          {/* Success Messages - Mobile Optimized */}
          {(order.status === 'delivered' || order.status === 'picked_up') && !order.isReceived && (
            <Card className="shadow-sm border-0 sm:border">
              <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2 text-blue-700 dark:text-blue-300">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
                    <span className="font-medium text-xs sm:text-sm leading-relaxed">
                      Package {order.status === 'picked_up' ? 'picked up' : 'delivered'}! Please confirm receipt above.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Final Success Message - Mobile Optimized */}
          {order.isReceived && order.receivedAt && (
            <Card className="shadow-sm border-0 sm:border">
              <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-300 dark:border-green-700">
                  <div className="flex items-start gap-2 sm:gap-3 text-green-700 dark:text-green-300">
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm sm:text-lg">Order Completed Successfully!</p>
                      <p className="text-xs sm:text-sm mt-1">Confirmed on {formatDate(order.receivedAt)}</p>
                      <p className="text-[10px] sm:text-xs mt-1 text-green-600 dark:text-green-400 italic">
                        This order is now read-only and cannot be modified.
                      </p>
                    </div>
                  </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Tracking Information - Mobile Optimized */}
          {order.trackingNumber && (
            <Card className="shadow-sm border-0 sm:border">
              <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
                  Tracking Information
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="text-xs sm:text-sm font-medium">Tracking Number</label>
                    <p className="text-sm sm:text-lg font-mono break-all mt-1">{order.trackingNumber}</p>
                  </div>
                  {order.estimatedDelivery && (
                    <div>
                      <label className="text-xs sm:text-sm font-medium">Estimated Delivery</label>
                      <p className="text-sm sm:text-lg mt-1">{formatDate(order.estimatedDelivery)}</p>
                    </div>
                  )}
                  <Button variant="outline" className="w-full h-10 sm:h-11 text-sm sm:text-base">
                    Track Package
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Mobile Optimized */}
        <div className="space-y-4 sm:space-y-6">
          {/* Order Summary - Mobile Native Style */}
          <Card className="shadow-sm border-0 sm:border">
            <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex justify-between text-sm sm:text-base">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(order.totalAmount, order.currency)}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span>Tax</span>
                  <span>TZS 0</span>
                </div>
                <hr className="my-2 sm:my-3" />
                <div className="flex justify-between font-semibold text-base sm:text-lg pt-1">
                  <span>Total</span>
                  <span>{formatCurrency(order.totalAmount, order.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information - Mobile Optimized */}
          <Card className="shadow-sm border-0 sm:border">
            <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-3">
                <div>
                  <label className="text-xs sm:text-sm font-medium">Payment Method</label>
                  <p className="text-sm sm:text-base mt-1">{order.paymentMethod}</p>
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium">Payment Status</label>
                  <div className="mt-1.5">
                    {getPaymentStatusBadge(order.paymentStatus)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Information - Mobile Optimized */}
          <Card className="shadow-sm border-0 sm:border">
            <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                {order.deliveryOption === 'pickup' ? <Package className="w-4 h-4 sm:w-5 sm:h-5" /> : <Truck className="w-4 h-4 sm:w-5 sm:h-5" />}
                {order.deliveryOption === 'pickup' ? 'Pickup Information' : 'Delivery Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-3 sm:space-y-4">
                {/* Delivery Method Badge */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-start sm:justify-center gap-2">
                  <Badge className={`whitespace-nowrap text-xs sm:text-sm ${order.deliveryOption === 'pickup' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {order.deliveryOption === 'pickup' ? 'Store Pickup' : 'Home Delivery'}
                  </Badge>
                  {order.deliveryOption === 'pickup' && (
                    <span className="text-xs sm:text-sm text-muted-foreground break-all">
                      Pickup ID: <span className="font-mono">{order.pickupId}</span>
                    </span>
                  )}
                </div>
                
                {/* Address Information - Mobile Optimized */}
                {(order.deliveryOption === 'delivery' || order.deliveryOption === 'shipping') && order.shippingAddress && (
                  <div className="space-y-1.5 sm:space-y-2">
                    {order.shippingAddress.fullName && (
                      <p className="font-medium text-sm sm:text-base">{order.shippingAddress.fullName}</p>
                    )}
                    {order.shippingAddress.address && (
                      <p className="text-sm sm:text-base">{order.shippingAddress.address}</p>
                    )}
                    {order.shippingAddress.address2 && <p className="text-sm sm:text-base">{order.shippingAddress.address2}</p>}
                    {(order.shippingAddress.city || order.shippingAddress.state) && (
                      <p className="text-sm sm:text-base">{[order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(', ')}</p>
                    )}
                    {(order.shippingAddress.postalCode || order.shippingAddress.country) && (
                      <p className="text-sm sm:text-base">{[order.shippingAddress.postalCode, order.shippingAddress.country].filter(Boolean).join(', ')}</p>
                    )}
                    {order.shippingAddress.phone && (
                      <p className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground mt-2">
                        <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        {order.shippingAddress.phone}
                      </p>
                    )}
                  </div>
                )}
                
                {/* For pickup orders, show pickup ID prominently if no address */}
                {order.deliveryOption === 'pickup' && (!order.shippingAddress || !order.shippingAddress.fullName) && (
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Pickup orders don't require a shipping address. Please collect from our store.
                    </p>
                  </div>
                )}

                {/* Pickup Instructions - Mobile Optimized */}
                {order.deliveryOption === 'pickup' && (
                  <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-1.5 sm:mb-2 text-sm sm:text-base">Pickup Instructions</h4>
                    <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300 leading-relaxed">
                      Please bring a valid ID and your pickup ID ({order.pickupId}) when collecting your order.
                      Our store hours are Monday-Friday 9AM-6PM, Saturday 9AM-4PM.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Billing Address - Mobile Optimized */}
          {order.billingAddress && (
            <Card className="shadow-sm border-0 sm:border">
              <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Home className="w-4 h-4 sm:w-5 sm:h-5" />
                  Billing Address
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-1.5 sm:space-y-2">
                  {order.billingAddress.fullName && (
                    <p className="font-medium text-sm sm:text-base">{order.billingAddress.fullName}</p>
                  )}
                  {order.billingAddress.address && (
                    <p className="text-sm sm:text-base">{order.billingAddress.address}</p>
                  )}
                  {(order.billingAddress.city || order.billingAddress.region) && (
                    <p className="text-sm sm:text-base">{[order.billingAddress.city, order.billingAddress.region].filter(Boolean).join(', ')}</p>
                  )}
                  {(order.billingAddress.postalCode || order.billingAddress.country) && (
                    <p className="text-sm sm:text-base">{[order.billingAddress.postalCode, order.billingAddress.country].filter(Boolean).join(', ')}</p>
                  )}
                  {order.billingAddress.phone && (
                    <p className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground mt-2">
                      <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      {order.billingAddress.phone}
                    </p>
                  )}
                  {order.billingAddress.email && (
                    <p className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="break-all">{order.billingAddress.email}</span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Notes - Mobile Optimized */}
          {order.notes && (
            <Card className="shadow-sm border-0 sm:border">
              <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  Special Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <p className="text-xs sm:text-sm leading-relaxed">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Actions - Mobile Optimized */}
          <Card className="shadow-sm border-0 sm:border">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2.5 sm:space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    className="w-full h-10 sm:h-11 text-xs sm:text-sm" 
                    onClick={() => handleDownloadInvoice()}
                    disabled={downloadingInvoice}
                  >
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                    <span className="hidden sm:inline">{downloadingInvoice ? 'Generating...' : 'HTML Invoice'}</span>
                    <span className="sm:hidden">HTML</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full h-10 sm:h-11 text-xs sm:text-sm"
                    onClick={() => handleDownloadInvoice(order!.orderNumber, 'pdf')}
                    disabled={downloadingInvoice}
                  >
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                    <span className="hidden sm:inline">PDF Invoice</span>
                    <span className="sm:hidden">PDF</span>
                  </Button>
                </div>
                <Button variant="outline" className="w-full h-10 sm:h-11 text-xs sm:text-sm" onClick={() => fetchOrderDetails(false)} disabled={loading}>
                  <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Status
                </Button>
                {order.status === 'delivered' && (
                  <Button variant="outline" className="w-full h-10 sm:h-11 text-xs sm:text-sm">
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
