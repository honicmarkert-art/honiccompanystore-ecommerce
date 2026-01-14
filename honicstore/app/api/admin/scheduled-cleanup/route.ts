import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/admin/scheduled-cleanup - Scheduled cleanup (can be called by cron jobs)
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_scheduled_cleanup_post', async () => {
    try {
      // Verify this is a scheduled request
      const authHeader = request.headers.get('authorization')
      const expectedToken = process.env.CLEANUP_SCHEDULED_TOKEN || 'scheduled-cleanup-token'
      
      if (authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      logger.log('🕐 Scheduled cleanup triggered')

      // Use admin client to run cleanup function
      const adminClient = createAdminSupabaseClient()
      
      const { data, error } = await adminClient
        .rpc('schedule_daily_cleanup')

      if (error) {
        logError(error, {
          action: 'admin_scheduled_cleanup_post',
          endpoint: '/api/admin/scheduled-cleanup'
        })
        return NextResponse.json(
          { error: 'Failed to run scheduled cleanup', details: error.message },
          { status: 500 }
        )
      }

      logger.log('✅ Scheduled cleanup completed successfully')

      return NextResponse.json({
        success: true,
        message: 'Scheduled cleanup completed successfully',
        timestamp: new Date().toISOString(),
        ...data
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_scheduled_cleanup_post',
        endpoint: '/api/admin/scheduled-cleanup'
      })
      return createErrorResponse(error, 500)
    }
  })
}

// GET /api/admin/scheduled-cleanup - Health check for scheduled cleanup
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_scheduled_cleanup_get', async () => {
    try {
      // Verify this is a health check request
      const authHeader = request.headers.get('authorization')
      const expectedToken = process.env.CLEANUP_SCHEDULED_TOKEN || 'scheduled-cleanup-token'
      
      if (authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      return NextResponse.json({
        success: true,
        message: 'Scheduled cleanup service is running',
        timestamp: new Date().toISOString(),
        status: 'healthy'
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_scheduled_cleanup_get',
        endpoint: '/api/admin/scheduled-cleanup'
      })
      return createErrorResponse(error, 500)
    }
  })
}
