import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/admin-auth'
import { getSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

/**
 * PATCH /api/admin/orders/items/tracking
 * Assign tracking number to order items from a specific supplier
 * 
 * Body:
 * {
 *   orderId: string (UUID) | orderNumber: string,
 *   supplierId: string (UUID),
 *   trackingNumber: string
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    // Validate admin access
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const supabase = getSupabaseClient()
    const body = await request.json()
    const { orderId, orderNumber, supplierId, trackingNumber } = body

    // Validate required fields
    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 })
    }

    if (!trackingNumber || trackingNumber.trim() === '') {
      return NextResponse.json({ error: 'Tracking number is required' }, { status: 400 })
    }

    if (!orderId && !orderNumber) {
      return NextResponse.json({ error: 'Either orderId or orderNumber is required' }, { status: 400 })
    }

    logger.log('📦 Assigning tracking number:', {
      orderId,
      orderNumber,
      supplierId,
      trackingNumber
    })

    // Find the order
    let order
    if (orderId) {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('id', orderId)
        .single()

      if (orderError || !orderData) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      order = orderData
    } else {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', orderNumber)
        .single()

      if (orderError || !orderData) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      order = orderData
    }

    // Get all order items for this order
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id')
      .eq('order_id', order.id)

    if (itemsError) {
      logger.error('❌ Error fetching order items:', itemsError)
      return NextResponse.json({ 
        error: 'Failed to fetch order items', 
        details: itemsError.message 
      }, { status: 500 })
    }

    if (!orderItems || orderItems.length === 0) {
      return NextResponse.json({ error: 'No order items found for this order' }, { status: 404 })
    }

    // Get product IDs that belong to this supplier
    const productIds = orderItems.map(item => item.product_id).filter(Boolean)
    
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, supplier_id, user_id')
      .in('id', productIds)

    if (productsError) {
      logger.error('❌ Error fetching products:', productsError)
      return NextResponse.json({ 
        error: 'Failed to fetch products', 
        details: productsError.message 
      }, { status: 500 })
    }

    // Filter order items that belong to this supplier
    const supplierProductIds = new Set(
      products
        ?.filter(p => (p.supplier_id === supplierId || p.user_id === supplierId))
        .map(p => p.id) || []
    )

    const supplierOrderItemIds = orderItems
      .filter(item => supplierProductIds.has(item.product_id))
      .map(item => item.id)

    if (supplierOrderItemIds.length === 0) {
      return NextResponse.json({ 
        error: 'No order items found for this supplier in this order' 
      }, { status: 404 })
    }

    // Update all order items from this supplier with the tracking number
    const { data: updatedItems, error: updateError } = await supabase
      .from('order_items')
      .update({ 
        tracking_number: trackingNumber.trim()
      })
      .in('id', supplierOrderItemIds)
      .select('id, product_id, tracking_number')

    if (updateError) {
      logger.error('❌ Error updating tracking numbers:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update tracking numbers', 
        details: updateError.message 
      }, { status: 500 })
    }

    logger.log('✅ Tracking number assigned successfully:', {
      orderId: order.id,
      supplierId,
      trackingNumber,
      itemsUpdated: updatedItems?.length || 0
    })

    return NextResponse.json({
      success: true,
      message: `Tracking number assigned to ${updatedItems?.length || 0} order item(s)`,
      data: {
        orderId: order.id,
        supplierId,
        trackingNumber,
        itemsUpdated: updatedItems?.length || 0,
        updatedItems: updatedItems || []
      }
    })

  } catch (error: any) {
    logger.error('❌ Error in tracking number assignment:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 })
  }
}

/**
 * GET /api/admin/orders/items/tracking
 * Get tracking numbers for order items by supplier
 * 
 * Query params:
 * - orderId: string (UUID) | orderNumber: string
 */
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const supabase = getSupabaseClient()
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')
    const orderNumber = searchParams.get('orderNumber')

    if (!orderId && !orderNumber) {
      return NextResponse.json({ error: 'Either orderId or orderNumber is required' }, { status: 400 })
    }

    // Find the order
    let order
    if (orderId) {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('id', orderId)
        .single()

      if (orderError || !orderData) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      order = orderData
    } else {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', orderNumber)
        .single()

      if (orderError || !orderData) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      order = orderData
    }

    // Get all order items with their products and tracking numbers
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        id,
        product_id,
        tracking_number,
        products!inner (
          id,
          supplier_id,
          user_id
        )
      `)
      .eq('order_id', order.id)

    if (itemsError) {
      return NextResponse.json({ 
        error: 'Failed to fetch order items', 
        details: itemsError.message 
      }, { status: 500 })
    }

    // Group by supplier
    const supplierTrackingMap = new Map<string, {
      supplierId: string
      trackingNumber: string | null
      itemIds: string[]
      productIds: number[]
    }>()

    orderItems?.forEach((item: any) => {
      const product = item.products
      const supplierId = product?.supplier_id || product?.user_id
      
      if (supplierId) {
        const key = supplierId
        if (!supplierTrackingMap.has(key)) {
          supplierTrackingMap.set(key, {
            supplierId: key,
            trackingNumber: item.tracking_number,
            itemIds: [],
            productIds: []
          })
        }
        
        const entry = supplierTrackingMap.get(key)!
        entry.itemIds.push(item.id)
        entry.productIds.push(item.product_id)
        // If any item has a tracking number, use it (they should all be the same)
        if (item.tracking_number && !entry.trackingNumber) {
          entry.trackingNumber = item.tracking_number
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: Array.from(supplierTrackingMap.values())
    })

  } catch (error: any) {
    logger.error('❌ Error fetching tracking numbers:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 })
  }
}

