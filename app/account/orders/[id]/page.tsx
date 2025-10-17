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
  ChevronRight
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
  const { fetchOrderById, getOrderStatusHistory } = useOrders()
  const [order, setOrder] = useState<Order | null>(null)
  const [statusHistory, setStatusHistory] = useState<OrderStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [downloadingInvoice, setDownloadingInvoice] = useState(false)

  useEffect(() => {
    const getOrderId = async () => {
      const resolvedParams = await params
      setOrderId(resolvedParams.id)
    }
    getOrderId()
  }, [params])

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails()
    }
  }, [orderId])

  const fetchOrderDetails = async () => {
    try {
      setLoading(true)
      
      // Fetch order details
      const orderData = await fetchOrderById(orderId)
      setOrder(orderData)
      
      // Fetch status history
      const statusData = await getOrderStatusHistory(orderId)
      
      // Filter status history based on delivery option
      let filteredStatusHistory = statusData
      if (orderData?.deliveryOption === 'pickup') {
        // For pickup orders, only show relevant statuses
        filteredStatusHistory = statusData.filter(status => 
          ['pending', 'confirmed', 'ready_for_pickup', 'picked_up', 'cancelled'].includes(status.status)
        )
      } else {
        // For delivery orders, only show delivery-relevant statuses
        filteredStatusHistory = statusData.filter(status => 
          ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(status.status)
        )
      }
      
      setStatusHistory(filteredStatusHistory)
    } catch (error) {
      console.error('Error fetching order details:', error)
    } finally {
      setLoading(false)
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
      case 'cancelled':
        return <X className="w-5 h-5" />
      default:
        return <Package className="w-5 h-5" />
    }
  }

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>
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

  const formatCurrency = (amount: number, currency: string = 'TZS') => {
    return `${currency} ${amount.toLocaleString()}`
  }

  const handleDownloadInvoice = async (orderIdParam?: string, orderNumber?: string, format: 'html' | 'pdf' = 'html') => {
    const currentOrderId = orderIdParam || orderId
    const currentOrderNumber = orderNumber || order?.orderNumber
    
    if (!currentOrderId) return
    
    setDownloadingInvoice(true)
    try {
      const endpoint = format === 'pdf' 
        ? `/api/user/orders/${currentOrderId}/invoice-pdf`
        : `/api/user/orders/${currentOrderId}/invoice`
      
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
      link.download = `invoice-${currentOrderNumber || currentOrderId}.${fileExtension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Error downloading invoice:', error)
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

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
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
          <div>
            <h1 className="text-3xl font-bold">{order.orderNumber}</h1>
            <p className="text-muted-foreground">Order placed on {formatDate(order.createdAt)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {getStatusIcon(order.status)}
          {getStatusBadge(order.status)}
          {getPaymentStatusBadge(order.paymentStatus)}
          <Badge className={order.deliveryOption === 'pickup' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
            {order.deliveryOption === 'pickup' ? 'Pickup Order' : 'Delivery Order'}
          </Badge>
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
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
                    <Image
                      src={item.productImage}
                      alt={item.productName}
                      width={80}
                      height={80}
                      className="rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.productName}</h3>
                      {item.variantName && (
                        <p className="text-sm text-muted-foreground">Variant: {item.variantName}</p>
                      )}
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm">Qty: {item.quantity}</span>
                        <span className="font-semibold">{formatCurrency(item.totalPrice)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Order Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {order.deliveryOption === 'pickup' ? <Package className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                Order Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statusHistory.map((status, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        index === statusHistory.length - 1 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}>
                        {getStatusIcon(status.status)}
                      </div>
                      {index < statusHistory.length - 1 && (
                        <div className="w-0.5 h-8 bg-muted mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium capitalize">{status.status}</h4>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(status.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{status.description}</p>
                      {status.location && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Location: {status.location}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
                {order.deliveryOption === 'pickup' ? 'Pickup Information' : 'Shipping Address'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Delivery Method Badge */}
                <div className="flex items-center gap-2">
                  <Badge className={order.deliveryOption === 'pickup' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                    {order.deliveryOption === 'pickup' ? 'Store Pickup' : 'Home Delivery'}
                  </Badge>
                  {order.deliveryOption === 'pickup' && (
                    <span className="text-sm text-muted-foreground">Pickup ID: {order.pickupId}</span>
                  )}
                </div>
                
                {/* Address Information */}
                <div className="space-y-2">
                  <p className="font-medium">{order.shippingAddress.fullName}</p>
                  <p>{order.shippingAddress.address}</p>
                  {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
                  <p>{order.shippingAddress.city}, {order.shippingAddress.state}</p>
                  <p>{order.shippingAddress.postalCode}, {order.shippingAddress.country}</p>
                  {order.shippingAddress.phone && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      {order.shippingAddress.phone}
                    </p>
                  )}
                </div>

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
                  <p className="font-medium">{order.billingAddress.fullName}</p>
                  <p>{order.billingAddress.address}</p>
                  <p>{order.billingAddress.city}, {order.billingAddress.region}</p>
                  <p>{order.billingAddress.postalCode}, {order.billingAddress.country}</p>
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
                    onClick={() => handleDownloadInvoice(orderId!, order!.orderNumber, 'pdf')}
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
