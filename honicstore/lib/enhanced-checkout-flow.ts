// Enhanced Checkout Flow with Proper ID Handling
// This shows how to update the checkout page to use the two-phase order creation

// ============================================================================
// UPDATED CHECKOUT PAGE LOGIC
// ============================================================================

const handlePlaceOrder = async () => {
  setIsProcessingPayment(true)
  
  try {
    // Validation logic (existing code)
    if (!validateDeliveryOption() || !validateShippingAddress()) {
      setIsProcessingPayment(false)
      return
    }
    
    const selectedIds = cart.filter(i => selected[i.productId]).map(i => i.productId)
    if (selectedIds.length === 0) {
      showCheckoutValidation('Please select at least one item to proceed to checkout.')
      setIsProcessingPayment(false)
      return
    }
    
    // PHASE 1: Reserve Order IDs
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    
    const reserveResponse = await fetch('/api/orders/reserve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user?.id || null,
        orderNumber: orderId,
      }),
    })
    
    if (!reserveResponse.ok) {
      const errorData = await reserveResponse.json()
      throw new Error(errorData.error || 'Failed to reserve order IDs')
    }
    
    const reserveResult = await reserveResponse.json()
    const { reservedOrder } = reserveResult
    
    // Now we have the proper IDs from backend
    const backendOrderId = reservedOrder.id
    const referenceId = reservedOrder.referenceId
    const pickupId = reservedOrder.pickupId
    
    // PHASE 2: Complete Order Creation
    const selectedItems = selectedIds.length > 0 ? cart.filter(i => selectedIds.includes(i.productId)) : cart
    
    const orderData = {
      orderId: backendOrderId,        // ✅ Use backend-generated ID
      referenceId: referenceId,      // ✅ Use backend-generated reference ID
      pickupId: pickupId,            // ✅ Use backend-generated pickup ID
      userId: user?.id || null,      // ✅ User ID
      // Extract customer information from shipping address
      customerName: formData.shippingAddress.fullName,
      customerEmail: formData.shippingAddress.email,
      customerPhone: formData.shippingAddress.phone,
      items: selectedItems.flatMap(item => 
        item.variants.map(variant => ({
          productId: item.productId,
          productName: item.product?.name || `Product ${item.productId}`,
          variantId: variant.variantId ? parseInt(variant.variantId) : null,
          variantName: Object.values(variant.attributes).join(', ') || 'Default',
          variantAttributes: variant.attributes || {},
          quantity: variant.quantity,
          unitPrice: variant.price,
          totalPrice: variant.price * variant.quantity,
        }))
      ),
      shippingAddress: formData.shippingAddress,
      billingAddress: formData.sameAsShipping ? formData.shippingAddress : formData.billingAddress,
      deliveryOption,
      shippingFee: shippingFee,
      totalAmount: orderTotal,
      timestamp: new Date().toISOString(),
    }
    
    // Complete the order creation
    const completeResponse = await fetch('/api/orders/complete', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    })
    
    if (!completeResponse.ok) {
      const errorData = await completeResponse.json()
      throw new Error(errorData.error || 'Failed to complete order')
    }
    
    const result = await completeResponse.json()
    
    // Update state with proper IDs
    setOrderId(backendOrderId)
    setOrderReferenceId(referenceId)
    setOrderPickupId(pickupId)
    setPaymentStatus(result.order.paymentStatus)
    setOrderPlaced(true)
    
    // Generate ClickPesa checkout link with proper reference ID
    let clickpesaRedirectSuccess = false
    try {
      const resp = await fetch('/api/payment/clickpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-checkout-link',
          amount: String(orderData.totalAmount),
          currency: 'TZS',
          orderId: referenceId, // ✅ Use proper reference ID
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || (process.env.NODE_ENV === 'development' ? `http://localhost:${process.env.LOCALHOST_PORT || '3000'}` : 'https://honiccompanystore.com')
          returnUrl: `${baseUrl}/checkout/return?orderReference=${referenceId}&status=SUCCESS`,
          cancelUrl: `${baseUrl}/checkout/return?orderReference=${referenceId}&status=CANCELLED`,
          customerDetails: {
            fullName: formData.shippingAddress.fullName,
            email: formData.shippingAddress.email,
            phone: formData.shippingAddress.phone,
            firstName: formData.shippingAddress.fullName.split(' ')[0],
            lastName: formData.shippingAddress.fullName.split(' ').slice(1).join(' ') || 'Customer',
            address: formData.shippingAddress.address1,
            city: formData.shippingAddress.city,
            country: formData.shippingAddress.country || 'Tanzania',
          }
        })
      })
      
      if (resp.ok) {
        const clickpesaResult = await resp.json()
        if (clickpesaResult.success && clickpesaResult.checkoutUrl) {
          // Open ClickPesa in new tab
          const popupWindow = window.open(clickpesaResult.checkoutUrl, '_blank', 'noopener,noreferrer')
          if (popupWindow && !popupWindow.closed) {
            clickpesaRedirectSuccess = true
          } else {
            // Fallback if popup blocked
            window.location.href = clickpesaResult.checkoutUrl
            clickpesaRedirectSuccess = true
          }
        }
      }
    } catch (clickpesaError) {
      }
    
    if (!clickpesaRedirectSuccess) {
      // Fallback: show order confirmation page
      router.push(`/checkout/confirmation?orderId=${backendOrderId}&referenceId=${referenceId}&pickupId=${pickupId}`)
    }
    
  } catch (error) {
    toast({
      title: "Order Failed",
      description: error instanceof Error ? error.message : "Failed to create order. Please try again.",
      variant: "destructive"
    })
  } finally {
    setIsProcessingPayment(false)
  }
}

// ============================================================================
// UPDATED ORDER CONFIRMATION PAGE
// ============================================================================

// New page: /checkout/confirmation/page.tsx
function OrderConfirmationPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  const referenceId = searchParams.get('referenceId')
  const pickupId = searchParams.get('pickupId')
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-green-800 mb-4">Order Placed Successfully!</h1>
          <div className="space-y-2">
            <p><strong>Order ID:</strong> {orderId}</p>
            <p><strong>Reference ID:</strong> {referenceId}</p>
            <p><strong>Pickup ID:</strong> {pickupId}</p>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">Next Steps</h2>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>Complete your payment using the provided link</li>
            <li>You will receive a confirmation email</li>
            <li>Track your order using the Reference ID</li>
            <li>Use the Pickup ID for store pickup orders</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
