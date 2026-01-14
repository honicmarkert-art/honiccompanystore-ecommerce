import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schemas
const orderUpdateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'ready_for_pickup', 'picked_up']).optional(),
  confirmationStatus: z.string().optional(),
})

// PATCH /api/admin/orders/[orderId] - Update a specific order by database ID
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  return performanceMonitor.measure('admin_orders_patch', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/orders/[orderId]',
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

      logger.log('🔧 PATCH /api/admin/orders/[orderId] - Starting request')
      
      const { orderId } = await params
      logger.log('🔧 Order ID:', orderId)
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(orderId)) {
        return NextResponse.json({ error: 'Invalid order ID format' }, { status: 400 })
      }
      
      // Validate admin access first
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_orders_patch',
          endpoint: '/api/admin/orders/[orderId]'
        })
        return authError
      }
      logger.log('🔧 Auth successful, user:', user?.id)

      const supabase = createAdminSupabaseClient()

      if (!orderId) {
        return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
      }

      const body = await request.json()
      logger.log('🔧 Request body:', body)

      // Validate input with Zod
      let validatedData
      try {
        validatedData = orderUpdateSchema.parse(body)
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return NextResponse.json(
            { 
              error: 'Validation failed',
              details: validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            },
            { status: 400 }
          )
        }
        throw validationError
      }

      const { status, confirmationStatus } = validatedData

      if (!status && !confirmationStatus) {
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
        logError(updateError, {
          userId: user.id,
          action: 'admin_orders_patch',
          endpoint: '/api/admin/orders/[orderId]',
          metadata: { orderId }
        })
        return createErrorResponse(updateError, 500)
      }

      logger.log('🔧 Order updated successfully:', updatedOrder)

      // Log admin action
      logSecurityEvent('ORDER_UPDATED', user.id, {
        orderId,
        status,
        confirmationStatus,
        endpoint: '/api/admin/orders/[orderId]'
      })

      // Clear cache
      const { setCachedData } = await import('@/lib/database-optimization')
      setCachedData('admin_orders_all', null, 0)

      return NextResponse.json({
        success: true,
        order: updatedOrder,
        message: 'Order status updated successfully'
      })

    } catch (error) {
      logError(error, {
        action: 'admin_orders_patch',
        endpoint: '/api/admin/orders/[orderId]'
      })
      return createErrorResponse(error, 500)
    }
  })
}

// DELETE /api/admin/orders/[orderId] - Delete a specific order by database ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  return performanceMonitor.measure('admin_orders_delete', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/orders/[orderId]',
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

      const { orderId } = await params

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(orderId)) {
        return NextResponse.json({ error: 'Invalid order ID format' }, { status: 400 })
      }

      // Validate admin access first
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_orders_delete',
          endpoint: '/api/admin/orders/[orderId]'
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()

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
        logError(itemsError, {
          userId: user.id,
          action: 'admin_orders_delete',
          endpoint: '/api/admin/orders/[orderId]',
          metadata: { orderId }
        })
        return createErrorResponse(itemsError, 500)
      }

      // Delete the order
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)

      if (deleteError) {
        logError(deleteError, {
          userId: user.id,
          action: 'admin_orders_delete',
          endpoint: '/api/admin/orders/[orderId]',
          metadata: { orderId }
        })
        return createErrorResponse(deleteError, 500)
      }

      // Log admin action
      logSecurityEvent('ORDER_DELETED', user.id, {
        orderId,
        paymentStatus: order.payment_status,
        orderStatus: order.status,
        endpoint: '/api/admin/orders/[orderId]'
      })

      // Clear cache
      const { setCachedData } = await import('@/lib/database-optimization')
      setCachedData('admin_orders_all', null, 0)

      return NextResponse.json({ 
        success: true, 
        message: 'Order deleted successfully',
        deletedOrderId: orderId,
        paymentStatus: order.payment_status
      })

    } catch (error) {
      logError(error, {
        action: 'admin_orders_delete',
        endpoint: '/api/admin/orders/[orderId]'
      })
      return createErrorResponse(error, 500)
    }
  })
}
