import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { sanitizeOrderNumber, validateOrderOwnership } from '@/lib/auth-utils'

// GET /api/user/orders/[orderNumber] - Get order details by order number (customer-facing)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/user/orders/[orderNumber]',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }

    const { orderNumber: rawOrderNumber } = await params
    
    // Sanitize and validate order number
    const orderNumber = sanitizeOrderNumber(rawOrderNumber)
    if (!orderNumber) {
      return NextResponse.json({ error: 'Invalid order number format' }, { status: 400 })
    }
    const cookieStore = await cookies()
    
    // Create response to handle cookie updates
    const response = new NextResponse()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set(name, value, options)
          },
          remove(name: string, options: any) {
            response.cookies.delete(name)
          },
        },
      }
    )
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.log('❌ Authentication failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    logger.log('🔍 Customer order lookup for order number:', orderNumber)

    if (!orderNumber) {
      return NextResponse.json({ error: 'Order number is required' }, { status: 400 })
    }

    // Find order by order_number (not by UUID)
    logger.log('📦 Fetching order:', orderNumber)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          product_name,
          variant_id,
          variant_name,
          quantity,
          price,
          total_price,
          tracking_number
        )
      `)
      .eq('order_number', orderNumber)  // Use order_number instead of id
      .single()

    logger.log('📦 Order query result:', { hasOrder: !!order, error: orderError })

    if (orderError) {
      logger.log('❌ Order not found:', orderError)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check user authorization - ensure the authenticated user owns this order
    if (!validateOrderOwnership(order.user_id, user.id)) {
      logger.log('❌ Unauthorized access attempt:', { 
        orderUserId: order.user_id, 
        requestUserId: user.id 
      })
      logSecurityEvent('UNAUTHORIZED_ORDER_ACCESS', {
        endpoint: '/api/user/orders/[orderNumber]',
        orderNumber: orderNumber,
        orderUserId: order.user_id,
        requestUserId: user.id
      }, request)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    logger.log('✅ User authorized for order:', orderNumber)
    
    // Fetch confirmed order data if it exists
    const { data: confirmedOrder } = await supabase
      .from('confirmed_orders')
      .select('id, status, confirmed_at, is_received, received_at, updated_at, delivery_option')
      .eq('order_id', order.id)
      .single()
    
    // Fetch confirmed order items with status if order is confirmed
    let confirmedOrderItems: any[] = []
    if (confirmedOrder?.id) {
      const { data: items } = await supabase
        .from('confirmed_order_items')
        .select(`
          id,
          product_id,
          product_name,
          variant_id,
          variant_name,
          quantity,
          price,
          total_price,
          status,
          tracking_number
        `)
        .eq('confirmed_order_id', confirmedOrder.id)
      
      if (items) {
        confirmedOrderItems = items
      }
    }
    
    // Use confirmed order items if available, otherwise fall back to order_items
    const orderItems = confirmedOrderItems.length > 0 ? confirmedOrderItems : (order.order_items || [])
    
    // Fetch product images and supplier information
    const productIds = orderItems.map((item: any) => item.product_id).filter(Boolean) || []
    let productImagesMap = new Map<number, string>()
    let productSuppliersMap = new Map<number, { supplierId: string | null, supplierName: string | null }>()
    
    if (productIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, image, supplier_id, user_id')
        .in('id', productIds)
      
      if (products && !productsError) {
        // Get unique supplier IDs
        const supplierIds = [...new Set(products.map(p => p.supplier_id || p.user_id).filter(Boolean))]
        
        // Fetch supplier names
        let suppliersMap = new Map<string, string>()
        if (supplierIds.length > 0) {
          const { data: suppliers } = await supabase
            .from('profiles')
            .select('id, company_name, full_name')
            .in('id', supplierIds)
          
          if (suppliers) {
            suppliers.forEach(supplier => {
              suppliersMap.set(supplier.id, supplier.company_name || supplier.full_name || 'Unknown Supplier')
            })
          }
        }
        
        products.forEach(product => {
          productImagesMap.set(product.id, product.image || '/placeholder.jpg')
          const supplierId = product.supplier_id || product.user_id
          const supplierName = supplierId ? (suppliersMap.get(supplierId) || 'Unknown Supplier') : null
          productSuppliersMap.set(product.id, {
            supplierId: supplierId,
            supplierName: supplierName
          })
        })
      }
    }

    // Format the response (reference_id and pickup_id are READ-ONLY for customers)
    // SECURITY: Never expose UUIDs (order.id, supplierId, item.id) to clients
    const responseData = {
      // id: order.id, // REMOVED: UUID should never be exposed to client
      orderNumber: order.order_number,
      referenceId: order.reference_id, // READ-ONLY: Payment gateway integration only
      pickupId: order.pickup_id,       // READ-ONLY: Customer pickup confirmation
      status: confirmedOrder?.status || order.status,
      totalAmount: order.total_amount,
      currency: order.currency || 'TZS',
      itemCount: orderItems.length || 0,
      totalItems: orderItems.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0,
      createdAt: order.created_at,
      updatedAt: confirmedOrder?.updated_at || confirmedOrder?.confirmed_at || order.updated_at,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      clickpesaTransactionId: order.clickpesa_transaction_id,
      paymentTimestamp: order.payment_timestamp,
      failureReason: order.failure_reason,
      deliveryOption: confirmedOrder?.delivery_option || order.delivery_option,
      trackingNumber: order.tracking_number,
      estimatedDelivery: order.estimated_delivery,
      isReceived: confirmedOrder?.is_received || false,
      receivedAt: confirmedOrder?.received_at || null,
      confirmedAt: confirmedOrder?.confirmed_at || null,
      shippingAddress: order.shipping_address,
      billingAddress: order.billing_address,
      items: orderItems.map((item: any, index: number) => {
        const supplierInfo = productSuppliersMap.get(item.product_id) || { supplierId: null, supplierName: null }
        // SECURITY: Generate a safe hash key instead of exposing UUID
        // Use product_id + variant_id + index to create a unique, non-UUID identifier
        const safeItemKey = `${item.product_id}-${item.variant_id || 'default'}-${index}`
        return {
          // id: item.id, // REMOVED: UUID should never be exposed to client
          itemKey: safeItemKey, // Safe, non-UUID identifier for client-side operations
          productId: item.product_id,
          productName: item.product_name || 'Unknown Product',
          productImage: productImagesMap.get(item.product_id) || '/placeholder.jpg',
          variantName: item.variant_name,
          variantAttributes: item.variant_attributes,
          quantity: item.quantity,
          unitPrice: item.price, // This is the unit price from the database
          totalPrice: item.total_price, // This is the total price from the database
          // supplierId: supplierInfo.supplierId, // REMOVED: UUID should never be exposed to client
          supplierName: supplierInfo.supplierName, // Only send display name, never UUID
          trackingNumber: item.tracking_number || null,
          status: item.status || 'confirmed' // Per-item status from confirmed_order_items
        }
      }),
      notes: order.notes
    }

    logger.log('✅ Returning order data')
    return NextResponse.json(responseData)

  } catch (error: any) {
    logger.log('❌ Error fetching order by number:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// PATCH /api/user/orders/[orderNumber] - Update order (limited customer operations)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/user/orders/[orderNumber]',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }

    const { orderNumber: rawOrderNumber } = await params
    
    // Sanitize and validate order number
    const orderNumber = sanitizeOrderNumber(rawOrderNumber)
    if (!orderNumber) {
      return NextResponse.json({ error: 'Invalid order number format' }, { status: 400 })
    }
    const body = await request.json()
    const cookieStore = await cookies()
    
    const response = new NextResponse()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set(name, value, options)
          },
          remove(name: string, options: any) {
            response.cookies.delete(name)
          },
        },
      }
    )
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow certain fields to be updated by customers
    const allowedFields = ['notes'] // Customers can only update notes
    const forbiddenFields = ['reference_id', 'pickup_id', 'id', 'order_number', 'user_id'] // READ-ONLY fields
    const updateData: any = {}
    
    // Check for forbidden fields
    for (const field of forbiddenFields) {
      if (body[field] !== undefined) {
        return NextResponse.json({ 
          error: `Field '${field}' is read-only and cannot be modified by customers`,
          forbiddenField: field
        }, { status: 403 })
      }
    }
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Find order by order_number
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id')
      .eq('order_number', orderNumber)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check user authorization - ensure the authenticated user owns this order
    if (!validateOrderOwnership(order.user_id, user.id)) {
      logger.log('❌ Unauthorized order update attempt:', { 
        orderUserId: order.user_id, 
        requestUserId: user.id 
      })
      logSecurityEvent('UNAUTHORIZED_ORDER_UPDATE', {
        endpoint: '/api/user/orders/[orderNumber]',
        orderNumber: orderNumber,
        orderUserId: order.user_id,
        requestUserId: user.id
      }, request)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Update the order
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id) // Use internal ID for update

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update order', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Order updated successfully' })

  } catch (error: any) {
    logger.log('❌ Error updating order:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
