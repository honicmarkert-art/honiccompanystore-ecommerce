import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { buildUrl } from '@/lib/url-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/admin/orders/[orderId]/send-confirmation-email - Manually trigger order confirmation email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  return performanceMonitor.measure('admin_orders_send_confirmation_email_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/orders/[orderId]/send-confirmation-email',
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
      
      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_orders_send_confirmation_email_post',
          endpoint: '/api/admin/orders/[orderId]/send-confirmation-email'
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()
      
      // Get order by reference_id or order_number
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .or(`reference_id.eq.${orderId},order_number.eq.${orderId},id.eq.${orderId}`)
        .single()

      if (orderError || !order) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        )
      }

      // Check if order is paid
      if (order.payment_status !== 'paid' && order.payment_status !== 'success') {
        return NextResponse.json(
          { error: 'Order is not paid. Email will only be sent for paid orders.' },
          { status: 400 }
        )
      }

      // Send payment confirmation email
      const emailResult = await sendPaymentConfirmation(order, supabase)

      if (!emailResult.success) {
        logError(new Error(emailResult.error || 'Failed to send email'), {
          userId: user.id,
          action: 'admin_orders_send_confirmation_email_post',
          endpoint: '/api/admin/orders/[orderId]/send-confirmation-email',
          metadata: { orderId }
        })
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to send confirmation email', 
            details: emailResult.error 
          },
          { status: 500 }
        )
      }

      // Log admin action
      logSecurityEvent('CONFIRMATION_EMAIL_SENT', user.id, {
        orderId: order.id,
        orderNumber: order.order_number,
        endpoint: '/api/admin/orders/[orderId]/send-confirmation-email'
      })

      return NextResponse.json({
        success: true,
        message: 'Order confirmation email sent successfully',
        orderNumber: order.order_number || order.id
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_orders_send_confirmation_email_post',
        endpoint: '/api/admin/orders/[orderId]/send-confirmation-email'
      })
      return createErrorResponse(error, 500)
    }
  })
}

// Function to send payment confirmation
async function sendPaymentConfirmation(order: any, supabase: any) {
  try {
    const { sendOrderConfirmationEmail } = await import('@/lib/user-email-service')
    
    // Get customer email - Priority: logged-in user's email, then shipping/billing email
    let customerEmail: string | null = null
    
    // First, try to get email from logged-in user account
    if (order.user_id) {
      try {
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(order.user_id)
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
      customerEmail = shippingAddress?.email || 
                     billingAddress?.email || 
                     order.user_email ||
                     null
    }
    
    if (!customerEmail) {
      logger.warn('No customer email found for order confirmation:', order.id)
      return { success: false, error: 'No customer email found' }
    }

    // Get order items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('*, products(name, image)')
      .eq('order_id', order.id)

    const items = (orderItems || []).map((item: any) => ({
      name: item.product_name || item.products?.name || 'Product',
      quantity: item.quantity,
      price: item.price || 0, // Unit price
      totalPrice: item.total_price || (item.price || 0) * (item.quantity || 1), // Use total_price if available
      image: item.products?.image || item.product_image
    }))

    // Calculate totals - use total_price from database if available, otherwise calculate
    const subtotal = items.reduce((sum: number, item: any) => {
      // Use total_price from database (most accurate), fallback to price * quantity
      const itemTotal = item.totalPrice || (item.price * item.quantity) || 0
      return sum + itemTotal
    }, 0)
    const shipping = order.shipping_cost || 0
    const tax = order.tax_amount || 0
    const total = order.total_amount || (subtotal + shipping + tax)

    // Parse addresses
    const shippingAddress = typeof order.shipping_address === 'string' 
      ? JSON.parse(order.shipping_address) 
      : order.shipping_address
    const billingAddress = typeof order.billing_address === 'string'
      ? JSON.parse(order.billing_address)
      : order.billing_address

    // Send order confirmation email
    const emailResult = await sendOrderConfirmationEmail(customerEmail, {
      orderNumber: order.order_number || order.id.toString(),
      orderDate: new Date(order.created_at || Date.now()).toLocaleDateString(),
      items,
      subtotal,
      shipping,
      tax,
      total,
      shippingAddress: shippingAddress || {},
      billingAddress: billingAddress || shippingAddress || {},
      paymentMethod: order.payment_method || 'ClickPesa',
      trackingUrl: order.tracking_url || buildUrl(`/account/orders/${order.order_number || order.id}`),
      invoiceUrl: buildUrl(`/api/user/orders/${order.order_number || order.id}/invoice`)
    })

    if (!emailResult.success) {
      logger.error('Failed to send order confirmation email:', emailResult.error)
    } else {
      logger.log(`✅ Order confirmation email sent to ${customerEmail} for order ${order.order_number || order.id}`)
    }

    return emailResult
  } catch (error: any) {
    logger.error('Error in sendPaymentConfirmation:', error)
    return { success: false, error: error.message }
  }
}
