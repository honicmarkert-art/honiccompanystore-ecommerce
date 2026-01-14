import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/user-email-service'
import { sendRefundConfirmationEmail } from '@/lib/user-email-service'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schema
const refundSchema = z.object({
  refundAmount: z.number().positive('Refund amount must be positive'),
  refundMethod: z.string().optional(),
  refundTimeline: z.string().optional(),
  transactionId: z.string().optional(),
  notes: z.string().max(500).optional(),
})

// POST /api/admin/orders/[orderId]/refund - Process refund and send confirmation email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  return performanceMonitor.measure('admin_orders_refund_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/orders/[orderId]/refund',
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
      
      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_orders_refund_post',
          endpoint: '/api/admin/orders/[orderId]/refund'
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()
      const body = await request.json()

      // Validate input with Zod
      let validatedData
      try {
        validatedData = refundSchema.parse(body)
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

      const { 
        refundAmount, 
        refundMethod = 'Original payment method',
        refundTimeline = '5-7 business days',
        transactionId,
        notes
      } = validatedData

      // Get order details
      const { data: order, error: orderError } = await supabase
        .from('confirmed_orders')
        .select(`
          *,
          orders (
            shipping_address,
            billing_address,
            user_id
          )
        `)
        .eq('id', orderId)
        .single()

      if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      // Update order status to refunded
      const { error: updateError } = await supabase
        .from('confirmed_orders')
        .update({
          status: 'refunded',
          updated_at: new Date().toISOString(),
          notes: notes || `Refund processed: ${refundAmount} via ${refundMethod}`
        })
        .eq('id', orderId)

      if (updateError) {
        logError(updateError, {
          userId: user.id,
          action: 'admin_orders_refund_post',
          endpoint: '/api/admin/orders/[orderId]/refund',
          metadata: { orderId }
        })
        return createErrorResponse(updateError, 500)
      }

      // Get customer email - Priority: logged-in user's email, then shipping/billing email
      let customerEmail: string | null = null
      
      // First, try to get email from logged-in user account
      const orderUserId = (order.orders as any)?.user_id || order.user_id
      if (orderUserId) {
        try {
          const { data: { user: authUser } } = await supabase.auth.admin.getUserById(orderUserId)
          if (authUser?.email) {
            customerEmail = authUser.email
          }
        } catch (authError) {
          logger.warn('Failed to get user email from auth:', authError)
        }
      }
      
      // Fallback to shipping/billing email if no user account email
      if (!customerEmail) {
        const shippingAddress = typeof order.shipping_address === 'string' 
          ? JSON.parse(order.shipping_address) 
          : order.shipping_address
        const billingAddress = typeof order.billing_address === 'string'
          ? JSON.parse(order.billing_address)
          : order.billing_address
        customerEmail = shippingAddress?.email || billingAddress?.email || null
      }

      if (customerEmail) {
        try {
          // Send refund confirmation email
          await sendRefundConfirmationEmail(customerEmail, {
            orderNumber: order.order_number || orderId,
            refundAmount,
            refundMethod,
            refundTimeline,
            transactionId
          })

          // Log email
          await supabase
            .from('email_logs')
            .insert({
              user_id: order.user_id,
              email: customerEmail,
              email_type: 'refund_confirmation',
              subject: `Refund Processed for Order #${order.order_number || orderId}`,
              status: 'sent',
              metadata: {
                order_id: orderId,
                refund_amount: refundAmount,
                refund_method: refundMethod
              }
            })
        } catch (emailError) {
          logger.error('Error sending refund confirmation email:', emailError)
          // Don't fail the refund if email fails
        }
      }

      // Log admin action
      logSecurityEvent('ORDER_REFUND_PROCESSED', user.id, {
        orderId,
        refundAmount,
        refundMethod,
        endpoint: '/api/admin/orders/[orderId]/refund'
      })

      // Clear cache
      const { setCachedData } = await import('@/lib/database-optimization')
      setCachedData('admin_confirmed_orders_all', null, 0)

      return NextResponse.json({
        success: true,
        message: 'Refund processed successfully',
        refund: {
          amount: refundAmount,
          method: refundMethod,
          timeline: refundTimeline
        }
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_orders_refund_post',
        endpoint: '/api/admin/orders/[orderId]/refund'
      })
      return createErrorResponse(error, 500)
    }
  })
}
