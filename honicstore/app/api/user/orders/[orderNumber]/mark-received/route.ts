import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { sanitizeOrderNumber, validateOrderOwnership } from '@/lib/auth-utils'

// PATCH /api/user/orders/[orderNumber]/mark-received - Mark order as received
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/user/orders/[orderNumber]/mark-received',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }

    const { orderNumber: rawOrderNumber } = await params
    
    // Sanitize and validate order number
    const orderNumber = sanitizeOrderNumber(rawOrderNumber)
    if (!orderNumber) {
      return NextResponse.json({ error: 'Invalid order number format' }, { status: 400 })
    }
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.log('❌ Authentication failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!orderNumber) {
      return NextResponse.json({ error: 'Order number is required' }, { status: 400 })
    }

    // Find the confirmed order by order_number
    const { data: confirmedOrder, error: orderError } = await supabase
      .from('confirmed_orders')
      .select('id, user_id, is_received, status')
      .eq('order_number', orderNumber)
      .single()

    if (orderError) {
      logger.log('❌ Error fetching confirmed order:', {
        error: orderError,
        code: orderError.code,
        message: orderError.message,
        details: orderError.details,
        hint: orderError.hint
      })
      return NextResponse.json({ 
        error: 'Order not found', 
        details: orderError.message 
      }, { status: 404 })
    }

    if (!confirmedOrder) {
      logger.log('❌ Confirmed order not found for order number:', orderNumber)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    // Check if order is already received (read-only) - this should not happen but double-check
    if (confirmedOrder.is_received) {
      logger.log('⚠️ Order already marked as received (read-only):', {
        orderNumber,
        userId: user.id
      })
      return NextResponse.json({ 
        error: 'Order is already marked as received and is read-only',
        readOnly: true
      }, { status: 403 })
    }
    
    // Check if order is in a valid state to be marked as received
    if (confirmedOrder.status !== 'delivered' && confirmedOrder.status !== 'picked_up') {
      logger.log('❌ Order not in valid state to mark as received:', {
        orderNumber,
        currentStatus: confirmedOrder.status
      })
      return NextResponse.json({ 
        error: 'Order must be delivered or picked up before marking as received',
        currentStatus: confirmedOrder.status
      }, { status: 400 })
    }

    // Check user authorization - ensure the authenticated user owns this order
    if (!validateOrderOwnership(confirmedOrder.user_id, user.id)) {
      logger.log('❌ Unauthorized access attempt:', { 
        orderUserId: confirmedOrder.user_id, 
        requestUserId: user.id 
      })
      logSecurityEvent('UNAUTHORIZED_ORDER_UPDATE', {
        endpoint: '/api/user/orders/[orderNumber]/mark-received',
        orderNumber: orderNumber,
        orderUserId: confirmedOrder.user_id,
        requestUserId: user.id
      }, request)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if already received - order becomes read-only after being marked as received
    if (confirmedOrder.is_received) {
      logger.log('⚠️ Attempt to update read-only order:', {
        orderNumber,
        userId: user.id
      })
      return NextResponse.json({ 
        success: true, 
        message: 'Order already marked as received and is now read-only',
        alreadyReceived: true,
        readOnly: true
      })
    }

    // Update the order to mark as received
    logger.log('🔄 Attempting to update confirmed order:', {
      orderId: confirmedOrder.id,
      orderNumber,
      userId: user.id,
      orderUserId: confirmedOrder.user_id,
      currentStatus: confirmedOrder.status,
      isReceived: confirmedOrder.is_received
    })
    
    const { data: updatedOrder, error: updateError } = await supabase
      .from('confirmed_orders')
      .update({
        is_received: true,
        received_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', confirmedOrder.id)
      .select('is_received, received_at')
      .single()

    if (updateError) {
      logger.log('❌ Error marking order as received:', {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        orderId: confirmedOrder.id,
        orderNumber,
        userId: user.id
      })
      return NextResponse.json(
        { 
          error: 'Failed to mark order as received', 
          details: updateError.message,
          code: updateError.code,
          hint: updateError.hint
        },
        { status: 500 }
      )
    }
    
    if (!updatedOrder) {
      logger.log('❌ Update succeeded but no data returned')
      return NextResponse.json(
        { error: 'Update succeeded but no data returned' },
        { status: 500 }
      )
    }

    logger.log('✅ Order marked as received:', orderNumber)
    return NextResponse.json({
      success: true,
      message: 'Order marked as received',
      is_received: updatedOrder.is_received,
      received_at: updatedOrder.received_at
    })

  } catch (error: any) {
    logger.log('❌ Error marking order as received:', {
      error,
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    })
    console.error('❌ [MARK-RECEIVED] Full error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error?.message || 'Unknown error',
        type: error?.name || 'Error'
      },
      { status: 500 }
    )
  }
}

