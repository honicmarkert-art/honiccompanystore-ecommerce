"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/hooks/use-theme"
import { useCompanyContext } from "@/components/company-provider"
import { useCurrency } from "@/contexts/currency-context"
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface OrderData {
  orderId: string
  customerDetails: {
    fullName: string
    email: string
    phone: string
  }
  shippingAddress: {
    fullName: string
    email: string
    phone: string
    address1: string
    city: string
    state: string
    country: string
    postalCode: string
  }
  billingAddress: any
  paymentMethod: string
  items: any[]
  subtotal: number
  total: number
  currency: string
  status: string
  createdAt: string
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { themeClasses, darkHeaderFooterClasses } = useTheme()
  const { companyName } = useCompanyContext()
  const { formatPrice } = useCurrency()
  
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [polling, setPolling] = useState<boolean>(false)

  const orderId = searchParams.get("orderId")
  const status = searchParams.get("status")
  const orderReference = searchParams.get("orderReference") // ClickPesa parameter
  const transactionId = searchParams.get("transactionId") // ClickPesa parameter

  useEffect(() => {
    const loadOrderData = async () => {
      // Try to get orderId from different sources
      let actualOrderId = orderId
      
      // If no orderId but we have orderReference, try to find order by reference
      if (!actualOrderId && orderReference) {
        // Extract orderId from orderReference (new format: ORDtimestamprandom + more)
        // The orderReference contains the cleaned orderId + timestamp + random
        // We need to find the original orderId pattern: ORD + timestamp + random
        const match = orderReference.match(/^(ORD\d+[A-Z0-9]+)/)
        if (match) {
          // Look for the pattern ORD followed by timestamp (13 digits) and random chars
          const timestampMatch = orderReference.match(/^ORD(\d{13})[A-Z0-9]+/)
          if (timestampMatch) {
            actualOrderId = `ORD${timestampMatch[1]}${orderReference.substring(16, 22)}` // Extract original format
          } else {
            // Fallback: try to find any stored order that matches the reference
            const allOrders = Object.keys(localStorage).filter(key => key.startsWith('order-'))
            for (const orderKey of allOrders) {
              const order = JSON.parse(localStorage.getItem(orderKey) || '{}')
              if (order.clickPesa?.orderReference === orderReference) {
                actualOrderId = orderKey.replace('order-', '')
                break
              }
            }
          }
        }
      }
      
      if (!actualOrderId) {
        setError("No order information provided")
        setIsLoading(false)
        return
      }

      try {
        // Load order data from localStorage (in a real app, this would be from API)
        const storedOrder = localStorage.getItem(`order-${actualOrderId}`)
        
        if (storedOrder) {
          const orderData = JSON.parse(storedOrder)
          
          // Update order status based on ClickPesa response
          if (status === "success" || status === "completed") {
            orderData.status = "confirmed"
            orderData.paymentConfirmedAt = new Date().toISOString()
            
            // Add ClickPesa transaction details if available
            if (transactionId) {
              orderData.clickPesa = {
                ...orderData.clickPesa,
                transactionId,
                status: "completed"
              }
            }
            
            // Update localStorage with confirmed status
            localStorage.setItem(`order-${actualOrderId}`, JSON.stringify(orderData))
          } else if (status === "failed" || status === "cancelled") {
            orderData.status = "failed"
            orderData.paymentFailedAt = new Date().toISOString()
            localStorage.setItem(`order-${actualOrderId}`, JSON.stringify(orderData))
          }
          
          setOrderData(orderData)
        } else {
          setError("Order not found. Please contact support if you believe this is an error.")
        }
      } catch (error) {
        setError("Failed to load order details. Please contact support.")
      } finally {
        setIsLoading(false)
      }
    }

    loadOrderData()
  }, [orderId, orderReference, status, transactionId])

  // Poll backend orders to reflect webhook-updated status
  useEffect(() => {
    // Prefer explicit params; fallback to sessionStorage
    let reference = orderReference
    try {
      if (!reference) reference = sessionStorage.getItem('last_order_reference')
    } catch {}

    if (!reference && !orderId) return

    let attempts = 0
    setPolling(true)
    const interval = setInterval(async () => {
      attempts += 1
      try {
        const resp = await fetch('/api/admin/orders', { cache: 'no-store' })
        if (resp.ok) {
          const data = await resp.json()
          const orders: any[] = data.orders || []
          // Try to match by reference id or order number; otherwise take most recent
          const matched = orders.find(o => (
            (reference && (o.reference_id === reference || o.id === reference)) ||
            (orderId && (o.order_number === orderId || o.id === orderId))
          )) || orders[0]

          if (matched) {
            setLiveStatus(matched.status)
            // If confirmed/failed/cancelled, stop polling
            if (['confirmed', 'failed', 'cancelled', 'delivered', 'shipped'].includes(String(matched.status))) {
              clearInterval(interval)
              setPolling(false)
              // Merge into local state if we had any
              setOrderData(prev => prev ? { ...prev, status: matched.status } : prev)
            }
          }
        }
      } catch {}

      // Stop polling after ~2 minutes
      if (attempts >= 30) {
        clearInterval(interval)
        setPolling(false)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [orderReference, orderId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-TZ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-yellow-500" />
          <p className={themeClasses.mainText}>Loading your order details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className={cn("max-w-md w-full", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className={cn("text-red-500", themeClasses.mainText)}>
              Order Not Found
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className={themeClasses.mainText}>{error}</p>
            <div className="space-y-2">
              <Button asChild className="w-full bg-yellow-500 text-neutral-950 hover:bg-yellow-600">
                <Link href="/checkout">Try Again</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <Card className={cn("", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className={cn("text-green-500 text-2xl", themeClasses.mainText)}>
              Order Confirmed!
            </CardTitle>
            <p className={themeClasses.mainText}>
              Thank you for your order. Your order has been placed successfully and is being processed.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {orderData && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className={cn("font-semibold mb-2", themeClasses.mainText)}>
                      Order Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className={themeClasses.mainText}>Order ID:</span>
                        <span className={themeClasses.mainText}>{orderData.orderId}</span>
                      </div>
                      {liveStatus && (
                        <div className="flex justify-between">
                          <span className={themeClasses.mainText}>Live Status:</span>
                          <span className={cn("capitalize", liveStatus === 'confirmed' ? 'text-green-500' : liveStatus === 'failed' ? 'text-red-500' : themeClasses.mainText)}>
                            {liveStatus}
                            {polling && <span className="ml-2 text-xs opacity-70">(updating...)</span>}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className={themeClasses.mainText}>Total Amount:</span>
                        <span className={themeClasses.mainText}>{formatPrice(orderData.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={themeClasses.mainText}>Date:</span>
                        <span className={themeClasses.mainText}>{formatDate(orderData.createdAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={themeClasses.mainText}>Status:</span>
                        <span className="text-green-500 font-semibold capitalize">{orderData.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={themeClasses.mainText}>Payment Method:</span>
                        <span className={themeClasses.mainText} style={{textTransform: 'capitalize'}}>{orderData.paymentMethod}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className={cn("font-semibold mb-2", themeClasses.mainText)}>
                      Customer Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className={themeClasses.mainText}>Name:</span>
                        <span className={themeClasses.mainText}>{orderData.customerDetails.fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={themeClasses.mainText}>Email:</span>
                        <span className={themeClasses.mainText}>{orderData.customerDetails.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={themeClasses.mainText}>Phone:</span>
                        <span className={themeClasses.mainText}>{orderData.customerDetails.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={themeClasses.mainText}>Items:</span>
                        <span className={themeClasses.mainText}>{orderData.items.length} item(s)</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className={cn("font-semibold mb-2", themeClasses.mainText)}>
                    Delivery Address
                  </h3>
                  <p className={cn("text-sm", themeClasses.mainText)}>
                    {orderData.shippingAddress.address1}<br />
                    {orderData.shippingAddress.city}, {orderData.shippingAddress.state}<br />
                    {orderData.shippingAddress.country} {orderData.shippingAddress.postalCode}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Button asChild className="w-full bg-yellow-500 text-neutral-950 hover:bg-yellow-600">
                <Link href="/">Continue Shopping</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/orders">View Orders</Link>
              </Button>
            </div>

            <div className="text-center text-sm text-gray-500">
              <p>You will receive an email confirmation shortly.</p>
              <p>If you have any questions, please contact our support team.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading order details...</p>
        </div>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  )
}