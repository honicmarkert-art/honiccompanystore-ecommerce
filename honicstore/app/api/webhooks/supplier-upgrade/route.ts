import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { notifyAllAdmins, createNotification } from '@/lib/notification-helpers'
import { validateWebhook, parseWebhookPayload, verifyTransactionWithClickPesa } from '@/lib/clickpesa-api'

export const runtime = 'nodejs'

// POST /api/webhooks/supplier-upgrade - Handle ClickPesa webhook for supplier upgrades
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.text()
    const signature = request.headers.get('x-clickpesa-signature') || request.headers.get('signature') || ''

    const timestamp = new Date().toISOString()
    
    logger.log('Supplier upgrade webhook received:', {
      signature: signature ? signature.substring(0, 20) + '...' : 'NOT PROVIDED',
      bodyLength: body.length,
      timestamp: timestamp
    })

    // SECURITY: Signature validation with fallback
    // Primary: ClickPesa signature (x-clickpesa-signature or signature)
    // Fallback: Custom webhook signature (X-Webhook-Signature) using shared secret + HMAC-SHA256
    const webhookSecret = process.env.CLICKPESA_WEBHOOK_SECRET || process.env.CLICKPESA_CHECKSUM_KEY || ''
    const hasWebhookSecret = !!process.env.CLICKPESA_WEBHOOK_SECRET
    const hasChecksumKey = !!process.env.CLICKPESA_CHECKSUM_KEY
    
    // Check for custom webhook signature (fallback)
    const customSignature = request.headers.get('x-webhook-signature') || 
                            request.headers.get('X-Webhook-Signature') || 
                            ''
    
    // Extract custom signature (remove prefix if present like "sha256=")
    const extractedCustomSignature = customSignature.replace(/^sha256=/i, '').trim()
    
    logger.log('🔐 Supplier upgrade webhook signature validation:', {
      hasClickPesaSignature: !!signature,
      hasCustomSignature: !!extractedCustomSignature,
      hasSecret: !!webhookSecret,
      signatureLength: signature?.length || 0,
      customSignatureLength: extractedCustomSignature?.length || 0,
      bodyLength: body.length,
      timestamp: timestamp
    })
    
    let signatureValid = false
    let validationMethod = 'none'
    
    // PRIMARY: Try ClickPesa signature validation first
    if (signature && webhookSecret) {
      logger.log('🔍 Validating ClickPesa signature...')
      signatureValid = validateWebhook(body, signature, webhookSecret)
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
    if (!signatureValid && extractedCustomSignature && webhookSecret) {
      logger.log('🔍 Validating custom webhook signature (fallback - REQUIRED)...')
      
      // Use HMAC-SHA256 of raw body for custom signature
      const crypto = require('crypto')
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex')
      
      const receivedSignature = extractedCustomSignature.replace(/^sha256=/i, '').trim()
      signatureValid = expectedSignature === receivedSignature
      
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
      logger.error('❌ SECURITY: Supplier upgrade webhook rejected - Invalid signature provided', {
        hasClickPesaSignature: !!signature,
        hasCustomSignature: !!extractedCustomSignature,
        hasSecret: !!webhookSecret,
        bodyLength: body.length,
        timestamp: timestamp,
        headers: Object.fromEntries(request.headers.entries())
      })
      return NextResponse.json(
        { success: false, error: 'Webhook signature validation failed' },
        { status: 401 }
      )
    }
    
    if (signatureValid) {
      logger.log(`✅ Supplier upgrade webhook signature validation PASSED using ${validationMethod} method`)
    } else {
      logger.log('⚠️ No signature provided - proceeding to ClickPesa API verification (primary security)', {
        bodyLength: body.length,
        timestamp: timestamp
      })
    }

    // Parse webhook payload - handle both JSON string and object
    let parsedBody
    try {
      parsedBody = typeof body === 'string' ? JSON.parse(body) : body
    } catch (e) {
      parsedBody = body
    }
    
    logger.log('Supplier upgrade webhook raw body:', parsedBody)
    
    // Try to parse using ClickPesa parser, but also handle raw payload
    let payload
    try {
      payload = parseWebhookPayload(parsedBody)
    } catch (e) {
      // If parsing fails, try to extract data directly
      logger.log('Standard parsing failed, trying direct extraction:', e)
      // Handle nested data structure from ClickPesa webhooks
      const data = parsedBody.data || parsedBody
      payload = {
        orderReference: data.orderReference || data.order_reference || parsedBody.orderReference || parsedBody.order_reference || parsedBody.referenceId || parsedBody.reference_id,
        transactionId: data.id || data.paymentId || data.transactionId || data.transaction_id || parsedBody.transactionId || parsedBody.transaction_id || parsedBody.paymentId || parsedBody.payment_id,
        status: data.status || data.paymentStatus || data.payment_status || parsedBody.status || parsedBody.paymentStatus || parsedBody.payment_status,
        amount: data.amount || data.totalPrice || data.total_price || parsedBody.amount || parsedBody.totalPrice || parsedBody.total_price,
        currency: data.currency || data.orderCurrency || data.order_currency || parsedBody.currency || parsedBody.orderCurrency || parsedBody.order_currency
      }
    }
    
    logger.log('Supplier upgrade webhook payload:', payload)

    const { orderReference, transactionId, status, amount, currency } = payload

    if (!orderReference) {
      logger.error('Missing orderReference in webhook payload:', payload)
      return NextResponse.json(
        { success: false, error: 'Missing orderReference' },
        { status: 400 }
      )
    }
    
    const supabase = createAdminSupabaseClient()

    // Find payment transaction by reference ID in profiles table
    // Try exact match first, then try without hyphens
    let profile
    let findError
    
    // First try exact match
    const { data: profileExact, error: errorExact } = await supabase
      .from('profiles')
      .select('id, payment_reference_id, pending_plan_id, payment_status, supplier_plan_id')
      .eq('payment_reference_id', orderReference)
      .single()
    
    if (!errorExact && profileExact) {
      profile = profileExact
      } else {
      // Try without hyphens (ClickPesa might remove them)
      const normalizedRef = orderReference.replace(/[^A-Za-z0-9]/g, '')
      const { data: profileNormalized, error: errorNormalized } = await supabase
        .from('profiles')
        .select('id, payment_reference_id, pending_plan_id, payment_status, supplier_plan_id')
        .eq('payment_reference_id', normalizedRef)
        .single()
      
      if (!errorNormalized && profileNormalized) {
        profile = profileNormalized
        } else {
        findError = errorNormalized || errorExact
        if (errorNormalized) {
          }
      }
    }

    if (findError || !profile || !profile.payment_reference_id) {
      logger.error('Payment transaction not found:', {
        orderReference,
        error: findError,
        searchedRefs: [orderReference, orderReference.replace(/[^A-Za-z0-9]/g, '')]
      })
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // SECURITY: Always verify transaction via ClickPesa API before marking as confirmed
    logger.log('🔐 Verifying transaction with ClickPesa API before confirmation:', {
      orderReference: orderReference,
      webhookStatus: status
    })
    
    // Use supplier credentials for supplier upgrade payments
    const verification = await verifyTransactionWithClickPesa(orderReference, true)
    
    if (verification.error) {
      }
    
    // If verification failed, reject the webhook
    if (!verification.verified) {
      logger.error('❌ SECURITY: Supplier upgrade webhook rejected - Transaction verification failed', {
        orderReference: orderReference,
        profileId: profile.id,
        verificationError: verification.error,
        verificationStatus: verification.status
      })
      return NextResponse.json(
        { success: false, error: 'Transaction verification failed. Could not confirm transaction status with ClickPesa API.' },
        { status: 401 }
      )
    }
    
    // Always use webhook status as primary source
    // API verification confirms transaction exists, but webhook has the most current status
    const verifiedStatus = verification.status?.toUpperCase() || ''
    
    // SECURITY: Validate transaction ID to prevent tampering
    // If API returns a transaction ID, it MUST match the webhook transaction ID
    // SECURITY: Always ensure we have a transaction ID (use API verification as fallback)
    let finalTransactionId = transactionId
    if (verification.transactionId && transactionId) {
      if (verification.transactionId !== transactionId) {
        logger.error('❌ SECURITY: Supplier upgrade webhook rejected - Transaction ID mismatch (possible tampering)', {
          webhookTransactionId: transactionId,
          apiTransactionId: verification.transactionId,
          orderReference: orderReference,
          profileId: profile.id
        })
        return NextResponse.json(
          { success: false, error: 'Security validation failed: Transaction ID mismatch. Possible tampering detected.' },
          { status: 401 }
        )
      } else {
        finalTransactionId = transactionId
      }
    } else if (verification.transactionId && !transactionId) {
      // Use API transaction ID if webhook doesn't have one
      finalTransactionId = verification.transactionId
      logger.log('📝 Using transaction ID from ClickPesa API verification (webhook had none):', finalTransactionId)
    } else if (!finalTransactionId && verification.transactionId) {
      // Fallback: Use API transaction ID if we still don't have one
      finalTransactionId = verification.transactionId
      logger.log('📝 Using transaction ID from ClickPesa API verification as fallback:', finalTransactionId)
    }
    
    // CRITICAL: Ensure transaction ID is always set (use orderReference as last resort)
    if (!finalTransactionId) {
      logger.warn('⚠️ No transaction ID available from webhook or API - using orderReference as fallback')
      finalTransactionId = orderReference // Use orderReference as fallback to ensure field is never null
    }
    
    // SECURITY: Validate status consistency - reject if mismatch
    if (verifiedStatus !== 'UNKNOWN' && verifiedStatus !== '') {
      const webhookStatusUpper = String(status || '').toUpperCase()
      const apiStatusUpper = verifiedStatus
      
      // Map API status to our status format for comparison
      let apiMappedStatus = 'pending'
      if (apiStatusUpper === 'SUCCESS' || apiStatusUpper === 'SETTLED') {
        apiMappedStatus = 'paid'
      } else if (apiStatusUpper === 'FAILED' || apiStatusUpper === 'ERROR' || apiStatusUpper === 'CANCELLED' || apiStatusUpper === 'DECLINED') {
        apiMappedStatus = 'failed'
      }
      
      // Map webhook status for comparison
      let webhookMappedStatus = 'pending'
      if (webhookStatusUpper === 'SUCCESS' || webhookStatusUpper === 'PAID' || webhookStatusUpper === 'COMPLETED') {
        webhookMappedStatus = 'paid'
      } else if (webhookStatusUpper === 'FAILED' || webhookStatusUpper === 'ERROR' || webhookStatusUpper === 'CANCELLED') {
        webhookMappedStatus = 'failed'
      }
      
      if (apiMappedStatus !== webhookMappedStatus && webhookMappedStatus !== 'pending') {
        logger.error('❌ SECURITY: Supplier upgrade webhook rejected - Status mismatch (possible tampering)', {
          webhookStatus: status,
          webhookMappedStatus: webhookMappedStatus,
          apiStatus: apiMappedStatus,
          apiRawStatus: verifiedStatus,
          orderReference: orderReference,
          profileId: profile.id
        })
        return NextResponse.json(
          { success: false, error: 'Security validation failed: Status mismatch between webhook and API. Possible tampering detected.' },
          { status: 401 }
        )
      }
    }
    
    logger.log('✅ Transaction verified - using webhook status as primary source', {
      webhookStatus: status,
      apiStatus: verifiedStatus,
      orderReference: orderReference
    })

    // Update payment status in profile
    // The trigger will automatically update supplier_plan_id when payment_status becomes 'paid'
    // Always use webhook status as primary source
    const updateData: any = {
      payment_updated_at: new Date().toISOString()
    }

    // Handle webhook status (primary source)
    const statusUpper = String(status || '').toUpperCase()
    const statusLower = statusUpper.toLowerCase()
    
    logger.log('Processing payment status (using webhook):', { 
      webhookStatus: status, 
      statusUpper, 
      statusLower 
    })

    if (statusUpper === 'SUCCESS' || statusUpper === 'PAID' || statusUpper === 'COMPLETED' || 
        statusLower === 'success' || statusLower === 'paid' || statusLower === 'completed' ||
        statusLower === 'payment received') {
      updateData.payment_status = 'paid'
      updateData.payment_timestamp = new Date().toISOString()
      // Always set transaction ID (guaranteed to be set above)
      updateData.clickpesa_transaction_id = finalTransactionId
      // Clear failure reason when payment is successful
      updateData.payment_failure_reason = null
      
      // Calculate payment expiration date (1 month from payment date for Premium plan)
      if (profile.pending_plan_id) {
        const { data: plan } = await supabase
          .from('supplier_plans')
          .select('slug, term')
          .eq('id', profile.pending_plan_id)
          .single()
        
        if (plan?.slug === 'premium') {
          const paymentDate = new Date()
          const expirationDate = new Date(paymentDate)
          // Default to 1 month if term is not specified
          expirationDate.setMonth(expirationDate.getMonth() + 1)
          updateData.payment_expires_at = expirationDate.toISOString()
        }
      }
      
      logger.log('Setting payment status to PAID (verified via ClickPesa API)')
      // Note: supplier_plan_id will be updated automatically by the trigger
      // when payment_status changes to 'paid' and pending_plan_id is set
    } else if (statusUpper === 'FAILED' || statusUpper === 'CANCELLED' || statusUpper === 'ERROR' ||
               statusLower === 'failed' || statusLower === 'cancelled' || statusLower === 'error' ||
               statusLower === 'payment failed') {
      updateData.payment_status = 'failed'
      updateData.payment_failure_reason = verification.message || parsedBody?.data?.message || 'Payment failed'
      // Always set transaction ID even for failed payments
      updateData.clickpesa_transaction_id = finalTransactionId
      logger.log('Setting payment status to FAILED')
    } else {
      updateData.payment_status = 'pending'
      // Always set transaction ID even for pending payments
      updateData.clickpesa_transaction_id = finalTransactionId
      logger.log('Setting payment status to PENDING (unknown status)')
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', profile.id)

    if (updateError) {
      logger.error('Error updating payment transaction:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update transaction' },
        { status: 500 }
      )
    }

    const processingTime = Date.now() - startTime
    logger.log('Supplier payment transaction updated:', {
      referenceId: orderReference,
      status: updateData.payment_status,
      transactionId: transactionId
    })

    // Notify supplier when payment is successful
    if (updateData.payment_status === 'paid' && profile.pending_plan_id) {
      try {
        const { createNotification } = await import('@/lib/notification-helpers')
        const { data: plan } = await supabase
          .from('supplier_plans')
          .select('name, slug')
          .eq('id', profile.pending_plan_id)
          .single()
        
        const planName = plan?.name || 'Premium Plan'
        
        await createNotification(
          profile.id,
          'payment_received',
          'Payment Successful! ✅',
          `Your payment for ${planName} has been received successfully. Your account will be activated soon.`,
          {
            supplier_id: profile.id,
            transaction_id: finalTransactionId || orderReference,
            plan_slug: plan?.slug || 'premium',
            plan_name: planName,
            reference_id: orderReference
          }
        )
        
        logger.log('Created payment success notification for supplier', {
          userId: profile.id,
          planName: planName,
          transactionId: finalTransactionId || orderReference
        })

        // Send secure, non-promotional receipt email
        try {
          const { data: supplierProfile } = await supabase
            .from('profiles')
            .select('company_name, email, payment_amount, payment_currency')
            .eq('id', profile.id)
            .single()

          const userEmail = supplierProfile?.email
          if (userEmail) {
            const { sendSupplierPremiumReceiptEmail } = await import('@/lib/user-email-service')
            await sendSupplierPremiumReceiptEmail(userEmail, {
              companyName: supplierProfile?.company_name || userEmail,
              planName,
              amount: Number(supplierProfile?.payment_amount || 0),
              currency: supplierProfile?.payment_currency || 'TZS',
              referenceId: orderReference,
              transactionId: finalTransactionId || undefined,
              billingCycle: 'monthly', // current webhook doesn't carry billing cycle; safe default
              paymentDate: new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
              dashboardUrl: `${baseUrl}/supplier/dashboard`,
            })
          }
        } catch (emailError) {
          logger.error('Failed to send supplier premium receipt email', {
            error: emailError instanceof Error ? emailError.message : String(emailError),
            userId: profile.id,
          })
          // Do not fail webhook if email fails
        }
      } catch (notifError) {
        logger.error('Failed to create payment success notification', {
          error: notifError instanceof Error ? notifError.message : String(notifError),
          userId: profile.id
        })
        // Don't fail the webhook if notification fails
      }
    }

    // Notify admins when payment is received for Premium plan
    if (updateData.payment_status === 'paid' && profile.pending_plan_id) {
      try {
        const { data: plan } = await supabase
          .from('supplier_plans')
          .select('slug, name')
          .eq('id', profile.pending_plan_id)
          .single()

        if (plan?.slug === 'premium') {
          const { data: supplierProfile } = await supabase
            .from('profiles')
            .select('company_name, email')
            .eq('id', profile.id)
            .single()

          const companyName = supplierProfile?.company_name || supplierProfile?.email || 'Unknown'

          await notifyAllAdmins(
            'payment_received',
            'Premium Plan Payment Received 💰',
            `Payment received: ${companyName} upgraded to Premium plan. Transaction ID: ${transactionId || orderReference}`,
            {
              supplier_id: profile.id,
              company_name: companyName,
              email: supplierProfile?.email || '',
              transaction_id: transactionId || orderReference,
              plan_slug: 'premium',
              action_url: `/siem-dashboard/suppliers?highlight=${profile.id}`
            }
          )
        }
      } catch (notifError) {
        // Don't fail the webhook if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully'
    })
  } catch (error: any) {
    const processingTime = Date.now() - startTime
    logger.error('Error processing supplier upgrade webhook:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}



