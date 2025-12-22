// Enhanced Order Creation Flow
// This implements a two-phase order creation process to ensure proper ID handling

// ============================================================================
// PHASE 1: ORDER ID RESERVATION API
// ============================================================================

// New API endpoint: /api/orders/reserve
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    
    // Parse request data
    const { userId, orderNumber } = await request.json()
    
    // Generate dual ID system
    const { referenceId, pickupId } = generateOrderIds()
    const cleanReferenceId = referenceId.replace(/-/g, '')
    
    // Create a "reserved" order record with minimal data
    const reservedOrderData = {
      order_number: orderNumber,
      reference_id: cleanReferenceId,
      pickup_id: pickupId,
      user_id: userId || null,
      status: 'reserved', // Special status for reserved orders
      total_amount: 0, // Will be updated later
      payment_status: 'reserved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    // Insert reserved order
    const { data: reservedOrder, error: reserveError } = await supabase
      .from('orders')
      .insert(reservedOrderData)
      .select()
      .single()
    
    if (reserveError) {
      return NextResponse.json(
        { error: 'Failed to reserve order IDs', details: reserveError.message },
        { status: 500 }
      )
    }
    
    // Return reserved IDs to frontend
    return NextResponse.json({
      success: true,
      reservedOrder: {
        id: reservedOrder.id,
        orderNumber: reservedOrder.order_number,
        referenceId: reservedOrder.reference_id,
        pickupId: reservedOrder.pickup_id,
        status: 'reserved'
      }
    })
    
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================================
// PHASE 2: COMPLETE ORDER CREATION API
// ============================================================================

// Updated API endpoint: /api/orders/complete
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    
    // Parse order data
    const orderData = await request.json()
    const { orderId, referenceId, pickupId, ...orderDetails } = orderData
    
    // Validate that the order exists and is in 'reserved' status
    const { data: existingOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('status', 'reserved')
      .single()
    
    if (fetchError || !existingOrder) {
      return NextResponse.json(
        { error: 'Reserved order not found or already completed' },
        { status: 404 }
      )
    }
    
    // Update the reserved order with complete data
    const completeOrderData = {
      ...orderDetails,
      status: 'pending',
      payment_status: 'pending',
      updated_at: new Date().toISOString(),
    }
    
    const { data: completedOrder, error: updateError } = await supabase
      .from('orders')
      .update(completeOrderData)
      .eq('id', orderId)
      .select()
      .single()
    
    if (updateError) {
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
        return NextResponse.json(
          { error: 'Order items creation failed', details: itemsError.message },
          { status: 500 }
        )
      }
    }
    
    // Return completed order data
    return NextResponse.json({
      success: true,
      order: {
        id: completedOrder.id,
        orderNumber: completedOrder.order_number,
        referenceId: completedOrder.reference_id,
        pickupId: completedOrder.pickup_id,
        totalAmount: completedOrder.total_amount,
        paymentStatus: completedOrder.payment_status,
        status: completedOrder.status,
        deliveryOption: completedOrder.delivery_option,
        createdAt: completedOrder.created_at,
      },
    })
    
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
