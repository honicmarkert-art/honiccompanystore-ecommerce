import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateOrderIds, formatPickupId } from '@/lib/order-ids'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'

function getAdminClient() {
  try {
    return { client: createAdminSupabaseClient(), error: null as string | null }
  } catch (error: any) {
    return { client: null as any, error: error.message }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate admin access first
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const { client: supabase, error: envError } = getAdminClient()
    if (envError) {
      return NextResponse.json({ error: 'Server not configured', details: envError }, { status: 500 })
    }
    // Parse order data
    const orderData = await request.json()
    
    // Generate dual ID system
    const { referenceId, pickupId } = generateOrderIds()
    
    logger.log('📦 Admin Order Submission:', orderData)
    logger.log('🆔 Generated IDs:', { referenceId, pickupId: formatPickupId(pickupId) })
    
    // Create order record with only existing columns
    const basicOrderData = {
      order_number: orderData.orderNumber,
      reference_id: referenceId,
      pickup_id: pickupId,
      user_id: orderData.userId || null, // null for guest users
      // Use objects for JSON/JSONB columns
      shipping_address: orderData.shippingAddress,
      billing_address: orderData.sameAsShipping ? orderData.shippingAddress : orderData.billingAddress,
      // Persist delivery option from client ("shipping" | "pickup")
      delivery_option: orderData.deliveryOption,
      // Common required fields
      total_amount: orderData.totalAmount,
      payment_method: 'clickpesa',
      payment_status: 'pending',
      status: 'pending',
      created_at: orderData.timestamp,
      updated_at: new Date().toISOString(),
    } as any

    logger.log('📝 Inserting basic order data:', basicOrderData)
    logger.log('📝 Order data received:', orderData)

    let order: any = null
    let orderError: any = null
    try {
      const result = await supabase
        .from('orders')
        .insert(basicOrderData)
        .select()
        .single()
      order = result.data
      orderError = result.error
    } catch (e: any) {
      orderError = e
    }

    if (orderError) {
      console.warn('Primary insert failed, attempting minimal insert. Error:', orderError?.message || String(orderError))
      // Fallback: minimal insert with the least assumptions about schema
      const minimalData: any = {
        order_number: orderData.orderNumber,
        total_amount: orderData.totalAmount,
        status: 'pending',
        created_at: orderData.timestamp,
        updated_at: new Date().toISOString(),
      }
      try {
        const result2 = await supabase
          .from('orders')
          .insert(minimalData)
          .select()
          .single()
        order = result2.data
        orderError = result2.error
      } catch (e2: any) {
        orderError = e2
      }
    }

    if (orderError) {
      console.error('Failed to create order record after fallback:', orderError)
      console.error('Attempted payloads:', { basicOrderData })
      return NextResponse.json(
        { 
          error: 'Failed to create order record', 
          details: orderError?.message || String(orderError),
          hint: 'Verify orders table columns and nullability for: order_number, total_amount, status, created_at, updated_at, currency, payment_method, shipping_address, billing_address (JSON)'
        },
        { status: 500 }
      )
    }

    // Create order_items records from the order data
    logger.log('📦 Order data items:', orderData.items)
    if (orderData.items && Array.isArray(orderData.items)) {
      const orderItems = orderData.items.map((item: any) => ({
        order_id: order.id,
        product_id: item.productId || item.product_id,
        product_name: item.productName || item.product_name || 'Unknown Product',
        variant_id: item.variantId || item.variant_id || null,
        variant_name: item.variantName || item.variant_name || null,
        quantity: item.quantity || 1,
        price: item.price || item.unitPrice || 0,
        total_price: item.totalPrice || (item.price || item.unitPrice || 0) * (item.quantity || 1),
        created_at: new Date().toISOString()
      }))

      const { error: orderItemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (orderItemsError) {
        console.error('Failed to create order items:', orderItemsError)
        console.error('Order items data:', orderItems)
        // Don't fail the order creation, but log the error
      } else {
        logger.log('✅ Successfully created order items:', orderItems.length, 'items')
      }
    }

    // Send email notification to admin (simulate)
    await sendAdminNotification(orderData, order.id, referenceId, pickupId)

    // Generate payment URL (if needed)
    const paymentUrl = generatePaymentUrl(referenceId, orderData.totalAmount)

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        referenceId: order.reference_id || referenceId, // Fallback to generated ID
        pickupId: order.pickup_id ? formatPickupId(order.pickup_id) : formatPickupId(pickupId), // Fallback to generated ID
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status || 'unpaid', // Fallback to unpaid
        paymentUrl,
      },
    })

  } catch (error) {
    console.error('Admin order submission error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Validate admin access first
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const { client: supabase, error: envError } = getAdminClient()
    if (envError) {
      return NextResponse.json({ error: 'Server not configured', details: envError }, { status: 500 })
    }
    
    // Fetch all orders with their order items
    const { data: orders, error: ordersError } = await supabase
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
          created_at
        )
      `)
      .order('created_at', { ascending: false })

    if (ordersError) {
      console.error('Failed to fetch orders:', ordersError)
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      )
    }

    // Transform the data to include order items in a more accessible format
    const transformedOrders = (orders || []).map(order => ({
      ...order,
      order_items: order.order_items || [],
      // Calculate total items count from order_items
      total_items: (order.order_items || []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
      // Calculate total amount from order_items if not present in order
      calculated_total: (order.order_items || []).reduce((sum: number, item: any) => sum + (item.total_price || 0), 0)
    }))

    return NextResponse.json({
      success: true,
      orders: transformedOrders,
    })

  } catch (error) {
    console.error('Orders fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/orders - update order status or metadata
export async function PATCH(request: NextRequest) {
  try {
    // Validate admin access first
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const { client: supabase, error: envError } = getAdminClient()
    if (envError) {
      return NextResponse.json({ error: 'Server not configured', details: envError }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { id, status, payment_status } = body || {}

    if (!id) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 })
    }

    const update: any = { updated_at: new Date().toISOString() }
    if (status) update.status = status
    if (payment_status) update.payment_status = payment_status

    const { error: updateError } = await supabase
      .from('orders')
      .update(update)
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update order', details: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Order update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/orders - Delete a specific order or all orders
export async function DELETE(request: NextRequest) {
  try {
    // Validate admin access first
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const { client: supabase, error: envError } = getAdminClient()
    if (envError) {
      return NextResponse.json({ error: 'Server not configured', details: envError }, { status: 500 })
    }

    // Check if we're deleting a specific order or all orders
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('id')
    
    logger.log('DELETE request - Order ID:', orderId)

    if (orderId) {
      logger.log('🗑️ Attempting to delete order:', orderId)
      
      // First check if the order exists
      const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_status')
        .eq('id', orderId)
        .single()

      if (fetchError) {
        console.error('❌ Order not found:', fetchError)
        return NextResponse.json(
          { error: 'Order not found', details: fetchError.message },
          { status: 404 }
        )
      }

      logger.log('🔍 Found order to delete:', existingOrder)

      // Delete specific order and its items
      const { error: deleteItemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId)

      if (deleteItemsError) {
        console.warn('⚠️ Failed to delete order_items, assuming cascade:', deleteItemsError)
      } else {
        logger.log('✅ Order items deleted successfully')
      }

      const { error: deleteOrderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)

      if (deleteOrderError) {
        console.error('❌ Failed to delete order from database:', deleteOrderError)
        return NextResponse.json(
          { error: 'Failed to delete order', details: deleteOrderError.message },
          { status: 500 }
        )
      }

      logger.log('✅ Order deleted successfully:', orderId)
      return NextResponse.json({ success: true, message: 'Order deleted successfully' })
    } else {
      // Delete all orders (original functionality)
      const { error: deleteItemsError } = await supabase
        .from('order_items')
        .delete()
        .neq('order_id', '') // noop filter to satisfy API requirements

      if (deleteItemsError) {
        console.warn('Failed to delete order_items directly, proceeding to delete orders (assuming cascade):', deleteItemsError)
      }

      const { error: deleteOrdersError } = await supabase
        .from('orders')
        .delete()
        .neq('id', '')

      if (deleteOrdersError) {
        return NextResponse.json(
          { error: 'Failed to delete orders', details: deleteOrdersError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, message: 'All orders cleared' })
    }

  } catch (error) {
    console.error('Orders delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Function to send admin notification
async function sendAdminNotification(orderData: any, orderId: string, referenceId: string, pickupId: string) {
  try {
    // Simulate email notification
    logger.log('📧 Admin Notification Sent:')
    logger.log(`   Order ID: ${orderId}`)
    logger.log(`   Reference ID: ${referenceId}`)
    logger.log(`   Pickup ID: ${formatPickupId(pickupId)}`)
    logger.log(`   Order Number: ${orderData.orderNumber}`)
    logger.log(`   Customer: ${orderData.shippingAddress.fullName}`)
    logger.log(`   Total: ${orderData.totalAmount}`)
    logger.log(`   Delivery: ${orderData.deliveryOption}`)
    logger.log(`   Payment Status: Unpaid`)
    
    // In a real app, you would:
    // 1. Send email to admin using your email service
    // 2. Send SMS notification
    // 3. Create notification in admin dashboard
    // 4. Update order status in real-time
    
    return { success: true }
  } catch (error) {
    console.error('Failed to send admin notification:', error)
    throw error
  }
}

// Function to generate payment URL
function generatePaymentUrl(referenceId: string, amount: number): string {
  // Generate payment URL (simulate ClickPesa or other payment gateway)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const paymentId = `PAY_${Date.now()}`
  
  // In a real app, this would integrate with your payment gateway
  // Use Reference ID for secure internal tracking
  const paymentUrl = `${baseUrl}/payment/${paymentId}?ref=${referenceId}&amount=${amount}`
  
  logger.log('💰 Payment URL Generated:', paymentUrl)
  
  return paymentUrl
}
