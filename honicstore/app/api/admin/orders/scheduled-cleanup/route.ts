import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/admin/orders/scheduled-cleanup - Scheduled cleanup (can be called by cron jobs)
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_orders_scheduled_cleanup_post', async () => {
    try {
      // Check for API key authentication (for external cron services)
      const authHeader = request.headers.get('authorization')
      const expectedKey = process.env.CLEANUP_API_KEY || 'default-cleanup-key'
      
      if (authHeader !== `Bearer ${expectedKey}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const supabase = createAdminSupabaseClient()

      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago

      logger.log('🤖 Scheduled cleanup running...')
      logger.log('Current time:', now.toISOString())

      let totalProcessed = 0
      let failedCount = 0
      let deletedCount = 0

      // Step 1: Mark pending payments as failed after 1 hour
      const { data: pendingOrders, error: pendingError } = await supabase
        .from('orders')
        .select('id, order_number, created_at, payment_status')
        .eq('payment_status', 'pending')
        .lt('created_at', oneHourAgo.toISOString())

      if (!pendingError && pendingOrders && pendingOrders.length > 0) {
        const orderIds = pendingOrders.map(order => order.id)
        
        const { error: updateError } = await supabase
          .from('orders')
          .update({ 
            payment_status: 'failed',
            updated_at: now.toISOString()
          })
          .in('id', orderIds)

        if (!updateError) {
          failedCount = pendingOrders.length
          logger.log(`✅ Scheduled: Marked ${failedCount} orders as failed`)
        } else {
          logError(updateError, {
            action: 'admin_orders_scheduled_cleanup_post',
            metadata: {
              endpoint: '/api/admin/orders/scheduled-cleanup'
            }
          })
        }
      }

      // Step 2: Delete failed orders after 24 hours
      const { data: failedOrders, error: failedError } = await supabase
        .from('orders')
        .select('id, order_number, created_at, payment_status')
        .eq('payment_status', 'failed')
        .lt('created_at', twentyFourHoursAgo.toISOString())

      if (!failedError && failedOrders && failedOrders.length > 0) {
        const orderIds = failedOrders.map(order => order.id)
        
        // Delete order items first
        await supabase
          .from('order_items')
          .delete()
          .in('order_id', orderIds)

        // Then delete orders
        const { error: deleteOrdersError } = await supabase
          .from('orders')
          .delete()
          .in('id', orderIds)

        if (!deleteOrdersError) {
          deletedCount = failedOrders.length
          logger.log(`✅ Scheduled: Deleted ${deletedCount} failed orders`)
        } else {
          logError(deleteOrdersError, {
            action: 'admin_orders_scheduled_cleanup_post',
            metadata: {
              endpoint: '/api/admin/orders/scheduled-cleanup'
            }
          })
        }
      }

      totalProcessed = failedCount + deletedCount

      return NextResponse.json({
        success: true,
        message: 'Scheduled cleanup completed',
        failedCount,
        deletedCount,
        totalProcessed,
        timestamp: now.toISOString()
      })

    } catch (error) {
      logError(error, {
        action: 'admin_orders_scheduled_cleanup_post',
        metadata: {
          endpoint: '/api/admin/orders/scheduled-cleanup'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}
