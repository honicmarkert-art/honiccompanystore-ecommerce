"use client"

import { useState, useEffect } from "react"

export interface OrderItem {
  id: number
  productId: number
  variantId?: number
  quantity: number
  price: number
  totalPrice: number
  productName: string
  variantName?: string
}

export interface Order {
  id: number
  orderNumber: string
  userId: string
  status: string
  totalAmount: number
  shippingAddress: any
  billingAddress: any
  paymentMethod: string
  paymentStatus: string
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    full_name: string
    email: string
    phone: string
  }
  items: OrderItem[]
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load orders from API on mount
  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/orders')
      if (response.ok) {
        const data = await response.json()
        setOrders(data)
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to fetch orders'
        setError(errorMessage)
        console.error('Failed to fetch orders:', errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      setError(errorMessage)
      console.error('Error fetching orders:', error)
    } finally {
      setIsLoading(false)
      setIsInitialized(true)
    }
  }

  const addOrder = async (order: Omit<Order, "id" | "createdAt" | "updatedAt">) => {
    try {
      setError(null)
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
      })

      if (response.ok) {
        const newOrder = await response.json()
        setOrders(prev => [newOrder, ...prev])
        return newOrder
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to add order'
        setError(errorMessage)
        throw new Error(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add order'
      setError(errorMessage)
      console.error('Error adding order:', error)
      throw error
    }
  }

  const updateOrder = async (id: number, updates: Partial<Order>) => {
    try {
      setError(null)
      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...updates }),
      })

      if (response.ok) {
        const updatedOrder = await response.json()
        setOrders(prev => 
          prev.map(order => 
            order.id === id ? updatedOrder : order
          )
        )
        return updatedOrder
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to update order'
        setError(errorMessage)
        throw new Error(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update order'
      setError(errorMessage)
      console.error('Error updating order:', error)
      throw error
    }
  }

  const deleteOrder = async (id: number) => {
    try {
      setError(null)
      const response = await fetch(`/api/orders?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setOrders(prev => prev.filter(order => order.id !== id))
        return true
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to delete order'
        setError(errorMessage)
        throw new Error(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete order'
      setError(errorMessage)
      console.error('Error deleting order:', error)
      throw error
    }
  }

  const getOrder = (id: number) => {
    return orders.find(order => order.id === id)
  }

  const retry = () => {
    fetchOrders()
  }

  return {
    orders,
    addOrder,
    updateOrder,
    deleteOrder,
    getOrder,
    retry,
    isInitialized,
    isLoading,
    error,
  }
} 