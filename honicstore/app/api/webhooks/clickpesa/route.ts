import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { logger } from '@/lib/logger'
import { secureOrderUpdate } from '@/lib/reference-id-security'
import { verifyTransactionWithClickPesa, normalizeOrderReference } from '@/lib/clickpesa-api'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

const WEBHOOK_REPLAY_TTL_MS = Math.max(
  5 * 60 * 1000,
  parseInt(process.env.CLICKPESA_WEBHOOK_REPLAY_TTL_MS || `${24 * 60 * 60 * 1000}`, 10) || (24 * 60 * 60 * 1000)
)
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const localWebhookReplayStore = new Map<string, number>()

async function upstashCommand(command: string[]): Promise<any> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Upstash Redis is not configured')
  }

  const response = await fetch(UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })

  if (!response.ok) {
    throw new Error(`Upstash request failed: ${response.status}`)
  }

  const payload = await response.json()
  if (payload?.error) {
    throw new Error(String(payload.error))
  }
  return payload?.result
}

function buildWebhookReplayKey(orderReference: string, transactionId: string, paymentStatus: string): string {
  const normalizedRef = normalizeOrderReference(orderReference || '')
  const raw = `${normalizedRef}|${transactionId || 'unknown'}|${paymentStatus || 'unknown'}`
  const digest = crypto.createHash('sha256').update(raw).digest('hex')
  return `webhook-replay:${digest}`
}

async function acquireWebhookReplayLock(
  orderReference: string,
  transactionId: string,
  paymentStatus: string
): Promise<{ accepted: boolean; backend: 'upstash' | 'memory' }> {
  const key = buildWebhookReplayKey(orderReference, transactionId, paymentStatus)

  if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    try {
      const result = await upstashCommand(['SET', key, '1', 'NX', 'PX', String(WEBHOOK_REPLAY_TTL_MS)])
      return { accepted: result === 'OK', backend: 'upstash' }
    } catch {
      // fall through to local memory lock
    }
  }

  const now = Date.now()
  const existingExpiry = localWebhookReplayStore.get(key)
  if (existingExpiry && existingExpiry > now) {
    return { accepted: false, backend: 'memory' }
  }
  localWebhookReplayStore.set(key, now + WEBHOOK_REPLAY_TTL_MS)
  return { accepted: true, backend: 'memory' }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, expiresAt] of localWebhookReplayStore.entries()) {
    if (expiresAt <= now) {
      localWebhookReplayStore.delete(key)
    }
  }
}, 10 * 60 * 1000)

function resolveTransactionId(
  currentTransactionId: string | null | undefined,
  verifiedTransactionId: string | null | undefined,
  orderReference: string
): string {
  return verifiedTransactionId || currentTransactionId || orderReference
}

function mapClickPesaStatusToPaymentStatus(status: string): 'paid' | 'failed' | 'pending' {
  const normalized = status.toUpperCase()
  if (normalized === 'SUCCESS' || normalized === 'SETTLED') return 'paid'
  if (normalized === 'FAILED' || normalized === 'ERROR' || normalized === 'CANCELLED' || normalized === 'DECLINED') {
    return 'failed'
  }
  return 'pending'
}

function validateIncomingWebhookSignature(request: NextRequest, body: string): boolean {
  const signature = request.headers.get('x-clickpesa-signature')
  const hasWebhookSecret = !!process.env.CLICKPESA_WEBHOOK_SECRET
  const secretKey = hasWebhookSecret ? process.env.CLICKPESA_WEBHOOK_SECRET : process.env.CLICKPESA_CHECKSUM_KEY
  const customSignature =
    request.headers.get('x-webhook-signature') ||
    request.headers.get('X-Webhook-Signature') ||
    ''
  const extractedCustomSignature = customSignature.replace(/^sha256=/i, '').trim()

  let signatureValid = false
  if (signature && secretKey) {
    signatureValid = verifyWebhookSignature(body, signature, secretKey)
  }
  if (!signatureValid && extractedCustomSignature && secretKey) {
    signatureValid = verifyCustomWebhookSignature(body, extractedCustomSignature, secretKey)
  }

  if ((signature || extractedCustomSignature) && !signatureValid) {
    logger.error('❌ SECURITY: Webhook rejected - Invalid signature provided', {
      hasClickPesaSignature: !!signature,
      hasCustomSignature: !!extractedCustomSignature,
      hasSecretKey: !!secretKey,
      bodyLength: body.length,
      headers: Object.fromEntries(request.headers.entries())
    })
    return false
  }

  return true
}

