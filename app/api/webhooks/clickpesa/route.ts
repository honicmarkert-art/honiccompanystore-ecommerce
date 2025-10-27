import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { logger } from '@/lib/logger'
import { secureOrderUpdate, ReferenceIdSecurity } from '@/lib/reference-id-security'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
// ClickPesa webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-clickpesa-signature')
    
    // Log ALL headers to see what ClickPesa actually sends
    const allHeaders = Object.fromEntries(request.headers.entries())
    
    logger.log('🔔 ClickPesa webhook received:', {
      hasSignature: !!signature,
      signature: signature || 'NOT PROVIDED',
      bodyLength: body.length,
      allHeaders: allHeaders,
      bodyContent: body.substring(0, 300), // First 300 chars
      timestamp: new Date().toISOString()
    })
    
    // Additional debug: log ALL headers individually
    console.log('🔍 Webhook Headers from ClickPesa:')
    request.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`)
    })

    // Verify webhook signature/checksum - MANDATORY
    const hasChecksumKey = !!process.env.CLICKPESA_CHECKSUM_KEY
    
    // Reject webhook if no signature is provided
    if (!signature) {
      logger.log('❌ Webhook rejected: No signature provided')
      return NextResponse.json(
        { error: 'Signature required' },
        { status: 401 }
      )
    }
    
    // Reject webhook if we don't have checksum key configured
    if (!hasChecksumKey) {
      logger.log('❌ Webhook rejected: Checksum key not configured')
      return NextResponse.json(
        { error: 'Webhook validation not configured' },
        { status: 500 }
      )
    }
    
    // Validate signature
    const isValidSignature = verifyWebhookSignature(body, signature)
    
    if (!isValidSignature) {
      logger.log('⚠️ Webhook checksum validation failed:', {
        signature: signature,
        bodyPreview: body.substring(0, 200)
      })
      return NextResponse.json(
        { error: 'Invalid checksum' },
        { status: 401 }
      )
    }
    
    logger.log('✅ Webhook checksum validation passed')

    const payload = JSON.parse(body)
    logger.log('📦 ClickPesa webhook payload:', payload)

    // Extract payment information based on ClickPesa format
    // ClickPesa uses 'event' for PAYMENT RECEIVED and 'eventType' for PAYMENT FAILED
    const event = payload.event || payload.eventType
    const data = payload.data
    
    // Handle different event types
    let paymentStatus = 'unpaid'
    let orderReference = null
    let transactionId = null
    let amount = 0
    let currency = 'TZS'
    let customerInfo = null
    let timestamp = new Date().toISOString()
    let failureReason = null

    if (event === 'PAYMENT RECEIVED') {
      paymentStatus = 'paid'
      orderReference = data.orderReference
      transactionId = data.paymentId
      amount = parseFloat(data.collectedAmount) || 0
      currency = data.collectedCurrency || 'TZS'
      customerInfo = data.customer
      timestamp = data.updatedAt || data.createdAt
    } else if (event === 'PAYMENT FAILED') {
      paymentStatus = 'failed'
      orderReference = data.orderReference
      transactionId = data.id
      timestamp = data.updatedAt || data.createdAt
      failureReason = data.message || 'Payment failed'
    } else {
      logger.log('⚠️ Unhandled event type:', event)
      return NextResponse.json({
        success: true,
        message: 'Event type not handled',
        event_type: event
      })
    }

    if (!orderReference) {
      return NextResponse.json(
        { error: 'No order reference found' },
        { status: 400 }
      )
    }

    // Find the order in our database using orderReference
    // Handle different reference formats (with/without hyphens, different cases)
    const supabase = await import('@/lib/supabase-server').then(m => m.getSupabaseClient())
    
    // Normalize the reference ID (remove hyphens, convert to lowercase)
    const normalizedReference = orderReference.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
    
    logger.log('🔍 Looking for order with reference:', {
      originalReference: orderReference,
      normalizedReference: normalizedReference
    })
    
    // Try multiple reference formats to find the order
    let { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('reference_id', normalizedReference)
      .single()
    
    logger.log('🔍 First query result:', {
      foundOrder: !!order,
      error: orderError?.message,
      orderId: order?.id,
      orderReferenceId: order?.reference_id
    })

    // If not found, try original reference
    if (orderError && normalizedReference !== orderReference) {
      logger.log('🔄 Trying with original reference format...')
      const result = await supabase
        .from('orders')
        .select('*')
        .eq('reference_id', orderReference)
        .single()
      
      logger.log('🔍 Second query result:', {
        foundOrder: !!result.data,
        error: result.error?.message,
        orderId: result.data?.id,
        orderReferenceId: result.data?.reference_id
      })
      
      order = result.data
      orderError = result.error
    }
    
    // If still not found, try case-insensitive search with all existing orders
    if (orderError) {
      logger.log('🔄 Trying case-insensitive search...')
      const { data: allRecentOrders } = await supabase
        .from('orders')
        .select('id, reference_id, order_number, payment_status')
        .order('created_at', { ascending: false })
        .limit(10)
      
      logger.log('📋 Recent orders in database:', allRecentOrders?.map(o => ({
        id: o.id,
        reference_id: o.reference_id,
        order_number: o.order_number,
        payment_status: o.payment_status
      })))
    }

    // If still not found, try retry reference matching (for cases like "e62d9c1ae22347bbbbd487bc87c72d71retry1759665048447")
    if (orderError) {
      logger.log('🔄 Trying retry reference matching...')
      
      // Check if this is a retry reference (contains "retry" followed by timestamp)
      const retryMatch = orderReference.match(/^(.+?)retry\d+$/)
      if (retryMatch) {
        const originalReference = retryMatch[1] // Get the part before "retry"
        const normalizedOriginalReference = originalReference.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
        
        logger.log('🔍 Trying original reference from retry format:', {
          originalReference: originalReference,
          normalizedOriginalReference: normalizedOriginalReference
        })
        
        const result = await supabase
          .from('orders')
          .select('*')
          .eq('reference_id', normalizedOriginalReference)
          .single()
        
        order = result.data
        orderError = result.error
      }
    }

    // If still not found, try partial matching (for cases like "218cf8f1ac1e446f90f64016bcb80b4 Oretry1759662681519")
    let baseReference = null
    if (orderError) {
      logger.log('🔄 Trying partial reference matching...')
      baseReference = orderReference.split(' ')[0] // Get the first part before space
      const normalizedBaseReference = baseReference.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
      
      logger.log('🔍 Trying base reference:', {
        baseReference: baseReference,
        normalizedBaseReference: normalizedBaseReference
      })
      
      const result = await supabase
        .from('orders')
        .select('*')
        .eq('reference_id', normalizedBaseReference)
        .single()
      
      order = result.data
      orderError = result.error
    }

    // If still not found, try with original base reference
    if (orderError && baseReference) {
      logger.log('🔄 Trying with original base reference format...')
      const result = await supabase
        .from('orders')
        .select('*')
        .eq('reference_id', baseReference)
        .single()
      
      order = result.data
      orderError = result.error
    }

    // If still not found, try searching by transaction ID as fallback
    if (orderError && transactionId) {
      logger.log('🔄 Trying to find order by transaction ID as fallback...')
      const result = await supabase
        .from('orders')
        .select('*')
        .eq('clickpesa_transaction_id', transactionId)
        .single()
      
      order = result.data
      orderError = result.error
      
      if (order) {
        logger.log('✅ Order found by transaction ID:', {
          transactionId: transactionId,
          orderId: order.id,
          orderNumber: order.order_number,
          referenceId: order.reference_id
        })
      }
    }

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    logger.log('✅ Order found:', {
      orderId: order.id,
      orderNumber: order.order_number,
      referenceId: order.reference_id,
      currentPaymentStatus: order.payment_status,
      currentOrderStatus: order.status,
      isRetryPayment: order.payment_status === 'failed' || order.payment_status === 'pending'
    })

    // Update payment status - already determined from event type
    let orderStatus = order.status
    
    // If order is pending and payment is successful, keep it pending for admin confirmation
    if (paymentStatus === 'paid' && order.status === 'pending') {
      orderStatus = 'pending' // Admin still needs to confirm
    }

    // Use secure order update with reference_id protection
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    let updateData: any = {
      payment_status: paymentStatus,
      status: orderStatus,
      failure_reason: failureReason || null,
      clickpesa_transaction_id: transactionId,
      payment_method: 'clickpesa',
      payment_timestamp: timestamp
    }

    const updateResult = await secureOrderUpdate(order.id, updateData, undefined, clientIP || undefined)
    
    if (!updateResult.success) {
      return NextResponse.json(
        { error: 'Failed to update order', details: updateResult.error },
        { status: 500 }
      )
    }
    
    logger.log('✅ Order updated securely with reference_id protection')


    logger.log('✅ Order updated successfully:', {
      orderId: order.id,
      paymentStatus,
      orderStatus,
      transactionId,
      eventType: event,
      failureReason: failureReason || null
    })

    // If payment is successful, reduce stock quantities and clear cart (only if not already processed)
    if (paymentStatus === 'paid' && order.payment_status !== 'paid' && order.payment_status !== 'success') {
      try {
        const isRetryPayment = order.payment_status === 'failed' || order.payment_status === 'pending'
        logger.log('📦 Reducing stock for paid order:', {
          orderId: order.id,
          orderNumber: order.order_number,
          isRetryPayment: isRetryPayment,
          previousStatus: order.payment_status,
          newStatus: paymentStatus
        })
        
        // Get order items to reduce stock
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, quantity, variant_attributes')
          .eq('order_id', order.id)

        if (itemsError) {
          // Error fetching order items for stock reduction
        } else if (orderItems && orderItems.length > 0) {
          // Reduce stock for each item
          for (const item of orderItems) {
            try {
              // Check if item has variant_attributes (attribute-level stock)
              if (item.variant_attributes && typeof item.variant_attributes === 'object') {
                // Decrement specific attribute quantity
                const { data: variants, error: variantsError } = await supabase
                  .from('product_variants')
                  .select('id, primary_values')
                  .eq('product_id', item.product_id)

                if (variantsError || !variants || variants.length === 0) {
                  continue
                }

                // Find and update the matching primaryValue quantity
                for (const variant of variants) {
                  if (!variant.primary_values || !Array.isArray(variant.primary_values)) continue

                  let updated = false
                  const updatedPrimaryValues = variant.primary_values.map((pv: any) => {
                    // Match by attribute values
                    const matches = Object.entries(item.variant_attributes).every(([key, value]) => {
                      return pv.attribute === key && pv.value === value
                    })

                    if (matches) {
                      const currentQty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                      const newQty = Math.max(0, currentQty - item.quantity)
                      updated = true
                      logger.log(`✅ Reducing attribute stock: ${pv.attribute}="${pv.value}" by ${item.quantity} (${currentQty} -> ${newQty})`)
                      return { ...pv, quantity: newQty }
                    }
                    return pv
                  })

                  if (updated) {
                    await supabase
                      .from('product_variants')
                      .update({ primary_values: updatedPrimaryValues })
                      .eq('id', variant.id)

                    // Recalculate and update product total stock
                    const totalStock = updatedPrimaryValues.reduce((sum: number, pv: any) => {
                      const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                      return sum + qty
                    }, 0)

                    await supabase
                      .from('products')
                      .update({
                        stock_quantity: totalStock,
                        in_stock: totalStock > 0,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', item.product_id)

                    logger.log(`✅ Product total stock updated to: ${totalStock}`)
                  }
                }
              } else {
                // Fallback: Old product-level stock reduction
                const { data: product, error: fetchError } = await supabase
                  .from('products')
                  .select('stock_quantity, in_stock')
                  .eq('id', item.product_id)
                  .single()

                if (fetchError) {
                  continue
                }

                const currentStock = product.stock_quantity || 0
                const newStock = Math.max(0, currentStock - item.quantity)
                const isInStock = newStock > 0

                const { error: updateError } = await supabase
                  .from('products')
                  .update({
                    stock_quantity: newStock,
                    in_stock: isInStock,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', item.product_id)

                if (updateError) {
                  // Error updating stock for product
                }
              }
            } catch (stockError) {
              // Error in stock reduction for product
            }
          }
        }
      } catch (stockReductionError) {
        // Error in stock reduction process
      }

      // Clear cart for authenticated users after successful payment
      if (order.user_id) {
        try {
          logger.log('🛒 Clearing cart for user after successful payment:', order.user_id)
          
          const { error: clearCartError } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', order.user_id)

          if (clearCartError) {
            logger.log('⚠️ Failed to clear cart after payment:', clearCartError)
          } else {
            logger.log('✅ Cart cleared successfully after payment')
          }
        } catch (cartClearError) {
          logger.log('⚠️ Error clearing cart after payment:', cartClearError)
        }
      }
    }

    // Send real-time update to admin (if using Supabase Realtime)
    try {
      await supabase
        .from('orders')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', order.id)
    } catch (realtimeError) {
      // Real-time update failed
    }

    const isRetryPayment = order.payment_status === 'failed' || order.payment_status === 'pending'
    
    return NextResponse.json({
      success: true,
      message: isRetryPayment ? 'Retry payment processed successfully' : 'Initial payment processed successfully',
      order_id: order.id,
      order_number: order.order_number,
      reference_id: order.reference_id,
      payment_status: paymentStatus,
      order_status: orderStatus,
      is_retry_payment: isRetryPayment,
      previous_payment_status: order.payment_status,
      failure_reason: failureReason || null,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Verify webhook checksum using ClickPesa's method:
// 1. Parse JSON payload
// 2. Sort keys alphabetically
// 3. Concatenate values only (not keys)
// 4. Generate HMAC-SHA256 hash
// 5. Compare with received signature
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) {
    return false
  }

  const checksumKey = process.env.CLICKPESA_CHECKSUM_KEY
  if (!checksumKey) {
    return false
  }

  try {
    // Parse the JSON payload
    const payloadObj = JSON.parse(payload)
    
    // 1. Sort keys alphabetically and create sorted payload
    const sortedPayload = Object.keys(payloadObj)
      .sort()
      .reduce((obj: any, key) => {
        obj[key] = payloadObj[key]
        return obj
      }, {})
    
    // 2. Concatenate values only (join all values directly)
    const payloadString = Object.values(sortedPayload).join('')
    
    logger.log('Checksum validation:', {
      sortedKeys: Object.keys(sortedPayload),
      payloadString: payloadString.substring(0, 100),
      payloadStringLength: payloadString.length
    })
    
    // 3. Generate HMAC-SHA256 hash
    const expectedSignature = crypto
      .createHmac('sha256', checksumKey)
      .update(payloadString)
      .digest('hex')

    // 4. Compare signatures
    const receivedSignature = signature.replace('sha256=', '')
    
    const isValid = expectedSignature === receivedSignature

    logger.log('Signature comparison:', {
      expected: expectedSignature,
      received: receivedSignature,
      match: isValid
    })

    return isValid
  } catch (error) {
    logger.log('Checksum validation error:', error)
    return false
  }
}

// Handle GET requests (for webhook verification)
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const challenge = url.searchParams.get('challenge')
  
  if (challenge) {
    logger.log('🔍 Webhook verification challenge:', challenge)
    return NextResponse.json({ challenge })
  }
  
  return NextResponse.json({ message: 'ClickPesa webhook endpoint is active' })
}
