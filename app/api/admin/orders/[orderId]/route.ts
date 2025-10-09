import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/admin-auth'
import { getSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// PATCH /api/admin/orders/[orderId] - Update a specific order by database ID
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    logger.log('🔧 PATCH /api/admin/orders/[orderId] - Starting request')
    
    const { orderId } = await params
    logger.log('🔧 Order ID:', orderId)
    
    // Validate admin access first
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      logger.log('🔧 Auth error:', authError)
      return authError
    }
    logger.log('🔧 Auth successful, user:', user?.id)

    const supabase = getSupabaseClient()

    if (!orderId) {
      logger.log('🔧 No order ID provided')
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    const body = await request.json()
    logger.log('🔧 Request body:', body)
    const { status, confirmationStatus } = body

    if (!status && !confirmationStatus) {
      logger.log('🔧 No status or confirmationStatus provided')
      return NextResponse.json({ error: 'Status or confirmationStatus is required' }, { status: 400 })
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    if (status) {
      updateData.status = status
    }
    
    if (confirmationStatus) {
      updateData.confirmation_status = confirmationStatus
    }

    logger.log('🔧 Update data:', updateData)

    // Update the order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      console.error('🔧 Error updating order status:', updateError)
      return NextResponse.json({ error: 'Failed to update order status', details: updateError.message }, { status: 500 })
    }

    logger.log('🔧 Order updated successfully:', updatedOrder)

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: 'Order status updated successfully'
    })

  } catch (error) {
    console.error('🔧 Error in PATCH /api/admin/orders/[orderId]:', error)
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// DELETE /api/admin/orders/[orderId] - Delete a specific order by database ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    // Validate admin access first
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const { client: supabase, error: envError } = getAdminClient()
    if (envError) {
      return NextResponse.json({ error: 'Server not configured', details: envError }, { status: 500 })
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    // First, check if the order exists and get its payment status
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, payment_status, status')
      .eq('id', orderId)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Allow deletion of failed, unpaid, pending orders, or confirmed orders (for clearing confirmed orders)
    const allowedPaymentStatuses = ['failed', 'unpaid', 'pending', 'paid']
    const allowedOrderStatuses = ['failed', 'unpaid', 'pending', 'confirmed', 'ready_for_pickup']
    
    if (!allowedPaymentStatuses.includes(order.payment_status) || 
        !allowedOrderStatuses.includes(order.status)) {
      return NextResponse.json({ 
        error: 'Cannot delete order', 
        message: 'Only failed, unpaid, pending, or confirmed orders can be deleted' 
      }, { status: 400 })
    }

    // Delete order items first (due to foreign key constraints)
    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId)

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to delete order items' }, { status: 500 })
    }

    // Delete the order
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Order deleted successfully',
      deletedOrderId: orderId,
      paymentStatus: order.payment_status
    })

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}




