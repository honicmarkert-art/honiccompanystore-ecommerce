"use client"

// Force dynamic rendering
export const dynamic = 'force-dynamic'


import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { logger } from '@/lib/logger'
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
  Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/use-theme'
import { supabaseClient } from '@/lib/supabase-client'

interface OrderItem {
  id: string
  product_id: number
  product_name: string
  variant_id: string | null
  variant_name: string | null
  quantity: number
  price: number
  total_price: number
  created_at: string
}

interface Order {
  id: string
  referenceId: string
  pickupId: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  userId: string | null // null for guest users, user ID for registered users
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'ready_for_pickup' | 'picked_up'
  total: number
  currency: string
  items: number
  total_items: number
  orderDate: string
  deliveryOption: 'shipping' | 'pickup'
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
  paymentStatus: 'pending' | 'paid' | 'failed' | 'unpaid'
  clickpesaTransactionId?: string
  paymentTimestamp?: string
  failureReason?: string
  order_items: OrderItem[]
  isConfirming?: boolean // Loading state for confirm button
}

export default function AdminOrdersPage() {
  const { themeClasses } = useTheme()
  const [orders, setOrders] = useState<Order[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all')
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all')
  const [deliveryOptionFilter, setDeliveryOptionFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isClearing, setIsClearing] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [newOrderNotification, setNewOrderNotification] = useState<string | null>(null)
  const [forceUpdate, setForceUpdate] = useState(0)
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const newOrderSoundRef = useRef<HTMLAudioElement | null>(null)

  // Fetch orders from API
  const fetchOrders = async (isRealTimeUpdate = false) => {
    if (!isRealTimeUpdate) {
      setIsLoading(true)
    } else {
    }
    
    try {
      const res = await fetch(`/api/admin/orders?t=${Date.now()}`, { cache: 'no-store' })
      
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Failed to fetch orders: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      
      const normalized: Order[] = (data.orders || []).map((o: any) => {
        // Extract customer information from appropriate address based on delivery option
        const shippingAddress = typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address) : (o.shipping_address || {});
        const billingAddress = typeof o.billing_address === 'string' ? JSON.parse(o.billing_address) : (o.billing_address || {});
        
        // For pickup orders, use billing address (contact info); for shipping, use shipping address
        const isPickup = o.delivery_option === 'pickup';
        const customerInfoSource = isPickup ? billingAddress : shippingAddress;
        
        return {
          id: o.id,
          referenceId: o.reference_id || o.id,
          pickupId: o.pickup_id ? o.pickup_id : (o.created_at ? new Date(o.created_at).toISOString().slice(0,10).replace(/-/g,'') : ''),
          orderNumber: o.order_number || o.id,
          customerName: o.customer_name || customerInfoSource.fullName || '',
          customerEmail: o.customer_email || customerInfoSource.email || '',
          customerPhone: o.customer_phone || customerInfoSource.phone || '',
          userId: o.user_id || null, // null for guest users, user ID for registered users
          status: (o.status || 'pending'),
          total: Number(o.total_amount || o.calculated_total || 0),
          currency: o.currency || 'TZS',
          items: o.order_items ? o.order_items.length : 0, // Number of different products/variants
          total_items: o.total_items || 0, // Total quantity of all items
          orderDate: o.created_at || new Date().toISOString(),
          deliveryOption: o.delivery_option || 'shipping', // Default to shipping if not specified
          shippingAddress: shippingAddress,
          paymentMethod: o.payment_method || 'clickpesa',
          paymentStatus: o.payment_status || (o.status === 'confirmed' ? 'paid' : 'unpaid'),
          clickpesaTransactionId: o.clickpesa_transaction_id || undefined,
          paymentTimestamp: o.payment_timestamp || undefined,
          failureReason: o.failure_reason || undefined,
          order_items: o.order_items || []
        }
      })
      setOrders(normalized)
      setLastUpdated(new Date())
      setForceUpdate(prev => prev + 1) // Force re-render
    } catch (e) {
      setOrders([])
    } finally {
      if (!isRealTimeUpdate) {
    setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchOrders()
    // Prepare simple notification sound
    try {
      const audio = new Audio('data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA=')
      newOrderSoundRef.current = audio
    } catch {}
  }, [])

  // Realtime subscription for new orders
  useEffect(() => {
    
    const channel = supabaseClient
      .channel('admin-orders-realtime')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders' 
      }, async (payload) => {
        
        // Immediate visual feedback
        setLastUpdated(new Date())
        
        // Show new order notification
        const orderNumber = payload.new?.order_number || 'New Order'
        setNewOrderNotification(`🔔 New order received: ${orderNumber}`)
        
        // Auto-hide notification after 5 seconds
        setTimeout(() => {
          setNewOrderNotification(null)
        }, 5000)
        
        try {
          // Play notification sound immediately
          newOrderSoundRef.current?.play().catch(() => {})
          
          // Fetch fresh orders
          await fetchOrders(true)
          
        } catch (error) {
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders' 
      }, async (payload) => {
        
        // Immediate visual feedback
        setLastUpdated(new Date())
        
        try {
          // Fetch fresh orders
          await fetchOrders(true)
          
        } catch (error) {
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
        } else if (status === 'CHANNEL_ERROR') {
        } else if (status === 'TIMED_OUT') {
        }
      })

    return () => {
      try { 
        supabaseClient.removeChannel(channel)
      } catch (error) {
        // Silent error handling
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders(true) // Pass true to indicate it's an auto-refresh
      setLastUpdated(new Date())
    }, 5000) // 5 seconds

    // Cleanup interval on component unmount
    return () => {
      clearInterval(interval)
    }
  }, [])

  // Filter orders based on all criteria using useMemo for better performance
  const filteredOrders = useMemo(() => {
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

    // Payment status filter
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.paymentStatus === paymentStatusFilter)
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

    // Date filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.orderDate)
        const fromDate = dateFrom ? new Date(dateFrom) : new Date('1900-01-01')
        const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : new Date()
        
        return orderDate >= fromDate && orderDate <= toDate
      })
    }

    // Time filter (if date is selected)
    if ((timeFrom || timeTo) && (dateFrom || dateTo)) {
      filtered = filtered.filter(order => {
        const orderDateTime = new Date(order.orderDate)
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

    
    return filtered
  }, [orders, searchTerm, statusFilter, paymentStatusFilter, userTypeFilter, deliveryOptionFilter, dateFrom, dateTo, timeFrom, timeTo, forceUpdate])

  const getStatusBadge = (status: Order['status']) => {
    const statusConfig = {
      pending: { 
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800', 
        icon: Clock,
        label: 'Awaiting Confirmation'
      },
      confirmed: { 
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800', 
        icon: CheckCircle,
        label: 'Confirmed'
      },
      shipped: { 
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 border-purple-200 dark:border-purple-800', 
        icon: Truck,
        label: 'Shipped'
      },
      delivered: { 
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800', 
        icon: Package,
        label: 'Delivered'
      },
      ready_for_pickup: { 
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300 border-orange-200 dark:border-orange-800', 
        icon: MapPin,
        label: 'Ready for Pickup'
      },
      picked_up: { 
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800', 
        icon: CheckCircle,
        label: 'Picked Up'
      },
      cancelled: { 
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800', 
        icon: XCircle,
        label: 'Cancelled'
      }
    }

    const config = statusConfig[status] || {
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 border-gray-200 dark:border-gray-800',
      icon: Package,
      label: status || 'Unknown'
    }
    const Icon = config.icon

    return (
      <Badge className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border", config.color)}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    )
  }

  const getPaymentStatusBadge = (paymentStatus: Order['paymentStatus']) => {
    const paymentStatusConfig = {
      paid: { 
        color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', 
        icon: CheckCircle,
        label: 'Payment Received'
      },
      unpaid: { 
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800', 
        icon: Clock,
        label: 'Payment Required'
      },
      pending: { 
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800', 
        icon: Clock,
        label: 'Payment Pending'
      },
      failed: { 
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800', 
        icon: XCircle,
        label: 'Payment Failed'
      }
    }

    const config = paymentStatusConfig[paymentStatus] || {
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 border-gray-200 dark:border-gray-800',
      icon: Clock,
      label: paymentStatus || 'Unknown'
    }
    const Icon = config.icon

    return (
      <Badge className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border", config.color)}>
        <Icon className="w-3 h-3" />
        {config.label}
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

  const getOrderAgeWarning = (order: Order) => {
    const now = new Date()
    const orderDate = new Date(order.orderDate)
    const ageInHours = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60)
    
    if (order.paymentStatus === 'pending' && ageInHours >= 0.8) { // 48 minutes (close to 1 hour)
      return (
        <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
          <Clock className="w-3 h-3 mr-1" />
          Will fail soon
        </Badge>
      )
    }
    
    if (order.paymentStatus === 'failed' && ageInHours >= 23) { // 23 hours (close to 24 hours)
      return (
        <Badge variant="outline" className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
          <Trash2 className="w-3 h-3 mr-1" />
          Will delete soon
        </Badge>
      )
    }
    
    return null
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
      // return only date-time portion (exclude any nanoid suffixes)
      return `${parts[0]}-${parts[1]}`
    }
    return pickupId
  }

  const clearAllFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setPaymentStatusFilter('all')
    setUserTypeFilter('all')
    setDeliveryOptionFilter('all')
    setDateFrom('')
    setDateTo('')
    setTimeFrom('')
    setTimeTo('')
  }

  const cleanupExpiredOrders = async () => {
    setIsCleaningUp(true)
    try {
      const response = await fetch('/api/admin/orders/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cleanup orders')
      }

      // Show success message with detailed results
      const message = result.failedCount > 0 || result.deletedCount > 0 
        ? `🧹 Cleanup completed: ${result.failedCount} orders marked as failed, ${result.deletedCount} orders deleted`
        : `🧹 Cleanup completed: No orders needed cleanup`
      
      setNewOrderNotification(message)
      setTimeout(() => {
        setNewOrderNotification(null)
      }, 5000)

      // Refresh orders list
      await fetchOrders()

    } catch (error) {
      setNewOrderNotification(`❌ Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setTimeout(() => {
        setNewOrderNotification(null)
      }, 5000)
    } finally {
      setIsCleaningUp(false)
    }
  }

  const confirmOrder = async (order: Order) => {
    // Only allow confirmation of paid orders
    if (order.paymentStatus !== 'paid') {
      logger.log(`Cannot confirm order ${order.orderNumber}: Payment status is ${order.paymentStatus}`)
      return
    }

    // Set loading state for this specific order
    setOrders(prevOrders => 
      prevOrders.map(o => 
        o.id === order.id 
          ? { ...o, isConfirming: true }
          : o
      )
    )

    try {
      // Create a confirmed order record for tracking
      const confirmedOrderData = {
        originalOrderId: order.id,
        orderNumber: order.orderNumber,
        referenceId: order.referenceId,
        pickupId: order.pickupId,
        userId: order.userId,
        totalAmount: order.total,
        shippingAddress: order.shippingAddress,
        billingAddress: order.shippingAddress,
        paymentMethod: order.paymentMethod || 'clickpesa',
        deliveryOption: order.deliveryOption,
        confirmedBy: null, // Set to null since we don't have admin user ID
        orderItems: order.order_items || []
      }

      const confirmResponse = await fetch('/api/admin/confirmed-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmedOrderData)
      })

      if (confirmResponse.ok) {
        const confirmData = await confirmResponse.json().catch(() => ({}))
        logger.log('✅ Order successfully moved to confirmed_orders table:', confirmData)
        
        // Update the order status and confirmation status in the database
        const newStatus = order.deliveryOption === 'pickup' ? 'ready_for_pickup' : 'confirmed'
        
        try {
          const updateResponse = await fetch(`/api/admin/orders/${order.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: newStatus,
              confirmationStatus: 'confirmed'
            })
          })

          if (updateResponse.ok) {
            logger.log('✅ Order status updated in database to:', newStatus)
          } else {
            const errorData = await updateResponse.json().catch(() => ({ error: 'Unknown error' }))
            console.error('❌ Failed to update order status in database:', errorData)
            logger.log('⚠️ Continuing with local state update only')
          }
        } catch (updateError) {
          console.error('❌ Error updating order status in database:', updateError)
          logger.log('⚠️ Continuing with local state update only')
        }
        
        // Mark order as confirmed (but don't delete yet)
        setOrders(prevOrders => 
          prevOrders.map(o => 
            o.id === order.id 
              ? { ...o, status: newStatus }
              : o
          )
        )

        const statusMessage = order.deliveryOption === 'pickup' 
          ? `Order ${order.orderNumber} is ready for pickup and confirmed!` 
          : `Order ${order.orderNumber} has been confirmed successfully.`
        
        logger.log('✅ ' + statusMessage)
      } else {
        const errorData = await confirmResponse.json().catch(() => ({ error: 'Unknown error' }))
        console.error('❌ Failed to create confirmed order record:', errorData)
        console.error('Response status:', confirmResponse.status)
        console.error('Request data sent:', {
          originalOrderId: confirmedOrderData.originalOrderId,
          orderNumber: confirmedOrderData.orderNumber,
          referenceId: confirmedOrderData.referenceId
        })
        return
      }
    } catch (error) {
      console.error('Error in confirmOrder:', error)
    } finally {
      // Clear loading state
      setOrders(prevOrders => 
        prevOrders.map(o => 
          o.id === order.id 
            ? { ...o, isConfirming: false }
            : o
        )
      )
    }
  }

  const clearConfirmedOrder = async (order: Order) => {
    // Set loading state for this specific order
    setOrders(prevOrders => 
      prevOrders.map(o => 
        o.id === order.id 
          ? { ...o, isConfirming: true }
          : o
      )
    )

    try {
      logger.log('🗑️ Clearing confirmed order from orders table:', order.id)
      
      const deleteResponse = await fetch(`/api/admin/orders?id=${order.id}`, {
        method: 'DELETE'
      })
      
      if (deleteResponse.ok) {
        logger.log('✅ Confirmed order cleared from orders table:', order.orderNumber)
        
        // Remove order from local state
        setOrders(prevOrders => 
          prevOrders.filter(o => o.id !== order.id)
        )
      } else {
        console.error('❌ Delete request failed with status:', deleteResponse.status)
        console.error('❌ Delete request status text:', deleteResponse.statusText)
        
        let deleteErrorData
        try {
          deleteErrorData = await deleteResponse.json()
        } catch (jsonError) {
          deleteErrorData = { error: `HTTP ${deleteResponse.status}: ${deleteResponse.statusText}` }
        }
        
        console.error('❌ Failed to clear confirmed order:', deleteErrorData)
        console.error('❌ Order details:', { id: order.id, orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus })
      }
    } catch (error) {
      console.error('Error clearing confirmed order:', error)
    } finally {
      // Clear loading state for this specific order
      setOrders(prevOrders => 
        prevOrders.map(o => 
          o.id === order.id 
            ? { ...o, isConfirming: false }
            : o
        )
      )
    }
  }

  const deleteOrder = async (order: Order) => {
    // Only allow deletion of failed or unpaid orders
    const allowedStatuses = ['failed', 'unpaid', 'pending']
    if (!allowedStatuses.includes(order.paymentStatus)) {
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete order ${order.orderNumber}?\n\n` +
      `This will permanently remove the order and all its items.\n` +
      `Payment Status: ${order.paymentStatus.toUpperCase()}\n\n` +
      `This action cannot be undone.`
    )
    
    if (!confirmed) return

    try {
      const res = await fetch(`/api/admin/orders?id=${order.id}`, { 
        method: 'DELETE' 
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Failed to delete order')
      }

      const result = await res.json()
      
      // Refresh the orders list
      await fetchOrders()
    } catch (error: any) {
    }
  }

  const previewOrder = (order: Order) => {
    setSelectedOrder(order)
    setIsDialogOpen(true)
  }

  const handleClearAll = async () => {
    const confirmed = window.confirm('This will permanently delete ALL orders. Continue?')
    if (!confirmed) return
    setIsClearing(true)
    try {
      const res = await fetch('/api/admin/orders', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to clear orders')
      // Refresh list to empty
      setOrders([])
      setFilteredOrders([])
    } catch (e) {
    } finally {
      setIsClearing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <p className={themeClasses.textNeutralSecondary}>Loading orders...</p>
        </div>
      </div>
    )
  }


  return (
    <div className={cn("min-h-screen p-6", themeClasses.mainBg)}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={cn("text-3xl font-bold mb-2", themeClasses.mainText)}>Orders Management</h1>
          <p className={cn("text-lg", themeClasses.textNeutralSecondary)}>
            Manage and track customer orders
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
                    themeClasses.inputBg,
                    themeClasses.inputBorder,
                    themeClasses.textNeutralPrimary
                  )}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Awaiting Confirmation</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="ready_for_pickup">Ready for Pickup</option>
                  <option value="picked_up">Picked Up</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Payment Status Filter */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  Payment Status
                </label>
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 border rounded-md",
                    themeClasses.inputBg,
                    themeClasses.inputBorder,
                    themeClasses.textNeutralPrimary
                  )}
                >
                  <option value="all">All Payment Statuses</option>
                  <option value="paid">Payment Received</option>
                  <option value="unpaid">Payment Required</option>
                  <option value="pending">Payment Pending</option>
                  <option value="failed">Payment Failed</option>
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
                    themeClasses.inputBg,
                    themeClasses.inputBorder,
                    themeClasses.textNeutralPrimary
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
                    themeClasses.inputBg,
                    themeClasses.inputBorder,
                    themeClasses.textNeutralPrimary
                  )}
                >
                  <option value="all">All Options</option>
                  <option value="pickup">Pickup from Shop</option>
                  <option value="shipping">Home Delivery</option>
                </select>
              </div>
            </div>

            {/* Filter Row 2 - Date and Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Date From */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  Date From
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={cn(
                    themeClasses.inputBg,
                    themeClasses.inputBorder,
                    themeClasses.textNeutralPrimary
                  )}
                />
              </div>

              {/* Date To */}
              <div>
                <label className={cn("block text-sm font-medium mb-1", themeClasses.textNeutralSecondary)}>
                  Date To
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={cn(
                    themeClasses.inputBg,
                    themeClasses.inputBorder,
                    themeClasses.textNeutralPrimary
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
                    themeClasses.inputBg,
                    themeClasses.inputBorder,
                    themeClasses.textNeutralPrimary
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
                    themeClasses.inputBg,
                    themeClasses.inputBorder,
                    themeClasses.textNeutralPrimary
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
                <Button variant="outline" className="flex items-center gap-2" onClick={fetchOrders} disabled={isLoading}>
                <Download className="w-4 h-4" />
                  {isLoading ? 'Refreshing...' : 'Refresh'}
                </Button>
                <div className="text-xs text-gray-500">
                  Auto-refresh: 5s
                </div>
                <Button 
                  variant="secondary" 
                  className="flex items-center gap-2 bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:bg-orange-900/30" 
                  onClick={cleanupExpiredOrders} 
                  disabled={isCleaningUp}
                >
                  <Package className="w-4 h-4" />
                  {isCleaningUp ? 'Cleaning...' : 'Cleanup Expired'}
                </Button>
                <Button variant="destructive" className="flex items-center gap-2" onClick={handleClearAll} disabled={isClearing}>
                  {isClearing ? 'Clearing…' : 'Clear All Orders'}
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
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className={cn("text-lg font-semibold mb-2", themeClasses.mainText)}>No orders found</h3>
                <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Orders will appear here when customers place them.'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <Card key={`${order.id}-${forceUpdate}`} className={cn(themeClasses.cardBg, themeClasses.cardBorder, "relative")}>
                <CardContent className="p-6">
                  {/* User Type Badge and Age Warning - Top Right */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                    {getUserTypeBadge(order.userId)}
                    {getOrderAgeWarning(order)}
                  </div>
                  
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Order Info */}
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4">
                        {/* Order Header */}
                        <div className="flex-1">
                          <h3 className={cn("text-lg font-semibold mb-2", themeClasses.mainText)}>
                            {order.pickupId || order.orderNumber}
                          </h3>
                          
                          {/* Order IDs and Tracking */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className={cn("text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-mono", themeClasses.mainText)}>
                                Ref: {order.referenceId.slice(0, 8)}...
                              </span>
                            {/* Show pickup ID only for pickup orders */}
                            {order.deliveryOption === 'pickup' && order.pickupId && (
                              <span className={cn("text-xs px-2 py-1 rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 font-mono", themeClasses.mainText)}>
                                Pickup: {displayPickup(order.pickupId)}
                              </span>
                            )}
                            {/* Show ship ID only for shipping orders */}
                            {order.deliveryOption === 'shipping' && (
                              <span className={cn("text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-mono", themeClasses.mainText)}>
                                Ship #{order.pickupId || order.referenceId.slice(-8).toUpperCase()}
                              </span>
                            )}
                            {/* Delivery Method Badge */}
                            <span className={cn(
                              "text-xs px-2 py-1 rounded font-medium",
                              order.deliveryOption === 'pickup' 
                                ? "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200" 
                                : "bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200"
                            )}>
                              {order.deliveryOption === 'pickup' ? '🏪 Pickup' : '🚚 Delivery'}
                              </span>
                            </div>
                        </div>

                        {/* Status Section */}
                        <div className="flex flex-col items-start sm:items-end gap-2">
                          <span className={cn("text-xs font-medium", themeClasses.textNeutralSecondary)}>
                            Status & Payment
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {getStatusBadge(order.status)}
                            {getPaymentStatusBadge(order.paymentStatus)}
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
                          <span className={cn("font-medium", themeClasses.mainText)}>Date:</span>
                          <p className={cn(themeClasses.textNeutralSecondary)}>
                            {formatDate(order.orderDate)}
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
                      {order.paymentStatus === 'paid' && order.status === 'pending' && (
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700" 
                          onClick={() => confirmOrder(order)}
                          disabled={order.isConfirming}
                        >
                          {order.isConfirming ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Confirming...
                            </>
                          ) : (
                            'Confirm Order'
                          )}
                        </Button>
                      )}
                      {(order.status === 'confirmed' || order.status === 'ready_for_pickup') && (
                        <Button 
                          size="sm" 
                          className="bg-orange-600 hover:bg-orange-700" 
                          onClick={() => clearConfirmedOrder(order)}
                          disabled={order.isConfirming}
                        >
                          {order.isConfirming ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Clearing...
                            </>
                          ) : (
                            'Clear Confirmed'
                          )}
                        </Button>
                      )}
                      {(order.paymentStatus === 'failed' || order.paymentStatus === 'unpaid' || order.paymentStatus === 'pending') && (
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          className="flex items-center gap-2" 
                          onClick={() => deleteOrder(order)}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Order
                        </Button>
                      )}
                      {order.status === 'confirmed' && (
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                          Mark Shipped
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
              <CardTitle className={themeClasses.mainText}>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="text-center">
                  <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                    {filteredOrders.length}
                  </p>
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Total Orders</p>
                </div>
                <div className="text-center">
                  <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                    {filteredOrders.filter(o => o.status === 'pending').length}
                  </p>
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Pending</p>
                </div>
                <div className="text-center">
                  <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                    {filteredOrders.filter(o => o.status === 'shipped').length}
                  </p>
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Shipped</p>
                </div>
                <div className="text-center">
                  <p className={cn("text-2xl font-bold", themeClasses.mainText)}>
                    {filteredOrders.filter(o => o.status === 'delivered').length}
                  </p>
                  <p className={cn("text-sm", themeClasses.textNeutralSecondary)}>Delivered</p>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", themeClasses.mainText)}>
              <Package className="w-5 h-5" />
              Order Details
            </DialogTitle>
            <DialogDescription className={cn(themeClasses.textNeutralSecondary)}>
              Complete order information and item details
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
                
                <div className="space-y-3">
                  {/* Order Status */}
                  <div className="space-y-1">
                    <span className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
                      Order Status
                    </span>
                    {getStatusBadge(selectedOrder.status)}
                  </div>

                  {/* Payment Status */}
                  <div className="space-y-1">
                    <span className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
                      Payment Status
                    </span>
                    {getPaymentStatusBadge(selectedOrder.paymentStatus)}
                  </div>

                  {/* Order Date */}
                  <div className="space-y-1">
                    <span className={cn("text-sm font-medium", themeClasses.textNeutralSecondary)}>
                      Order Date
                    </span>
                    <span className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                      {formatDate(selectedOrder.orderDate)}
                    </span>
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
                    {selectedOrder.clickpesaTransactionId && (
                      <div className="mt-2 text-xs">
                        <span className={cn("font-medium", themeClasses.textNeutralSecondary)}>Transaction ID: </span>
                        <span className={cn("font-mono", themeClasses.textNeutralSecondary)}>
                          {selectedOrder.clickpesaTransactionId}
                        </span>
                      </div>
                    )}
                    {selectedOrder.paymentTimestamp && (
                      <div className="text-xs">
                        <span className={cn("font-medium", themeClasses.textNeutralSecondary)}>Payment Time: </span>
                        <span className={cn(themeClasses.textNeutralSecondary)}>
                          {new Date(selectedOrder.paymentTimestamp).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="space-y-3">
                <h3 className={cn("font-semibold text-lg", themeClasses.mainText)}>Customer Information</h3>
                
                {/* Compact Customer Card */}
                <div className={cn("p-3 rounded-lg border", themeClasses.cardBg, themeClasses.cardBorder)}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    {/* Customer Name */}
                    <div className="space-y-1">
                      <span className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>
                        Full Name
                      </span>
                      <p className={cn("font-medium", themeClasses.mainText)}>
                        {selectedOrder.customerName || 'Not provided'}
                      </p>
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                      <span className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>
                        Email Address
                      </span>
                      <p className={cn("font-mono text-xs break-all", themeClasses.mainText)}>
                        {selectedOrder.customerEmail || 'Not provided'}
                      </p>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1">
                      <span className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>
                        Phone Number
                      </span>
                      <p className={cn("font-mono", themeClasses.mainText)}>
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
                
                {/* Compact Address Card */}
                <div className={cn("p-3 rounded-lg border", themeClasses.cardBg, themeClasses.cardBorder)}>
                  {selectedOrder.deliveryOption === 'pickup' ? (
                    // Pickup Information
                    <div className="space-y-4">
                      {/* Store Pickup Notice */}
                      <div className={cn("p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800")}>
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-5 h-5 text-orange-600" />
                          <h4 className={cn("font-semibold text-orange-800 dark:text-orange-200")}>
                            Store Pickup Information
                          </h4>
                        </div>
                        <p className={cn("text-sm text-orange-700 dark:text-orange-300")}>
                          Customer will pick up their order from our store location. Contact information provided below.
                        </p>
                      </div>

                      {/* Customer Contact for Pickup */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="space-y-1">
                          <span className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>
                            Customer Name
                          </span>
                          <p className={cn("font-medium", themeClasses.mainText)}>
                            {selectedOrder.shippingAddress.fullName || 'Not provided'}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>
                            Contact Phone
                          </span>
                          <p className={cn("font-mono", themeClasses.mainText)}>
                            {selectedOrder.shippingAddress.phone || 'Not provided'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Shipping Address Information
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {/* Customer Name */}
                      <div className="space-y-1">
                        <span className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>
                          Customer Name
                        </span>
                        <p className={cn("font-medium", themeClasses.mainText)}>
                          {selectedOrder.shippingAddress.fullName || 'Not provided'}
                        </p>
                      </div>

                      {/* Phone Number */}
                      <div className="space-y-1">
                        <span className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>
                          Phone Number
                        </span>
                        <p className={cn("font-mono", themeClasses.mainText)}>
                          {selectedOrder.shippingAddress.phone || 'Not provided'}
                        </p>
                      </div>

                      {/* Building/Street Address */}
                      <div className="space-y-1 md:col-span-2">
                        <span className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>
                          Building & Street Address
                        </span>
                        <div className="space-y-1">
                          <p className={cn(themeClasses.mainText)}>
                            {selectedOrder.shippingAddress.address1 || 'Not provided'}
                          </p>
                          {selectedOrder.shippingAddress.address2 && (
                            <p className={cn(themeClasses.textNeutralSecondary)}>
                              {selectedOrder.shippingAddress.address2}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* City & Postal Code */}
                      <div className="space-y-1">
                        <span className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>
                          City & Postal Code
                        </span>
                        <p className={cn(themeClasses.mainText)}>
                          {selectedOrder.shippingAddress.city || 'Not provided'}
                          {selectedOrder.shippingAddress.postalCode && `, ${selectedOrder.shippingAddress.postalCode}`}
                        </p>
                      </div>

                      {/* Country */}
                      <div className="space-y-1">
                        <span className={cn("text-xs font-medium uppercase tracking-wide", themeClasses.textNeutralSecondary)}>
                          Country
                        </span>
                        <p className={cn(themeClasses.mainText)}>
                          {selectedOrder.shippingAddress.country || 'Not provided'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
                  <div className="space-y-2">
                    {selectedOrder.order_items.map((item, index) => (
                      <div key={item.id || index} className={cn("p-3 rounded-lg border bg-gradient-to-r from-blue-50/30 to-purple-50/30 dark:from-blue-950/20 dark:to-purple-950/20", themeClasses.cardBorder)}>
                        <div className="flex items-center justify-between">
                          {/* Item Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              {/* Item Number Badge */}
                              <div className={cn("flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center")}>
                                <span className={cn("text-xs font-bold text-blue-800 dark:text-blue-200")}>
                                  {String(index + 1).padStart(2, '0')}
                                </span>
                              </div>
                              
                              {/* Product Details */}
                              <div className="flex-1 min-w-0">
                                <h4 className={cn("font-medium truncate", themeClasses.mainText)}>
                                  {item.product_name}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  {item.variant_name && (
                                    <span className={cn("text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300")}>
                                      {item.variant_name}
                                    </span>
                                  )}
                                  <span className={cn("text-xs text-gray-500 dark:text-gray-400 font-mono")}>
                                    ID: {item.product_id}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Quantity and Price */}
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <div className={cn("text-lg font-bold", themeClasses.mainText)}>
                                {item.quantity}
                              </div>
                              <div className={cn("text-xs", themeClasses.textNeutralSecondary)}>
                                {item.quantity === 1 ? 'item' : 'items'}
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className={cn("text-sm", themeClasses.textNeutralSecondary)}>
                                {formatPrice(item.price, selectedOrder.currency)}
                              </div>
                              <div className={cn("text-lg font-bold", themeClasses.mainText)}>
                                {formatPrice(item.total_price, selectedOrder.currency)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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
