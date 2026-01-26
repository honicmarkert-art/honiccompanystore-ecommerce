import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { logger } from '@/lib/logger'
import { secureOrderUpdate, ReferenceIdSecurity } from '@/lib/reference-id-security'
import { verifyTransactionWithClickPesa, normalizeOrderReference } from '@/lib/clickpesa-api'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
// ClickPesa webhook handler
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const timestamp = new Date().toISOString()
    const body = await request.text()
    const signature = request.headers.get('x-clickpesa-signature')
    
    // Log ALL headers to see what ClickPesa actually sends
    const allHeaders = Object.fromEntries(request.headers.entries())
    
    logger.log('🔔 ClickPesa webhook received:', {
      hasSignature: !!signature,
      signature: signature || 'NOT PROVIDED',
      bodyLength: body.length,
      allHeaders: allHeaders,
      bodyContent: body.substring(0, 300),
      timestamp: timestamp
    })

    // SECURITY: Signature validation with fallback
    // Primary: ClickPesa signature (x-clickpesa-signature)
    // Fallback: Custom webhook signature (X-Webhook-Signature) using shared secret + HMAC-SHA256
    const hasChecksumKey = !!process.env.CLICKPESA_CHECKSUM_KEY
    const hasWebhookSecret = !!process.env.CLICKPESA_WEBHOOK_SECRET
    const secretKey = hasWebhookSecret ? process.env.CLICKPESA_WEBHOOK_SECRET : process.env.CLICKPESA_CHECKSUM_KEY
    
    // Check for custom webhook signature (fallback)
    const customSignature = request.headers.get('x-webhook-signature') || 
                            request.headers.get('X-Webhook-Signature') || 
                            ''
    
    // Extract custom signature (remove prefix if present like "sha256=")
    const extractedCustomSignature = customSignature.replace(/^sha256=/i, '').trim()
    
    logger.log('🔐 Webhook signature validation:', {
      hasClickPesaSignature: !!signature,
      hasCustomSignature: !!extractedCustomSignature,
      hasChecksumKey: hasChecksumKey,
      hasWebhookSecret: hasWebhookSecret,
      signatureLength: signature?.length || 0,
      customSignatureLength: extractedCustomSignature?.length || 0,
      bodyLength: body.length,
      timestamp: timestamp
    })
    
    let signatureValid = false
    let validationMethod = 'none'
    
    // PRIMARY: Try ClickPesa signature validation first
    if (signature && secretKey) {
      logger.log('🔍 Validating ClickPesa signature...')
      signatureValid = verifyWebhookSignature(body, signature, secretKey)
      if (signatureValid) {
        validationMethod = 'clickpesa'
        logger.log('✅ ClickPesa signature validation PASSED')
      } else {
        logger.log('❌ ClickPesa signature validation FAILED')
      }
    }
    
    // OPTION 3: Accept webhooks without signatures
    // Security is provided by ClickPesa API verification (happens later)
    // Signatures are optional - if provided, we validate them; if not, we rely on API verification
    if (!signature && !extractedCustomSignature) {
      logger.log('⚠️ No signature provided - will verify via ClickPesa API', {
        hasClickPesaSignature: false,
        hasCustomSignature: false,
          bodyLength: body.length,
        timestamp: timestamp
      })
    }
    
    // FALLBACK: Try custom webhook signature validation if ClickPesa signature failed or not present
    if (!signatureValid && extractedCustomSignature && secretKey) {
      logger.log('🔍 Validating custom webhook signature (fallback - REQUIRED)...')
      signatureValid = verifyCustomWebhookSignature(body, extractedCustomSignature, secretKey)
      if (signatureValid) {
        validationMethod = 'custom'
        logger.log('✅ Custom webhook signature validation PASSED (fallback)')
      } else {
        logger.log('❌ Custom webhook signature validation FAILED')
      }
    }
    
    // REJECT only if signature was provided but validation failed
    // If no signature was provided, we'll proceed to API verification
    if ((signature || extractedCustomSignature) && !signatureValid) {
      logger.error('❌ SECURITY: Webhook rejected - Invalid signature provided', {
        hasClickPesaSignature: !!signature,
        hasCustomSignature: !!extractedCustomSignature,
        hasSecretKey: !!secretKey,
        bodyLength: body.length,
        timestamp: timestamp,
        headers: Object.fromEntries(request.headers.entries())
        })
        return NextResponse.json(
        { error: 'Webhook signature validation failed' },
          { status: 401 }
        )
      }
      
    if (signatureValid) {
      logger.log(`✅ Webhook signature validation PASSED using ${validationMethod} method`)
    } else {
      logger.log('⚠️ No signature provided - proceeding to ClickPesa API verification (primary security)', {
        bodyLength: body.length,
        timestamp: timestamp
      })
    }

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
    let paymentTimestamp = new Date().toISOString()
    let failureReason = null

    if (event === 'PAYMENT RECEIVED') {
      paymentStatus = 'paid'
      orderReference = data.orderReference
      // Transaction ID is in data.id for all events
      transactionId = data.id || data.paymentId || data.transactionId
      amount = parseFloat(data.collectedAmount) || 0
      currency = data.collectedCurrency || 'TZS'
      customerInfo = data.customer
      paymentTimestamp = data.updatedAt || data.createdAt
    } else if (event === 'PAYMENT FAILED') {
      paymentStatus = 'failed'
      orderReference = data.orderReference
      // Transaction ID is in data.id for all events
      transactionId = data.id || data.paymentId || data.transactionId
      paymentTimestamp = data.updatedAt || data.createdAt
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
    // Handle different reference formats (with/without hyphens)
    const supabase = await import('@/lib/supabase-server').then(m => m.getSupabaseClient())
    
    // Normalize the reference ID (remove hyphens and non-alphanumeric, preserve case for consistency)
    // Use consistent normalization function to match checkout link creation
    const normalizedReference = normalizeOrderReference(orderReference)
    
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
    
    if (orderError) {
      }
    if (order) {
      }
    
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
      
      if (result.error) {
        }
      
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

    // If order not found, check if it's a supplier upgrade payment (stored in profiles table)
    if (orderError || !order) {
      logger.log('⚠️ Order not found, checking profiles table for supplier upgrade payment:', {
        orderReference: orderReference,
        normalizedReference: normalizedReference
      })
      
      // Check profiles table for supplier upgrade payments
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, payment_reference_id, pending_plan_id, payment_status')
        .eq('payment_reference_id', orderReference)
        .single()
      
      // Also try normalized reference
      let profileFound = profile
      if (profileError && normalizedReference !== orderReference) {
        const { data: profileNormalized } = await supabase
          .from('profiles')
          .select('id, payment_reference_id, pending_plan_id, payment_status')
          .eq('payment_reference_id', normalizedReference)
          .single()
        profileFound = profileNormalized
      }
      
      if (profileFound) {
        logger.log('✅ Found supplier upgrade payment:', {
          profileId: profileFound.id,
          paymentReferenceId: profileFound.payment_reference_id,
          pendingPlanId: profileFound.pending_plan_id
        })
        
        // This is a supplier upgrade payment - handle it here
        // Extract transaction ID from webhook payload (same as regular orders)
        let transactionId = data.id || data.paymentId || data.transactionId || null
        
        // Verify via API for security
        const { verifyTransactionWithClickPesa } = await import('@/lib/clickpesa-api')
        // Use supplier credentials for supplier upgrade payments
        const verification = await verifyTransactionWithClickPesa(orderReference, true)
        
        // SECURITY: Always ensure we have a transaction ID (use API verification as fallback)
        if (!transactionId && verification.transactionId) {
          transactionId = verification.transactionId
          logger.log('📝 Using transaction ID from ClickPesa API verification (webhook had none):', transactionId)
        } else if (verification.transactionId && transactionId && verification.transactionId !== transactionId) {
          // If both exist but don't match, use API version (more reliable)
          logger.log('⚠️ Transaction ID mismatch - using API version:', {
            webhook: transactionId,
            api: verification.transactionId
          })
          transactionId = verification.transactionId
        } else if (verification.transactionId && !transactionId) {
          transactionId = verification.transactionId
          logger.log('📝 Using transaction ID from ClickPesa API verification:', transactionId)
        }
        
        // CRITICAL: Ensure transaction ID is always set (use orderReference as last resort)
        if (!transactionId) {
          logger.warn('⚠️ No transaction ID available from webhook or API - using orderReference as fallback')
          transactionId = orderReference // Use orderReference as fallback to ensure field is never null
        }
        
        if (!verification.verified) {
          logger.error('❌ SECURITY: Supplier upgrade webhook rejected - Transaction verification failed', {
            orderReference: orderReference,
            profileId: profileFound.id,
            verificationError: verification.error,
            verificationStatus: verification.status
          })
      return NextResponse.json(
            { error: 'Transaction verification failed. Could not confirm transaction status with ClickPesa API.' },
            { status: 401 }
          )
        }
        
        // Always use webhook status as primary source
        // API verification confirms transaction exists, but webhook has the most current status
        const verifiedStatus = verification.status?.toUpperCase() || ''
        const verifiedPaymentStatus = paymentStatus // Use webhook status directly
        
        // SECURITY: Validate transaction ID to prevent tampering
        // If API returns a transaction ID, it MUST match the webhook transaction ID
        // But first ensure we have a transaction ID from webhook or API
        if (!transactionId && verification.transactionId) {
          transactionId = verification.transactionId
          logger.log('📝 Using transaction ID from ClickPesa API verification (webhook had none):', transactionId)
        }
        
        if (verification.transactionId && transactionId) {
          if (verification.transactionId !== transactionId) {
            logger.error('❌ SECURITY: Webhook rejected - Transaction ID mismatch (possible tampering)', {
              webhookTransactionId: transactionId,
              apiTransactionId: verification.transactionId,
              orderReference: orderReference,
              profileId: profileFound.id
            })
            return NextResponse.json(
              { error: 'Security validation failed: Transaction ID mismatch. Possible tampering detected.' },
              { status: 401 }
            )
          } else {
            }
        } else if (verification.transactionId && !transactionId) {
          // Use API transaction ID if webhook doesn't have one
          transactionId = verification.transactionId
          logger.log('📝 Using transaction ID from ClickPesa API verification:', transactionId)
        }
        
        // CRITICAL: Ensure transaction ID is always set (use orderReference as last resort)
        if (!transactionId) {
          logger.warn('⚠️ No transaction ID available from webhook or API - using orderReference as fallback')
          transactionId = orderReference // Use orderReference as fallback to ensure field is never null
        }
        
        // SECURITY: Validate status consistency - reject if mismatch
        if (verifiedStatus !== 'UNKNOWN' && verifiedStatus !== '') {
          const webhookStatusUpper = paymentStatus.toUpperCase()
          const apiStatusUpper = verifiedStatus
          
          // Map API status to our status format for comparison
          let apiMappedStatus = 'pending'
          if (apiStatusUpper === 'SUCCESS' || apiStatusUpper === 'SETTLED') {
            apiMappedStatus = 'paid'
          } else if (apiStatusUpper === 'FAILED' || apiStatusUpper === 'ERROR' || apiStatusUpper === 'CANCELLED' || apiStatusUpper === 'DECLINED') {
            apiMappedStatus = 'failed'
          }
          
          if (apiMappedStatus !== paymentStatus && paymentStatus !== 'pending') {
            logger.error('❌ SECURITY: Webhook rejected - Status mismatch (possible tampering)', {
              webhookStatus: paymentStatus,
              apiStatus: apiMappedStatus,
              apiRawStatus: verifiedStatus,
              orderReference: orderReference,
              profileId: profileFound.id
            })
            return NextResponse.json(
              { error: 'Security validation failed: Status mismatch between webhook and API. Possible tampering detected.' },
              { status: 401 }
            )
          }
        }
        
        logger.log('✅ Transaction verified - using webhook status as primary source', {
          webhookStatus: paymentStatus,
          apiStatus: verifiedStatus,
          orderReference: orderReference
        })
        
        // Update profile payment status
        const { getSupabaseClient } = await import('@/lib/admin-auth')
        const adminSupabase = getSupabaseClient()
        
        const updateData: any = {
          payment_updated_at: new Date().toISOString()
        }
        
        if (verifiedPaymentStatus === 'paid') {
          updateData.payment_status = 'paid'
          updateData.payment_timestamp = new Date().toISOString()
          // Always set transaction ID (use API verification as primary, webhook as fallback)
          updateData.clickpesa_transaction_id = verification.transactionId || transactionId || orderReference
          // Clear failure reason when payment is successful
          updateData.payment_failure_reason = null
          
          // Calculate payment expiration date (1 month from payment date for Premium plan)
          if (profileFound.pending_plan_id) {
            const { data: plan } = await adminSupabase
              .from('supplier_plans')
              .select('slug, term')
              .eq('id', profileFound.pending_plan_id)
              .single()
            
            if (plan?.slug === 'premium') {
              const paymentDate = new Date()
              const expirationDate = new Date(paymentDate)
              expirationDate.setMonth(expirationDate.getMonth() + 1)
              updateData.payment_expires_at = expirationDate.toISOString()
            }
          }
        } else if (verifiedPaymentStatus === 'failed') {
          updateData.payment_status = 'failed'
          updateData.payment_failure_reason = verification.message || failureReason || 'Payment failed'
          // Always set transaction ID even for failed payments
          updateData.clickpesa_transaction_id = transactionId
        } else {
          updateData.payment_status = 'pending'
          // Always set transaction ID even for pending payments
          updateData.clickpesa_transaction_id = transactionId
        }
        
        const { error: updateError } = await adminSupabase
          .from('profiles')
          .update(updateData)
          .eq('id', profileFound.id)
        
        if (updateError) {
          logger.error('Error updating supplier upgrade payment:', updateError)
          return NextResponse.json(
            { error: 'Failed to update supplier upgrade payment' },
            { status: 500 }
          )
        }
        
        // Notify supplier when payment is successful
        if (verifiedPaymentStatus === 'paid' && profileFound.pending_plan_id) {
          try {
            const { createNotification } = await import('@/lib/notification-helpers')
            const { data: plan } = await adminSupabase
              .from('supplier_plans')
              .select('name, slug')
              .eq('id', profileFound.pending_plan_id)
              .single()

            const planName = plan?.name || 'Premium Plan'
            
            await createNotification(
              profileFound.id,
              'payment_received',
              'Payment Successful! ✅',
              `Your payment for ${planName} has been received successfully. Your account will be activated soon.`,
              {
                supplier_id: profileFound.id,
                transaction_id: verification.transactionId || transactionId || orderReference,
                plan_slug: plan?.slug || 'premium',
                plan_name: planName,
                reference_id: orderReference
              }
            )
            
            } catch (notifError) {
            // Don't fail the webhook if notification fails
          }
        }
        
        return NextResponse.json({
          success: true,
          message: 'Supplier upgrade payment processed successfully',
          payment_type: 'supplier_upgrade',
          orderReference: orderReference,
          payment_status: verifiedPaymentStatus,
          verified_status: verifiedStatus
        })
      }
      
      // Not found in either table
      logger.error('❌ Transaction not found in orders or profiles table:', {
        orderReference: orderReference,
        normalizedReference: normalizedReference,
        orderError: orderError?.message,
        profileError: profileError?.message
      })
      return NextResponse.json(
        { error: 'Transaction not found in database' },
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

    // Check if this is a manual trigger (skip API verification)
    const isManualTrigger = request.headers.get('x-manual-trigger') === 'true'
    
    let verification: any = { verified: false, transactionId: null, status: null }
    let verifiedStatus = ''
    let verifiedPaymentStatus = paymentStatus
    
    if (isManualTrigger) {
      // Skip API verification for manual triggers
      logger.log('🔧 Manual trigger detected - skipping ClickPesa API verification', {
        orderReference: orderReference,
        webhookPaymentStatus: paymentStatus
      })
      
      // Use webhook data directly for manual triggers
      verifiedStatus = 'MANUAL'
      verifiedPaymentStatus = paymentStatus
      
      // Ensure transaction ID is set (use provided or generate one)
      if (!transactionId) {
        transactionId = `MANUAL-${Date.now()}`
        logger.log('📝 Generated transaction ID for manual trigger:', transactionId)
      }
    } else {
      // SECURITY: Always verify transaction via ClickPesa API before marking as confirmed
      logger.log('🔐 Verifying transaction with ClickPesa API before confirmation:', {
        orderReference: orderReference,
        webhookPaymentStatus: paymentStatus,
        webhookEvent: event
      })
      
      // Use regular credentials for regular orders
      verification = await verifyTransactionWithClickPesa(orderReference, false)
      
      if (verification.error) {
        }
      
      // If verification failed, reject the webhook
      if (!verification.verified) {
        logger.error('❌ SECURITY: Webhook rejected - Transaction verification failed', {
          orderReference: orderReference,
          orderId: order.id,
          verificationError: verification.error,
          verificationStatus: verification.status
        })
        return NextResponse.json(
          { error: 'Transaction verification failed. Could not confirm transaction status with ClickPesa API.' },
          { status: 401 }
        )
      }
      
      // Always use webhook status as primary source
      // API verification confirms transaction exists, but webhook has the most current status
      verifiedStatus = verification.status?.toUpperCase() || ''
      verifiedPaymentStatus = paymentStatus // Always use webhook status
      
      // SECURITY: Always ensure we have a transaction ID (use API verification as fallback)
      if (!transactionId && verification.transactionId) {
        transactionId = verification.transactionId
        logger.log('📝 Using transaction ID from ClickPesa API verification (webhook had none):', transactionId)
      } else if (verification.transactionId && transactionId && verification.transactionId !== transactionId) {
        // If both exist but don't match, use API version (more reliable)
        logger.log('⚠️ Transaction ID mismatch - using API version:', {
          webhook: transactionId,
          api: verification.transactionId
        })
        transactionId = verification.transactionId
      } else if (verification.transactionId && !transactionId) {
        transactionId = verification.transactionId
        logger.log('📝 Using transaction ID from ClickPesa API verification:', transactionId)
      }
      
      // CRITICAL: Ensure transaction ID is always set (use orderReference as last resort)
      if (!transactionId) {
        logger.warn('⚠️ No transaction ID available from webhook or API - using orderReference as fallback')
        transactionId = orderReference // Use orderReference as fallback to ensure field is never null
      }
    }
    
    if (isManualTrigger) {
      logger.log('✅ Manual trigger processed - payment status updated', {
        webhookStatus: paymentStatus,
        orderReference: orderReference,
        transactionId: transactionId
      })
    } else {
      logger.log('✅ Transaction verified - using webhook status as primary source', {
        webhookStatus: paymentStatus,
        apiStatus: verifiedStatus,
        orderReference: orderReference,
        transactionId: transactionId
      })
    }
    
    // Update payment status - always use webhook status
    let orderStatus = order.status
    
    // If order is pending and payment is successful, keep it pending for admin confirmation
    if (verifiedPaymentStatus === 'paid' && order.status === 'pending') {
      orderStatus = 'pending' // Admin still needs to confirm
    }

    const clientIP = request.headers.get('x-forwarded-for') 
      || request.headers.get('x-real-ip') || 'N/A'

    // Use secure order update with reference_id protection
    // Always use webhook status as primary source
    let updateData: any = {
      payment_status: verifiedPaymentStatus, // Always use webhook status
      status: orderStatus,
      failure_reason: failureReason || verification.message || null,
      clickpesa_transaction_id: transactionId, // Always set (never null)
      payment_method: 'clickpesa',
      payment_timestamp: paymentTimestamp
    }

    const updateResult = await secureOrderUpdate(order.id, updateData, undefined, clientIP || undefined)
    
    if (!updateResult.success) {
      return NextResponse.json(
        { error: 'Failed to update order', details: updateResult.error },
        { status: 500 }
      )
    }
    
    logger.log('✅ Order updated successfully:', {
      orderId: order.id,
      paymentStatus,
      orderStatus,
      transactionId,
      eventType: event,
      failureReason: failureReason || null
    })

    // If payment is successful, reduce stock quantities and clear cart (only if not already processed)
    const shouldProcessStock = paymentStatus === 'paid' && order.payment_status !== 'paid' && order.payment_status !== 'success'
    
    logger.log('🔍 Checking stock reduction condition:', {
      paymentStatus,
      orderPaymentStatus: order.payment_status,
      shouldProcess: shouldProcessStock,
      reason: !shouldProcessStock 
        ? (order.payment_status === 'paid' ? 'Order already paid' : order.payment_status === 'success' ? 'Order already successful' : 'Payment not paid')
        : 'Will process stock reduction'
    })
    
    if (shouldProcessStock) {
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
          .select('id, product_id, quantity, variant_attributes, variant_id, variant_name')
          .eq('order_id', order.id)

        if (itemsError) {
          logger.log('❌ Error fetching order items for stock reduction:', itemsError)
          throw itemsError // Re-throw to be caught by outer catch
        } else if (orderItems && orderItems.length > 0) {
          logger.log(`📦 Found ${orderItems.length} order item(s) to process for stock reduction`)
          logger.log(`📋 Order items details:`, orderItems.map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
            variant_id: item.variant_id,
            variant_attributes: item.variant_attributes,
            variant_attributes_type: typeof item.variant_attributes
          })))
          
          // Reduce stock for each item
          for (const item of orderItems) {
            try {
              // Parse variant_attributes if it's a JSON string
              let variantAttributes = item.variant_attributes
              if (typeof variantAttributes === 'string') {
                try {
                  variantAttributes = JSON.parse(variantAttributes)
                } catch (e) {
                  logger.log(`⚠️ Could not parse variant_attributes for item ${item.product_id}:`, e)
                  variantAttributes = null
                }
              }
              
              // Fallback: If variant_attributes is null/empty but variant_name exists, try to reconstruct it
              if ((!variantAttributes || Object.keys(variantAttributes || {}).length === 0) && item.variant_name) {
                logger.log(`⚠️ variant_attributes is missing for product ${item.product_id}, attempting to reconstruct from variant_name: "${item.variant_name}"`)
                
                // Fetch variants to find which attribute this variant_name belongs to
                const { data: productVariants, error: variantFetchError } = await supabase
                  .from('product_variants')
                  .select('primary_values')
                  .eq('product_id', item.product_id)
                
                if (!variantFetchError && productVariants) {
                  // Search through all variants to find the attribute that matches variant_name
                  for (const variant of productVariants) {
                    let pvArray = variant.primary_values
                    if (typeof pvArray === 'string') {
                      try {
                        pvArray = JSON.parse(pvArray)
                      } catch (e) {
                        continue
                      }
                    }
                    
                    if (pvArray && Array.isArray(pvArray)) {
                      // Find primaryValue that matches variant_name
                      const matchingPv = pvArray.find((pv: any) => String(pv.value) === String(item.variant_name))
                      if (matchingPv) {
                        // Reconstruct variant_attributes from the found primaryValue
                        variantAttributes = {
                          [matchingPv.attribute]: matchingPv.value
                        }
                        logger.log(`✅ Reconstructed variant_attributes:`, variantAttributes)
                        logger.log(`✅ Reconstructed variant_attributes type:`, typeof variantAttributes)
                        logger.log(`✅ Reconstructed variant_attributes keys:`, Object.keys(variantAttributes))
                        logger.log(`✅ Reconstructed variant_attributes length:`, Object.keys(variantAttributes).length)
                        break
                      }
                    }
                  }
                }
              }
              
              // Check if item has variant_attributes (attribute-level stock)
              logger.log(`🔍 Final variant_attributes check for product ${item.product_id}:`, {
                variantAttributes,
                type: typeof variantAttributes,
                isObject: typeof variantAttributes === 'object',
                keys: variantAttributes && typeof variantAttributes === 'object' ? Object.keys(variantAttributes) : 'N/A',
                keysLength: variantAttributes && typeof variantAttributes === 'object' ? Object.keys(variantAttributes).length : 0,
                willProcess: variantAttributes && typeof variantAttributes === 'object' && Object.keys(variantAttributes).length > 0
              })
              
              if (variantAttributes && typeof variantAttributes === 'object' && Object.keys(variantAttributes).length > 0) {
                logger.log(`📦 Processing variant stock decrement for product ${item.product_id}:`, {
                  variant_attributes: variantAttributes,
                  quantity: item.quantity
                })
                
                // Decrement specific attribute quantity
                const { data: variants, error: variantsError } = await supabase
                  .from('product_variants')
                  .select('id, primary_values')
                  .eq('product_id', item.product_id)

                if (variantsError || !variants || variants.length === 0) {
                  logger.log(`⚠️ No variants found for product ${item.product_id} - skipping variant stock decrement`)
                  continue
                }

                logger.log(`🔍 Found ${variants.length} variant(s) for product ${item.product_id}`)

                // Find and update the matching primaryValue quantities
                // Each attribute in variant_attributes should match a primaryValue
                for (const variant of variants) {
                  // Parse primary_values if it's a JSON string
                  let primaryValues = variant.primary_values
                  if (typeof primaryValues === 'string') {
                    try {
                      primaryValues = JSON.parse(primaryValues)
                    } catch (e) {
                      logger.log(`❌ Error parsing primary_values for variant ${variant.id}:`, e)
                      continue
                    }
                  }
                  
                  if (!primaryValues || !Array.isArray(primaryValues)) {
                    logger.log(`⚠️ Variant ${variant.id} has invalid primary_values:`, primaryValues)
                    continue
                  }

                  logger.log(`🔍 Checking variant ${variant.id} with ${primaryValues.length} primaryValues:`, 
                    primaryValues.map((pv: any) => `${pv.attribute}="${pv.value}" (qty: ${pv.quantity})`).join(', '))

                  let updated = false
                  const updatedPrimaryValues = primaryValues.map((pv: any) => {
                    // Check if this primaryValue matches any attribute in the order item
                    // For each attribute in variant_attributes, find the matching primaryValue
                    const matchingAttribute = Object.entries(variantAttributes).find(
                      ([key, value]) => {
                        const matches = pv.attribute === key && String(pv.value) === String(value)
                        if (matches) {
                          logger.log(`✅ Found match: ${pv.attribute}="${pv.value}" matches order attribute ${key}="${value}"`)
                        }
                        return matches
                      }
                    )

                    if (matchingAttribute) {
                      // This primaryValue matches one of the ordered attributes
                      const currentQty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(String(pv.quantity)) || 0
                      const newQty = Math.max(0, currentQty - item.quantity)
                      updated = true
                      logger.log(`✅ Reducing attribute stock: ${pv.attribute}="${pv.value}" by ${item.quantity} (${currentQty} -> ${newQty})`)
                      return { ...pv, quantity: newQty }
                    }
                    return pv
                  })

                  if (updated) {
                    logger.log(`🔄 Updating variant ${variant.id} with decremented primaryValues`)
                    logger.log(`📝 Updated primaryValues:`, JSON.stringify(updatedPrimaryValues, null, 2))
                    
                    // Update variant with decremented primaryValues
                    const { error: variantUpdateError } = await supabase
                      .from('product_variants')
                      .update({ primary_values: updatedPrimaryValues })
                      .eq('id', variant.id)

                    if (variantUpdateError) {
                      logger.log(`❌ Error updating variant ${variant.id}:`, variantUpdateError)
                      logger.log(`❌ Update payload:`, { id: variant.id, primary_values: updatedPrimaryValues })
                      continue
                    }

                    // Verify the update worked
                    const { data: verifyVariant, error: verifyError } = await supabase
                      .from('product_variants')
                      .select('primary_values')
                      .eq('id', variant.id)
                      .single()

                    if (verifyError) {
                      logger.log(`⚠️ Could not verify variant update:`, verifyError)
                    } else {
                      logger.log(`✅ Variant ${variant.id} updated successfully. Verified:`, verifyVariant?.primary_values)
                    }

                    // Recalculate total stock from ALL variants for this product
                    const { data: allVariants, error: allVariantsError } = await supabase
                      .from('product_variants')
                      .select('primary_values')
                      .eq('product_id', item.product_id)

                    if (!allVariantsError && allVariants) {
                      // Sum up all quantities from all primaryValues across all variants
                      let totalStock = 0
                      for (const v of allVariants) {
                        let pvArray = v.primary_values
                        // Parse if string
                        if (typeof pvArray === 'string') {
                          try {
                            pvArray = JSON.parse(pvArray)
                          } catch (e) {
                            continue
                          }
                        }
                        
                        if (pvArray && Array.isArray(pvArray)) {
                          for (const pv of pvArray) {
                            const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(String(pv.quantity)) || 0
                            totalStock += qty
                          }
                        }
                      }

                      logger.log(`📊 Calculated total stock for product ${item.product_id}: ${totalStock}`)

                      // Update product total stock
                      const { error: productUpdateError } = await supabase
                        .from('products')
                        .update({
                          stock_quantity: totalStock,
                          in_stock: totalStock > 0,
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', item.product_id)

                      if (productUpdateError) {
                        logger.log(`❌ Error updating product stock:`, productUpdateError)
                      } else {
                        logger.log(`✅ Product ${item.product_id} total stock updated to: ${totalStock}`)
                      }
                    } else {
                      logger.log(`⚠️ Could not fetch all variants for recalculation:`, allVariantsError)
                    }
                  } else {
                    logger.log(`⚠️ No matching primaryValues found in variant ${variant.id} for order attributes:`, variantAttributes)
                  }
                }
              } else {
                // Fallback: Old product-level stock reduction (only if no variant_attributes)
                logger.log(`⚠️ No variant_attributes found for product ${item.product_id}, using product-level stock reduction`)
                logger.log(`📦 Item data:`, { 
                  product_id: item.product_id, 
                  quantity: item.quantity,
                  variant_attributes: item.variant_attributes,
                  variant_attributes_type: typeof item.variant_attributes
                })
                
                const { data: product, error: fetchError } = await supabase
                  .from('products')
                  .select('stock_quantity, in_stock')
                  .eq('id', item.product_id)
                  .single()

                if (fetchError) {
                  logger.log(`❌ Error fetching product for stock reduction:`, fetchError)
                  continue
                }

                const currentStock = product.stock_quantity || 0
                const newStock = Math.max(0, currentStock - item.quantity)
                const isInStock = newStock > 0

                logger.log(`📊 Product-level stock reduction: ${currentStock} - ${item.quantity} = ${newStock}`)

                const { error: updateError } = await supabase
                  .from('products')
                  .update({
                    stock_quantity: newStock,
                    in_stock: isInStock,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', item.product_id)

                if (updateError) {
                  logger.log(`❌ Error updating product stock:`, updateError)
                } else {
                  logger.log(`✅ Product ${item.product_id} stock updated to ${newStock}`)
                }
              }
            } catch (stockError) {
              logger.log(`❌ Error in stock reduction for product ${item.product_id}:`, stockError)
              if (stockError instanceof Error) {
                logger.log(`❌ Error details:`, {
                  message: stockError.message,
                  stack: stockError.stack
                })
              }
            }
          }
        }
      } catch (stockReductionError) {
        logger.log(`❌ Error in stock reduction process:`, stockReductionError)
        if (stockReductionError instanceof Error) {
          logger.log(`❌ Stock reduction error details:`, {
            message: stockReductionError.message,
            stack: stockReductionError.stack
          })
        }
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
    const processingTime = Date.now() - startTime
    
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
    const processingTime = Date.now() - startTime
    logger.error('❌ ClickPesa webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Verify custom webhook signature using HMAC-SHA256:
// 1. Use raw payload body
// 2. Generate HMAC-SHA256 hash using shared secret
// 3. Compare with received signature (format: sha256=... or just hex)
function verifyCustomWebhookSignature(payload: string, signature: string, secretKey: string): boolean {
  logger.log('🔐 verifyCustomWebhookSignature called:', {
    hasSignature: !!signature,
    signatureLength: signature?.length,
    payloadLength: payload.length,
    hasSecretKey: !!secretKey
  })
  
  if (!signature || !secretKey) {
    logger.log('❌ Missing signature or secret key for custom webhook validation')
    return false
  }

  try {
    // Generate HMAC-SHA256 hash of the raw payload
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(payload)
      .digest('hex')

    // Extract received signature (remove prefix if present like "sha256=")
    const receivedSignature = signature.replace(/^sha256=/i, '').trim()
    
    logger.log('🔑 Custom webhook signature comparison:', {
      expectedLength: expectedSignature.length,
      receivedLength: receivedSignature.length,
      expected: expectedSignature,
      received: receivedSignature,
      match: expectedSignature === receivedSignature
    })

    const isValid = expectedSignature === receivedSignature

    if (!isValid) {
      logger.log('❌ CUSTOM WEBHOOK SIGNATURE VALIDATION FAILED')
    } else {
      logger.log('✅ CUSTOM WEBHOOK SIGNATURE VALIDATION SUCCEEDED')
    }

    return isValid
  } catch (error) {
    logger.log('❌ CUSTOM WEBHOOK SIGNATURE VALIDATION ERROR:', error)
    return false
  }
}

// Canonicalize payload recursively - sort all object keys alphabetically at every nesting level
function canonicalizeWebhook(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(canonicalizeWebhook)
  }
  
  // Recursively sort object keys alphabetically
  return Object.keys(obj)
    .sort()
    .reduce((acc: Record<string, any>, key: string) => {
      acc[key] = canonicalizeWebhook(obj[key])
      return acc
    }, {})
}

// Verify webhook checksum using ClickPesa's NEW method (Updated 2024):
// 1. Parse JSON payload
// 2. Exclude checksum and checksumMethod fields
// 3. Recursively canonicalize (sort keys alphabetically at all nesting levels)
// 4. Serialize to compact JSON
// 5. Generate HMAC-SHA256 hash
// 6. Compare with received signature
function verifyWebhookSignature(payload: string, signature: string | null, secretKey?: string): boolean {
  logger.log('🔐 verifyWebhookSignature called:', {
    hasSignature: !!signature,
    signatureLength: signature?.length,
    payloadLength: payload.length,
    hasSecretKey: !!secretKey
  })
  
  if (!signature) {
    logger.log('❌ No signature provided to verifyWebhookSignature')
    return false
  }

  // Use provided secret key or fallback to CLICKPESA_CHECKSUM_KEY
  const checksumKey = secretKey || process.env.CLICKPESA_CHECKSUM_KEY
  if (!checksumKey) {
    logger.log('❌ Secret key not provided and CLICKPESA_CHECKSUM_KEY not configured')
    return false
  }

  try {
    // Parse the JSON payload
    const payloadObj = JSON.parse(payload)
    logger.log('✅ Successfully parsed JSON payload')
    
    // 1. Exclude checksum and checksumMethod fields
    const payloadForValidation = { ...payloadObj }
    delete payloadForValidation.checksum
    delete payloadForValidation.checksumMethod
    
    // 2. Recursively canonicalize payload (sort keys alphabetically at all nesting levels)
    const canonicalPayload = canonicalizeWebhook(payloadForValidation)
    
    // 3. Serialize to compact JSON (no extra whitespace)
    const payloadString = JSON.stringify(canonicalPayload)
    
    logger.log('📝 Payload string for checksum:', {
      first100Chars: payloadString.substring(0, 100),
      fullLength: payloadString.length
    })
    
    // 4. Generate HMAC-SHA256 hash
    const expectedSignature = crypto
      .createHmac('sha256', checksumKey)
      .update(payloadString)
      .digest('hex')

    logger.log('🔑 Generated checksum:', expectedSignature)

    // 4. Compare signatures
    const receivedSignature = signature.replace('sha256=', '')
    
    logger.log('📬 Received signature:', receivedSignature)
    
    const isValid = expectedSignature === receivedSignature

    logger.log('🎯 Signature comparison result:', {
      expectedLength: expectedSignature.length,
      receivedLength: receivedSignature.length,
      expected: expectedSignature,
      received: receivedSignature,
      match: isValid
    })

    if (!isValid) {
      logger.log('❌ CHECKSUM VALIDATION FAILED')
      logger.log('Full details:', {
        expected: expectedSignature,
        received: receivedSignature,
        payloadPreview: payload.substring(0, 200)
      })
    } else {
      logger.log('✅ CHECKSUM VALIDATION SUCCEEDED')
    }

    return isValid
  } catch (error) {
    logger.log('❌ CHECKSUM VALIDATION ERROR:', error)
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
