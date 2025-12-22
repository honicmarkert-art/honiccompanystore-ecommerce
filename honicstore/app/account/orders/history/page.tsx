"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Package, 
  Search, 
  Eye,
  Download,
  Calendar,
  CreditCard,
  Truck,
  CheckCircle,
  History,
  ArrowLeft
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
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
  deliveryOption: 'shipping' | 'pickup'
  isReceived?: boolean
  receivedAt?: string | null
  shippingAddress: {
    fullName: string
    address: string
    city: string
    state: string
    postalCode: string
    country: string
    phone: string
  }
  items: OrderItem[]
}

interface OrderItem {
  // id: string // REMOVED: UUID should never be exposed to client
  itemKey?: string // Safe, non-UUID identifier for client-side operations
  productId: string
  productName: string
  productImage: string
  variantName?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  // supplierId?: string | null // REMOVED: UUID should never be exposed to client
  supplierName?: string | null // Only display name, never UUID
  status?: string // Per-item status from confirmed_order_items
  trackingNumber?: string | null
}

function OrderHistoryPageContent() {
  const { user } = useAuth()
  const { orders, loading } = useOrders()
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [downloadingInvoices, setDownloadingInvoices] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Filter orders that should be in history:
    // 1. Orders marked as received (isReceived === true), OR
    // 2. Orders where ALL items from ALL suppliers are picked_up
    const receivedOrders = orders.filter(order => {
      // If order is received, include it
      if (order.isReceived === true) {
        return true
      }
      
      // Check if ALL items (across all suppliers) are picked_up
      if (order.items && order.items.length > 0) {
        const allItemsPickedUp = order.items.every((item: OrderItem) => item.status === 'picked_up')
        return allItemsPickedUp
      }
      
      return false
    })
    
    // Apply search filter
    let filtered = receivedOrders
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.referenceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.shippingAddress.fullName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    setFilteredOrders(filtered)
  }, [orders, searchTerm])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'picked_up':
        return <Badge className="bg-green-100 text-green-800">Picked Up</Badge>
      case 'delivered':
        return <Badge className="bg-purple-100 text-purple-800">Delivered</Badge>
      case 'received':
        return <Badge className="bg-green-100 text-green-800">Received</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
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
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCurrency = (amount: number, currency: string = 'TZS') => {
    return `${currency} ${amount.toLocaleString()}`
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

  const handleDownloadInvoice = async (orderNumber: string) => {
    setDownloadingInvoices(prev => new Set(prev).add(orderNumber))
    
    try {
      const response = await fetch(`/api/user/orders/${orderNumber}/invoice`)
      
      if (!response.ok) {
        throw new Error('Failed to generate invoice')
      }
      
      const htmlContent = await response.text()
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
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Order History</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Completed orders that have been received
            </p>
          </div>
          <Link href="/account/orders">
            <Button variant="outline">
              <Package className="w-4 h-4 mr-2" />
              Active Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <Card className="mb-4 sm:mb-8">
        <CardContent className="p-4 sm:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <History className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Order History</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm 
                ? 'No orders found matching your search.' 
                : 'Orders that have been received will appear here.'}
            </p>
            <Link href="/account/orders">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                View Active Orders
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.orderNumber} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{order.orderNumber}</h3>
                        <span className="text-xs text-muted-foreground font-mono">({order.referenceId})</span>
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Completed
                      </Badge>
                      {getPaymentStatusBadge(order.paymentStatus)}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {order.receivedAt ? formatDate(order.receivedAt) : formatDate(order.updatedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Truck className="w-4 h-4" />
                        {order.deliveryOption === 'pickup' ? 'Store Pickup' : 'Home Delivery'}
                      </span>
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-4 h-4" />
                        {formatCurrency(order.totalAmount, order.currency)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/account/orders/${order.orderNumber}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadInvoice(order.orderNumber)}
                      disabled={downloadingInvoices.has(order.orderNumber)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {downloadingInvoices.has(order.orderNumber) ? 'Downloading...' : 'Invoice'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrderHistoryPage() {
  return (
    <ProtectedRoute>
      <OrderHistoryPageContent />
    </ProtectedRoute>
  )
}

