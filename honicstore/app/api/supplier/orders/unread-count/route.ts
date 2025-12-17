import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/supplier/orders/unread-count - Get count of unread orders for supplier
export async function GET(request: NextRequest) {
  try {
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

    // Get all product IDs owned by this supplier
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
      return NextResponse.json({
        success: true,
        unreadCount: 0
      })
    }

    const supplierProductIds = supplierProducts.map(p => p.id)

    // Get confirmed orders with supplier's products that were created in the last 24 hours
    // (considering them as "new" orders)
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    // Fetch confirmed order items that belong to supplier's products
    const { data: supplierOrderItems, error: itemsError } = await supabase
      .from('confirmed_order_items')
      .select('confirmed_order_id')
      .in('product_id', supplierProductIds)

    if (itemsError) {
      console.error('Error fetching order items:', itemsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch order items' },
        { status: 500 }
      )
    }

    if (!supplierOrderItems || supplierOrderItems.length === 0) {
      return NextResponse.json({
        success: true,
        unreadCount: 0
      })
    }

    // Get unique confirmed_order_ids
    const orderIds = [...new Set(supplierOrderItems.map(item => item.confirmed_order_id))]

    // Count orders created in the last 24 hours
    const { count, error: countError } = await supabase
      .from('confirmed_orders')
      .select('*', { count: 'exact', head: true })
      .in('id', orderIds)
      .gte('confirmed_at', twentyFourHoursAgo.toISOString())

    if (countError) {
      console.error('Error counting orders:', countError)
      return NextResponse.json(
        { success: false, error: 'Failed to count orders' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      unreadCount: count || 0
    })

  } catch (error: any) {
    console.error('Error in supplier orders unread count API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}









