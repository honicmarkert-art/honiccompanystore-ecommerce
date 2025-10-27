import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

// GET /api/user/orders/[orderNumber] - Get order details by order number (customer-facing)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params
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
          total_price
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
    if (order.user_id !== user.id) {
      logger.log('❌ Unauthorized access attempt:', { 
        orderUserId: order.user_id, 
        requestUserId: user.id 
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    logger.log('✅ User authorized for order:', orderNumber)
    
    // Fetch product images
    const productIds = order.order_items?.map((item: any) => item.product_id).filter(Boolean) || []
    let productImagesMap = new Map<number, string>()
    
    if (productIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, image')
        .in('id', productIds)
      
      if (products && !productsError) {
        products.forEach(product => {
          productImagesMap.set(product.id, product.image || '/placeholder.jpg')
        })
      }
    }

    // Format the response (reference_id and pickup_id are READ-ONLY for customers)
    const responseData = {
      id: order.id, // Keep for internal operations but don't expose in URLs
      orderNumber: order.order_number,
      referenceId: order.reference_id, // READ-ONLY: Payment gateway integration only
      pickupId: order.pickup_id,       // READ-ONLY: Customer pickup confirmation
      status: order.status,
      totalAmount: order.total_amount,
      currency: order.currency || 'TZS',
      itemCount: order.order_items?.length || 0,
      totalItems: order.order_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      clickpesaTransactionId: order.clickpesa_transaction_id,
      paymentTimestamp: order.payment_timestamp,
      failureReason: order.failure_reason,
      deliveryOption: order.delivery_option,
      trackingNumber: order.tracking_number,
      estimatedDelivery: order.estimated_delivery,
      shippingAddress: order.shipping_address,
      billingAddress: order.billing_address,
      items: (order.order_items || []).map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name || 'Unknown Product',
        productImage: productImagesMap.get(item.product_id) || '/placeholder.jpg',
        variantName: item.variant_name,
        variantAttributes: item.variant_attributes,
        quantity: item.quantity,
        unitPrice: item.price, // This is the unit price from the database
        totalPrice: item.total_price // This is the total price from the database
      })),
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
    const { orderNumber } = await params
    const body = await request.json()
    const supabase = getSupabaseClient()

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

    // TODO: Add user authorization check
    // Ensure the authenticated user owns this order

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
