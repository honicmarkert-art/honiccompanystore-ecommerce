import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// PUT /api/orders/complete - Complete order creation
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    
    // Parse order data
    const orderData = await request.json()
    const { orderId, referenceId, pickupId, userId, ...orderDetails } = orderData
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }
    
    logger.log('🔍 Completing order:', {
      orderId,
      referenceId,
      pickupId,
      userId,
      totalAmount: orderDetails.totalAmount
    })
    
    // Validate that the order exists and is in 'reserved' status
    const { data: existingOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('status', 'reserved')
      .single()
    
    if (fetchError || !existingOrder) {
      logger.log('❌ Reserved order not found:', fetchError)
      return NextResponse.json(
        { error: 'Reserved order not found or already completed' },
        { status: 404 }
      )
    }
    
    // Update the reserved order with complete data
    const completeOrderData = {
      user_id: userId || null,
      total_amount: orderDetails.totalAmount,
      currency: orderDetails.currency || 'TZS',
      shipping_address: orderDetails.shippingAddress,
      billing_address: orderDetails.billingAddress,
      delivery_option: orderDetails.deliveryOption || 'shipping',
      payment_method: 'clickpesa',
      payment_status: 'pending',
      status: 'pending',
      updated_at: new Date().toISOString(),
    }
    
    const { data: completedOrder, error: updateError } = await supabase
      .from('orders')
      .update(completeOrderData)
      .eq('id', orderId)
      .select()
      .single()
    
    if (updateError) {
      logger.log('❌ Complete order error:', updateError)
      return NextResponse.json(
        { error: 'Failed to complete order', details: updateError.message },
        { status: 500 }
      )
    }
    
    // Create order items
    if (orderDetails.items && orderDetails.items.length > 0) {
      const orderItemsData = orderDetails.items.map((item: any) => ({
        order_id: orderId,
        product_id: item.productId,
        product_name: item.productName,
        variant_id: item.variantId,
        variant_name: item.variantName,
        variant_attributes: null, // No longer used in simplified variant system
        quantity: item.quantity,
        price: item.unitPrice || item.price,
        total_price: item.totalPrice,
        created_at: new Date().toISOString(),
      }))
      
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData)
      
      if (itemsError) {
        logger.log('❌ Order items creation error:', itemsError)
        return NextResponse.json(
          { error: 'Order items creation failed', details: itemsError.message },
          { status: 500 }
        )
      }
      
      logger.log('✅ Order items created:', orderItemsData.length, 'items')
    }
    
    logger.log('✅ Order completed successfully:', {
      id: completedOrder.id,
      orderNumber: completedOrder.order_number,
      referenceId: completedOrder.reference_id,
      pickupId: completedOrder.pickup_id,
      totalAmount: completedOrder.total_amount
    })
    
    // Return completed order data (hide Order ID and User ID from users)
    return NextResponse.json({
      success: true,
      order: {
        id: completedOrder.id, // Keep for internal use but don't display to users
        orderNumber: completedOrder.order_number,
        referenceId: completedOrder.reference_id,
        pickupId: completedOrder.pickup_id,
        totalAmount: completedOrder.total_amount,
        paymentStatus: completedOrder.payment_status,
        status: completedOrder.status,
        deliveryOption: completedOrder.delivery_option,
        createdAt: completedOrder.created_at,
        // userId: completedOrder.user_id, // Hidden from users - internal use only
      },
    })
    
  } catch (error: any) {
    logger.log('❌ Complete order exception:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
