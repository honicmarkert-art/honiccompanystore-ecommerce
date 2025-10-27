import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateOrderIds, formatPickupId } from '@/lib/order-ids'
import { logger } from '@/lib/logger'
import { secureOrderCreation, ReferenceIdSecurity } from '@/lib/reference-id-security'



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
    
    // Create order record with reference_id and pickup_id stored in database
    const basicOrderData = {
      order_number: orderData.orderNumber,
      reference_id: cleanReferenceId, // Store reference ID in database
      pickup_id: pickupId,            // Store pickup ID in database
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

    logger.log('🔍 basicOrderData:', basicOrderData)

    // Use secure order creation with reference_id validation
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    const creationResult = await secureOrderCreation(basicOrderData, null, clientIP)
    
    if (!creationResult.success) {
      return NextResponse.json(
        { error: 'Order creation failed', details: creationResult.error },
        { status: 500 }
      )
    }
    
    const order = creationResult.data

    logger.log('🔍 Database Debug:')
    logger.log('Stored order.id:', order.id)


    // Create order items
    if (orderData.items && orderData.items.length > 0) {
      
      const orderItemsData = orderData.items.map((item: any) => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.productName,
        variant_id: item.variantId,
        variant_name: item.variantName,
        quantity: item.quantity,
        price: item.unitPrice || item.price, // Use unitPrice if available, fallback to price
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

    // Return order data with stored IDs
    const responseData = {
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        referenceId: order.reference_id, // Use stored reference ID
        pickupId: order.pickup_id,       // Use stored pickup ID
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
