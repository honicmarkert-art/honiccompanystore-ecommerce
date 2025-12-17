import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { sendRefundConfirmationEmail } from '@/lib/user-email-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/admin/orders/[orderId]/refund - Process refund and send confirmation email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    
    // Validate admin access
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    const { 
      refundAmount, 
      refundMethod = 'Original payment method',
      refundTimeline = '5-7 business days',
      transactionId,
      notes
    } = body

    if (!refundAmount || refundAmount <= 0) {
      return NextResponse.json({ error: 'Valid refund amount is required' }, { status: 400 })
    }

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
      logger.error('Error updating order status:', updateError)
      return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
    }

    // Get customer email - Priority: logged-in user's email, then shipping/billing email
    let customerEmail: string | null = null
    
    // First, try to get email from logged-in user account
    const orderUserId = (order.orders as any)?.user_id || order.user_id
    if (orderUserId) {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const adminSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          }
        )
        const { data: { user: authUser } } = await adminSupabase.auth.admin.getUserById(orderUserId)
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
    logger.error('Error processing refund:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



