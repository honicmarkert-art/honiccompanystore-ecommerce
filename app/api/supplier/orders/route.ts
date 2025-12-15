import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/supplier/orders - Fetch orders with supplier's products only
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/supplier/orders',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { success: false, error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is a supplier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_supplier')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_supplier) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Supplier access required.' },
        { status: 403 }
      )
    }

    // First, get all product IDs owned by this supplier
    const { data: supplierProducts, error: productsError } = await supabase
      .from('products')
      .select('id')
      .or(`user_id.eq.${user.id},supplier_id.eq.${user.id}`)

    if (productsError) {
      console.error('Error fetching supplier products:', productsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch supplier products' },
        { status: 500 }
      )
    }

    if (!supplierProducts || supplierProducts.length === 0) {
      // No products owned by supplier, return empty orders
      return NextResponse.json({
        success: true,
        orders: []
      })
    }

    const supplierProductIds = supplierProducts.map(p => p.id)

    // Fetch confirmed order items that belong to supplier's products
    const { data: supplierOrderItems, error: itemsError } = await supabase
      .from('confirmed_order_items')
      .select(`
        id,
        confirmed_order_id,
        product_id,
        product_name,
        variant_id,
        variant_name,
        quantity,
        price,
        total_price,
        status,
        tracking_number,
        created_at
      `)
      .in('product_id', supplierProductIds)

    if (itemsError) {
      console.error('Error fetching order items:', itemsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch order items' },
        { status: 500 }
      )
    }

    if (!supplierOrderItems || supplierOrderItems.length === 0) {
      // No order items for supplier's products
      return NextResponse.json({
        success: true,
        orders: []
      })
    }

    // Get unique confirmed_order_ids
    const orderIds = [...new Set(supplierOrderItems.map(item => item.confirmed_order_id))]

    // Fetch confirmed orders
    const { data: orders, error: ordersError } = await supabase
      .from('confirmed_orders')
      .select(`
        id,
        order_number,
        reference_id,
        pickup_id,
        user_id,
        shipping_address,
        billing_address,
        delivery_option,
        total_amount,
        payment_method,
        payment_status,
        status,
        confirmed_by,
        confirmed_at,
        created_at,
        updated_at
      `)
      .in('id', orderIds)
      .order('confirmed_at', { ascending: false })

    if (ordersError) {
      console.error('Error fetching confirmed orders:', ordersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch orders' },
        { status: 500 }
      )
    }

    // Group order items by confirmed_order_id
    const itemsByOrderId = new Map<string, typeof supplierOrderItems>()
    supplierOrderItems.forEach(item => {
      const orderId = item.confirmed_order_id
      if (!itemsByOrderId.has(orderId)) {
        itemsByOrderId.set(orderId, [])
      }
      itemsByOrderId.get(orderId)!.push(item)
    })

    // Combine orders with their items
    const supplierOrders = (orders || []).map(order => {
      const supplierItems = itemsByOrderId.get(order.id) || []
      const supplierTotal = supplierItems.reduce(
        (sum: number, item: any) => sum + (item.total_price || 0),
        0
      )
      const supplierItemsCount = supplierItems.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0
      )

      return {
        id: order.id,
        order_number: order.order_number,
        reference_id: order.reference_id,
        pickup_id: order.pickup_id,
        user_id: order.user_id,
        shipping_address: order.shipping_address,
        billing_address: order.billing_address,
        delivery_option: order.delivery_option,
        total_amount: order.total_amount, // Original order total
        supplier_total: supplierTotal, // Total for supplier's items only
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        status: order.status,
        confirmed_by: order.confirmed_by,
        confirmed_at: order.confirmed_at,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: supplierItems, // Only supplier's items
        items_count: supplierItemsCount, // Count of supplier's items
        total_items: supplierItems.length // Number of different items
      }
    })

    return NextResponse.json({
      success: true,
      orders: supplierOrders
    })

  } catch (error: any) {
    console.error('Error in supplier orders API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

