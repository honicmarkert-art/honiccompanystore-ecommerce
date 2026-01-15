import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { decrementStockForOrderItem } from '@/lib/stock-decrement'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { buildUrl } from '@/lib/url-utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schema
const paymentUpdateSchema = z.object({
  paymentStatus: z.enum(['paid', 'failed', 'pending']),
  paymentId: z.string().optional(),
  paymentMethod: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  return performanceMonitor.measure('admin_orders_payment_patch', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/orders/[orderId]/payment',
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
      // Validate admin access first
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_orders_payment_patch',
          endpoint: '/api/admin/orders/[orderId]/payment'
        })
        return authError
      }

      const body = await request.json()

      // Validate input with Zod
      let validatedData
      try {
        validatedData = paymentUpdateSchema.parse(body)
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

      const { paymentStatus, paymentId, paymentMethod } = validatedData
    
      const supabase = createAdminSupabaseClient()
    
    // Update order payment status using orderId as reference_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .update({
        payment_status: paymentStatus,
        payment_id: paymentId || null,
        payment_method: paymentMethod || null,
        updated_at: new Date().toISOString(),
      })
      .eq('reference_id', orderId)
      .select()
      .single()

      if (orderError) {
        logError(orderError, {
          userId: user.id,
          action: 'admin_orders_payment_patch',
          endpoint: '/api/admin/orders/[orderId]/payment',
          metadata: { orderId }
        })
        return createErrorResponse(orderError, 500)
      }

      if (!order) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        )
      }

    // Send notification and reduce stock if payment is successful (only if not already reduced)
    if (paymentStatus === 'paid' && order.payment_status !== 'paid' && order.payment_status !== 'success') {
      await sendPaymentConfirmation(order)
      
      // Reduce stock quantities for paid orders
      try {
        logger.log('📦 Reducing stock for admin-confirmed paid order:', order.id)
        
        // Get order items to reduce stock (simplified variant system)
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, quantity, variant_id, variant_name')
          .eq('order_id', order.id)

        if (itemsError) {
          logger.log('❌ Error fetching order items for stock reduction:', itemsError)
        } else if (orderItems && orderItems.length > 0) {
          // Reduce stock for each item using simplified variant system
          for (const item of orderItems) {
            try {
              // Use simplified variant system: decrement variant stock_quantity AND product stock_quantity
              await decrementStockForOrderItem(supabase, {
                product_id: item.product_id,
                variant_id: item.variant_id || null,
                variant_name: item.variant_name || null,
                quantity: item.quantity
              })
            } catch (stockError) {
              logger.log('❌ Error in stock reduction for product:', item.product_id, stockError)
            }
          }
        }
      } catch (stockReductionError) {
        logger.log('❌ Error in stock reduction process:', stockReductionError)
      }
    }

      // Log admin action
      logSecurityEvent('ORDER_PAYMENT_UPDATED', user.id, {
        orderId: order.id,
        referenceId: order.reference_id,
        paymentStatus,
        endpoint: '/api/admin/orders/[orderId]/payment'
      })

      // Clear cache
      const { setCachedData } = await import('@/lib/database-optimization')
      setCachedData('admin_orders_all', null, 0)

      return NextResponse.json({
        success: true,
        order: {
          referenceId: order.reference_id,
          pickupId: order.pickup_id,
          paymentStatus: order.payment_status,
          status: order.status,
        },
      })

    } catch (error) {
      logError(error, {
        action: 'admin_orders_payment_patch',
        endpoint: '/api/admin/orders/[orderId]/payment'
      })
      return createErrorResponse(error, 500)
    }
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  return performanceMonitor.measure('admin_orders_payment_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/orders/[orderId]/payment',
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
      // Validate admin access first
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_orders_payment_get',
          endpoint: '/api/admin/orders/[orderId]/payment'
        })
        return authError
      }

    const supabase = createAdminSupabaseClient()
    
    // Get order payment status using orderId as reference_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('reference_id, pickup_id, payment_status, status, total_amount')
      .eq('reference_id', orderId)
      .single()

    if (orderError) {
      return NextResponse.json(
        { error: 'Failed to fetch payment status' },
        { status: 500 }
      )
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      order: {
        referenceId: order.reference_id,
        pickupId: order.pickup_id,
        paymentStatus: order.payment_status,
        status: order.status,
        totalAmount: order.total_amount,
      },
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
  })
}

// Function to send payment confirmation
async function sendPaymentConfirmation(order: any) {
  try {
    const { sendOrderConfirmationEmail } = await import('@/lib/user-email-service')
    const supabase = createAdminSupabaseClient()
    
    // Get customer email - Priority: logged-in user's email, then shipping/billing email
    let customerEmail: string | null = null
    
    // First, try to get email from logged-in user account
    if (order.user_id) {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(order.user_id)
      if (authUser?.email) {
        customerEmail = authUser.email
      }
    }
    
    // Fallback to shipping/billing email if no user account email
    if (!customerEmail) {
      customerEmail = order.shipping_address?.email || 
                     order.billing_address?.email || 
                     order.user_email ||
                     null
    }
    
    if (!customerEmail) {
      logger.warn('No customer email found for order confirmation:', order.id)
      return { success: false, error: 'No customer email' }
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

    // Send order confirmation email
    const emailResult = await sendOrderConfirmationEmail(customerEmail, {
      orderNumber: order.order_number || order.id.toString(),
      orderDate: new Date(order.created_at || Date.now()).toLocaleDateString(),
      items,
      subtotal,
      shipping,
      tax,
      total,
      shippingAddress: order.shipping_address || {},
      billingAddress: order.billing_address,
      paymentMethod: order.payment_method || 'ClickPesa',
      trackingUrl: order.tracking_url || buildUrl(`/account/orders/${order.order_number || order.id}`),
      invoiceUrl: buildUrl(`/api/user/orders/${order.order_number || order.id}/invoice`)
    })

    if (!emailResult.success) {
      logger.error('Failed to send order confirmation email:', emailResult.error)
    }

    return emailResult
  } catch (error: any) {
    logger.error('Error in sendPaymentConfirmation:', error)
    return { success: false, error: error.message }
  }
}



