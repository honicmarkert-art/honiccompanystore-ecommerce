"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/hooks/use-theme"
import { useCompanyContext } from "@/components/company-provider"
import { useCurrency } from "@/contexts/currency-context"
import { useAuth } from "@/contexts/auth-context"
import { useGlobalAuthModal } from "@/contexts/global-auth-modal"
import { CheckCircle, Clock, ArrowLeft, Home, Package, XCircle, RefreshCw } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Footer } from "@/components/footer"

function CheckoutReturnContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { themeClasses } = useTheme()
  const { companyName, companyColor } = useCompanyContext()
  const { formatPrice } = useCurrency()
  const { user } = useAuth()
  const { openAuthModal } = useGlobalAuthModal()

  // Get order details from URL parameters
  let orderReference = searchParams.get('orderReference') || searchParams.get('order_reference') || searchParams.get('reference') || searchParams.get('order_id')
  let paymentStatus = searchParams.get('status') || searchParams.get('payment_status')
  let amount = searchParams.get('amount')
  let currency = searchParams.get('currency') || 'TZS'

  // Handle malformed URLs from ClickPesa where placeholders aren't replaced
  // ClickPesa sometimes sends URLs like: ?orderReference={reference}?orderReference=real_id&status=FAILED
  // Also sometimes the first value includes a nested query string.
  if (orderReference === '{orderReference}' || !orderReference || orderReference.includes('orderReference=')) {
    // Try to extract from the full URL string (handles malformed URLs with duplicate parameters)
    if (typeof window !== 'undefined') {
      const fullUrl = typeof window !== 'undefined' ? window.location.href : ''
      const orderRefMatch = fullUrl.match(/orderReference=([A-Za-z0-9-]{32,36})/)
      if (orderRefMatch) {
        orderReference = orderRefMatch[1]
      }
    }
    
    // Also try to extract from currency parameter
    const currencyParam = searchParams.get('currency')
    if (currencyParam && currencyParam.includes('orderReference=')) {
      const match = currencyParam.match(/orderReference=([^&]+)/)
      if (match) {
        orderReference = match[1]
      }
    }
  }

  // Normalize reference: if it still contains a nested pattern or label, strip it.
  if (orderReference && orderReference.includes('orderReference=')) {
    const nested = orderReference.match(/orderReference=([A-Za-z0-9-]{32,36})/)
    if (nested) {
      orderReference = nested[1]
    }
  }

  // Ensure we use the hyphen-less 32-char id for DB (our DB stores without hyphens)
  // Also clean up any corrupted reference IDs (remove common suffixes like "retr", "retry", etc.)
  let normalizedReference = orderReference ? orderReference.replace(/[^A-Za-z0-9]/g, '').toLowerCase() : null
  
  // Clean up corrupted reference IDs that might have suffixes
  if (normalizedReference && normalizedReference.length > 32) {
    // Try to extract the original 32-character ID
    const cleanId = normalizedReference.replace(/(retr|retry|retry\d+)$/i, '')
    if (cleanId.length === 32) {
      normalizedReference = cleanId
    }
  }

  if (paymentStatus === '{status}' || !paymentStatus) {
    // Try to extract real status from the full URL
    if (typeof window !== 'undefined') {
      const fullUrl = typeof window !== 'undefined' ? window.location.href : ''
      const statusMatch = fullUrl.match(/status=(FAILED|SUCCESS|PENDING|CANCELLED)/i)
      if (statusMatch) {
        paymentStatus = statusMatch[1]
      } else {
        paymentStatus = 'FAILED' // Default to failed if we can't determine
      }
    } else {
      paymentStatus = 'FAILED' // Default to failed if we can't determine
    }
  }

  if (amount === '{amount}' || !amount) {
    amount = null // Will show "Amount not specified" - will be fetched from database
  }

  if (currency === '{currency}' || currency?.includes('orderReference=')) {
    currency = 'TZS' // Default currency
  }


  const [isRedirecting, setIsRedirecting] = useState(false)
  const [orderData, setOrderData] = useState<any>(null)
  const [isLoadingOrder, setIsLoadingOrder] = useState(false)
  const [isRetryingPayment, setIsRetryingPayment] = useState(false)
  const [retryAttempts, setRetryAttempts] = useState(() => {
    // Initialize from localStorage to persist across page reloads
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`retryAttempts_${normalizedReference || orderReference}`)
      return stored ? parseInt(stored, 10) : 0
    }
    return 0
  })
  const [isRegeneratingOrder, setIsRegeneratingOrder] = useState(false)

  // Handle manual redirect
  const handleRedirectToProducts = () => {
    setIsRedirecting(true)
    router.push('/products')
  }

  const handleGoHome = () => {
    setIsRedirecting(true)
    router.push('/')
  }

  // Fetch order data from database
  const fetchOrderData = async (referenceId: string) => {
    if (!referenceId) return
    
    setIsLoadingOrder(true)
    try {
      const response = await fetch(`/api/orders/${referenceId}`)
      if (response.ok) {
        const data = await response.json()
        setOrderData(data.order)
      } else {
        let details = ''
        try { details = await response.text() } catch {}
        // Order not found - this is normal for some cases
        // Don't show error to user, just log it silently
      }
    } catch (error) {
      // Network or other error - don't show to user
    } finally {
      setIsLoadingOrder(false)
    }
  }

  // Note: updateOrderStatus function removed
  // Payment status updates are now handled by webhooks only
  // The return URL is read-only and only displays current status

  // Retry payment - redirect to checkout page
  const handleRetryPayment = async () => {
    if (!orderData?.referenceId) {
      // If no order data, redirect to checkout page
      router.push('/checkout')
      return
    }
    
    setIsRetryingPayment(true)
    try {
      // Use the correct ClickPesa API format
      const response = await fetch('/api/payment/clickpesa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-checkout-link',
          amount: String(orderData.totalAmount),
          currency: orderData.currency || 'TZS',
          orderId: orderData.referenceId,
          returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/checkout/return?orderReference=${orderData.referenceId}`,
          cancelUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/checkout/return?orderReference=${orderData.referenceId}`,
          customerDetails: {
            fullName: orderData.billingAddress?.fullName || orderData.shippingAddress?.fullName || '',
            email: orderData.billingAddress?.email || orderData.shippingAddress?.email || '',
            phone: orderData.billingAddress?.phone || orderData.shippingAddress?.phone || '',
            firstName: (orderData.billingAddress?.fullName || orderData.shippingAddress?.fullName || '').split(' ')[0],
            lastName: (orderData.billingAddress?.fullName || orderData.shippingAddress?.fullName || '').split(' ').slice(1).join(' '),
            address: orderData.billingAddress?.address1 || orderData.shippingAddress?.address1 || '',
            city: orderData.billingAddress?.city || orderData.shippingAddress?.city || '',
            country: orderData.billingAddress?.country || orderData.shippingAddress?.country || 'Tanzania',
          },
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.checkoutUrl || data.checkoutLink) {
          router.push(data.checkoutUrl || data.checkoutLink)
        } else {
          console.error('No checkout URL received:', data)
          // Fallback to checkout page
          router.push('/checkout')
        }
      } else {
        const errorText = await response.text()
        console.error('Failed to create payment retry:', response.status, errorText)
        // Fallback to checkout page
        router.push('/checkout')
      }
    } catch (error) {
      console.error('Error retrying payment:', error)
      // Fallback to checkout page
      router.push('/checkout')
    } finally {
      setIsRetryingPayment(false)
    }
  }

  // Regenerate order with new reference ID
  const handleTryAgain = async () => {
    // Check retry limit
    if (retryAttempts >= 2) {
      alert('Maximum retry attempts reached. Please contact support.')
      return
    }

    // Use orderData referenceId if available, otherwise fall back to URL parameter
    const referenceId = orderData?.referenceId || normalizedReference || orderReference
    
    if (!referenceId) {
      console.error('No reference ID available for retry:', { orderData, normalizedReference, orderReference })
      alert('Unable to retry payment. Please contact support.')
      return
    }

    setIsRegeneratingOrder(true)
    setRetryAttempts(prev => {
      const newAttempts = prev + 1
      // Save to localStorage to persist across page reloads
      if (typeof window !== 'undefined') {
        localStorage.setItem(`retryAttempts_${referenceId}`, newAttempts.toString())
      }
      return newAttempts
    })
    
    try {
      // Generate a new reference ID for retry (ClickPesa doesn't allow reusing reference IDs)
      // Use timestamp to ensure uniqueness
      const timestamp = Date.now()
      const newReferenceId = `${referenceId}-retry-${timestamp}`
      
      // Create new ClickPesa checkout link with new reference ID
      const response = await fetch('/api/payment/clickpesa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-checkout-link',
          amount: String(orderData?.totalAmount || 0),
          currency: orderData?.currency || 'TZS',
          orderId: newReferenceId, // Use new reference ID
          returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/checkout/return?orderReference=${referenceId}&status=SUCCESS`,
          cancelUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/checkout/return?orderReference=${referenceId}&status=CANCELLED`,
          customerDetails: {
            fullName: orderData?.billingAddress?.fullName || orderData?.shippingAddress?.fullName || 'Customer',
            email: orderData?.billingAddress?.email || orderData?.shippingAddress?.email || '',
            phone: orderData?.billingAddress?.phone || orderData?.shippingAddress?.phone || '',
            firstName: (orderData?.billingAddress?.fullName || orderData?.shippingAddress?.fullName || 'Customer').split(' ')[0],
            lastName: (orderData?.billingAddress?.fullName || orderData?.shippingAddress?.fullName || 'Customer').split(' ').slice(1).join(' ') || 'Customer',
            address: orderData?.billingAddress?.address1 || orderData?.shippingAddress?.address1 || '',
            city: orderData?.billingAddress?.city || orderData?.shippingAddress?.city || '',
            country: orderData?.billingAddress?.country || orderData?.shippingAddress?.country || 'Tanzania',
          }
        })
      })

      const result = await response.json()
      
      if (result.success && (result.checkoutUrl || result.checkoutLink)) {
        // Redirect to ClickPesa checkout
        router.push(result.checkoutUrl || result.checkoutLink)
      } else {
        console.error('Failed to regenerate checkout link:', result)
        alert(`Payment system is temporarily unavailable. ${result.error || 'Please contact support or try again later.'}`)
      }
    } catch (error) {
      console.error('Error regenerating payment:', error)
      alert('An error occurred while creating payment link. Please try again.')
    } finally {
      setIsRegeneratingOrder(false)
    }
  }

  const isPaymentSuccessful = paymentStatus === 'success' || paymentStatus === 'SUCCESS' || paymentStatus === 'completed' || paymentStatus === 'paid'
  const isPaymentFailed = paymentStatus === 'failed' || paymentStatus === 'FAILED' || paymentStatus === 'error'

  // Fetch order data when component mounts
  useEffect(() => {
    if (normalizedReference) {
      fetchOrderData(normalizedReference)
    }
  }, [normalizedReference])

  // Hybrid approach: Use return URL as backup for retry payments
  // Webhooks handle initial payments, return URL handles retry payments
  useEffect(() => {
    if (isPaymentSuccessful && normalizedReference && orderData) {
      // Only update if this appears to be a retry payment (webhook didn't work)
      if (orderData.paymentStatus === 'failed' || orderData.paymentStatus === 'pending') {
        updateOrderStatusViaReturnUrl(normalizedReference, 'paid')
      }
    }
  }, [isPaymentSuccessful, normalizedReference, orderData])

  // Backup function to update order status via return URL (for retry payments only)
  const updateOrderStatusViaReturnUrl = async (referenceId: string, status: string) => {
    if (!referenceId) return
    
    try {
      const response = await fetch(`/api/orders/${referenceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentStatus: status,
          isRetryPayment: true // Flag to indicate this is a retry
        })
      })
      
      if (response.ok) {
        // Refresh order data to get updated status
        await fetchOrderData(referenceId)
      } else {
        console.error('❌ Failed to update retry payment status via return URL')
      }
    } catch (error) {
      console.error('❌ Error updating retry payment status:', error)
    }
  }

  // Auto-retry disabled - use manual retry buttons instead
  // useEffect(() => {
  //   if (orderData && orderData.paymentStatus === 'failed' && !isRetryingPayment) {
  //     // Add a small delay to ensure the page has loaded properly
  //     const timer = setTimeout(() => {
  //       handleRetryPayment()
  //     }, 2000) // 2 second delay
  //     
  //     return () => clearTimeout(timer)
  //   }
  // }, [orderData, isRetryingPayment])

  // Show retry message for failed payments even if order data is not found
  const shouldShowRetryMessage = isPaymentFailed && !isLoadingOrder

  // Use order data from database if available, otherwise fall back to URL parameters
  const displayOrderReference = orderData?.referenceId || normalizedReference || orderReference
  const displayPaymentStatus = orderData?.paymentStatus || paymentStatus
  const displayAmount = orderData?.totalAmount || amount || 'Amount not specified'
  const displayFailureReason = orderData?.failureReason
  

  // Update payment status logic based on database data
  const isPaymentSuccessfulFromDB = displayPaymentStatus === 'paid'
  const isPaymentFailedFromDB = displayPaymentStatus === 'failed' || displayPaymentStatus === 'unpaid'
  const isPaymentPendingFromDB = displayPaymentStatus === 'pending'

  // Prioritize URL parameter status over database status for ClickPesa returns
  // URL parameters are more reliable for real-time payment status
  const finalIsPaymentSuccessful = isPaymentSuccessful || (orderData && isPaymentSuccessfulFromDB)
  const finalIsPaymentFailed = isPaymentFailed || (orderData && isPaymentFailedFromDB && !isPaymentSuccessful)
  const finalIsPaymentPending = !finalIsPaymentSuccessful && !finalIsPaymentFailed

  // Clean up retry attempts when payment is successful
  useEffect(() => {
    if (finalIsPaymentSuccessful && typeof window !== 'undefined') {
      localStorage.removeItem(`retryAttempts_${normalizedReference || orderReference}`)
    }
  }, [finalIsPaymentSuccessful, normalizedReference, orderReference])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      {/* Welcome Message Bar - Mobile Only */}
      <div className="fixed top-0 z-50 w-full bg-stone-100/90 dark:bg-gray-900/95 backdrop-blur-sm border-b border-stone-200 dark:border-gray-700 sm:hidden">
        <div className="flex items-center justify-center h-6 px-4">
          {user ? (
            <div className="text-xs text-green-600 dark:text-green-400 font-medium">
              Hi! {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'} - Welcome again <span className="text-blue-600 dark:text-blue-400">{companyName || 'Honic Co.'}</span>
            </div>
          ) : (
            <button 
              onClick={() => openAuthModal('login')}
              className="text-xs text-gray-700 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors font-medium"
            >
              Welcome to {companyName || 'Honic Co.'} <span className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">login here</span> for better search
            </button>
          )}
        </div>
      </div>
      
      <div className="w-full max-w-2xl pt-6 sm:pt-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className={cn(
            "inline-flex items-center justify-center w-20 h-20 rounded-full mb-4",
            finalIsPaymentSuccessful
              ? "bg-green-100 dark:bg-green-900/20"
              : finalIsPaymentFailed
              ? "bg-red-100 dark:bg-red-900/20"
              : "bg-yellow-100 dark:bg-yellow-900/20"
          )}>
            {finalIsPaymentSuccessful ? (
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            ) : finalIsPaymentFailed ? (
              <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            ) : (
              <Clock className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {finalIsPaymentSuccessful
              ? '🎉 Welcome Back!'
              : 'Payment Processing'
            }
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {finalIsPaymentSuccessful
              ? 'Your payment has been received successfully!'
              : finalIsPaymentFailed
              ? 'Your payment could not be processed. Please try again.'
              : 'Your payment is being processed. Please wait...'
            }
          </p>
          
          {/* Debug info in development */}
        </div>

        {/* Loading State */}
        {isLoadingOrder ? (
          <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Loading Order Details...
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Please wait while we fetch your order information
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Main Card */
          <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                Order Confirmation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Loading State */}
              {isLoadingOrder && (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                  <span className="text-gray-600 dark:text-gray-400">Loading order details...</span>
                </div>
              )}

              {/* Order Details */}
              {!isLoadingOrder && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Order Reference:</span>
                    <span className="font-mono text-lg font-bold text-gray-900 dark:text-white break-words break-all text-left sm:text-right">
                      {displayOrderReference || 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Amount:</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {displayAmount ? formatPrice(parseFloat(displayAmount)) : 'Amount not specified'}
                    </span>
                  </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Payment Status:</span>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    finalIsPaymentSuccessful 
                      ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                      : finalIsPaymentFailed
                      ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                  )}>
                    {finalIsPaymentSuccessful 
                      ? '✅ Paid' 
                      : finalIsPaymentFailed 
                      ? '❌ Failed' 
                      : 'Processing'
                    }
                  </span>
                </div>

                {/* Failure Reason */}
                {finalIsPaymentFailed && displayFailureReason && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                          Payment Issue
                        </h3>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          {displayFailureReason}
                        </p>
                        
                        {/* Try Again Button */}
                        {!isRetryingPayment && !isRegeneratingOrder && retryAttempts < 2 && (
                          <div className="mt-3">
                            <button
                              onClick={handleTryAgain}
                              disabled={isRegeneratingOrder}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className={`w-4 h-4 ${isRegeneratingOrder ? 'animate-spin' : ''}`} />
                              <span>Try Again ({2 - retryAttempts} left)</span>
                            </button>
                          </div>
                        )}
                        
                        {/* Regenerating order message */}
                        {isRegeneratingOrder && (
                          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                                Creating new payment link...
                              </p>
                            </div>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                              Please wait while we redirect you to ClickPesa
                            </p>
                          </div>
                        )}
                        
                        {/* Retry in progress message */}
                        {isRetryingPayment && (
                          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                                Processing payment retry...
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Company:</span>
                  <span className="text-lg font-semibold" style={{ color: companyColor }}>
                    {companyName}
                  </span>
                </div>
              </div>
            )}

        {/* Success Message */}
        {isPaymentSuccessful && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                      Payment Successful!
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Thank you for your purchase! We've received your payment and will process your order shortly. 
                      You'll receive a confirmation email with order details.
                    </p>
                  </div>
                </div>
              </div>
            )}


            {/* Processing Message */}
            {!isPaymentSuccessful && !isPaymentFailed && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Payment Processing
                    </h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Your payment is being processed. This may take a few minutes. 
                      You'll receive an email confirmation once the payment is completed.
                    </p>
                  </div>
                </div>
              </div>
            )}


            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={handleRedirectToProducts}
                disabled={isRedirecting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Package className="w-4 h-4 mr-2" />
                {isRedirecting ? 'Redirecting...' : 'Continue Shopping'}
              </Button>
              
              <Button
                onClick={handleGoHome}
                disabled={isRedirecting}
                variant="outline"
                className="flex-1"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </div>

            {/* Additional Info */}
            <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Need help? Contact our support team or check your email for order confirmation.
              </p>
            </div>
              </CardContent>
            </Card>
        )}

        <Footer />
      </div>
    </div>
  )
}

export default function CheckoutReturnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <CheckoutReturnContent />
    </Suspense>
  )
}
