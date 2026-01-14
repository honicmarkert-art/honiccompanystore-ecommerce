import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/admin/cleanup-failed-orders - Manual cleanup of failed orders
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_cleanup_failed_orders_post', async () => {
    try {
      // Rate limiting (stricter for cleanup operations)
      const rateLimitResult = enhancedRateLimit(request, { max: 10, window: 60000 }) // 10 per minute
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/cleanup-failed-orders',
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

      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_cleanup_failed_orders_post',
          endpoint: '/api/admin/cleanup-failed-orders'
        })
        return authError
      }

      logger.log('🧹 Manual cleanup of failed orders triggered by admin:', user.id)

      // Use admin client to run cleanup function
      const adminClient = createAdminSupabaseClient()
      
      const { data, error } = await adminClient
        .rpc('manual_cleanup_failed_orders')

      if (error) {
        logError(error, {
          userId: user.id,
          action: 'admin_cleanup_failed_orders_post',
          endpoint: '/api/admin/cleanup-failed-orders'
        })
        return createErrorResponse(error, 500)
      }

      logger.log('✅ Cleanup completed successfully:', data)

      // Log admin action
      logSecurityEvent('FAILED_ORDERS_CLEANUP_EXECUTED', user.id, {
        endpoint: '/api/admin/cleanup-failed-orders',
        result: data
      })

      return NextResponse.json({
        success: true,
        message: 'Cleanup completed successfully',
        ...data
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_cleanup_failed_orders_post',
        endpoint: '/api/admin/cleanup-failed-orders'
      })
      return createErrorResponse(error, 500)
    }
  })
}

// GET /api/admin/cleanup-failed-orders - Check failed orders status
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_cleanup_failed_orders_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/cleanup-failed-orders',
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

      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_cleanup_failed_orders_get',
          endpoint: '/api/admin/cleanup-failed-orders'
        })
        return authError
      }

      // Use admin client to check failed orders
      const adminClient = createAdminSupabaseClient()
      
      // Get count of failed orders older than 1 month
      const { data: failedOrders, error } = await adminClient
        .from('orders')
        .select('id, user_id, order_number, payment_status, created_at')
        .eq('payment_status', 'failed')
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // 1 month ago

      if (error) {
        logError(error, {
          userId: user.id,
          action: 'admin_cleanup_failed_orders_get',
          endpoint: '/api/admin/cleanup-failed-orders'
        })
        return createErrorResponse(error, 500)
      }

      return NextResponse.json({
        success: true,
        failed_orders_count: failedOrders?.length || 0,
        failed_orders: failedOrders || [],
        cleanup_threshold: '1 month',
        last_checked: new Date().toISOString()
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_cleanup_failed_orders_get',
        endpoint: '/api/admin/cleanup-failed-orders'
      })
      return createErrorResponse(error, 500)
    }
  })
}
