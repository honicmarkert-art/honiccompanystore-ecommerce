import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/admin/orders/cleanup - Manual cleanup of old orders
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_orders_cleanup_post', async () => {
    try {
      // Rate limiting (stricter for cleanup operations)
      const rateLimitResult = enhancedRateLimit(request, { max: 10, window: 60000 }) // 10 per minute
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/orders/cleanup',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
            }
          }
        )
      }

      // Validate admin access first
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_orders_cleanup_post',
          endpoint: '/api/admin/orders/cleanup'
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()

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
        logError(pendingError, {
          userId: user.id,
          action: 'admin_orders_cleanup_post',
          endpoint: '/api/admin/orders/cleanup'
        })
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
            logError(updateError, {
              userId: user.id,
              action: 'admin_orders_cleanup_post',
              endpoint: '/api/admin/orders/cleanup'
            })
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
        logError(failedError, {
          userId: user.id,
          action: 'admin_orders_cleanup_post',
          endpoint: '/api/admin/orders/cleanup'
        })
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
            logError(deleteItemsError, {
              userId: user.id,
              action: 'admin_orders_cleanup_post',
              endpoint: '/api/admin/orders/cleanup'
            })
          } else {
            logger.log(`✅ Deleted order items for ${failedOrders.length} orders`)
          }

          // Then delete the orders
          const { error: deleteOrdersError } = await supabase
            .from('orders')
            .delete()
            .in('id', orderIds)

          if (deleteOrdersError) {
            logError(deleteOrdersError, {
              userId: user.id,
              action: 'admin_orders_cleanup_post',
              endpoint: '/api/admin/orders/cleanup'
            })
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

      // Log admin action
      logSecurityEvent('ORDERS_CLEANUP_EXECUTED', user.id, {
        failedCount,
        deletedCount,
        totalProcessed,
        endpoint: '/api/admin/orders/cleanup'
      })

      // Clear cache
      const { setCachedData } = await import('@/lib/database-optimization')
      setCachedData('admin_orders_all', null, 0)

      return NextResponse.json({
        success: true,
        message: 'Order cleanup completed successfully',
        failedCount,
        deletedCount,
        totalProcessed,
        timestamp: now.toISOString()
      })

    } catch (error) {
      logError(error, {
        action: 'admin_orders_cleanup_post',
        endpoint: '/api/admin/orders/cleanup'
      })
      return createErrorResponse(error, 500)
    }
  })
}
