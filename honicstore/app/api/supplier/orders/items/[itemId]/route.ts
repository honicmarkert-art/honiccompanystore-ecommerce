import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PATCH /api/supplier/orders/items/[itemId] - Update order item status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params

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
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      )
    }
    // Validate status value
    const validStatuses = ['confirmed', 'shipped', 'delivered', 'picked_up', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }
    // First, verify that the item belongs to a product owned by this supplier
    const { data: orderItem, error: itemError } = await supabase
      .from('confirmed_order_items')
      .select(`
        id,
        product_id,
        status,
        confirmed_order_id
      `)
      .eq('id', itemId)
      .single()

    if (itemError || !orderItem) {
      return NextResponse.json(
        { success: false, error: 'Order item not found' },
        { status: 404 }
      )
    }
    // Check if the product belongs to this supplier
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, user_id, supplier_id')
      .eq('id', orderItem.product_id)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }
    // Verify ownership
    if (product.user_id !== user.id && product.supplier_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied. You do not own this product.' },
        { status: 403 }
      )
    }
    // Validate status transition
    const currentStatus = orderItem.status
    const validTransitions: Record<string, string[]> = {
      'confirmed': ['shipped', 'cancelled'], // Suppliers can mark as 'shipped' first
      'shipped': ['delivered'], // Then mark as 'delivered'
      'delivered': [], // Final state for suppliers
      'picked_up': [], // Final state (customer action)
      'cancelled': [] // Final state
    }
    if (!validTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status transition. Cannot change from '${currentStatus}' to '${status}'. Valid transitions: ${validTransitions[currentStatus]?.join(', ') || 'none'}`
        },
        { status: 400 }
      )
    }
    // Get delivery option from confirmed_order to determine correct final status
    const { data: confirmedOrder, error: orderError } = await supabase
      .from('confirmed_orders')
      .select('delivery_option')
      .eq('id', orderItem.confirmed_order_id)
      .single()

    // Suppliers always mark as 'delivered' regardless of delivery option
    // For pickup orders, customer will mark as 'picked_up' later
    let finalStatus = status
    // Don't convert 'delivered' to 'picked_up' for suppliers - they always use 'delivered'
    if (status === 'picked_up' && confirmedOrder?.delivery_option === 'shipping') {
      finalStatus = 'delivered'
    }
    // IMPORTANT: Find ALL items from this supplier in this order
    // Get all products owned by this supplier
    const { data: supplierProducts, error: supplierProductsError } = await supabase
      .from('products')
      .select('id')
      .or(`user_id.eq.${user.id},supplier_id.eq.${user.id}`)

    if (supplierProductsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch supplier products' },
        { status: 500 }
      )
    }
    const supplierProductIds = supplierProducts?.map(p => p.id) || []

    if (supplierProductIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No products found for this supplier' },
        { status: 404 }
      )
    }
    // Find ALL confirmed_order_items from this supplier in this order
    // that can be updated to the new status
    const { data: allSupplierItems, error: allItemsError } = await supabase
      .from('confirmed_order_items')
      .select('id, status, product_id')
      .eq('confirmed_order_id', orderItem.confirmed_order_id)
      .in('product_id', supplierProductIds)

    if (allItemsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch supplier items', details: allItemsError.message },
        { status: 500 }
      )
    }
    // Filter items that can be updated to the new status
    // Use the same validTransitions as the initial validation
    const itemsToUpdate = (allSupplierItems || []).filter(item => {
      const currentItemStatus = item.status || 'confirmed'
      const validTransitions: Record<string, string[]> = {
        'confirmed': ['shipped', 'cancelled'],
        'shipped': ['delivered'], // Suppliers always mark as 'delivered', not 'picked_up'
        'delivered': [],
        'picked_up': [],
        'cancelled': []
      }
      return validTransitions[currentItemStatus]?.includes(finalStatus) || false
    })

    if (itemsToUpdate.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No items can be updated to this status' },
        { status: 400 }
      )
    }
    const itemIdsToUpdate = itemsToUpdate.map(item => item.id)

    // Update ALL items from this supplier in this order
    const { data: updatedItems, error: updateError } = await supabase
      .from('confirmed_order_items')
      .update({ status: finalStatus })
      .in('id', itemIdsToUpdate)
      .select('id, status, product_id, confirmed_order_id')

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to update items status', details: updateError.message },
        { status: 500 }
      )
    }
    return NextResponse.json({
      success: true,
      itemsUpdated: updatedItems?.length || 0,
      items: updatedItems,
      message: `Updated ${updatedItems?.length || 0} item(s) status to '${finalStatus}' successfully`
    })

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
