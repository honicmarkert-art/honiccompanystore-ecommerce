import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'

function getAdminClient() {
  try {
    return { client: createAdminSupabaseClient(), error: null as string | null }
  } catch (error: any) {
    return { client: null as any, error: error.message }
  }
}

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

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago

    logger.log('🧹 Starting order cleanup process...')
    logger.log('Current time:', now.toISOString())
    logger.log('1 hour ago:', oneHourAgo.toISOString())
    logger.log('24 hours ago:', twentyFourHoursAgo.toISOString())

    let totalProcessed = 0
    let failedCount = 0
    let deletedCount = 0

    // Step 1: Mark pending payments as failed after 1 hour
    logger.log('📝 Step 1: Marking pending payments as failed (older than 1 hour)...')
    
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('orders')
      .select('id, order_number, created_at, payment_status')
      .eq('payment_status', 'pending')
      .lt('created_at', oneHourAgo.toISOString())

    if (pendingError) {
      console.error('Error fetching pending orders:', pendingError)
    } else {
      logger.log(`Found ${pendingOrders?.length || 0} pending orders older than 1 hour`)
      
      if (pendingOrders && pendingOrders.length > 0) {
        const orderIds = pendingOrders.map(order => order.id)
        
        const { error: updateError } = await supabase
          .from('orders')
          .update({ 
            payment_status: 'failed',
            updated_at: now.toISOString()
          })
          .in('id', orderIds)

        if (updateError) {
          console.error('Error updating pending orders to failed:', updateError)
        } else {
          failedCount = pendingOrders.length
          logger.log(`✅ Marked ${failedCount} orders as failed`)
        }
      }
    }

    // Step 2: Delete failed orders after 24 hours
    logger.log('🗑️ Step 2: Deleting failed orders (older than 24 hours)...')
    
    const { data: failedOrders, error: failedError } = await supabase
      .from('orders')
      .select('id, order_number, created_at, payment_status')
      .eq('payment_status', 'failed')
      .lt('created_at', twentyFourHoursAgo.toISOString())

    if (failedError) {
      console.error('Error fetching failed orders:', failedError)
    } else {
      logger.log(`Found ${failedOrders?.length || 0} failed orders older than 24 hours`)
      
      if (failedOrders && failedOrders.length > 0) {
        const orderIds = failedOrders.map(order => order.id)
        
        // First delete order items (due to foreign key constraints)
        const { error: deleteItemsError } = await supabase
          .from('order_items')
          .delete()
          .in('order_id', orderIds)

        if (deleteItemsError) {
          console.error('Error deleting order items:', deleteItemsError)
        } else {
          logger.log(`✅ Deleted order items for ${failedOrders.length} orders`)
        }

        // Then delete the orders
        const { error: deleteOrdersError } = await supabase
          .from('orders')
          .delete()
          .in('id', orderIds)

        if (deleteOrdersError) {
          console.error('Error deleting failed orders:', deleteOrdersError)
        } else {
          deletedCount = failedOrders.length
          logger.log(`✅ Deleted ${deletedCount} failed orders`)
        }
      }
    }

    totalProcessed = failedCount + deletedCount

    logger.log('🎉 Cleanup completed!')
    logger.log(`- Orders marked as failed: ${failedCount}`)
    logger.log(`- Orders deleted: ${deletedCount}`)
    logger.log(`- Total processed: ${totalProcessed}`)

    return NextResponse.json({
      success: true,
      message: 'Order cleanup completed successfully',
      failedCount,
      deletedCount,
      totalProcessed,
      timestamp: now.toISOString()
    })

  } catch (error) {
    console.error('Order cleanup error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}