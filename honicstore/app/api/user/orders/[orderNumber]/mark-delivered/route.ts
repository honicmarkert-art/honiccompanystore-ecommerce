import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { sanitizeOrderNumber, validateOrderOwnership } from '@/lib/auth-utils'

// PATCH /api/user/orders/[orderNumber]/mark-delivered - Mark order as delivered/picked up
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/user/orders/[orderNumber]/mark-delivered',
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
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.log('❌ Authentication failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!orderNumber) {
      return NextResponse.json({ error: 'Order number is required' }, { status: 400 })
    }

    // Parse request body to get optional item IDs (for updating specific supplier group)
    const body = await request.json().catch(() => ({}))
    const itemIds: string[] | undefined = body.itemIds

    // Find the confirmed order by order_number
    const { data: confirmedOrder, error: orderError } = await supabase
      .from('confirmed_orders')
      .select('id, user_id, status, delivery_option, is_received')
      .eq('order_number', orderNumber)
      .single()

    if (orderError || !confirmedOrder) {
      logger.log('❌ Confirmed order not found:', orderError)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check user authorization - ensure the authenticated user owns this order
    if (!validateOrderOwnership(confirmedOrder.user_id, user.id)) {
      logger.log('❌ Unauthorized access attempt:', { 
        orderUserId: confirmedOrder.user_id, 
        requestUserId: user.id 
      })
      logSecurityEvent('UNAUTHORIZED_ORDER_UPDATE', {
        endpoint: '/api/user/orders/[orderNumber]/mark-delivered',
        orderNumber: orderNumber,
        orderUserId: confirmedOrder.user_id,
        requestUserId: user.id
      }, request)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check the status from confirmed_order_items (suppliers update item status, not order status)
    // If itemIds are provided, only check those items; otherwise check all items
    let itemsQuery = supabase
      .from('confirmed_order_items')
      .select('id, status')
      .eq('confirmed_order_id', confirmedOrder.id)
    
    if (itemIds && itemIds.length > 0) {
      itemsQuery = itemsQuery.in('id', itemIds)
    }
    
    const { data: orderItems, error: itemsError } = await itemsQuery

    if (itemsError) {
      logger.log('❌ Error fetching order items:', itemsError)
      return NextResponse.json({ error: 'Failed to fetch order items' }, { status: 500 })
    }

    if (!orderItems || orderItems.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No items found to update' 
      }, { status: 400 })
    }

    // Check if any items are marked as 'delivered' (supplier marks items as delivered)
    const hasDeliveredItems = orderItems?.some(item => item.status === 'delivered') || false
    const allItemsPickedUp = orderItems?.every(item => item.status === 'picked_up') || false

    // Determine the new status based on item statuses
    // For both shipping and pickup orders: if any items are 'delivered', customer can mark as 'picked_up'
    let newStatus: string
    if (hasDeliveredItems) {
      // Customer marking order as picked up after supplier marked items as delivered
      // This applies to both shipping and pickup orders
      newStatus = 'picked_up'
    } else if (allItemsPickedUp) {
      // Order already picked up
      return NextResponse.json({ 
        success: true, 
        message: 'Order already marked as picked up',
        alreadyCompleted: true,
        status: 'picked_up'
      })
    } else {
      // Should not happen - supplier should mark items as delivered first
      const currentItemStatuses = orderItems?.map(item => item.status).join(', ') || 'unknown'
      logger.log('❌ Order items not delivered yet:', { 
        orderNumber, 
        itemStatuses: currentItemStatuses,
        orderStatus: confirmedOrder.status
      })
      return NextResponse.json({ 
        success: false, 
        error: 'Order must be marked as delivered by supplier before you can mark as picked up',
        currentStatus: confirmedOrder.status,
        itemStatuses: currentItemStatuses
      }, { status: 400 })
    }

    // Prepare update data
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }

    // Note: For pickup orders, picked_up is the final status (not received)

    // Update the confirmed_order status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('confirmed_orders')
      .update(updateData)
      .eq('id', confirmedOrder.id)
      .select('status, updated_at, is_received, received_at')
      .single()

    if (updateError) {
      logger.log('❌ Error marking order as delivered/picked up:', updateError)
      return NextResponse.json(
        { error: 'Failed to mark order', details: updateError.message },
        { status: 500 }
      )
    }

    // Update confirmed_order_items status
    // If itemIds are provided, only update those items; otherwise update all items
    let itemsUpdateQuery = supabase
      .from('confirmed_order_items')
      .update({ status: newStatus })
      .eq('confirmed_order_id', confirmedOrder.id)
    
    if (itemIds && itemIds.length > 0) {
      itemsUpdateQuery = itemsUpdateQuery.in('id', itemIds)
    }
    
    const { error: itemsUpdateError } = await itemsUpdateQuery

    if (itemsUpdateError) {
      logger.log('⚠️ Warning: Failed to update order items status:', itemsUpdateError)
      // Don't fail the request, but log the warning
    }

    logger.log('✅ Order marked as delivered/picked up:', orderNumber)
    
    // Send delivery confirmation email
    if (newStatus === 'delivered' || newStatus === 'picked_up') {
      try {
        const { sendDeliveryConfirmationEmail } = await import('@/lib/user-email-service')
        
        const { data: orderItems } = await supabase
          .from('confirmed_order_items')
          .select('product_name, quantity, products(image)')
          .eq('confirmed_order_id', confirmedOrder.id)

        if (user.email) {
          await sendDeliveryConfirmationEmail(user.email, {
            orderNumber: orderNumber,
            deliveryDate: new Date().toLocaleDateString(),
            items: orderItems?.map((item: any) => ({
              name: item.product_name,
              quantity: item.quantity,
              image: item.products?.image
            })) || [],
            reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://honiccompanystore.com'}/account/orders/${orderNumber}/review`
          })
        }
      } catch (emailError) {
        logger.error('Error sending delivery confirmation email:', emailError)
        // Don't fail the request if email fails
      }
    }
    
    const message = newStatus === 'picked_up' 
      ? 'Order marked as picked up and received successfully!' 
      : 'Order marked as delivered successfully'
    
    return NextResponse.json({
      success: true,
      message: message,
      status: updatedOrder.status,
      updated_at: updatedOrder.updated_at,
      is_received: updatedOrder.is_received,
      received_at: updatedOrder.received_at
    })

  } catch (error: any) {
    logger.log('❌ Error marking order as delivered/picked up:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}



