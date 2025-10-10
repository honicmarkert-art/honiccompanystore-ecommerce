import { NextRequest, NextResponse } from 'next/server'
import { validateAuth, copyCookies } from '@/lib/auth-server'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeInput, validateAddress, validatePaymentMethod, validateCartItems, validateOrderAmount } from '@/lib/validation-utils'
import { 
  handleApiError, 
  createValidationError, 
  createAuthError, 
  createRateLimitError,
  createStockError,
  createOrderError,
  createDatabaseError,
  Logger,
  measurePerformance
} from '@/lib/error-handler'
import { dbOptimizer } from '@/lib/database-optimizer'
import { cacheInvalidator } from '@/lib/cache'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// POST /api/checkout - Process checkout with stock enforcement
export async function POST(request: NextRequest) {
  const logger = Logger.getInstance()
  const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  let user: any = null
  
  try {
    // Rate limiting
    if (!rateLimit(clientIP)) {
      throw createRateLimitError('Too many checkout attempts', { ip: clientIP })
    }

    // Authentication
    const { user: authUser, error: authError, response, supabase } = await validateAuth(request)
    user = authUser
    
    if (authError || !user) {
      throw createAuthError(authError || 'Authentication required', { ip: clientIP })
    }

    // Parse and validate request body
    let requestData
    try {
      requestData = await request.json()
    } catch (error) {
      throw createValidationError('Invalid JSON payload', undefined, { userId: user.id, ip: clientIP })
    }

    const { shippingAddress, paymentMethod } = requestData

    // Input validation
    if (!shippingAddress || !paymentMethod) {
      throw createValidationError('Missing required checkout information', undefined, { userId: user.id, ip: clientIP })
    }

    // Sanitize and validate inputs
    const sanitizedShippingAddress = sanitizeInput(shippingAddress)
    const sanitizedPaymentMethod = sanitizeInput(paymentMethod)

    // Validate address format
    const addressValidation = validateAddress(sanitizedShippingAddress)
    if (!addressValidation.isValid) {
      throw createValidationError('Invalid shipping address', 'shippingAddress', { 
        userId: user.id, 
        ip: clientIP,
        errors: addressValidation.errors 
      })
    }

    // Validate payment method (only ClickPesa is supported)
    if (sanitizedPaymentMethod.paymentMethod !== 'clickpesa') {
      throw createValidationError('Only ClickPesa payment method is supported', 'paymentMethod', { 
        userId: user.id, 
        ip: clientIP,
        providedMethod: sanitizedPaymentMethod.paymentMethod
      })
    }

    // Fetch cart items using optimized query with caching
    const cartItems = await measurePerformance(
      'fetch_cart_items',
      () => dbOptimizer.getUserCart(user.id, { useCache: true }),
      { userId: user.id, ip: clientIP }
    )

    if (!cartItems || cartItems.length === 0) {
      throw createValidationError('Cart is empty', undefined, { userId: user.id, ip: clientIP })
    }

    // Validate cart items structure
    const cartValidation = validateCartItems(cartItems)
    if (!cartValidation.isValid) {
      throw createValidationError('Invalid cart items', undefined, { 
        userId: user.id, 
        ip: clientIP,
        errors: cartValidation.errors 
      })
    }

    // Optimized batch stock validation
    const stockValidationItems = cartItems.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity
    }))

    const stockValidationResults = await measurePerformance(
      'validate_stock_batch',
      () => dbOptimizer.validateStockBatch(stockValidationItems, { 
        batchSize: 20, 
        concurrency: 5,
        useCache: true 
      }),
      { userId: user.id, itemCount: cartItems.length }
    )

    // Check for stock issues
    const stockIssues = []
    for (const result of stockValidationResults) {
      if (!result.valid) {
        const cartItem = cartItems.find(item => item.product_id === result.product_id)
        stockIssues.push({
          productId: result.product_id,
          productName: cartItem?.products?.name || 'Unknown Product',
          error: result.available === 0 ? 'Product is out of stock' : 'Insufficient stock',
          available: result.available,
          requested: result.requested
        })
      }
    }

    if (stockIssues.length > 0) {
      throw createStockError('Stock validation failed', { 
        userId: user.id, 
        ip: clientIP,
        stockIssues 
      })
    }

    // Stock validation is already done above with stockValidationResults
    // No need to reserve stock here - stock will be reduced only when payment is confirmed

    // Calculate totals with validation
    const orderTotal = cartItems.reduce((sum, item) => {
      const itemTotal = (item.price - (item.applied_discount || 0)) * item.quantity
      return sum + itemTotal
    }, 0)

    // Validate order amount
    const amountValidation = validateOrderAmount(orderTotal)
    if (!amountValidation.isValid) {
      return NextResponse.json({
        error: 'Invalid order amount',
        details: amountValidation.errors
      }, { status: 400 })
    }

    // Generate unique order ID and reference IDs
    const orderId = `ORD${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const referenceId = `REF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const pickupId = `PICKUP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Create order with comprehensive data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        id: orderId,
        user_id: user?.id || null, // null for guest users
        order_number: orderId,
        reference_id: referenceId,
        pickup_id: pickupId,
        total_amount: orderTotal,
        currency: 'TZS', // Default currency
        shipping_address: sanitizedShippingAddress,
        delivery_option: requestData.deliveryOption || 'shipping', // Store delivery option
        payment_method: 'clickpesa', // All payments go through ClickPesa
        payment_status: 'pending',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return NextResponse.json({ 
        error: 'Failed to create order',
        details: process.env.NODE_ENV === 'development' ? orderError.message : undefined
      }, { status: 500 })
    }

    // Create order items with validation
    const orderItems = cartItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name || 'Unknown Product',
      variant_id: item.variant_id || null,
      variant_name: item.variant_name || null,
      variant_attributes: item.variant_attributes || null,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (orderItemsError) {
      console.error('Order items creation error:', orderItemsError)
      
      // Attempt to clean up the created order
      await supabase
        .from('orders')
        .delete()
        .eq('id', order.id)
      
      return NextResponse.json({ 
        error: 'Failed to create order items',
        details: process.env.NODE_ENV === 'development' ? orderItemsError.message : undefined
      }, { status: 500 })
    }

    // Clear only selected items from cart after successful order creation
    const selectedProductIds = cartItems.map(item => item.product_id)
    const { error: clearCartError } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user?.id || 'guest')
      .in('product_id', selectedProductIds)

    if (clearCartError) {
      logger.error('Failed to clear cart after order', clearCartError, { 
        userId: user.id, 
        orderId: order.id 
      })
      // Don't fail the order for cart clearing issues, but log it
    }

    // Invalidate relevant caches
    cacheInvalidator.invalidateUser(user.id)
    cacheInvalidator.invalidateOrder(order.id)
    
    // Invalidate product caches for items that had stock changes
    for (const item of cartItems) {
      cacheInvalidator.invalidateProduct(item.product_id)
    }

    // Log successful order creation
    logger.info(`Order created successfully: ${order.id} for user: ${user.id}`, { 
      userId: user.id, 
      orderId: order.id,
      totalAmount: orderTotal,
      itemsCount: cartItems.length
    })

    const finalResponse = NextResponse.json({
      success: true,
      message: 'Order placed successfully',
      order: {
        id: order.id,
        total: orderTotal,
        currency: 'TZS',
        status: order.status,
        itemsCount: cartItems.length,
        createdAt: order.created_at
      }
    }, { status: 200 })

    copyCookies(response, finalResponse)
    return finalResponse

  } catch (error) {
    const errorContext = {
      userId: user?.id,
      ip: clientIP,
      userAgent: request.headers.get('user-agent') || undefined,
      action: 'checkout'
    }
    
    const errorResponse = handleApiError(error, errorContext)
    
    logger.error('Checkout process failed', error instanceof Error ? error : new Error(String(error)), errorContext)
    
    return NextResponse.json({
      error: errorResponse.message,
      ...(errorResponse.details && { details: errorResponse.details })
    }, { status: errorResponse.statusCode })
  }
}
