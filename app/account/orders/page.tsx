"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Search, 
  Filter, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Eye,
  Download,
  MessageCircle
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'

interface Order {
  id: string
  orderNumber: string
  date: Date
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  total: number
  items: number
  shippingAddress: string
  paymentMethod: string
  items: Array<{
    id: string
    name: string
    price: number
    quantity: number
    image: string
  }>
}

function OrdersPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        let res = await fetch('/api/orders/my', { credentials: 'include' })
        if (res.status === 401) {
          // Try to refresh session and retry once
          console.warn('[Orders] 401 – attempting session refresh')
          await fetch('/api/auth/session', { credentials: 'include' })
          res = await fetch('/api/orders/my', { credentials: 'include' })
        }
        if (!res.ok) throw new Error('Failed')
        const json = await res.json()
        const mapped: Order[] = (json.orders || []).map((o: any) => ({
          id: String(o.id),
          orderNumber: o.order_number || o.reference_id || `ORD-${o.id}`,
          date: new Date(o.created_at),
          status: (o.status || 'pending') as any,
          total: Number(o.total_amount || o.total || 0),
          items: (o.items || []).length || Number(o.items_count || 0),
          shippingAddress: typeof o.shipping_address === 'string' ? o.shipping_address : JSON.stringify(o.shipping_address || {}),
          paymentMethod: o.payment_method || '-',
          items: (o.items || []).map((it: any, idx: number) => ({
            id: String(it.id || idx),
            name: it.name || 'Item',
            price: Number(it.price || 0),
            quantity: Number(it.quantity || 1),
            image: it.image || '/placeholder.svg'
          }))
        }))
        setOrders(mapped)
        setFilteredOrders(mapped)
      } catch (e) {
        console.warn('[Orders] Failed to load:', e)
        setOrders([])
        setFilteredOrders([])
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // Filter orders based on search and status
  useEffect(() => {
    let filtered = orders

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.shippingAddress.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter)
    }

    setFilteredOrders(filtered)
  }, [searchTerm, statusFilter, orders])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800">Delivered</Badge>
      case 'shipped':
        return <Badge className="bg-blue-100 text-blue-800">Shipped</Badge>
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-800">Processing</Badge>
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'shipped':
        return <Truck className="w-5 h-5 text-blue-600" />
      case 'processing':
        return <Package className="w-5 h-5 text-yellow-600" />
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-600" />
      case 'cancelled':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      default:
        return <Package className="w-5 h-5" />
    }
  }

  const handleViewOrder = (orderId: string) => {
    router.push(`/account/orders/${orderId}`)
  }

  const handleTrackOrder = (orderId: string) => {
    router.push(`/account/orders/${orderId}/track`)
  }

  const handleContactSupport = (orderId: string) => {
    router.push(`/account/messages?order=${orderId}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading orders...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Orders</h1>
        <p className="text-muted-foreground">Track and manage your orders</p>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders by order number or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="space-y-6">
        {filteredOrders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(order.status)}
                  <div>
                    <h3 className="text-lg font-semibold">Order #{order.orderNumber}</h3>
                    <p className="text-sm text-muted-foreground">
                      Placed on {order.date.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(order.status)}
                  <span className="text-lg font-bold">${order.total.toFixed(2)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Order Items */}
                <div>
                  <h4 className="font-medium mb-3">Order Items ({order.items.length})</h4>
                  <div className="space-y-2">
                    {order.items.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-200 rounded"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Qty: {item.quantity} × ${item.price.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-sm text-muted-foreground">
                        +{order.items.length - 3} more items
                      </p>
                    )}
                  </div>
                </div>

                {/* Order Details */}
                <div>
                  <h4 className="font-medium mb-3">Order Details</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Shipping Address:</span>
                      <p>{order.shippingAddress}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Payment Method:</span>
                      <p>{order.paymentMethod}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Items:</span>
                      <p>{order.items.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleViewOrder(order.id)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Button>
                
                {order.status === 'shipped' && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleTrackOrder(order.id)}
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Track Order
                  </Button>
                )}

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleContactSupport(order.id)}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contact Support
                </Button>

                <Button 
                  variant="outline" 
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Invoice
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No orders found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'You haven\'t placed any orders yet.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={() => router.push('/products')}>
                Start Shopping
              </Button>
            )}
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
 