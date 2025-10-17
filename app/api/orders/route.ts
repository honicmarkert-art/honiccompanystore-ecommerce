import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateOrderIds, formatPickupId } from '@/lib/order-ids'
import { logger } from '@/lib/logger'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
function getSupabaseClient() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!url || !serviceKey) {
      throw new Error('Missing Supabase environment variables')
    }
    
    return createClient(url, serviceKey, { 
      auth: { autoRefreshToken: false, persistSession: false } 
    })
  } catch (error: any) {
    throw new Error(error.message)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    
    // Parse order data
    const orderData = await request.json()
    
    // Generate dual ID system
    const { referenceId, pickupId } = generateOrderIds()
    
    // Remove hyphens from UUID for consistent format
    const cleanReferenceId = referenceId.replace(/-/g, '')
    
    logger.log('🔍 UUID Debug:')
    logger.log('Original referenceId:', referenceId)
    logger.log('Clean referenceId:', cleanReferenceId)
    
    // Create order record with only existing columns
    const basicOrderData = {
      order_number: orderData.orderNumber,
      reference_id: cleanReferenceId, // UUID without hyphens
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

    logger.log('🔍 basicOrderData.reference_id:', basicOrderData.reference_id)

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
      return NextResponse.json(
        { error: 'Order creation failed', details: orderError.message },
        { status: 500 }
      )
    }

    logger.log('🔍 Database Debug:')
    logger.log('Stored order.reference_id:', order.reference_id)


    // Create order items
    if (orderData.items && orderData.items.length > 0) {
      
      const orderItemsData = orderData.items.map((item: any) => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.productName,
        variant_id: item.variantId,
        variant_name: item.variantName,
        quantity: item.quantity,
        price: item.price,
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

    // Return order data with generated IDs
    const responseData = {
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        referenceId: order.reference_id,
        pickupId: order.pickup_id,
        totalAmount: order.total_amount,
        paymentStatus: order.payment_status,
        status: order.status,
        deliveryOption: order.delivery_option,
        createdAt: order.created_at,
      },
    }

    return NextResponse.json(responseData)

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
