import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
function getAdminClient() {
  try {
    return { client: createAdminSupabaseClient(), error: null as string | null }
  } catch (error: any) {
    return { client: null as any, error: error.message }
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
    
    // Fetch all confirmed orders with their order items
    const { data: orders, error: ordersError } = await supabase
      .from('confirmed_orders')
      .select(`
        *,
        confirmed_order_items (
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
      .order('confirmed_at', { ascending: false })

    if (ordersError) {
      return NextResponse.json(
        { error: 'Failed to fetch confirmed orders' },
        { status: 500 }
      )
    }

    // Transform the data to include order items in a more accessible format
    const transformedOrders = (orders || []).map(order => ({
      ...order,
      order_items: order.confirmed_order_items || [],
      // Calculate total items count from confirmed_order_items
      total_items: (order.confirmed_order_items || []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
      // Calculate total amount from confirmed_order_items if not present in order
      calculated_total: (order.confirmed_order_items || []).reduce((sum: number, item: any) => sum + (item.total_price || 0), 0)
    }))

    return NextResponse.json({
      success: true,
      orders: transformedOrders,
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/confirmed-orders - Create a new confirmed order
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

    const orderData = await request.json()
    
    logger.log('📦 Received order confirmation request:', {
      originalOrderId: orderData.originalOrderId,
      orderNumber: orderData.orderNumber,
      hasOrderItems: !!orderData.orderItems && orderData.orderItems.length > 0
    })
    
    // Create confirmed order record
    // Note: Only include fields that definitely exist in the table
    const confirmedOrderData: any = {
      order_id: orderData.originalOrderId, // Link to original order
      order_number: orderData.orderNumber,
      reference_id: orderData.referenceId,
      pickup_id: orderData.pickupId,
      user_id: orderData.userId || null,
      delivery_option: orderData.deliveryOption || 'shipping',
      total_amount: orderData.totalAmount,
      payment_method: orderData.paymentMethod || 'clickpesa',
      payment_status: 'paid',
      status: 'confirmed',
      confirmed_by: orderData.confirmedBy || user?.id || null,
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Only include shipping/billing if they exist as JSONB columns
    // Try adding them as JSON strings if needed
    if (orderData.shippingAddress && typeof orderData.shippingAddress === 'object') {
      try {
        confirmedOrderData.shipping_address = JSON.stringify(orderData.shippingAddress)
      } catch (e) {
        // Ignore error
      }
    }
    
    if (orderData.billingAddress && typeof orderData.billingAddress === 'object') {
      try {
        confirmedOrderData.billing_address = JSON.stringify(orderData.billingAddress)
      } catch (e) {
        // Ignore error
      }
    }
    const { data: confirmedOrder, error: orderError } = await supabase
      .from('confirmed_orders')
      .insert(confirmedOrderData)
      .select()
      .single()
    
    if (orderError) {
      logger.error('❌ Failed to create confirmed order:', {
        error: orderError,
        message: orderError.message,
        details: orderError.details,
        hint: orderError.hint,
        code: orderError.code
      })
      logger.error('📝 Order data being inserted:', confirmedOrderData)
      
      return NextResponse.json(
        { error: 'Failed to create confirmed order', details: orderError.message },
        { status: 500 }
      )
    }

    logger.log('✅ Successfully created confirmed order:', confirmedOrder.id)


    // Copy order items from original order
    if (orderData.orderItems && Array.isArray(orderData.orderItems)) {
      const orderItems = orderData.orderItems.map((item: any) => ({
        confirmed_order_id: confirmedOrder.id,
        product_id: item.product_id,
        product_name: item.product_name,
        variant_id: item.variant_id,
        variant_name: item.variant_name,
        quantity: item.quantity,
        price: item.price,
        total_price: item.total_price,
        created_at: new Date().toISOString()
      }))
      
      const { error: orderItemsError } = await supabase
        .from('confirmed_order_items')
        .insert(orderItems)

      if (orderItemsError) {
        logger.error('Failed to create confirmed order items:', orderItemsError)
      } else {
        logger.log('Successfully created confirmed order items:', orderItems.length, 'items')
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        id: confirmedOrder.id,
        orderNumber: confirmedOrder.order_number,
        status: confirmedOrder.status,
        confirmedAt: confirmedOrder.confirmed_at
      }
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/confirmed-orders - Update confirmed order status
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
    const { id, status, notes } = body || {}

    if (!id) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 })
    }

    const update: any = { updated_at: new Date().toISOString() }
    if (status) update.status = status
    if (notes) update.notes = notes

    const { error: updateError } = await supabase
      .from('confirmed_orders')
      .update(update)
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update confirmed order', details: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

