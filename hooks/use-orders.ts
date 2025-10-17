import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'

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

export function useOrders() {
  const { isAuthenticated } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([])
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/user/orders')
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }
      
      const data = await response.json()
      setOrders(data.orders || [])
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  const fetchOrderById = useCallback(async (orderId: string): Promise<Order | null> => {
    if (!isAuthenticated) {
      return null
    }

    try {
      const response = await fetch(`/api/user/orders/${orderId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error('Failed to fetch order')
      }
      
      const data = await response.json()
      return data.order
    } catch (err) {
      console.error('Error fetching order:', err)
      throw err
    }
  }, [isAuthenticated])

  const createOrder = useCallback(async (orderData: Partial<Order>): Promise<Order | null> => {
    if (!isAuthenticated) {
      throw new Error('Must be authenticated to create order')
    }

    try {
      const response = await fetch('/api/user/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      })
      
      if (!response.ok) {
        throw new Error('Failed to create order')
      }
      
      const data = await response.json()
      return data.order
    } catch (err) {
      console.error('Error creating order:', err)
      throw err
    }
  }, [isAuthenticated])

  const updateOrder = useCallback(async (orderId: string, updates: Partial<Order>): Promise<Order | null> => {
    if (!isAuthenticated) {
      throw new Error('Must be authenticated to update order')
    }

    try {
      const response = await fetch(`/api/user/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update order')
      }
      
      const data = await response.json()
      return data.order
    } catch (err) {
      console.error('Error updating order:', err)
      throw err
    }
  }, [isAuthenticated])

  const getOrderStatusHistory = useCallback(async (orderId: string): Promise<OrderStatus[]> => {
    if (!isAuthenticated) {
      return []
    }

    try {
      const response = await fetch(`/api/user/orders/${orderId}/status-history`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch status history')
      }
      
      const data = await response.json()
      const statusHistory = data.statusHistory || []
      
      // If no status history exists, create a basic one
      if (statusHistory.length === 0) {
        return [
          {
            status: 'pending',
            timestamp: new Date().toISOString(),
            description: 'Order placed and payment pending',
            location: 'Online'
          }
        ]
      }
      
      return statusHistory
    } catch (err) {
      console.error('Error fetching status history:', err)
      // Return basic status history as fallback
      return [
        {
          status: 'pending',
          timestamp: new Date().toISOString(),
          description: 'Order placed and payment pending',
          location: 'Online'
        }
      ]
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  return {
    orders,
    loading,
    error,
    fetchOrders,
    fetchOrderById,
    createOrder,
    updateOrder,
    getOrderStatusHistory,
    refetch: fetchOrders
  }
}