import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { validateServerSession } from '@/lib/security-server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/admin/cleanup-failed-orders - Manual cleanup of failed orders
export async function POST(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateServerSession(request)
    if (!session || !(session.role === 'admin' || session.role === 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.log('🧹 Manual cleanup of failed orders triggered by admin:', session.user?.id)

    // Use admin client to run cleanup function
    const adminClient = createAdminSupabaseClient()
    
    const { data, error } = await adminClient
      .rpc('manual_cleanup_failed_orders')

    if (error) {
      logger.log('❌ Cleanup function error:', error)
      return NextResponse.json(
        { error: 'Failed to run cleanup', details: error.message },
        { status: 500 }
      )
    }

    logger.log('✅ Cleanup completed successfully:', data)

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed successfully',
      ...data
    })

  } catch (error: any) {
    logger.log('❌ Cleanup API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// GET /api/admin/cleanup-failed-orders - Check failed orders status
export async function GET(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateServerSession(request)
    if (!session || !(session.role === 'admin' || session.role === 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      logger.log('❌ Failed to fetch failed orders:', error)
      return NextResponse.json(
        { error: 'Failed to fetch failed orders', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      failed_orders_count: failedOrders?.length || 0,
      failed_orders: failedOrders || [],
      cleanup_threshold: '1 month',
      last_checked: new Date().toISOString()
    })

  } catch (error: any) {
    logger.log('❌ Failed orders check error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
