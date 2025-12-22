'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { useCurrency } from '@/contexts/currency-context'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ShoppingCart, Package, DollarSign, Calendar, Search, Eye, Truck, CheckCircle, RefreshCw } from 'lucide-react'
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
import { supabaseClient } from '@/lib/supabase-client'
import type { RealtimeChannel } from '@supabase/supabase-js'

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

export default function SupplierOrdersPage() {
  const { themeClasses } = useTheme()
  const { formatPrice } = useCurrency()
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [newOrderNotification, setNewOrderNotification] = useState<string | null>(null)
  const seenOrderIds = useRef<Set<string>>(new Set())
  const [updatingStatus, setUpdatingStatus] = useState<Set<string>>(new Set())
  const [isActive, setIsActive] = useState<boolean | null>(null)

  useEffect(() => {
    fetchOrders()
    fetchSupplierStatus()
    
    // Clear unread count when visiting orders page
    // This will trigger a refresh in the layout
    const clearUnreadCount = async () => {
      try {
        // Trigger a refresh of unread count in parent layout
        // The layout will automatically update when orders are fetched
        window.dispatchEvent(new CustomEvent('supplier-orders-visited'))
      } catch (error) {
        // Error clearing unread count
      }
    }
    
    clearUnreadCount()
  }, [])

  const fetchSupplierStatus = async () => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) return

      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('is_active')
        .eq('id', user.id)
        .single()

      if (!error && profile) {
        setIsActive(profile.is_active !== false) // Default to true if null
      }
    } catch (error) {
      // Error fetching supplier status
    }
  }

  // Real-time subscription for new confirmed orders
  useEffect(() => {
    let isMounted = true
    let activeChannel: RealtimeChannel | null = null

    const subscribeToRealtime = () => {
      if (!isMounted) return

      if (activeChannel) {
        try {
          supabaseClient.removeChannel(activeChannel)
        } catch (error) {
          // Supplier orders realtime cleanup error
        }
      }

      const channel = supabaseClient
        .channel('supplier-orders-realtime')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'confirmed_orders' 
        }, async (payload) => {
        const newOrder = payload?.new as any
        
        if (!newOrder || !newOrder.id || seenOrderIds.current.has(newOrder.id)) {
          return
        }
        
        // Refresh orders without marking as seen to detect new entries
        const updatedOrders = await fetchOrders(true, false)
        
        if (updatedOrders.length > 0) {
          // Check if this new order is in the list (has supplier's products)
          const hasSupplierProducts = updatedOrders.some((o: Order) => o.id === newOrder.id)
          
          if (hasSupplierProducts) {
            seenOrderIds.current.add(newOrder.id)
            
            // Show notification
            const orderNumber = newOrder.order_number || 'New Order'
            setNewOrderNotification(`🔔 New order received: ${orderNumber}`)
            
            // Show toast notification
            toast({
              title: 'New Order!',
              description: `Order #${orderNumber} has been confirmed`,
              duration: 5000,
            })
            
            // Auto-hide notification after 5 seconds
            setTimeout(() => {
              setNewOrderNotification(null)
            }, 5000)
            
            // Ensure orders state is updated
            setOrders(updatedOrders)
          }
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'confirmed_orders' 
      }, async () => {
        await fetchOrders(true)
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          fetchOrders(true)
          if (isMounted) {
            setTimeout(() => subscribeToRealtime(), 3000)
          }
        }
      })

      activeChannel = channel
    }

    subscribeToRealtime()

    return () => {
      isMounted = false
      if (activeChannel) {
        try {
          supabaseClient.removeChannel(activeChannel)
        } catch (error) {
          // Supplier orders realtime cleanup error
        }
      }
    }
  }, [toast])

  const fetchOrders = async (isRealTimeUpdate = false, markAsSeen = true, showRefreshLoading = false): Promise<Order[]> => {
    try {
      if (!isRealTimeUpdate) {
        if (showRefreshLoading) {
          setIsRefreshing(true)
        } else {
          setLoading(true)
        }
      }
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
        const allOrders: Order[] = data.orders || []
        // Filter out picked_up orders - they should be in order history
        // Only show orders where NOT all items are picked_up
        const activeOrders = allOrders.filter(order => {
          return !(order.items && order.items.every((item: OrderItem) => item.status === 'picked_up'))
        })
        setOrders(activeOrders)
        
        if (markAsSeen) {
          // Mark all current orders as seen
          activeOrders.forEach((order: Order) => {
            seenOrderIds.current.add(order.id)
          })
        }
        
        return activeOrders
      } else {
        if (!isRealTimeUpdate) {
          toast({
            title: 'Error',
            description: data.error || 'Failed to fetch orders',
            variant: 'destructive'
          })
        }
        return []
      }
    } catch (error: any) {
      if (!isRealTimeUpdate) {
        const errorMessage = error?.message || 'Failed to fetch orders'
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        })
      }
      return []
    } finally {
      if (!isRealTimeUpdate) {
        setLoading(false)
        setIsRefreshing(false)
      }
    }
  }

  const handleRefresh = async () => {
    await fetchOrders(false, true, true)
    toast({
      title: 'Orders refreshed',
      description: 'Order list has been updated',
    })
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

  const getPaymentStatusText = (status: string) => {
    if (status === 'paid') {
      return 'Payment Successful'
    }
    return status.charAt(0).toUpperCase() + status.slice(1)
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
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      shipped: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      delivered: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
      picked_up: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    }
    return statusColors[status.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
  }

  const handleUpdateOrderStatus = async (order: Order, newStatus: string) => {
    try {
      // Check if there are any items that can be updated
      const itemsToUpdate = order.items.filter((item: OrderItem) => {
        const currentStatus = item.status || 'confirmed'
        const availableStatuses = getAvailableStatuses(currentStatus, order.delivery_option)
        return availableStatuses.includes(newStatus)
      })

      if (itemsToUpdate.length === 0) {
        toast({
          title: 'No items to update',
          description: 'No items can be updated to this status',
          variant: 'destructive'
        })
        return
      }

      // Add all item IDs to updating set for UI feedback
      setUpdatingStatus(prev => {
        const newSet = new Set(prev)
        order.items.forEach((item: OrderItem) => newSet.add(item.id))
        return newSet
      })

      // Use the first item ID to trigger the update
      // The API will automatically update ALL items from this supplier in this order
      const firstItemId = itemsToUpdate[0].id
      
      const response = await fetch(`/api/supplier/orders/items/${firstItemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update order status')
      }

      // Refresh orders to get updated status
      await fetchOrders()
      
      toast({
        title: 'Success',
        description: data.message || `Order status updated to ${getStatusLabel(newStatus)}`,
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update order status',
        variant: 'destructive',
      })
    } finally {
      setUpdatingStatus(prev => {
        const newSet = new Set(prev)
        order.items.forEach((item: OrderItem) => newSet.delete(item.id))
        return newSet
      })
    }
  }


  const getAvailableStatuses = (currentStatus: string, deliveryOption: string): string[] => {
    const validTransitions: Record<string, string[]> = {
      'confirmed': ['shipped'], // Suppliers mark as 'shipped' first
      'shipped': ['delivered'], // Then mark as 'delivered'
      'delivered': [],
      'picked_up': [], // Keep for backward compatibility but don't show as option
      'cancelled': []
    }
    return validTransitions[currentStatus] || []
  }

  const getOrderStatus = (order: Order): string => {
    // Get the most advanced status among all items
    const statuses = order.items.map((item: OrderItem) => item.status || 'confirmed')
    if (statuses.some(s => s === 'delivered' || s === 'picked_up')) {
      return statuses.find(s => s === 'delivered' || s === 'picked_up') || 'confirmed'
    }
    if (statuses.some(s => s === 'shipped')) {
      return 'shipped'
    }
    return 'confirmed'
  }

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'confirmed': 'Confirmed',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'picked_up': 'Delivered', // Show as "Delivered" for suppliers even if status is picked_up
      'cancelled': 'Cancelled'
    }
    return labels[status] || status
  }


  return (
    <>
      {/* New Order Notification Banner */}
      {newOrderNotification && (
        <div className={cn("mb-4 p-4 rounded-lg border-2 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 animate-pulse", themeClasses.cardBg)}>
          <p className={cn("text-center font-semibold", themeClasses.mainText)}>
            {newOrderNotification}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div>
              <h1 className={cn("text-2xl sm:text-3xl font-bold mb-1 sm:mb-2", themeClasses.mainText)}>
                Current Orders
              </h1>
              <p className={cn("text-xs sm:text-sm", themeClasses.textNeutralSecondary)}>
                Manage and track your active orders (excluding picked up orders)
              </p>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              variant="outline"
              size="sm"
              className={cn(
                "h-8 w-8 sm:h-9 sm:w-9 p-0",
                themeClasses.borderNeutralSecondary,
                themeClasses.cardBg
              )}
              title="Refresh orders"
            >
              <RefreshCw className={cn(
                "w-4 h-4 sm:w-5 sm:h-5",
                (isRefreshing || loading) && "animate-spin"
              )} />
            </Button>
          </div>
          {isActive !== null && (
            <Badge className={cn(
              "w-fit text-xs sm:text-sm px-2 sm:px-3 py-1",
              isActive 
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            )}>
              {isActive ? 'Active' : 'Inactive'}
            </Badge>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search orders by ID or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn("pl-10", themeClasses.cardBg, themeClasses.borderNeutralSecondary)}
          />
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className={cn("text-center py-12", themeClasses.textNeutralSecondary)}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4">Loading orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
          <CardContent className="p-12">
            <div className={cn("text-center", themeClasses.textNeutralSecondary)}>
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">No orders found</p>
              <p className="text-sm">Orders will appear here once customers place orders for your products.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className={cn("border-2", themeClasses.cardBorder, themeClasses.cardBg)}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-2 sm:mb-3">
                      <h3 className={cn("text-base sm:text-lg font-semibold truncate", themeClasses.mainText)}>
                        Order #{order.order_number}
                      </h3>
                      <Badge className={cn("text-xs sm:text-sm", getStatusBadge(order.status))}>
                        {order.status}
                      </Badge>
                      <Badge className={cn("text-xs sm:text-sm", getPaymentStatusBadge(order.payment_status))}>
                        {getPaymentStatusText(order.payment_status)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm">
                      <div className={cn("flex items-center gap-1.5 sm:gap-2", themeClasses.textNeutralSecondary)}>
                        <Package className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span>{order.items_count} items</span>
                      </div>
                      <div className={cn("flex items-center gap-1.5 sm:gap-2", themeClasses.textNeutralSecondary)}>
                        <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span>{formatPrice(order.supplier_total)}</span>
                      </div>
                      <div className={cn("flex items-center gap-1.5 sm:gap-2", themeClasses.textNeutralSecondary)}>
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="whitespace-nowrap">{new Date(order.confirmed_at || order.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-2">
                    {/* Order Status Update Buttons */}
                    {order.items && order.items.length > 0 && (() => {
                      const orderStatus = getOrderStatus(order)
                      const availableStatuses = getAvailableStatuses(orderStatus, order.delivery_option)
                      const isUpdating = order.items.some((item: OrderItem) => updatingStatus.has(item.id))
                      
                      // If order is delivered/picked_up, show "Order Completed" button (disabled)
                      if (orderStatus === 'delivered' || orderStatus === 'picked_up') {
                        return (
                          <Button
                            size="sm"
                            disabled
                            className="bg-green-600 text-white cursor-not-allowed"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Order Completed
                          </Button>
                        )
                      }
                      
                      if (availableStatuses.length > 0) {
                        return (
                          <>
                            {availableStatuses.map((status) => (
                              <Button
                                key={status}
                                size="sm"
                                onClick={() => handleUpdateOrderStatus(order, status)}
                                disabled={isUpdating}
                                className={cn(
                                  "text-xs sm:text-sm px-2 sm:px-3",
                                  status === 'shipped'
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                                )}
                              >
                                {isUpdating ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                                    <span className="hidden sm:inline">Updating...</span>
                                    <span className="sm:hidden">...</span>
                                  </>
                                ) : (
                                  <>
                                    {status === 'shipped' ? (
                                      <Truck className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                    ) : (
                                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                    )}
                                    <span className="hidden sm:inline">Mark as {getStatusLabel(status)}</span>
                                    <span className="sm:hidden">{getStatusLabel(status)}</span>
                                  </>
                                )}
                              </Button>
                            ))}
                          </>
                        )
                      }
                      return null
                    })()}
                    
                    <Button
                      variant="outline"
                      className={cn(themeClasses.borderNeutralSecondary)}
                      onClick={() => handleViewDetails(order)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Order Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent
          className={cn(
            "max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl bg-white dark:bg-neutral-900",
            themeClasses.cardBorder
          )}
        >
          <DialogHeader>
            <DialogTitle className={cn(themeClasses.mainText)}>
              Order Details - #{selectedOrder?.order_number}
            </DialogTitle>
            <DialogDescription className={cn(themeClasses.textNeutralSecondary)}>
              View order information and items
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className={cn("grid grid-cols-2 gap-4 p-4 rounded-lg border", themeClasses.cardBorder, themeClasses.cardBg)}>
                <div>
                  <p className={cn("text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>Order Number</p>
                  <p className={cn(themeClasses.mainText)}>{selectedOrder.order_number}</p>
                </div>
                <div>
                  <p className={cn("text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>Reference ID</p>
                  <p className={cn(themeClasses.mainText)}>{selectedOrder.reference_id}</p>
                </div>
                <div>
                  <p className={cn("text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>Status</p>
                  <Badge className={getStatusBadge(selectedOrder.status)}>
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className={cn("text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>Payment Status</p>
                  <Badge className={getPaymentStatusBadge(selectedOrder.payment_status)}>
                    {getPaymentStatusText(selectedOrder.payment_status)}
                  </Badge>
                </div>
                <div>
                  <p className={cn("text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>Delivery Option</p>
                  <p className={cn(themeClasses.mainText)}>{selectedOrder.delivery_option}</p>
                </div>
                <div>
                  <p className={cn("text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>Confirmed At</p>
                  <p className={cn(themeClasses.mainText)}>
                    {new Date(selectedOrder.confirmed_at || selectedOrder.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>Your Products in This Order</h3>
                  {/* Order Status Update Buttons */}
                  {selectedOrder.items && selectedOrder.items.length > 0 && (() => {
                    const orderStatus = getOrderStatus(selectedOrder)
                    const availableStatuses = getAvailableStatuses(orderStatus, selectedOrder.delivery_option)
                    const isUpdating = selectedOrder.items.some((item: OrderItem) => updatingStatus.has(item.id))
                    
                    // If order is delivered/picked_up, show "Order Completed" button (disabled)
                    if (orderStatus === 'delivered' || orderStatus === 'picked_up') {
                      return (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled
                            className="bg-green-600 text-white cursor-not-allowed"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Order Completed
                          </Button>
                        </div>
                      )
                    }
                    
                    if (availableStatuses.length > 0) {
                      return (
                        <div className="flex items-center gap-2">
                          {availableStatuses.map((status) => (
                            <Button
                              key={status}
                              size="sm"
                              onClick={() => handleUpdateOrderStatus(selectedOrder, status)}
                              disabled={isUpdating}
                              className={cn(
                                status === 'shipped'
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'bg-purple-600 hover:bg-purple-700 text-white'
                              )}
                            >
                              {isUpdating ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                <>
                                  {status === 'shipped' ? (
                                    <Truck className="w-4 h-4 mr-2" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                  )}
                                  Mark as {getStatusLabel(status)}
                                </>
                              )}
                            </Button>
                          ))}
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <Card key={item.id} className={cn("border", themeClasses.cardBorder, themeClasses.cardBg)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className={cn("font-medium", themeClasses.mainText)}>{item.product_name}</p>
                              <Badge className={getStatusBadge(item.status || 'confirmed')}>
                                {item.status || 'confirmed'}
                              </Badge>
                            </div>
                            {item.tracking_number && (
                              <p className={cn("text-sm mt-1 font-medium text-blue-600 dark:text-blue-400")}>
                                Tracking: {item.tracking_number}
                              </p>
                            )}
                            {item.variant_name && (
                              <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                                Variant: {item.variant_name}
                              </p>
                            )}
                            <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                              Quantity: {item.quantity} × {formatPrice(item.price)} = {formatPrice(item.total_price)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className={cn("p-4 rounded-lg border", themeClasses.cardBorder, themeClasses.cardBg)}>
                <div className="flex items-center justify-between">
                  <span className={cn("text-lg font-semibold", themeClasses.mainText)}>Your Total:</span>
                  <span className={cn("text-lg font-bold", themeClasses.mainText)}>
                    {formatPrice(selectedOrder.supplier_total)}
                  </span>
                </div>
              </div>

              {/* Shipping Details - Only show for shipping orders */}
              {selectedOrder.delivery_option === 'shipping' && selectedOrder.shipping_address && (
                <div className={cn("p-4 rounded-lg border", themeClasses.cardBorder, themeClasses.cardBg)}>
                  <h3 className={cn("text-lg font-semibold mb-4", themeClasses.mainText)}>Shipping Details</h3>
                  <div className="space-y-2">
                    {selectedOrder.shipping_address.fullName || selectedOrder.shipping_address.full_name ? (
                      <p className={cn(themeClasses.mainText)}>
                        <span className={cn("font-medium", themeClasses.textNeutralSecondary)}>Name: </span>
                        {selectedOrder.shipping_address.fullName || selectedOrder.shipping_address.full_name}
                      </p>
                    ) : null}
                    {selectedOrder.shipping_address.address || selectedOrder.shipping_address.address1 ? (
                      <p className={cn(themeClasses.mainText)}>
                        <span className={cn("font-medium", themeClasses.textNeutralSecondary)}>Address: </span>
                        {selectedOrder.shipping_address.address || selectedOrder.shipping_address.address1}
                      </p>
                    ) : null}
                    {selectedOrder.shipping_address.address2 ? (
                      <p className={cn(themeClasses.mainText)}>
                        {selectedOrder.shipping_address.address2}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-4">
                      {selectedOrder.shipping_address.city ? (
                        <p className={cn(themeClasses.mainText)}>
                          <span className={cn("font-medium", themeClasses.textNeutralSecondary)}>City: </span>
                          {selectedOrder.shipping_address.city}
                        </p>
                      ) : null}
                      {selectedOrder.shipping_address.state || selectedOrder.shipping_address.region ? (
                        <p className={cn(themeClasses.mainText)}>
                          <span className={cn("font-medium", themeClasses.textNeutralSecondary)}>State/Region: </span>
                          {selectedOrder.shipping_address.state || selectedOrder.shipping_address.region}
                        </p>
                      ) : null}
                      {selectedOrder.shipping_address.postalCode || selectedOrder.shipping_address.postal_code ? (
                        <p className={cn(themeClasses.mainText)}>
                          <span className={cn("font-medium", themeClasses.textNeutralSecondary)}>Postal Code: </span>
                          {selectedOrder.shipping_address.postalCode || selectedOrder.shipping_address.postal_code}
                        </p>
                      ) : null}
                    </div>
                    {selectedOrder.shipping_address.country ? (
                      <p className={cn(themeClasses.mainText)}>
                        <span className={cn("font-medium", themeClasses.textNeutralSecondary)}>Country: </span>
                        {selectedOrder.shipping_address.country}
                      </p>
                    ) : null}
                    {selectedOrder.shipping_address.phone ? (
                      <p className={cn(themeClasses.mainText)}>
                        <span className={cn("font-medium", themeClasses.textNeutralSecondary)}>Phone: </span>
                        {selectedOrder.shipping_address.phone}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Pickup Information - Only show for pickup orders */}
              {selectedOrder.delivery_option === 'pickup' && selectedOrder.pickup_id && (
                <div className={cn("p-4 rounded-lg border", themeClasses.cardBorder, themeClasses.cardBg)}>
                  <h3 className={cn("text-lg font-semibold mb-4", themeClasses.mainText)}>Pickup Information</h3>
                  <p className={cn(themeClasses.mainText)}>
                    <span className={cn("font-medium", themeClasses.textNeutralSecondary)}>Pickup ID: </span>
                    {selectedOrder.pickup_id}
                  </p>
                  <div className={cn("mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800")}>
                    <p className={cn("text-sm font-medium text-blue-800 dark:text-blue-300")}>
                      📦 Please ship this order to Honic Company Store
                    </p>
                    <p className={cn("text-xs mt-1 text-blue-600 dark:text-blue-400")}>
                      Customer will collect this order from the store.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

