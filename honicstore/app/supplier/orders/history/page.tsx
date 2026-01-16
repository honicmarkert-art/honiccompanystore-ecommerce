'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { useCurrency } from '@/contexts/currency-context'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Package, DollarSign, Calendar, Search, Eye, CheckCircle, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import Link from 'next/link'

interface OrderItem {
  id: string
  product_id: number
  product_name: string
  variant_id: string | null
  variant_name: string | null
  quantity: number
  price: number
  total_price: number
  status: string
  tracking_number: string | null
  created_at: string
}

interface Order {
  id: string
  order_number: string
  reference_id: string
  pickup_id: string | null
  user_id: string | null
  shipping_address: any
  billing_address: any
  delivery_option: string
  total_amount: number
  supplier_total: number
  payment_method: string
  payment_status: string
  status: string
  confirmed_by: string | null
  confirmed_at: string
  created_at: string
  updated_at: string
  items: OrderItem[]
  items_count: number
  total_items: number
}

export default function SupplierOrderHistoryPage() {
  const { themeClasses } = useTheme()
  const { formatPrice } = useCurrency()
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/supplier/orders', { 
        credentials: 'include' 
      })
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        if (text.includes('<!DOCTYPE')) {
          throw new Error('Server returned HTML instead of JSON. The API endpoint may be misconfigured or unavailable.')
        }
        throw new Error(`Invalid response format. Expected JSON but received ${contentType}`)
      }
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(`Failed to fetch orders: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        // Filter only picked_up orders for history
        const allOrders: Order[] = data.orders || []
        const pickedUpOrders = allOrders.filter(order => {
          // Check if all items in the order are picked_up
          return order.items && order.items.every((item: OrderItem) => item.status === 'picked_up')
        })
        setOrders(pickedUpOrders)
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch order history',
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to fetch order history'
      toast({
        title: 'Error',
        description: 'Failed',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.reference_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order)
    setIsDetailsOpen(true)
  }

  const getPaymentStatusBadge = (status: string) => {
    const paymentStatusColors: Record<string, string> = {
      paid: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
      unpaid: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300',
    }
    return paymentStatusColors[status.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
  }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300',
      delivered: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
      picked_up: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    }
    return statusColors[status.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
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

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center min-h-screen", themeClasses.mainBg)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <p className={themeClasses.textNeutralSecondary}>Loading order history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen p-6", themeClasses.mainBg)}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className={cn("text-3xl font-bold mb-2", themeClasses.mainText)}>Order History</h1>
              <p className={cn("text-lg", themeClasses.textNeutralSecondary)}>
                Completed orders that have been picked up by customers
              </p>
            </div>
            <Link href="/supplier/orders">
              <Button variant="outline">
                <Package className="w-4 h-4 mr-2" />
                Active Orders
              </Button>
            </Link>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by order number, reference ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardContent className="p-12 text-center">
              <History className={cn("w-16 h-16 mx-auto mb-4", themeClasses.textNeutralSecondary)} />
              <h3 className={cn("text-xl font-semibold mb-2", themeClasses.mainText)}>No Order History</h3>
              <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                {searchTerm 
                  ? 'No orders found matching your search.' 
                  : 'Orders that have been picked up will appear here.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>
                          {order.order_number}
                        </h3>
                        <Badge className={getStatusBadge('picked_up')}>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Picked Up
                        </Badge>
                        <Badge className={getPaymentStatusBadge(order.payment_status)}>
                          {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <span className={cn("flex items-center gap-1", themeClasses.textNeutralSecondary)}>
                          <Calendar className="w-4 h-4" />
                          {formatDate(order.updated_at)}
                        </span>
                        <span className={cn("flex items-center gap-1", themeClasses.textNeutralSecondary)}>
                          <Package className="w-4 h-4" />
                          {order.items_count} item{order.items_count !== 1 ? 's' : ''}
                        </span>
                        <span className={cn("flex items-center gap-1", themeClasses.textNeutralSecondary)}>
                          <DollarSign className="w-4 h-4" />
                          {formatPrice(order.supplier_total)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleViewDetails(order)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Order Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className={cn("max-w-4xl max-h-[90vh] overflow-y-auto", themeClasses.cardBg, themeClasses.cardBorder)}>
            <DialogHeader>
              <DialogTitle className={cn(themeClasses.mainText)}>Order Details</DialogTitle>
              <DialogDescription className={cn(themeClasses.textNeutralSecondary)}>
                {selectedOrder?.order_number}
              </DialogDescription>
            </DialogHeader>

            {selectedOrder && (
              <div className="space-y-6">
                {/* Order Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className={cn("font-semibold mb-2", themeClasses.mainText)}>Order Information</h4>
                    <div className={cn("space-y-1 text-sm", themeClasses.textNeutralSecondary)}>
                      <p>Order Number: {selectedOrder.order_number}</p>
                      <p>Reference ID: {selectedOrder.reference_id}</p>
                      {selectedOrder.pickup_id && <p>Pickup ID: {selectedOrder.pickup_id}</p>}
                      <p>Delivery: {selectedOrder.delivery_option === 'pickup' ? 'Store Pickup' : 'Home Delivery'}</p>
                      <p>Status: <Badge className={getStatusBadge('picked_up')}>Picked Up</Badge></p>
                    </div>
                  </div>
                  <div>
                    <h4 className={cn("font-semibold mb-2", themeClasses.mainText)}>Payment Information</h4>
                    <div className={cn("space-y-1 text-sm", themeClasses.textNeutralSecondary)}>
                      <p>Payment Method: {selectedOrder.payment_method}</p>
                      <p>Payment Status: <Badge className={getPaymentStatusBadge(selectedOrder.payment_status)}>
                        {selectedOrder.payment_status.charAt(0).toUpperCase() + selectedOrder.payment_status.slice(1)}
                      </Badge></p>
                      <p>Total: <span className="font-semibold text-green-600 dark:text-green-400">{formatPrice(selectedOrder.supplier_total)}</span></p>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h4 className={cn("font-semibold mb-3", themeClasses.mainText)}>Order Items</h4>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className={cn("p-3 rounded-lg border", themeClasses.cardBg, themeClasses.cardBorder)}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h5 className={cn("font-medium", themeClasses.mainText)}>{item.product_name}</h5>
                            {item.variant_name && (
                              <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                                Variant: {item.variant_name}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span className={cn(themeClasses.textNeutralSecondary)}>Quantity: {item.quantity}</span>
                              <span className={cn(themeClasses.textNeutralSecondary)}>Price: {formatPrice(item.price)}</span>
                              {item.tracking_number && (
                                <span className={cn("text-blue-600 dark:text-blue-400")}>
                                  Tracking: {item.tracking_number}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn("font-semibold", themeClasses.mainText)}>
                              {formatPrice(item.total_price)}
                            </p>
                            <Badge className={getStatusBadge('picked_up')} variant="outline">
                              Picked Up
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dates */}
                <div className={cn("pt-4 border-t", themeClasses.cardBorder)}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className={cn("font-medium", themeClasses.mainText)}>Order Placed:</span>
                      <span className={cn("ml-2", themeClasses.textNeutralSecondary)}>{formatDate(selectedOrder.created_at)}</span>
                    </div>
                    <div>
                      <span className={cn("font-medium", themeClasses.mainText)}>Picked Up:</span>
                      <span className={cn("ml-2", themeClasses.textNeutralSecondary)}>{formatDate(selectedOrder.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

