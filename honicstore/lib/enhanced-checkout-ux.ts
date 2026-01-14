// Enhanced Checkout Flow - Show Order IDs at Right Time
// This shows when and how to display order IDs to users

// ============================================================================
// UPDATED CHECKOUT PAGE WITH ORDER ID DISPLAY
// ============================================================================

function CheckoutPageContent() {
  const [orderReserved, setOrderReserved] = useState(false)
  const [reservedOrder, setReservedOrder] = useState(null)
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  
  // Reserve order IDs when user reaches checkout
  const reserveOrderIds = async () => {
    if (orderReserved) return reservedOrder
    
    try {
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      
      const response = await fetch('/api/orders/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || null,
          orderNumber: orderId,
        }),
      })
      
      if (response.ok) {
        const result = await response.json()
        setReservedOrder(result.reservedOrder)
        setOrderReserved(true)
        return result.reservedOrder
      }
    } catch (error) {
      }
    return null
  }
  
  // Reserve IDs when component mounts or when user is ready
  useEffect(() => {
    if (selectedItems.length > 0 && !orderReserved) {
      reserveOrderIds()
    }
  }, [selectedItems.length])
  
  const handlePlaceOrder = async () => {
    setIsProcessingPayment(true)
    
    try {
      // Get reserved order (should already exist)
      const reserved = reservedOrder || await reserveOrderIds()
      if (!reserved) {
        throw new Error('Failed to reserve order IDs')
      }
      
      // Show order details to user before payment
      setShowOrderDetails(true)
      
      // Wait for user confirmation or auto-proceed after 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Complete order creation
      const selectedItems = cart.filter(i => selected[i.productId])
      const orderData = {
        orderId: reserved.id,
        referenceId: reserved.referenceId,
        pickupId: reserved.pickupId,
        userId: user?.id || null, // Internal use only - not shown to users
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
      
      // Complete the order
      const completeResponse = await fetch('/api/orders/complete', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })
      
      if (!completeResponse.ok) {
        throw new Error('Failed to complete order')
      }
      
      const result = await completeResponse.json()
      
      // Redirect to payment with proper IDs
      const paymentUrl = await createPaymentLink(reserved.referenceId, orderTotal)
      if (paymentUrl) {
        window.location.href = paymentUrl
      } else {
        // Fallback to confirmation page
        router.push(`/checkout/confirmation?orderId=${reserved.id}&referenceId=${reserved.referenceId}&pickupId=${reserved.pickupId}`)
      }
      
    } catch (error) {
      toast({
        title: "Order Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsProcessingPayment(false)
    }
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Order Review Section - Show IDs Here */}
      {orderReserved && reservedOrder && (
        <div className="mb-8">
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-800 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Order Reserved - Ready for Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order IDs Display - Only show user-friendly IDs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded border">
                  <label className="text-sm font-medium text-gray-600">Order Number</label>
                  <p className="text-lg font-mono font-bold text-gray-900">
                    {reservedOrder.orderNumber}
                  </p>
                  <p className="text-xs text-gray-500">For customer service</p>
                </div>
                
                <div className="bg-white p-3 rounded border">
                  <label className="text-sm font-medium text-gray-600">Reference ID</label>
                  <p className="text-lg font-mono font-bold text-blue-600">
                    {reservedOrder.referenceId}
                  </p>
                  <p className="text-xs text-gray-500">For payment tracking</p>
                </div>
                
                <div className="bg-white p-3 rounded border">
                  <label className="text-sm font-medium text-gray-600">Pickup ID</label>
                  <p className="text-lg font-mono font-bold text-green-600">
                    {reservedOrder.pickupId}
                  </p>
                  <p className="text-xs text-gray-500">For store pickup</p>
                </div>
              </div>
              
              {/* Order Summary */}
              <div className="bg-white p-4 rounded border">
                <h3 className="font-semibold mb-2">Order Summary</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Items ({selectedItemsCount})</span>
                    <span>{formatPrice(selectedSubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>{shippingCost === 0 ? 'Free' : formatPrice(shippingCost)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>{formatPrice(orderTotal)}</span>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button 
                  onClick={handlePlaceOrder}
                  disabled={isProcessingPayment}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Proceed to Payment
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setShowOrderDetails(!showOrderDetails)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {showOrderDetails ? 'Hide' : 'Show'} Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Detailed Order Information */}
      {showOrderDetails && reservedOrder && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Information */}
                <div>
                  <h3 className="font-semibold mb-3">Customer Information</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Name:</span> {formData.shippingAddress.fullName}
                    </div>
                    <div>
                      <span className="font-medium">Email:</span> {formData.shippingAddress.email}
                    </div>
                    <div>
                      <span className="font-medium">Phone:</span> {formData.shippingAddress.phone}
                    </div>
                    <div>
                      <span className="font-medium">Delivery:</span> {deliveryOption === 'pickup' ? 'Store Pickup' : 'Home Delivery'}
                    </div>
                  </div>
                </div>
                
                {/* Order Items */}
                <div>
                  <h3 className="font-semibold mb-3">Order Items</h3>
                  <div className="space-y-2">
                    {selectedItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{item.product?.name}</span>
                        <span>Qty: {item.totalQuantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Rest of checkout form */}
      {/* ... existing checkout form code ... */}
    </div>
  )
}

// ============================================================================
// ORDER CONFIRMATION PAGE - Show All IDs Clearly
// ============================================================================

function OrderConfirmationPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  const referenceId = searchParams.get('referenceId')
  const pickupId = searchParams.get('pickupId')
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    })
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-green-800 mb-2">Order Placed Successfully!</h1>
          <p className="text-gray-600">Your order has been created and is ready for payment</p>
        </div>
        
        {/* Order IDs Card - Only show user-friendly IDs */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Your Order Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Order Number */}
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-600 mb-2">Order Number</label>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-lg font-mono font-bold text-gray-900">
                    {orderId}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(orderId || '', 'Order Number')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Use this for customer service</p>
              </div>
              
              {/* Reference ID */}
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <label className="block text-sm font-medium text-blue-600 mb-2">Reference ID</label>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-lg font-mono font-bold text-blue-800">
                    {referenceId}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(referenceId || '', 'Reference ID')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-blue-500 mt-1">For payment tracking</p>
              </div>
              
              {/* Pickup ID */}
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <label className="block text-sm font-medium text-green-600 mb-2">Pickup ID</label>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-lg font-mono font-bold text-green-800">
                    {pickupId}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(pickupId || '', 'Pickup ID')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-green-500 mt-1">For store pickup</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Next Steps */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              What Happens Next?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">Complete Payment</h3>
                    <p className="text-sm text-gray-600">Use the payment link to complete your order</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">Order Confirmation</h3>
                    <p className="text-sm text-gray-600">You'll receive an email confirmation</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-yellow-600 font-bold text-sm">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">Order Processing</h3>
                    <p className="text-sm text-gray-600">We'll prepare your items for delivery</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-sm">4</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">Delivery/Pickup</h3>
                    <p className="text-sm text-gray-600">Track your order using the Reference ID</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={() => window.print()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Order Details
          </Button>
          
          <Button 
            onClick={() => router.push('/account/orders')}
            className="flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            View All Orders
          </Button>
          
          <Button 
            onClick={() => router.push('/products')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            Continue Shopping
          </Button>
        </div>
      </div>
    </div>
  )
}