async function processPaidOrderStockAndCart(
  supabase: any,
  order: any
): Promise<void> {
  try {
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id, quantity, variant_attributes, variant_id, variant_name')
      .eq('order_id', order.id)

    if (itemsError) {
      logger.error('Error fetching order items for stock reduction', itemsError)
      throw itemsError
    } else if (orderItems && orderItems.length > 0) {
      const dirtyVariantProductIds = new Set<number>()
      const productVariantsCache = new Map<number, Array<{ id: number; primary_values: any }>>()
      const getProductVariants = async (productId: number) => {
        const cached = productVariantsCache.get(productId)
        if (cached) return cached
        const { data: variants, error: variantsError } = await supabase
          .from('product_variants')
          .select('id, primary_values')
          .eq('product_id', productId)
        if (variantsError || !variants) return null
        productVariantsCache.set(productId, variants as Array<{ id: number; primary_values: any }>)
        return variants as Array<{ id: number; primary_values: any }>
      }

      for (const item of orderItems) {
        try {
          let variantAttributes = item.variant_attributes
          if (typeof variantAttributes === 'string') {
            try {
              variantAttributes = JSON.parse(variantAttributes)
            } catch {
              logger.warn(`Could not parse variant_attributes for item ${item.product_id}`)
              variantAttributes = null
            }
          }

          if ((!variantAttributes || Object.keys(variantAttributes || {}).length === 0) && item.variant_name) {
            const productVariants = await getProductVariants(item.product_id)
            if (productVariants) {
              for (const variant of productVariants) {
                let pvArray = variant.primary_values
                if (typeof pvArray === 'string') {
                  try {
                    pvArray = JSON.parse(pvArray)
                  } catch {
                    continue
                  }
                }

                if (pvArray && Array.isArray(pvArray)) {
                  const matchingPv = pvArray.find((pv: any) => String(pv.value) === String(item.variant_name))
                  if (matchingPv) {
                    variantAttributes = { [matchingPv.attribute]: matchingPv.value }
                    break
                  }
                }
              }
            }
          }

          if (variantAttributes && typeof variantAttributes === 'object' && Object.keys(variantAttributes).length > 0) {
            const variants = await getProductVariants(item.product_id)
            if (!variants || variants.length === 0) continue

            for (const variant of variants) {
              let primaryValues = variant.primary_values
              if (typeof primaryValues === 'string') {
                try {
                  primaryValues = JSON.parse(primaryValues)
                } catch (e) {
                  logger.error(`Error parsing primary_values for variant ${variant.id}`, e)
                  continue
                }
              }
              if (!primaryValues || !Array.isArray(primaryValues)) continue

              let updated = false
              const updatedPrimaryValues = primaryValues.map((pv: any) => {
                const matches = Object.entries(variantAttributes).some(
                  ([key, value]) => pv.attribute === key && String(pv.value) === String(value)
                )
                if (!matches) return pv
                const currentQty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(String(pv.quantity)) || 0
                const newQty = Math.max(0, currentQty - item.quantity)
                updated = true
                return { ...pv, quantity: newQty }
              })

              if (!updated) continue

              const { error: variantUpdateError } = await supabase
                .from('product_variants')
                .update({ primary_values: updatedPrimaryValues })
                .eq('id', variant.id)
              if (variantUpdateError) {
                logger.error(`Error updating variant ${variant.id}`, variantUpdateError)
                continue
              }

              const cachedVariants = productVariantsCache.get(item.product_id)
              if (cachedVariants) {
                const target = cachedVariants.find((cv) => cv.id === variant.id)
                if (target) target.primary_values = updatedPrimaryValues
              }
              dirtyVariantProductIds.add(item.product_id)
            }
          } else {
            const { data: product, error: fetchError } = await supabase
              .from('products')
              .select('stock_quantity, in_stock')
              .eq('id', item.product_id)
              .single()
            if (fetchError) {
              logger.error(`Error fetching product for stock reduction`, fetchError)
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
            if (updateError) logger.error(`Error updating product stock`, updateError)
          }
        } catch (stockError) {
          logger.error(`Error in stock reduction for product ${item.product_id}`, stockError)
        }
      }

      for (const productId of dirtyVariantProductIds) {
        const allVariants = (await getProductVariants(productId)) || []
        let totalStock = 0
        for (const v of allVariants) {
          let pvArray = v.primary_values
          if (typeof pvArray === 'string') {
            try {
              pvArray = JSON.parse(pvArray)
            } catch {
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
        const { error: productUpdateError } = await supabase
          .from('products')
          .update({
            stock_quantity: totalStock,
            in_stock: totalStock > 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', productId)
        if (productUpdateError) logger.error(`Error updating product stock`, productUpdateError)
      }
    }
  } catch (stockReductionError) {
    logger.error(`Error in stock reduction process`, stockReductionError)
  }

  if (order.user_id) {
    try {
      const { error: clearCartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', order.user_id)
      if (clearCartError) logger.warn('Failed to clear cart after payment')
    } catch {
      logger.warn('Error clearing cart after payment')
    }
  }
}

// ClickPesa webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    if (!validateIncomingWebhookSignature(request, body)) {
      return NextResponse.json(
        { error: 'Webhook signature validation failed' },
        { status: 401 }
      )
    }
      
    const payload = JSON.parse(body)
    // Extract payment information based on ClickPesa format
    // ClickPesa uses 'event' for PAYMENT RECEIVED and 'eventType' for PAYMENT FAILED
    const event = payload.event || payload.eventType
    const data = payload.data
    
    // Handle different event types
    let paymentStatus = 'unpaid'
    let orderReference = null
    let transactionId = null
    let paymentTimestamp = new Date().toISOString()
    let failureReason = null

    if (event === 'PAYMENT RECEIVED') {
      paymentStatus = 'paid'
      orderReference = data.orderReference
      // Transaction ID is in data.id for all events
      transactionId = data.id || data.paymentId || data.transactionId
      paymentTimestamp = data.updatedAt || data.createdAt
    } else if (event === 'PAYMENT FAILED') {
      paymentStatus = 'failed'
      orderReference = data.orderReference
      // Transaction ID is in data.id for all events
      transactionId = data.id || data.paymentId || data.transactionId
      paymentTimestamp = data.updatedAt || data.createdAt
      failureReason = data.message || 'Payment failed'
    } else {
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
    
    // Try multiple reference formats to find the order
    let { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('reference_id', normalizedReference)
      .single()
    
    // If not found, try original reference
    if (orderError && normalizedReference !== orderReference) {
      const result = await supabase
        .from('orders')
        .select('*')
        .eq('reference_id', orderReference)
        .single()

      order = result.data
      orderError = result.error
    }
    
    // If still not found, try case-insensitive search with all existing orders
    if (orderError) {
      const { data: allRecentOrders } = await supabase
        .from('orders')
        .select('id, reference_id, order_number, payment_status')
        .order('created_at', { ascending: false })
        .limit(10)
      
      void allRecentOrders
    }

    // If still not found, try retry reference matching (for cases like "e62d9c1ae22347bbbbd487bc87c72d71retry1759665048447")
    if (orderError) {
      // Check if this is a retry reference (contains "retry" followed by timestamp)
      const retryMatch = orderReference.match(/^(.+?)retry\d+$/)
      if (retryMatch) {
        const originalReference = retryMatch[1] // Get the part before "retry"
        const normalizedOriginalReference = originalReference.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
        
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
      baseReference = orderReference.split(' ')[0] // Get the first part before space
      const normalizedBaseReference = baseReference.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
      
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
      const result = await supabase
        .from('orders')
        .select('*')
        .eq('clickpesa_transaction_id', transactionId)
        .single()
      
      order = result.data
      orderError = result.error
    }

    // If order not found, check if it's a supplier upgrade payment (stored in profiles table)
    if (orderError || !order) {
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
        // This is a supplier upgrade payment - handle it here
        // Extract transaction ID from webhook payload (same as regular orders)
        let transactionId = data.id || data.paymentId || data.transactionId || null
        
        // Verify via API for security
        const { verifyTransactionWithClickPesa } = await import('@/lib/clickpesa-api')
        // Use supplier credentials for supplier upgrade payments
        const verification = await verifyTransactionWithClickPesa(orderReference, true)
        
        // SECURITY: Always ensure we have a transaction ID (use API verification as fallback)
        transactionId = resolveTransactionId(transactionId, verification.transactionId, orderReference)
        
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
        if (
          verification.transactionId &&
          transactionId &&
          verification.transactionId !== transactionId
        ) {
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
        }
        transactionId = resolveTransactionId(transactionId, verification.transactionId, orderReference)

        const replayLock = await acquireWebhookReplayLock(orderReference, transactionId, verifiedPaymentStatus)
        if (!replayLock.accepted) {
          logger.warn('Duplicate supplier upgrade webhook ignored (replay lock)', {
            orderReference,
            transactionId,
            paymentStatus: verifiedPaymentStatus,
            backend: replayLock.backend
          })
          return NextResponse.json({
            success: true,
            message: 'Duplicate webhook ignored',
            replay_protected: true
          })
        }
        
        // SECURITY: Validate status consistency - reject if mismatch
        if (verifiedStatus !== 'UNKNOWN' && verifiedStatus !== '') {
          const webhookStatusUpper = paymentStatus.toUpperCase()
          const apiStatusUpper = verifiedStatus
          
          // Map API status to our status format for comparison
          const apiMappedStatus = mapClickPesaStatusToPaymentStatus(apiStatusUpper)
          
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
        
        // Update profile payment status
        const { getSupabaseClient } = await import('@/lib/supabase-server')
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

    // Check if this is a manual trigger (skip API verification)
    const isManualTrigger = request.headers.get('x-manual-trigger') === 'true'
    
    let verification: any = { verified: false, transactionId: null, status: null }
    let verifiedStatus = ''
    let verifiedPaymentStatus = paymentStatus
    
    if (isManualTrigger) {
      // Skip API verification for manual triggers
      // Use webhook data directly for manual triggers
      verifiedStatus = 'MANUAL'
      verifiedPaymentStatus = paymentStatus
      
      // Ensure transaction ID is set (use provided or generate one)
      if (!transactionId) {
        transactionId = `MANUAL-${Date.now()}`
      }
    } else {
      // SECURITY: Always verify transaction via ClickPesa API before marking as confirmed
      // Use regular credentials for regular orders
      verification = await verifyTransactionWithClickPesa(orderReference, false)

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
      transactionId = resolveTransactionId(transactionId, verification.transactionId, orderReference)
    }

    const replayLock = await acquireWebhookReplayLock(orderReference, transactionId, verifiedPaymentStatus)
    if (!replayLock.accepted) {
      logger.warn('Duplicate order webhook ignored (replay lock)', {
        orderReference,
        transactionId,
        paymentStatus: verifiedPaymentStatus,
        backend: replayLock.backend
      })
      return NextResponse.json({
        success: true,
        message: 'Duplicate webhook ignored',
        replay_protected: true
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
    
    // If payment is successful, reduce stock quantities and clear cart (only if not already processed)
    const shouldProcessStock = paymentStatus === 'paid' && order.payment_status !== 'paid' && order.payment_status !== 'success'
    
    if (shouldProcessStock) {
      await processPaidOrderStockAndCart(supabase, order)
    }

    // Send real-time update to admin (if using Supabase Realtime)
    try {
      await supabase
        .from('orders')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', order.id)
    } catch {
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
  if (!signature || !secretKey) {
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
    
    const isValid = expectedSignature === receivedSignature
    return isValid
  } catch (error) {
    logger.error('CUSTOM WEBHOOK SIGNATURE VALIDATION ERROR', error)
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
  if (!signature) {
    return false
  }

  // Use provided secret key or fallback to CLICKPESA_CHECKSUM_KEY
  const checksumKey = secretKey || process.env.CLICKPESA_CHECKSUM_KEY
  if (!checksumKey) {
    return false
  }

  try {
    const payloadObj = JSON.parse(payload)
    
    // 1. Exclude checksum and checksumMethod fields
    const payloadForValidation = { ...payloadObj }
    delete payloadForValidation.checksum
    delete payloadForValidation.checksumMethod
    
    // 2. Recursively canonicalize payload (sort keys alphabetically at all nesting levels)
    const canonicalPayload = canonicalizeWebhook(payloadForValidation)
    
    // 3. Serialize to compact JSON (no extra whitespace)
    const payloadString = JSON.stringify(canonicalPayload)
    
    // 4. Generate HMAC-SHA256 hash
    const expectedSignature = crypto
      .createHmac('sha256', checksumKey)
      .update(payloadString)
      .digest('hex')

    // 4. Compare signatures
    const receivedSignature = signature.replace('sha256=', '')
    const isValid = expectedSignature === receivedSignature
    return isValid
  } catch (error) {
    logger.error('CHECKSUM VALIDATION ERROR', error)
    return false
  }
}

// Handle GET requests (for webhook verification)
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const challenge = url.searchParams.get('challenge')
  
  if (challenge) {
    return NextResponse.json({ challenge })
  }
  
  return NextResponse.json({ message: 'ClickPesa webhook endpoint is active' })
}
