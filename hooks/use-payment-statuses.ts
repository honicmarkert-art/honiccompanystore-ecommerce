"use client"

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'

export interface PaymentStatus {
  id: string
  order_number: string
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled'
  amount: number
  created_at: string
  updated_at: string
  payment_method: string
  transaction_id: string
}

interface UsePaymentStatusesReturn {
  paymentStatuses: PaymentStatus[]
  loading: boolean
  error: string | null
  addPaymentStatus: (status: Omit<PaymentStatus, 'created_at' | 'updated_at'>) => Promise<void>
  refetch: () => Promise<void>
}

export function usePaymentStatuses(): UsePaymentStatusesReturn {
  const { isAuthenticated } = useAuth()
  const [paymentStatuses, setPaymentStatuses] = useState<PaymentStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPaymentStatuses = useCallback(async () => {
    if (!isAuthenticated) {
      setPaymentStatuses([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/user/payment-statuses', {
        cache: 'no-store'
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Payment statuses API error:', response.status, errorText)
        throw new Error(`Failed to fetch payment statuses: ${response.status}`)
      }

      const data = await response.json()
      console.log('Payment statuses data:', data)
      setPaymentStatuses(data.paymentStatuses || [])
    } catch (err) {
      console.error('Payment statuses fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch payment statuses')
      setPaymentStatuses([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  const addPaymentStatus = useCallback(async (status: Omit<PaymentStatus, 'created_at' | 'updated_at'>) => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated')
    }

    try {
      const response = await fetch('/api/user/payment-statuses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(status),
      })

      if (!response.ok) {
        throw new Error('Failed to add payment status')
      }

      const data = await response.json()
      
      // Add to local state
      const newStatus: PaymentStatus = {
        ...status,
        created_at: data.paymentStatus.created_at,
        updated_at: data.paymentStatus.updated_at,
      }
      
      setPaymentStatuses(prev => [newStatus, ...prev].slice(0, 50))
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add payment status')
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchPaymentStatuses()
  }, [fetchPaymentStatuses])

  return {
    paymentStatuses,
    loading,
    error,
    addPaymentStatus,
    refetch: fetchPaymentStatuses,
  }
}
