import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// GET /api/orders/[referenceId] - Get order details by reference ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> }
) {
  try {
    const { referenceId } = await params
    const supabase = getSupabaseClient()
    // Normalize: DB stores reference_id without hyphens, lowercase
    const normalizedRef = referenceId.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
    
    // Also try the original reference ID in case it's already in the correct format
    const originalRef = referenceId

    // Debug logging (can be removed in production)
    logger.log('🔍 Order lookup for reference:', referenceId)

    if (!referenceId) {
      return NextResponse.json({ error: 'Reference ID is required' }, { status: 400 })
    }

    // First try a simple query without order_items to see if that's causing the issue
    let { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('reference_id', normalizedRef)
      .single()
    
    // If not found with normalized ref, try original ref
    if (orderError && normalizedRef !== originalRef) {
      logger.log('🔍 Trying original reference format:', originalRef)
      const result = await supabase
        .from('orders')
        .select('*')
        .eq('reference_id', originalRef)
        .single()
      
      order = result.data
      orderError = result.error
    }

    if (orderError) {
      console.error('Error fetching order:', orderError)
      console.error('🔍 Order not found - Query details:', {
        queryRef: normalizedRef,
        errorCode: orderError.code,
        errorMessage: orderError.message
      })
      
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Fetch order items separately since the join might cause issues
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)

    // Return order data
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        referenceId: order.reference_id,
        pickupId: order.pickup_id,
        userId: order.user_id,
        totalAmount: order.total_amount,
        currency: order.currency || 'TZS',
        paymentStatus: order.payment_status,
        status: order.status,
        failureReason: order.failure_reason,
        clickpesaTransactionId: order.clickpesa_transaction_id,
        paymentTimestamp: order.payment_timestamp,
        deliveryOption: order.delivery_option,
        shippingAddress: order.shipping_address,
        billingAddress: order.billing_address,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        orderItems: orderItems || []
      }
    })

  } catch (error) {
    console.error('Error in GET /api/orders/[referenceId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/orders/[referenceId] - Update order status
// SECURITY: This endpoint should ONLY be used as a last resort backup when webhook fails
// It requires additional security measures to prevent abuse
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> }
) {
  try {
    const { referenceId } = await params
    const body = await request.json()
    const { paymentStatus } = body

    if (!paymentStatus) {
      return NextResponse.json({ error: 'Payment status is required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    // Normalize: DB stores reference_id without hyphens, lowercase
    const normalizedRef = referenceId.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
    
    // Also try the original reference ID in case it's already in the correct format
    const originalRef = referenceId

    // First try with normalized reference
    let { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('reference_id', normalizedRef)
      .single()
    
    // If not found with normalized ref, try original ref
    if (orderError && normalizedRef !== originalRef) {
      const result = await supabase
        .from('orders')
        .select('*')
        .eq('reference_id', originalRef)
        .single()
      
      order = result.data
      orderError = result.error
    }

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // SECURITY: Verify user owns the order OR verify payment actually happened
    // Get user from session if available
    let isOrderOwner = false
    try {
      const cookieStore = cookies()
      const supabaseAuth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value
            },
            set() {},
            remove() {},
          },
        }
      )
      
      const { data: { user } } = await supabaseAuth.auth.getUser()
      isOrderOwner = !!(user && order.user_id === user.id)
    } catch (authError) {
      // If auth fails, user is not authenticated - continue with other checks
      logger.log('Auth check failed for return URL update:', authError)
    }

    // Check if this is a retry payment update request
    // IMPORTANT: Return URL updates are ONLY for retry payments when webhook fails
    // Webhooks are the PRIMARY mechanism - return URL is backup only
    const { isRetryPayment } = body
    
    // SECURITY: Additional validation for return URL updates
    if (isRetryPayment && paymentStatus === 'paid') {
      // SECURITY CHECK 1: Verify order is actually in retry state (failed/pending)
      if (order.payment_status !== 'failed' && order.payment_status !== 'pending') {
        logger.log('⚠️ SECURITY: Attempt to update non-retry order via return URL:', {
          orderId: order.id,
          currentStatus: order.payment_status,
          requestedStatus: paymentStatus
        })
        return NextResponse.json({ 
          error: 'Order is not in retry state. Only failed or pending orders can be updated via return URL.' 
        }, { status: 403 })
      }
      
      // SECURITY CHECK 2: Verify user owns the order OR verify ClickPesa transaction exists
      // For guest orders, we need to verify the payment actually happened
      if (!isOrderOwner) {
        // Check if there's a ClickPesa transaction ID (proves payment happened)
        const hasClickPesaTransaction = order.clickpesa_transaction_id
        
        if (!hasClickPesaTransaction) {
          logger.log('⚠️ SECURITY: Unauthorized return URL update attempt:', {
            orderId: order.id,
            orderUserId: order.user_id,
            requestUserId: user?.id || 'anonymous',
            hasTransaction: false
          })
          return NextResponse.json({ 
            error: 'Unauthorized. Only order owner or verified payment can update status.' 
          }, { status: 403 })
        }
      }
      
      // SECURITY CHECK 3: Rate limiting - prevent abuse
      // Check if this order was recently updated (prevent duplicate updates)
      const recentlyUpdated = order.updated_at && 
        (new Date().getTime() - new Date(order.updated_at).getTime()) < 5000 // 5 seconds
      
      if (recentlyUpdated && order.payment_status === 'paid') {
        logger.log('⚠️ SECURITY: Duplicate update attempt prevented:', {
          orderId: order.id,
          lastUpdated: order.updated_at
        })
        return NextResponse.json({ 
          error: 'Order was recently updated. Please wait before retrying.' 
        }, { status: 429 })
      }
      // This is a retry payment backup update via return URL (webhook didn't work)
      logger.log('🔄 Processing retry payment update via return URL (webhook backup):', order.id)
      
      // Update payment status
      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({ 
          payment_status: paymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating retry payment:', updateError)
        return NextResponse.json({ error: 'Failed to update retry payment' }, { status: 500 })
      }

      // Reduce stock for retry payment (only if not already reduced)
      if (order.payment_status !== 'paid' && order.payment_status !== 'success') {
        try {
          logger.log('📦 Reducing stock for retry payment via return URL:', order.id)
          
          // Get order items to reduce stock
          const { data: orderItems, error: itemsError } = await supabase
            .from('order_items')
            .select('product_id, quantity')
            .eq('order_id', order.id)

          if (itemsError) {
            console.error('❌ Error fetching order items for retry payment stock reduction:', itemsError)
          } else if (orderItems && orderItems.length > 0) {
            // Reduce stock for each item
            for (const item of orderItems) {
              try {
                // Get current stock
                const { data: product, error: fetchError } = await supabase
                  .from('products')
                  .select('stock_quantity, in_stock')
                  .eq('id', item.product_id)
                  .single()

                if (fetchError) {
                  console.error('❌ Error fetching product for retry payment stock reduction:', item.product_id, fetchError)
                  continue
                }

                const currentStock = product.stock_quantity || 0
                const newStock = Math.max(0, currentStock - item.quantity)
                const isInStock = newStock > 0

                // Update stock
                const { error: stockUpdateError } = await supabase
                  .from('products')
                  .update({
                    stock_quantity: newStock,
                    in_stock: isInStock,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', item.product_id)

                if (stockUpdateError) {
                  console.error('❌ Error updating stock for retry payment product:', item.product_id, stockUpdateError)
                } else {
                  logger.log('✅ Stock reduced for retry payment product:', item.product_id, 'by', item.quantity, `(${currentStock} -> ${newStock})`)
                }
              } catch (stockError) {
                console.error('❌ Error in retry payment stock reduction for product:', item.product_id, stockError)
              }
            }
          }
        } catch (stockReductionError) {
          console.error('❌ Error in retry payment stock reduction process:', stockReductionError)
        }
      }

      return NextResponse.json({
        success: true,
        order: {
          id: updatedOrder.id,
          referenceId: updatedOrder.reference_id,
          paymentStatus: updatedOrder.payment_status,
          updatedAt: updatedOrder.updated_at
        },
        message: 'Payment status updated successfully via return URL (webhook backup).'
      })
    } else {
      // Return current order status (READ-ONLY - no updates)
      // Payment status updates should only happen via webhooks
      logger.log('📋 Return URL: Returning current order status (read-only)')
      logger.log('📋 Current payment status:', order.payment_status)
      logger.log('📋 URL payment status:', paymentStatus)
      
      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          referenceId: order.reference_id,
          paymentStatus: order.payment_status, // Return current status, not URL status
          updatedAt: order.updated_at
        },
        message: 'Order status retrieved (read-only). Payment status updates are handled by webhooks only.'
      })
    }

  } catch (error) {
    console.error('Error in PATCH /api/orders/[referenceId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


