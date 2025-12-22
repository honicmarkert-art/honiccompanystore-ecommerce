"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Package, 
  Search, 
  Filter, 
  Eye,
  Download,
  RefreshCw,
  Calendar,
  MapPin,
  CreditCard,
  Truck,
  CheckCircle,
  Clock,
  X,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { useOrders } from '@/hooks/use-orders'
import Link from 'next/link'
import Image from 'next/image'
import { OrdersListSkeleton } from '@/components/ui/skeleton'

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
  status?: string // Per-item status from confirmed_order_items
  trackingNumber?: string | null
}

function OrdersPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { orders, loading, error, refetch } = useOrders()
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [downloadingInvoices, setDownloadingInvoices] = useState<Set<string>>(new Set())

  useEffect(() => {
    filterOrders()
  }, [orders, searchTerm, statusFilter, dateFilter])

  const filterOrders = () => {
    // Filter out orders where:
    // 1. Order is marked as received (isReceived === true), OR
    // 2. ALL items from ALL suppliers are picked_up
    let filtered = orders.filter(order => {
      // If order is received, exclude it
      if (order.isReceived === true) {
        return false
      }
      
      // Check if ALL items (across all suppliers) are picked_up
      if (order.items && order.items.length > 0) {
        const allItemsPickedUp = order.items.every((item: OrderItem) => item.status === 'picked_up')
        // Hide order if all items are picked up
        return !allItemsPickedUp
      }
      
      // If no items or items don't have status, show the order
      return true
    })

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.shippingAddress.fullName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter)
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const filterDate = new Date()
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          filterDate.setDate(now.getDate() - 7)
          break
        case 'month':
          filterDate.setMonth(now.getMonth() - 1)
          break
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1)
          break
      }
      
      filtered = filtered.filter(order => new Date(order.createdAt) >= filterDate)
    }

    setFilteredOrders(filtered)
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
        return <Clock className="w-4 h-4" />
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />
      case 'shipped':
        return <Truck className="w-4 h-4" />
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />
      case 'ready_for_pickup':
        return <Package className="w-4 h-4" />
      case 'picked_up':
        return <CheckCircle className="w-4 h-4" />
      case 'cancelled':
        return <X className="w-4 h-4" />
      default:
        return <Package className="w-4 h-4" />
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number, currency: string = 'TZS') => {
    return `${currency} ${amount.toLocaleString()}`
  }

  const handleDownloadInvoice = async (orderNumber: string) => {
    setDownloadingInvoices(prev => new Set(prev).add(orderNumber))
    
    try {
      const response = await fetch(`/api/user/orders/${orderNumber}/invoice`)
      
      if (!response.ok) {
        throw new Error('Failed to generate invoice')
      }
      
      // Get the HTML content
      const htmlContent = await response.text()
      
      // Create a blob and download it
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `invoice-${orderNumber}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
    } catch (error) {
      alert('Failed to download invoice. Please try again.')
    } finally {
      setDownloadingInvoices(prev => {
        const newSet = new Set(prev)
        newSet.delete(orderNumber)
        return newSet
      })
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 min-h-screen bg-background">
        <OrdersListSkeleton count={3} />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 min-h-screen bg-background">
      {/* Header */}
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">My Orders</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Track and manage your orders</p>
      </div>

      {/* Filters */}
      <Card className="mb-4 sm:mb-8">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <div className="relative col-span-2 md:col-span-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    // Search is already triggered by onChange, but we can add additional logic here if needed
                  }
                }}
                className="pl-10 h-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-2 h-9 border rounded-md text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-2 py-2 h-9 border rounded-md text-sm"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
            <Button variant="outline" size="sm" className="h-9" onClick={refetch}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Orders Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' || dateFilter !== 'all'
                ? 'No orders match your current filters.'
                : "You haven't placed any orders yet."}
            </p>
            {!searchTerm && statusFilter === 'all' && dateFilter === 'all' && (
              <Link href="/products">
                <Button>Start Shopping</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
        {filteredOrders.map((order) => (
            <Card key={order.orderNumber} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left Section: Order Info */}
                  <div className="flex-1 space-y-3">
                    {/* Order Number, Status, and Date */}
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg">{order.orderNumber}</h3>
                          <span className="text-xs text-muted-foreground font-mono">({order.referenceId})</span>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                    
                    {/* Item Count */}
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{order.itemCount} item{order.itemCount !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Payment and Delivery Info */}
                    <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{order.paymentMethod}</span>
                        {getPaymentStatusBadge(order.paymentStatus)}
                      </div>
                      <span className="text-muted-foreground">•</span>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {order.deliveryOption === 'pickup' ? 'Pickup' : 'Delivery'}
                          {order.shippingAddress?.city && ` - ${order.shippingAddress.city}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Section: Product Image, Total, Actions */}
                  <div className="flex items-center gap-4">
                    {/* Product Image */}
                    <div className="hidden sm:block">
                      <div className="w-16 h-16 rounded-full bg-white p-1 flex items-center justify-center overflow-hidden">
                        <Image
                          src={order.items[0]?.productImage || '/placeholder.jpg'}
                          alt={order.items[0]?.productName || 'Product'}
                          width={56}
                          height={56}
                          className="rounded-full object-cover w-full h-full"
                        />
                      </div>
                    </div>

                    {/* Total Amount */}
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatCurrency(order.totalAmount, order.currency)}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Link href={`/account/orders/${order.orderNumber}`}>
                        <Button variant="outline" size="sm" className="flex gap-2">
                          <Eye className="w-4 h-4" />
                          <span className="hidden sm:inline">View Details</span>
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDownloadInvoice(order.orderNumber)}
                        disabled={downloadingInvoices.has(order.orderNumber)}
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">{downloadingInvoices.has(order.orderNumber) ? 'Generating...' : 'Invoice'}</span>
                      </Button>
                    </div>
                  </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {/* Summary Stats */}
      {filteredOrders.length > 0 && (
        <Card className="mt-6 sm:mt-8">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center">
              <div>
                <p className="text-xl sm:text-2xl font-bold">{filteredOrders.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Orders</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">
                  {filteredOrders.filter(o => o.status === 'delivered').length}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Delivered</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">
                  {filteredOrders.filter(o => o.status === 'shipped').length}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">In Transit</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">
                  {formatCurrency(filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0), 'TZS')}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Spent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function OrdersPage() {
  return (
    <ProtectedRoute>
      <OrdersPageContent />
    </ProtectedRoute>
  )
} 
 