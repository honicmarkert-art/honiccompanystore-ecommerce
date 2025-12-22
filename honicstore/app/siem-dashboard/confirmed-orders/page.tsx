"use client"


// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  DollarSign,
  Calendar,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/use-theme'
import { supabaseClient } from '@/lib/supabase-client'

interface ConfirmedOrderItem {
  id: string
  product_id: number
  product_name: string
  variant_id: string | null
  variant_name: string | null
  quantity: number
  price: number
  total_price: number
  created_at: string
  supplierId?: string | null
  supplierName?: string | null
  status?: string | null
}

interface ConfirmedOrder {
  id: string
  order_id: string // Changed from original_order_id: number to order_id: string (UUID)
  referenceId: string
  pickupId: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  userId: string | null // null for guest users, user ID for registered users
  status: 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  total: number
  currency: string
  items: number
  total_items: number
  orderDate: string
  confirmedAt: string
  confirmedBy: string
  notes: string
  shippingAddress: {
    fullName: string
    address1: string
    address2?: string
    city: string
    state: string
    postalCode: string
    country: string
    phone: string
  }
  paymentMethod: string
  paymentStatus: 'paid' | 'pending' | 'failed'
  failureReason?: string
  deliveryOption: 'shipping' | 'pickup'
  order_items: ConfirmedOrderItem[]
  suppliers?: string[] // Array of supplier names
  hasSuppliers?: boolean // Boolean flag
}

