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
import { useAuth } from "@/contexts/auth-context"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { downloadOrderReceipt, getLocalOrder, saveLocalOrder, type LocalOrder } from "@/lib/local-orders"

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

function localToOrder(local: LocalOrder): OrderData {
  return {
    orderId: local.referenceId,
    customerDetails: { fullName: local.customerName, email: local.email, phone: local.phone },
    shippingAddress: {
      fullName: local.customerName,
      email: local.email,
      phone: local.phone,
      address1: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
    },
    billingAddress: {},
    paymentMethod: "snippe",
    items: local.items.map((item) => ({ productName: item.name, quantity: item.quantity, totalPrice: item.total })),
    subtotal: local.total,
    total: local.total,
    currency: local.currency || "TZS",
    status: local.status,
    createdAt: local.createdAt,
  }
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { themeClasses, darkHeaderFooterClasses } = useTheme()
  const { companyName } = useCompanyContext()
  const { formatPrice } = useCurrency()
  const { isAuthenticated } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()
  const [askForAccount, setAskForAccount] = useState(true)
  
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [polling, setPolling] = useState<boolean>(false)

  const orderId = searchParams.get("orderId")
  const status = searchParams.get("status")
  const orderReference = searchParams.get("orderReference")
  const transactionId = searchParams.get("transactionId")

  useEffect(() => {
    const loadOrderData = async () => {
      const reference = orderReference || orderId
      if (!reference) {
        setError("No order information provided")
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(reference)}`, { cache: "no-store" })
        if (response.ok) {
          const payload = await response.json()
          const order = payload.order || payload
          const address = order.shippingAddress || order.billingAddress || {}
          const paymentStatus = String(order.paymentStatus || order.payment_status || "pending")
          setLiveStatus(paymentStatus)
          setOrderData({
            orderId: order.referenceId || reference,
            customerDetails: {
              fullName: address.fullName || "",
              email: address.email || "",
              phone: address.phone || "",
            },
            shippingAddress: {
              fullName: address.fullName || "",
              email: address.email || "",
              phone: address.phone || "",
              address1: address.address1 || "",
              city: address.city || address.district || "",
              state: address.state || address.region || "",
              country: address.country || "",
              postalCode: address.postalCode || "",
            },
            billingAddress: order.billingAddress || address,
            paymentMethod: "snippe",
            items: order.orderItems || [],
            subtotal: Number(order.totalAmount || 0),
            total: Number(order.totalAmount || 0),
            currency: order.currency || "TZS",
            status: paymentStatus,
            createdAt: order.createdAt || new Date().toISOString(),
          })
          return
        }

        const local = getLocalOrder(reference)
        if (local) {
          setLiveStatus(local.status)
          setOrderData(localToOrder(local))
          return
        }

        const payment = await fetch(`/api/payment/snippe?orderReference=${encodeURIComponent(reference)}`, { cache: "no-store" })
        const paymentData = await payment.json().catch(() => null)
        if (paymentData?.success) {
          setLiveStatus(paymentData.paymentStatus)
          setOrderData({
            orderId: reference,
            customerDetails: { fullName: "", email: "", phone: "" },
            shippingAddress: { fullName: "", email: "", phone: "", address1: "", city: "", state: "", country: "", postalCode: "" },
            billingAddress: {},
            paymentMethod: "snippe",
            items: [],
            subtotal: 0,
            total: 0,
            currency: "TZS",
            status: paymentData.paymentStatus || "pending",
            createdAt: new Date().toISOString(),
          })
          return
        }

        setError("Order not found. Please contact support if you believe this is an error.")
      } catch {
        setError("Failed to load order details. Please contact support.")
      } finally {
        setIsLoading(false)
      }
    }

    loadOrderData()
  }, [orderId, orderReference])

  useEffect(() => {
    if (!orderData?.orderId) return
    saveLocalOrder({
      referenceId: orderData.orderId,
      status: orderData.status || "pending",
      total: Number(orderData.total) || 0,
      currency: orderData.currency || "TZS",
      createdAt: orderData.createdAt || new Date().toISOString(),
      customerName: orderData.customerDetails.fullName || "",
      phone: orderData.customerDetails.phone || "",
      email: orderData.customerDetails.email || "",
      items: (orderData.items || []).map((item: { productName?: string; product_name?: string; name?: string; quantity?: number; totalPrice?: number; total_price?: number }) => ({
        name: item.productName || item.product_name || item.name || "Item",
        quantity: Number(item.quantity) || 1,
        total: Number(item.totalPrice ?? item.total_price) || 0,
      })),
    })
  }, [orderData])

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
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
        // Use order reference API instead of admin API
        const apiPath = reference ? `/api/orders/${reference}` : (orderId ? `/api/orders/${orderId}` : null)
        if (!apiPath) {
          clearInterval(interval)
          setPolling(false)
          return
        }
        
        const statusPath = reference ? `/api/payment/snippe?orderReference=${encodeURIComponent(reference)}` : apiPath
        let resp = await fetch(statusPath || apiPath, { cache: 'no-store' })
        if (resp.status === 429) {
          await sleep(400 + Math.floor(Math.random() * 300))
          resp = await fetch(statusPath || apiPath, { cache: 'no-store' })
        }
        if (resp.ok) {
          const matched = await resp.json()
          const nextStatus = matched.paymentStatus || matched.order?.paymentStatus || matched.status
          if (nextStatus) {
            setLiveStatus(nextStatus)
            setOrderData(prev => prev ? { ...prev, status: nextStatus } : prev)
            if (['paid', 'failed', 'success'].includes(String(nextStatus))) {
              clearInterval(interval)
              setPolling(false)
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
                <Link href="/home">Back to Home</Link>
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
            <CheckCircle className={cn("h-16 w-16 mx-auto mb-4", orderData?.status === 'failed' ? 'text-red-500' : 'text-green-500')} />
            <CardTitle className={cn("text-2xl", orderData?.status === 'paid' || orderData?.status === 'success' ? 'text-green-500' : themeClasses.mainText)}>
              {orderData?.status === 'paid' || orderData?.status === 'success' ? 'Payment received' : orderData?.status === 'failed' ? 'Payment not completed' : 'Order received'}
            </CardTitle>
            <p className={themeClasses.mainText}>
              {orderData?.status === 'paid' || orderData?.status === 'success'
                ? 'Honic Company Limited has confirmed this payment.'
                : 'Your order is saved. This page updates when the payment is confirmed.'}
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
                      {orderData.total > 0 && (
                      <div className="flex justify-between">
                        <span className={themeClasses.mainText}>Total Amount:</span>
                        <span className={themeClasses.mainText}>{formatPrice(orderData.total)}</span>
                      </div>
                      )}
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
                
                {orderData.shippingAddress.address1 && (
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
                )}
              </div>
            )}

            {!isAuthenticated && askForAccount && (
              <div className="rounded-lg border border-[#184a96]/20 bg-[#184a96]/5 p-4 space-y-3">
                <p className={cn("font-semibold", themeClasses.mainText)}>Keep this order in an account</p>
                <p className={cn("text-sm", themeClasses.mainText)}>
                  Create an account if you want order history on any device. This is optional. The receipt is already saved on this computer.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="bg-[#184a96] text-white hover:bg-[#12386f]"
                    onClick={() => openAuthModal("register", `/checkout/success?orderReference=${encodeURIComponent(orderData?.orderId || orderReference || "")}`)}
                  >
                    Create account
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setAskForAccount(false)}>
                    Not now
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Button
                type="button"
                className="w-full bg-yellow-500 text-neutral-950 hover:bg-yellow-600"
                onClick={() => {
                  if (!orderData) return
                  downloadOrderReceipt({
                    referenceId: orderData.orderId,
                    status: orderData.status,
                    total: orderData.total,
                    currency: orderData.currency,
                    createdAt: orderData.createdAt,
                    customerName: orderData.customerDetails.fullName,
                    phone: orderData.customerDetails.phone,
                    email: orderData.customerDetails.email,
                    items: (orderData.items || []).map((item: { productName?: string; product_name?: string; name?: string; quantity?: number; totalPrice?: number; total_price?: number }) => ({
                      name: item.productName || item.product_name || item.name || "Item",
                      quantity: Number(item.quantity) || 1,
                      total: Number(item.totalPrice ?? item.total_price) || 0,
                    })),
                  })
                }}
              >
                Save receipt on this computer
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={isAuthenticated ? "/account/orders" : "/orders"}>View orders</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/home">Continue shopping</Link>
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