import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { generateOrderIds } from '@/lib/order-ids'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/orders/reserve - Reserve order IDs
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    
    // Parse request data
    const { userId, orderNumber } = await request.json()
    
    if (!orderNumber) {
      return NextResponse.json(
        { error: 'Order number is required' },
        { status: 400 }
      )
    }
    
    // Generate dual ID system
    const { referenceId, pickupId } = generateOrderIds()
    const cleanReferenceId = referenceId.replace(/-/g, '')
    
    logger.log('🔍 Reserving Order IDs:', {
      orderNumber,
      userId,
      referenceId: cleanReferenceId,
      pickupId
    })
    
    // Create a "reserved" order record with minimal data
    const reservedOrderData = {
      order_number: orderNumber,
      reference_id: cleanReferenceId,
      pickup_id: pickupId,
      user_id: userId || null,
      status: 'reserved', // Special status for reserved orders
      total_amount: 0, // Will be updated later
      payment_status: 'reserved',
      payment_method: 'clickpesa',
      currency: 'TZS',
      shipping_address: {}, // Will be updated later
      billing_address: {}, // Will be updated later
      delivery_option: 'shipping', // Will be updated later
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
      logger.log('❌ Reserve order error:', reserveError)
      return NextResponse.json(
        { error: 'Failed to reserve order IDs', details: reserveError.message },
        { status: 500 }
      )
    }
    
    logger.log('✅ Order IDs reserved successfully:', {
      id: reservedOrder.id,
      orderNumber: reservedOrder.order_number,
      referenceId: reservedOrder.reference_id,
      pickupId: reservedOrder.pickup_id
    })
    
    // Return reserved IDs to frontend (hide Order ID and User ID from users)
    return NextResponse.json({
      success: true,
      reservedOrder: {
        id: reservedOrder.id, // Keep for internal use but don't display to users
        orderNumber: reservedOrder.order_number,
        referenceId: reservedOrder.reference_id,
        pickupId: reservedOrder.pickup_id,
        status: 'reserved'
        // userId: reservedOrder.user_id, // Hidden from users - internal use only
      }
    })
    
  } catch (error: any) {
    logger.log('❌ Reserve order exception:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
