import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Simple authentication check - you can add a secret key for security
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET || 'default-secret'
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await import('@/lib/supabase-server').then(m => m.getSupabaseClient())

    // Calculate 1 day ago timestamp
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    const oneDayAgoISO = oneDayAgo.toISOString()

    logger.log('🧹 Cron: Starting automatic order cleanup for orders older than:', oneDayAgoISO)

    // Find unpaid orders older than 1 day
    const { data: expiredOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id, order_number, created_at, payment_status')
      .eq('payment_status', 'unpaid')
      .lt('created_at', oneDayAgoISO)

    if (fetchError) {
      console.error('❌ Cron: Error fetching expired orders:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch expired orders', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      logger.log('✅ Cron: No expired orders found')
      return NextResponse.json({
        success: true,
        message: 'No expired orders found',
        deletedCount: 0
      })
    }

    logger.log(`🗑️ Cron: Found ${expiredOrders.length} expired orders to delete`)

    // Get order IDs for deletion
    const orderIds = expiredOrders.map(order => order.id)

    // Delete order items first (due to foreign key constraints)
    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .in('order_id', orderIds)

    if (itemsError) {
      console.error('❌ Cron: Error deleting order items:', itemsError)
      return NextResponse.json(
        { error: 'Failed to delete order items', details: itemsError.message },
        { status: 500 }
      )
    }

    // Delete orders
    const { error: ordersError } = await supabase
      .from('orders')
      .delete()
      .in('id', orderIds)

    if (ordersError) {
      console.error('❌ Cron: Error deleting orders:', ordersError)
      return NextResponse.json(
        { error: 'Failed to delete orders', details: ordersError.message },
        { status: 500 }
      )
    }

    logger.log(`✅ Cron: Successfully deleted ${expiredOrders.length} expired orders`)

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${expiredOrders.length} expired orders`,
      deletedCount: expiredOrders.length,
      deletedOrders: expiredOrders.map(order => ({
        id: order.id,
        order_number: order.order_number,
        created_at: order.created_at
      }))
    })

  } catch (error) {
    console.error('❌ Cron: Order cleanup error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}





