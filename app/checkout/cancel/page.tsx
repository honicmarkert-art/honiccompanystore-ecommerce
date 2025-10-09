"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/hooks/use-theme"
import { useCompanyContext } from "@/components/company-provider"
import { XCircle, AlertTriangle, Loader2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

function CheckoutCancelContent() {
  const { themeClasses, darkHeaderFooterClasses } = useTheme()
  const { companyName } = useCompanyContext()
  const searchParams = useSearchParams()
  
  const [isLoading, setIsLoading] = useState(true)
  const [orderData, setOrderData] = useState<any>(null)

  const orderId = searchParams.get("orderId")
  const orderReference = searchParams.get("orderReference") // ClickPesa parameter
  const reason = searchParams.get("reason") || searchParams.get("error") || "Payment was cancelled or failed"

  useEffect(() => {
    const loadOrderData = async () => {
      // Try to get orderId from different sources
      let actualOrderId = orderId
      
      // If no orderId but we have orderReference, try to find order by reference
      if (!actualOrderId && orderReference) {
        // Extract orderId from orderReference (new format: ORDtimestamprandom + more)
        // The orderReference contains the cleaned orderId + timestamp + random
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
      
      if (actualOrderId) {
        try {
          const storedOrder = localStorage.getItem(`order-${actualOrderId}`)
          if (storedOrder) {
            const order = JSON.parse(storedOrder)
            order.status = "cancelled"
            order.cancelledAt = new Date().toISOString()
            order.cancellationReason = reason
            
            // Add ClickPesa cancellation details if available
            if (orderReference) {
              order.clickPesa = {
                ...order.clickPesa,
                status: "cancelled",
                cancellationReason: reason
              }
            }
            
            localStorage.setItem(`order-${actualOrderId}`, JSON.stringify(order))
            setOrderData(order)
          }
        } catch (error) {
          console.error("Error loading order data:", error)
        }
      }
      setIsLoading(false)
    }

    loadOrderData()
  }, [orderId, orderReference, reason])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-yellow-500" />
          <p className={themeClasses.mainText}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto">
        <Card className={cn("", themeClasses.cardBg, themeClasses.cardBorder)}>
          <CardHeader className="text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <CardTitle className={cn("text-red-500 text-2xl", themeClasses.mainText)}>
              Payment Cancelled
            </CardTitle>
            <p className={themeClasses.mainText}>
              {reason || "Your payment was not completed. No charges were made to your account."}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {orderData && (
              <div className="text-center space-y-2 mb-4">
                <p className={cn("text-sm", themeClasses.mainText)}>
                  Order ID: <span className="font-mono">{orderData.orderId}</span>
                </p>
                {orderReference && (
                  <p className={cn("text-xs", themeClasses.mainText)}>
                    Reference: <span className="font-mono">{orderReference}</span>
                  </p>
                )}
              </div>
            )}

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <h4 className={cn("font-medium", themeClasses.mainText)}>
                    What happened?
                  </h4>
                  <p className={cn("mt-1", themeClasses.mainText)}>
                    The payment process was interrupted or cancelled. This could be due to:
                  </p>
                  <ul className={cn("mt-2 space-y-1 text-sm", themeClasses.mainText)}>
                    <li>• Network connectivity issues</li>
                    <li>• Browser navigation away from payment page</li>
                    <li>• Payment method declined</li>
                    <li>• User cancellation</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button asChild className="w-full bg-yellow-500 text-neutral-950 hover:bg-yellow-600">
                <Link href="/checkout">Try Payment Again</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/cart">Return to Cart</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Continue Shopping</Link>
              </Button>
            </div>

            <div className="text-center text-sm text-gray-500">
              <p>Need help? Contact our support team.</p>
              <p>Your cart items are still saved.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CheckoutCancelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    }>
      <CheckoutCancelContent />
    </Suspense>
  )
}