export default function ConfirmedOrdersPage() {
  const { themeClasses } = useTheme()
  const [orders, setOrders] = useState<ConfirmedOrder[]>([])
  const [filteredOrders, setFilteredOrders] = useState<ConfirmedOrder[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all')
  const [deliveryOptionFilter, setDeliveryOptionFilter] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<ConfirmedOrder | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [newOrderNotification, setNewOrderNotification] = useState<string | null>(null)

  // Fetch confirmed orders from API
  const fetchConfirmedOrders = async () => {
    setIsLoading(true)
    try {
    const res = await fetch('/api/admin/confirmed-orders', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch confirmed orders')
      const data = await res.json()
      const normalized: ConfirmedOrder[] = (data.orders || []).map((o: any) => {
        // Extract customer information from appropriate address based on delivery option
        const shippingAddress = typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address) : (o.shipping_address || {});
        const billingAddress = typeof o.billing_address === 'string' ? JSON.parse(o.billing_address) : (o.billing_address || {});
        
        // For pickup orders, use billing address (contact info); for shipping, use shipping address
        const isPickup = o.delivery_option === 'pickup';
        const customerInfoSource = isPickup ? billingAddress : shippingAddress;
        
        return {
          id: o.id,
          order_id: o.order_id,
          referenceId: o.reference_id || o.id,
          pickupId: o.pickup_id ? o.pickup_id : (o.created_at ? new Date(o.created_at).toISOString().slice(0,10).replace(/-/g,'') : ''),
          orderNumber: o.order_number || o.id,
          customerName: o.customer_name || customerInfoSource.fullName || '',
          customerEmail: o.customer_email || customerInfoSource.email || '',
          customerPhone: o.customer_phone || customerInfoSource.phone || '',
          userId: o.user_id || null, // null for guest users, user ID for registered users
          status: (o.status || 'confirmed'),
          total: Number(o.total_amount || 0),
          currency: o.currency || 'TZS',
          items: o.order_items ? o.order_items.length : 0,
          total_items: o.total_items || 0,
          orderDate: o.created_at || new Date().toISOString(),
          deliveryOption: o.delivery_option || 'shipping',
          confirmedAt: o.confirmed_at || new Date().toISOString(),
          confirmedBy: o.confirmed_by || 'admin',
          notes: o.notes || '',
          shippingAddress: shippingAddress,
          paymentMethod: o.payment_method || 'clickpesa',
          paymentStatus: o.payment_status || 'paid',
          failureReason: o.failure_reason || undefined,
          order_items: o.order_items || [],
          suppliers: o.suppliers || [],
          hasSuppliers: o.hasSuppliers || false
        }
      })
      setOrders(normalized)
      setFilteredOrders(normalized)
      setLastUpdated(new Date())
    } catch (e) {
      setOrders([])
      setFilteredOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchConfirmedOrders()
  }, [])

  // Realtime subscription for new confirmed orders
  useEffect(() => {
    
    const channel = supabaseClient
      .channel('admin-confirmed-orders-realtime')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'confirmed_orders' 
      }, async (payload) => {
        
        // Immediate visual feedback
        setLastUpdated(new Date())
        
        // Show new order notification
        const orderNumber = payload.new?.order_number || 'New Confirmed Order'
        setNewOrderNotification(`✅ Order confirmed: ${orderNumber}`)
        
        // Auto-hide notification after 5 seconds
        setTimeout(() => {
          setNewOrderNotification(null)
        }, 5000)
        
        try {
          // Fetch fresh confirmed orders
          await fetchConfirmedOrders()
          
        } catch (error) {
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
        }
      })

    return () => {
      try { 
        supabaseClient.removeChannel(channel)
      } catch (error) {
        // Silent error handling
      }
    }
  }, [])

  // Filter orders based on all criteria
  useEffect(() => {
    let filtered = orders

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.referenceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.pickupId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerPhone.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter)
    }

    // User type filter
    if (userTypeFilter !== 'all') {
      filtered = filtered.filter(order => {
        if (userTypeFilter === 'guest') return order.userId === null
        if (userTypeFilter === 'registered') return order.userId !== null
        return true
      })
    }

    // Delivery option filter
    if (deliveryOptionFilter !== 'all') {
      filtered = filtered.filter(order => order.deliveryOption === deliveryOptionFilter)
    }

    // Supplier filter
    if (supplierFilter !== 'all') {
      filtered = filtered.filter(order => {
        if (supplierFilter === 'with-suppliers') return order.hasSuppliers === true
        if (supplierFilter === 'no-suppliers') return order.hasSuppliers === false
        return true
      })
    }

    // Date filter (using confirmedAt for confirmed orders)
    if (dateFrom || dateTo) {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.confirmedAt)
        const fromDate = dateFrom ? new Date(dateFrom) : new Date('1900-01-01')
        const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : new Date()
        
        return orderDate >= fromDate && orderDate <= toDate
      })
    }

    // Time filter (if date is selected)
    if ((timeFrom || timeTo) && (dateFrom || dateTo)) {
      filtered = filtered.filter(order => {
        const orderDateTime = new Date(order.confirmedAt)
        const orderTime = orderDateTime.getHours() * 60 + orderDateTime.getMinutes()
        
        let fromTime = 0
        let toTime = 1439 // 23:59
        
        if (timeFrom) {
          const [hours, minutes] = timeFrom.split(':').map(Number)
          fromTime = hours * 60 + minutes
        }
        
        if (timeTo) {
          const [hours, minutes] = timeTo.split(':').map(Number)
          toTime = hours * 60 + minutes
        }
        
        return orderTime >= fromTime && orderTime <= toTime
      })
    }

    setFilteredOrders(filtered)
  }, [orders, searchTerm, statusFilter, userTypeFilter, deliveryOptionFilter, supplierFilter, dateFrom, dateTo, timeFrom, timeTo])

  const getStatusBadge = (status: ConfirmedOrder['status'] | string) => {
    const statusConfig: Record<string, { color: string; icon: any }> = {
      confirmed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300', icon: CheckCircle },
      shipped: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300', icon: Truck },
      delivered: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300', icon: Package },
      picked_up: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300', icon: Package },
      ready_for_pickup: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300', icon: Clock },
      cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300', icon: XCircle }
    }

    const config = statusConfig[status] || { 
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300', 
      icon: Package 
    }
    const Icon = config.icon

    return (
      <Badge className={cn("flex items-center gap-1", config.color)}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
      </Badge>
    )
  }

  const getPaymentStatusBadge = (paymentStatus: ConfirmedOrder['paymentStatus']) => {
    const paymentStatusConfig = {
      paid: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300', icon: CheckCircle },
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300', icon: Clock },
      failed: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300', icon: XCircle }
    }

    const config = paymentStatusConfig[paymentStatus]
    const Icon = config.icon

    return (
      <Badge className={cn("flex items-center gap-1", config.color)}>
        <Icon className="w-3 h-3" />
        {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
      </Badge>
    )
  }

  const getUserTypeBadge = (userId: string | null) => {
    if (userId) {
      // Registered user
      return (
        <Badge className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800">
          <User className="w-3 h-3" />
          Registered
        </Badge>
      )
    } else {
      // Guest user
      return (
        <Badge className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 border-gray-200 dark:border-gray-800">
          <User className="w-3 h-3" />
          Guest
        </Badge>
      )
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

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const displayPickup = (pickupId?: string) => {
    if (!pickupId) return ''
    const parts = String(pickupId).split('-')
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1]}`
    }
    return pickupId
  }

  // Generate tracking timeline based on package status from confirmed_order_items.status
  // Similar to customer order detail page
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
        location: 'Customer',
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

  const clearAllFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setUserTypeFilter('all')
    setDeliveryOptionFilter('all')
    setDateFrom('')
    setDateTo('')
    setTimeFrom('')
    setTimeTo('')
  }

  const previewOrder = (order: ConfirmedOrder) => {
    setSelectedOrder(order)
    setIsDialogOpen(true)
  }

  const updateOrderStatus = async (order: ConfirmedOrder, newStatus: string) => {
    try {
      // Update order status directly (tracking numbers are auto-assigned when order is confirmed)
      const res = await fetch('/api/admin/confirmed-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: order.id, status: newStatus })
      })
      if (res.ok) {
        await fetchConfirmedOrders()
      }
    } catch (error) {
      console.error('Error updating order status:', error)
    }
  }


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <p className={themeClasses.textNeutralSecondary}>Loading confirmed orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen p-6", themeClasses.mainBg)}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={cn("text-3xl font-bold mb-2", themeClasses.mainText)}>Confirmed Orders</h1>
          <p className={cn("text-lg", themeClasses.textNeutralSecondary)}>
            Manage and track confirmed customer orders
          </p>
        </div>

        {/* New Order Notification */}
        {newOrderNotification && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                <span className="text-green-800 dark:text-green-300 font-medium">
                  {newOrderNotification}
                </span>
              </div>
              <button
                onClick={() => setNewOrderNotification(null)}
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <Card className={cn("mb-6", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardContent className="p-6">
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by order number, customer name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filter Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Status Filter */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  Order Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 border rounded-md",
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText
                  )}
                >
                  <option value="all">All Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* User Type Filter */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  User Type
                </label>
                <select
                  value={userTypeFilter}
                  onChange={(e) => setUserTypeFilter(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 border rounded-md",
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText
                  )}
                >
                  <option value="all">All Users</option>
                  <option value="guest">Guest Users</option>
                  <option value="registered">Registered Users</option>
                </select>
              </div>

              {/* Delivery Option Filter */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  Delivery Option
                </label>
                <select
                  value={deliveryOptionFilter}
                  onChange={(e) => setDeliveryOptionFilter(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 border rounded-md",
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText
                  )}
                >
                  <option value="all">All Options</option>
                  <option value="pickup">Pickup from Shop</option>
                  <option value="shipping">Home Delivery</option>
                </select>
              </div>

              {/* Supplier Filter */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  Supplier Orders
                </label>
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 border rounded-md",
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText
                  )}
                >
                  <option value="all">All Orders</option>
                  <option value="with-suppliers">With Suppliers</option>
                  <option value="no-suppliers">No Suppliers</option>
                </select>
              </div>
            </div>

            {/* Filter Row 2 - Date and Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Date From */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  Confirmed Date From
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={cn(
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText
                  )}
                />
              </div>

              {/* Date To */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  Confirmed Date To
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={cn(
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText
                  )}
                />
              </div>

              {/* Time From */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  Time From (Optional)
                </label>
                <Input
                  type="time"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                  className={cn(
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText
                  )}
                />
              </div>

              {/* Time To */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  Time To (Optional)
                </label>
                <Input
                  type="time"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                  className={cn(
                    themeClasses.cardBg,
                    themeClasses.cardBorder,
                    themeClasses.mainText
                  )}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  Clear All Filters
                </Button>
                <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  Showing {filteredOrders.length} of {orders.length} orders
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" className="flex items-center gap-2" onClick={fetchConfirmedOrders} disabled={isLoading}>
                  <Download className="w-4 h-4" />
                  {isLoading ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>
            </div>
            
            {/* Last Updated Info */}
            {lastUpdated && (
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Last updated: {lastUpdated.toLocaleTimeString()} ({orders.length} orders)
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <Card className={cn(themeClasses.cardBg, themeClasses.cardBorder)}>
              <CardContent className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className={cn("text-lg font-semibold mb-2", themeClasses.mainText)}>No confirmed orders found</h3>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Confirmed orders will appear here after you confirm pending orders.'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <Card key={order.id} className={cn(themeClasses.cardBg, themeClasses.cardBorder, "relative")}>
                <CardContent className="p-6">
                  {/* User Type Badge - Top Right */}
                  <div className="absolute top-4 right-4">
                    {getUserTypeBadge(order.userId)}
                  </div>
                  
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Order Info */}
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                        <div className="flex flex-col">
                          <h3 className={cn("text-lg font-semibold", themeClasses.mainText)}>
                            {order.pickupId || order.orderNumber}
                          </h3>
                          <div className="flex flex-col sm:flex-row gap-2 mt-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200", themeClasses.mainText)}>
                                Ref: {order.referenceId.slice(0, 8)}...
                              </span>
                              {/* Show pickup ID only for pickup orders */}
                              {order.deliveryOption === 'pickup' && order.pickupId && (
                                <span className={cn("text-xs px-2 py-1 rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200", themeClasses.mainText)}>
                                  Pickup: {displayPickup(order.pickupId)}
                                </span>
                              )}
                              {/* Show ship ID only for shipping orders */}
                              {order.deliveryOption === 'shipping' && (
                                <span className={cn("text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-mono", themeClasses.mainText)}>
                                  Ship #{order.pickupId || order.referenceId.slice(-8).toUpperCase()}
                                </span>
                              )}
                              <span className={cn("text-xs px-2 py-1 rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200", themeClasses.mainText)}>
                                Original: #{order.order_id}
                              </span>
                              {/* Show supplier badge if order has suppliers */}
                              {order.hasSuppliers && order.suppliers && order.suppliers.length > 0 && (
                                <span className={cn("text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200", themeClasses.mainText)}>
                                  Suppliers: {order.suppliers.length}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {getPaymentStatusBadge(order.paymentStatus)}
                              {getStatusBadge(order.status)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            {order.customerName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            {order.customerEmail}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                            {order.customerPhone}
                          </span>
                        </div>
                      </div>

                      {/* Order Details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className={cn("font-medium", themeClasses.mainText)}>Total:</span>
                          <p className={cn("font-semibold", themeClasses.mainText)}>
                            {formatPrice(order.total, order.currency)}
                          </p>
                        </div>
                        <div>
                          <span className={cn("font-medium", themeClasses.mainText)}>Products:</span>
                          <p className={cn(themeClasses.textNeutralSecondary)}>{order.items} types</p>
                        </div>
                        <div>
                          <span className={cn("font-medium", themeClasses.mainText)}>Quantity:</span>
                          <p className={cn(themeClasses.textNeutralSecondary)}>{order.total_items} items</p>
                        </div>
                        <div>
                          <span className={cn("font-medium", themeClasses.mainText)}>Confirmed:</span>
                          <p className={cn(themeClasses.textNeutralSecondary)}>
                            {formatDate(order.confirmedAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => previewOrder(order)}>
                        <Eye className="w-4 h-4" />
                        View Details
                      </Button>
                      {order.status === 'confirmed' && (
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => updateOrderStatus(order, 'shipped')}>
                          Mark Shipped
                        </Button>
                      )}
                      {order.status === 'shipped' && (
                        <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => updateOrderStatus(order, 'delivered')}>
                          Mark Delivered
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Summary Stats */}
        {filteredOrders.length > 0 && (
          <Card className={cn("mt-6", themeClasses.cardBg, themeClasses.cardBorder)}>
            <CardHeader>
              <CardTitle className={themeClasses.mainText}>Confirmed Orders Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                    {filteredOrders.length}
                  </p>
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Total Confirmed</p>
                </div>
                <div className="text-center">
                  <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                    {filteredOrders.filter(o => o.status === 'confirmed').length}
                  </p>
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Ready to Ship</p>
                </div>
                <div className="text-center">
                  <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                    {filteredOrders.filter(o => o.status === 'shipped').length}
                  </p>
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Shipped</p>
                </div>
                <div className="text-center">
                  <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                    {formatPrice(
                      filteredOrders.reduce((sum, order) => sum + order.total, 0),
                      'TZS'
                    )}
                  </p>
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Total Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={cn("max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl bg-white dark:bg-neutral-900", themeClasses.cardBorder)}>
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", themeClasses.mainText)}>
              <CheckCircle className="w-5 h-5" />
              Confirmed Order Details
            </DialogTitle>
            <DialogDescription className={cn(themeClasses.textNeutralSecondary)}>
              Complete confirmed order information and item details
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", themeClasses.mainText)}>Order Number:</span>
                    <span className={cn(themeClasses.textNeutralSecondary)}>{selectedOrder.orderNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", themeClasses.mainText)}>Original Order ID:</span>
                    <span className={cn("text-sm font-mono", themeClasses.textNeutralSecondary)}>
                      #{selectedOrder.order_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", themeClasses.mainText)}>Reference ID:</span>
                    <span className={cn("text-sm font-mono", themeClasses.textNeutralSecondary)}>
                      {selectedOrder.referenceId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", themeClasses.mainText)}>ClickPesa Reference:</span>
                    <span className={cn("text-sm font-mono", themeClasses.textNeutralSecondary)}>
                      {selectedOrder.referenceId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", themeClasses.mainText)}>Pickup ID:</span>
                    <span className={cn("text-sm font-mono", themeClasses.textNeutralSecondary)}>
                      {selectedOrder.pickupId}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", themeClasses.mainText)}>Status:</span>
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", themeClasses.mainText)}>Payment:</span>
                    {getPaymentStatusBadge(selectedOrder.paymentStatus)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", themeClasses.mainText)}>Confirmed At:</span>
                    <span className={cn(themeClasses.textNeutralSecondary)}>
                      {formatDate(selectedOrder.confirmedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", themeClasses.mainText)}>Confirmed By:</span>
                    <span className={cn(themeClasses.textNeutralSecondary)}>
                      {selectedOrder.confirmedBy}
                    </span>
                  </div>
                </div>
              </div>

              {/* Confirmation Info */}
              <div className={cn("p-4 rounded-lg border bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800")}>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <h3 className={cn("font-semibold text-green-800 dark:text-green-200")}>
                      Order Confirmed Successfully
                    </h3>
                    <p className={cn("text-sm text-green-700 dark:text-green-300")}>
                      This order has been confirmed and is ready for processing. Payment has been verified.
                    </p>
                    {selectedOrder.notes && (
                      <p className={cn("text-sm mt-2 text-green-700 dark:text-green-300")}>
                        <strong>Notes:</strong> {selectedOrder.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Status Section */}
              <div className={cn("p-4 rounded-lg border", 
                selectedOrder.paymentStatus === 'paid' 
                  ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" 
                  : selectedOrder.paymentStatus === 'failed'
                  ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                  : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"
              )}>
                <div className="flex items-center gap-3">
                  {selectedOrder.paymentStatus === 'paid' ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : selectedOrder.paymentStatus === 'failed' ? (
                    <XCircle className="w-6 h-6 text-red-600" />
                  ) : (
                    <Clock className="w-6 h-6 text-yellow-600" />
                  )}
                  <div>
                    <h3 className={cn("font-semibold text-lg", 
                      selectedOrder.paymentStatus === 'paid' ? "text-green-800 dark:text-green-200" : 
                      selectedOrder.paymentStatus === 'failed' ? "text-red-800 dark:text-red-200" :
                      "text-yellow-800 dark:text-yellow-200"
                    )}>
                      Payment Status: {selectedOrder.paymentStatus === 'paid' ? 'PAID' : 
                                     selectedOrder.paymentStatus === 'failed' ? 'FAILED' : 
                                     selectedOrder.paymentStatus === 'pending' ? 'PENDING' : 'NOT PAID'}
                    </h3>
                    <p className={cn("text-sm mt-1", 
                      selectedOrder.paymentStatus === 'paid' ? "text-green-700 dark:text-green-300" : 
                      selectedOrder.paymentStatus === 'failed' ? "text-red-700 dark:text-red-300" :
                      "text-yellow-700 dark:text-yellow-300"
                    )}>
                      {selectedOrder.paymentStatus === 'paid' 
                        ? 'Payment has been received and processed successfully.' 
                        : selectedOrder.paymentStatus === 'failed'
                        ? selectedOrder.failureReason 
                          ? `Payment failed: ${selectedOrder.failureReason}`
                          : 'Payment failed. No failure reason available.'
                        : selectedOrder.paymentStatus === 'pending'
                        ? 'Payment is being processed. Please wait for confirmation.'
                        : 'Payment is still pending or has not been completed.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="space-y-3">
                <h3 className={cn("font-semibold text-lg", themeClasses.mainText)}>Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className={cn("text-sm font-medium", themeClasses.mainText)}>Name</span>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        {selectedOrder.customerName || 'Not provided'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className={cn("text-sm font-medium", themeClasses.mainText)}>Email</span>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        {selectedOrder.customerEmail || 'Not provided'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className={cn("text-sm font-medium", themeClasses.mainText)}>Phone</span>
                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                        {selectedOrder.customerPhone || 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping Address / Pickup Information */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className={cn("font-semibold text-lg", themeClasses.mainText)}>
                    {selectedOrder.deliveryOption === 'pickup' ? 'Pick it from shop' : 'Shipping Address'}
                  </h3>
                  <div className={cn("text-xs px-3 py-1 rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-mono", themeClasses.mainText)}>
                    {selectedOrder.deliveryOption === 'pickup' ? 'Pickup' : 'Ship'} #{selectedOrder.pickupId || selectedOrder.referenceId.slice(-8).toUpperCase()}
                  </div>
                </div>
                
                {selectedOrder.deliveryOption === 'pickup' ? (
                  // Pickup Information
                  <div className={cn("p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800")}>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-5 h-5 text-orange-600" />
                      <h4 className={cn("font-semibold text-orange-800 dark:text-orange-200")}>
                        Store Pickup - Customer Contact
                      </h4>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className={cn("font-medium", themeClasses.mainText)}>
                        👤 {selectedOrder.shippingAddress.fullName || 'Not provided'}
                      </p>
                      {selectedOrder.shippingAddress.phone && (
                        <p className={cn("text-orange-700 dark:text-orange-300")}>
                          📞 {selectedOrder.shippingAddress.phone}
                        </p>
                      )}
                      <p className={cn("text-xs text-orange-600 dark:text-orange-400 mt-2")}>
                        Customer will pick up their order from our store location.
                      </p>
                    </div>
                  </div>
                ) : (
                  // Shipping Address Information
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                    <div className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      <p className={cn("font-medium", themeClasses.mainText)}>{selectedOrder.shippingAddress.fullName}</p>
                      <p>{selectedOrder.shippingAddress.address1}</p>
                      {selectedOrder.shippingAddress.address2 && <p>{selectedOrder.shippingAddress.address2}</p>}
                      <p>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.postalCode}</p>
                      <p>{selectedOrder.shippingAddress.country}</p>
                      {selectedOrder.shippingAddress.phone && (
                        <p className={cn("mt-2 text-xs", themeClasses.textNeutralSecondary)}>
                          📞 {selectedOrder.shippingAddress.phone}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Supplier Info - Only in Detail View */}
              {selectedOrder.hasSuppliers && selectedOrder.suppliers && selectedOrder.suppliers.length > 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className={cn("font-semibold text-lg", themeClasses.mainText)}>
                      Suppliers ({selectedOrder.suppliers.length})
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.suppliers.map((supplier, idx) => (
                      <Badge key={idx} className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm py-1 px-3">
                        {supplier}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className={cn("font-semibold text-lg", themeClasses.mainText)}>Order Items</h3>
                  <div className="text-right">
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      {selectedOrder.total_items} items total
                    </p>
                    <p className={cn("text-lg font-semibold", themeClasses.mainText)}>
                      {formatPrice(selectedOrder.total, selectedOrder.currency)}
                    </p>
                  </div>
                </div>
                
                {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                  <div className="space-y-4">
                    {(() => {
                      // Group items by supplier
                      const groupedBySupplier = new Map<string | null, typeof selectedOrder.order_items>()
                      
                      selectedOrder.order_items.forEach(item => {
                        const supplierKey = item.supplierName || 'no-supplier'
                        if (!groupedBySupplier.has(supplierKey)) {
                          groupedBySupplier.set(supplierKey, [])
                        }
                        groupedBySupplier.get(supplierKey)!.push(item)
                      })
                      
                      return Array.from(groupedBySupplier.entries()).map(([supplierKey, items]) => {
                        const supplierName = items[0]?.supplierName || 'Honic Company'
                        const groupTotal = items.reduce((sum, item) => sum + item.total_price, 0)
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
                          <div key={supplierKey} className="space-y-3">
                            {/* Supplier Header */}
                            <div className="flex items-center justify-between pb-2 border-b">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-green-600 dark:text-green-400" />
                                <h4 className={cn("font-semibold text-base", themeClasses.mainText)}>
                                  {supplierName}
                                </h4>
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  {items.length} {items.length === 1 ? 'item' : 'items'}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Subtotal:</p>
                                <p className={cn("font-semibold", themeClasses.mainText)}>
                                  {formatPrice(groupTotal, selectedOrder.currency)}
                                </p>
                              </div>
                            </div>
                            
                            {/* Tracking Timeline - Show if order is confirmed */}
                            {selectedOrder.confirmedAt && (
                              <div className="pt-3 border-t">
                                <h4 className={cn("text-sm font-semibold mb-4 flex items-center gap-2", themeClasses.mainText)}>
                                  <Truck className="w-4 h-4" />
                                  Package Tracking Status
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {packageStatus === 'confirmed' ? 'Awaiting Shipment' : 
                                     packageStatus === 'shipped' ? 'In Transit' :
                                     packageStatus === 'delivered' ? 'Delivered' :
                                     packageStatus === 'picked_up' ? 'Picked Up' : 
                                     'Processing'}
                                  </Badge>
                                </h4>
                                <div className="overflow-x-auto pb-4 -mx-2 px-2">
                                  <div className="flex items-start gap-2 min-w-max">
                                    {getTrackingTimeline(packageStatus, selectedOrder.deliveryOption, false, selectedOrder.confirmedAt).map((step, index, array) => {
                                      const isLastStep = index === array.length - 1
                                      
                                      return (
                                        <div key={index} className="flex items-start gap-2 flex-shrink-0">
                                          <div className="flex flex-col items-center">
                                            <div className={cn(`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                                              step.completed
                                                ? 'bg-green-500 border-green-500 text-white' 
                                                : isLastStep && !step.completed
                                                ? 'bg-blue-500 border-blue-500 text-white'
                                                : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                                            }`)}>
                                              {step.completed ? (
                                                <CheckCircle className="w-4 h-4" />
                                              ) : (
                                                <Clock className="w-3.5 h-3.5" />
                                              )}
                                            </div>
                                            {!isLastStep && (
                                              <div className={cn(`h-0.5 w-12 mt-2 transition-colors ${
                                                step.completed ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                                              }`)} />
                                            )}
                                          </div>
                                          <div className="flex flex-col items-center min-w-[80px] max-w-[120px] pt-1">
                                            <div className="flex flex-col items-center gap-1">
                                              <span className={cn(`text-xs font-medium text-center leading-tight ${
                                                step.completed 
                                                  ? 'text-green-600 dark:text-green-400' 
                                                  : themeClasses.textNeutralSecondary
                                              }`)}>
                                                {step.description}
                                              </span>
                                              {step.completed && (
                                                <CheckCircle className="w-3 h-3 text-green-500 mt-0.5" />
                                              )}
                                            </div>
                                            <p className={cn("text-[10px] text-center mt-1 leading-tight", themeClasses.textNeutralSecondary)}>
                                              {step.location}
                                            </p>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                                <p className={cn("text-xs mt-3 italic", themeClasses.textNeutralSecondary)}>
                                  This is how the customer sees the tracking status for this package.
                                </p>
                              </div>
                            )}
                            
                            {/* Items for this supplier */}
                            <div className="space-y-2 pl-4">
                              {items.map((item, index) => (
                                <div key={item.id || index} className={cn("p-3 rounded-lg border", themeClasses.cardBg, themeClasses.cardBorder)}>
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <h4 className={cn("font-medium", themeClasses.mainText)}>
                                        {item.product_name}
                                      </h4>
                                      {item.variant_name && (
                                        <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                                          Variant: {item.variant_name}
                                        </p>
                                      )}
                                      <p className={cn("text-sm mt-1", themeClasses.textNeutralSecondary)}>
                                        Product ID: {item.product_id}
                                      </p>
                                      <div className="flex items-center gap-2 mt-2">
                                        <p className={cn("text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-mono", themeClasses.mainText)}>
                                          Item #{String(index + 1).padStart(3, '0')}
                                        </p>
                                        {item.status && (
                                          <Badge className={cn(
                                            item.status === 'shipped' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                            item.status === 'delivered' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                            item.status === 'picked_up' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                          )}>
                                            {item.status === 'picked_up' ? 'Picked Up' : 
                                             item.status === 'delivered' ? 'Delivered' :
                                             item.status === 'shipped' ? 'Shipped' :
                                             item.status.charAt(0).toUpperCase() + item.status.slice(1).replace(/_/g, ' ')}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                                        {item.quantity}x {formatPrice(item.price, selectedOrder.currency)}
                                      </p>
                                      <p className={cn("font-semibold", themeClasses.mainText)}>
                                        {formatPrice(item.total_price, selectedOrder.currency)}
                                      </p>
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
                ) : (
                  <div className={cn("p-4 text-center rounded-lg border", themeClasses.cardBg, themeClasses.cardBorder)}>
                    <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      No order items found
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
