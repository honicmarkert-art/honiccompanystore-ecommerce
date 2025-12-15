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
    
    console.log('\n' + '='.repeat(80))
    console.log('🔔 SUPPLIER UPGRADE WEBHOOK RECEIVED')
    console.log('='.repeat(80))
    console.log('📅 Timestamp:', timestamp)
    console.log('🌐 URL:', request.url)
    console.log('📡 Method:', request.method)
    console.log('📦 Body Length:', body.length, 'bytes')
    console.log('🔐 Has Signature:', !!signature)
    console.log('🔐 Signature Length:', signature?.length || 0)
    console.log('🔐 Signature (first 50):', signature ? signature.substring(0, 50) + '...' : 'NOT PROVIDED')
    
    console.log('\n📋 ALL HEADERS:')
    request.headers.forEach((value, key) => {
      const displayValue = key.toLowerCase().includes('secret') || key.toLowerCase().includes('key')
        ? '***MASKED***'
        : value.length > 100 
          ? value.substring(0, 100) + '...'
          : value
      console.log(`  ${key}: ${displayValue}`)
    })
    
    console.log('\n📄 BODY CONTENT (first 500 chars):')
    console.log(body.substring(0, 500))
    if (body.length > 500) {
      console.log('  ... (truncated, total length:', body.length, ')')
    }
    
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
    
    console.log('\n🔐 SIGNATURE VALIDATION:')
    console.log('  ClickPesa Signature:', signature ? 'PRESENT' : 'NOT PROVIDED')
    console.log('  Custom Signature (X-Webhook-Signature):', extractedCustomSignature ? 'PRESENT' : 'NOT PROVIDED')
    console.log('  Has CLICKPESA_WEBHOOK_SECRET:', hasWebhookSecret)
    console.log('  Has CLICKPESA_CHECKSUM_KEY:', hasChecksumKey)
    console.log('  Secret Key Available:', !!webhookSecret)
    console.log('  Secret Key Length:', webhookSecret?.length || 0)
    
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
      console.log('\n🔍 Attempting ClickPesa signature validation...')
      logger.log('🔍 Validating ClickPesa signature...')
      signatureValid = validateWebhook(body, signature, webhookSecret)
      if (signatureValid) {
        validationMethod = 'clickpesa'
        console.log('✅ ClickPesa signature validation PASSED')
        logger.log('✅ ClickPesa signature validation PASSED')
      } else {
        console.log('❌ ClickPesa signature validation FAILED')
        logger.log('❌ ClickPesa signature validation FAILED')
      }
    }
    
    // OPTION 3: Accept webhooks without signatures
    // Security is provided by ClickPesa API verification (happens later)
    // Signatures are optional - if provided, we validate them; if not, we rely on API verification
    if (!signature && !extractedCustomSignature) {
      console.log('\n⚠️ INFO: No signature provided')
      console.log('  ClickPesa Signature: NOT PROVIDED')
      console.log('  Custom Signature: NOT PROVIDED')
      console.log('  ✅ Will verify via ClickPesa API (primary security mechanism)')
      logger.log('⚠️ No signature provided - will verify via ClickPesa API', {
        hasClickPesaSignature: false,
        hasCustomSignature: false,
        bodyLength: body.length,
        timestamp: timestamp
      })
    }
    
    // FALLBACK: Try custom webhook signature validation if ClickPesa signature failed or not present
    if (!signatureValid && extractedCustomSignature && webhookSecret) {
      console.log('\n🔍 Attempting custom webhook signature validation (fallback - REQUIRED)...')
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
        console.log('✅ Custom webhook signature validation PASSED (fallback)')
        logger.log('✅ Custom webhook signature validation PASSED (fallback)')
      } else {
        console.log('❌ Custom webhook signature validation FAILED')
        logger.log('❌ Custom webhook signature validation FAILED')
      }
    }
    
    // REJECT only if signature was provided but validation failed
    // If no signature was provided, we'll proceed to API verification
    if ((signature || extractedCustomSignature) && !signatureValid) {
      console.log('\n❌ SECURITY REJECTION: Invalid signature provided')
      console.log('  Status: 401 Unauthorized')
      console.log('  ClickPesa Signature:', signature ? 'PRESENT but INVALID' : 'NOT PROVIDED')
      console.log('  Custom Signature:', extractedCustomSignature ? 'PRESENT but INVALID' : 'NOT PROVIDED')
      console.log('  Secret Key:', webhookSecret ? 'CONFIGURED' : 'NOT CONFIGURED')
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
      console.log(`✅ Signature validation PASSED using ${validationMethod} method`)
      logger.log(`✅ Supplier upgrade webhook signature validation PASSED using ${validationMethod} method`)
    } else {
      console.log('⚠️ No signature provided - proceeding to ClickPesa API verification')
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
    
    console.log('\n📦 PARSING PAYLOAD...')
    logger.log('Supplier upgrade webhook raw body:', parsedBody)
    
    // Try to parse using ClickPesa parser, but also handle raw payload
    let payload
    try {
      payload = parseWebhookPayload(parsedBody)
      console.log('✅ Payload parsed using ClickPesa parser')
    } catch (e) {
      // If parsing fails, try to extract data directly
      console.log('⚠️ Standard parsing failed, trying direct extraction')
      console.log('  Error:', e instanceof Error ? e.message : String(e))
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
      console.log('✅ Payload extracted directly')
    }
    
    console.log('📋 Extracted Payload:')
    console.log(JSON.stringify(payload, null, 2))
    logger.log('Supplier upgrade webhook payload:', payload)

    const { orderReference, transactionId, status, amount, currency } = payload

    if (!orderReference) {
      console.log('\n❌ ERROR: Missing orderReference in payload')
      console.log('  Status: 400 Bad Request')
      console.log('  Payload keys:', Object.keys(payload))
      logger.error('Missing orderReference in webhook payload:', payload)
      return NextResponse.json(
        { success: false, error: 'Missing orderReference' },
        { status: 400 }
      )
    }
    
    console.log('\n📊 EXTRACTED DATA:')
    console.log('  Order Reference:', orderReference)
    console.log('  Transaction ID:', transactionId || 'N/A')
    console.log('  Status:', status || 'N/A')
    console.log('  Amount:', amount || 'N/A')
    console.log('  Currency:', currency || 'N/A')

    const supabase = createAdminSupabaseClient()

    console.log('\n🔍 SEARCHING FOR PROFILE:')
    console.log('  Order Reference:', orderReference)
    console.log('  Normalized Reference:', orderReference.replace(/[^A-Za-z0-9]/g, ''))

    // Find payment transaction by reference ID in profiles table
    // Try exact match first, then try without hyphens
    let profile
    let findError
    
    // First try exact match
    console.log('  Query 1: Searching with exact reference...')
    const { data: profileExact, error: errorExact } = await supabase
      .from('profiles')
      .select('id, payment_reference_id, pending_plan_id, payment_status, supplier_plan_id')
      .eq('payment_reference_id', orderReference)
      .single()
    
    if (!errorExact && profileExact) {
      profile = profileExact
      console.log('  ✅ Found with exact reference')
    } else {
      // Try without hyphens (ClickPesa might remove them)
      const normalizedRef = orderReference.replace(/[^A-Za-z0-9]/g, '')
      console.log('  Query 2: Searching with normalized reference...')
      const { data: profileNormalized, error: errorNormalized } = await supabase
        .from('profiles')
        .select('id, payment_reference_id, pending_plan_id, payment_status, supplier_plan_id')
        .eq('payment_reference_id', normalizedRef)
        .single()
      
      if (!errorNormalized && profileNormalized) {
        profile = profileNormalized
        console.log('  ✅ Found with normalized reference')
      } else {
        findError = errorNormalized || errorExact
        console.log('  ❌ Not found with normalized reference')
        if (errorNormalized) {
          console.log('  Error:', errorNormalized.message)
          console.log('  Error Code:', errorNormalized.code)
        }
      }
    }

    if (findError || !profile || !profile.payment_reference_id) {
      console.log('\n❌ ERROR: Payment transaction not found')
      console.log('  Status: 404 Not Found')
      console.log('  Searched References:', [orderReference, orderReference.replace(/[^A-Za-z0-9]/g, '')].filter(Boolean))
      console.log('  Last Error:', findError?.message || 'No profile found')
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

    console.log('\n✅ PROFILE FOUND:')
    console.log('  Profile ID:', profile.id)
    console.log('  Payment Reference ID:', profile.payment_reference_id)
    console.log('  Pending Plan ID:', profile.pending_plan_id || 'N/A')
    console.log('  Current Payment Status:', profile.payment_status || 'N/A')
    console.log('  Current Supplier Plan ID:', profile.supplier_plan_id || 'N/A')

    // SECURITY: Always verify transaction via ClickPesa API before marking as confirmed
    console.log('\n🔐 VERIFYING TRANSACTION WITH CLICKPESA API:')
    console.log('  Order Reference:', orderReference)
    logger.log('🔐 Verifying transaction with ClickPesa API before confirmation:', {
      orderReference: orderReference,
      webhookStatus: status
    })
    
    // Use supplier credentials for supplier upgrade payments
    const verification = await verifyTransactionWithClickPesa(orderReference, true)
    
    console.log('  Verification Result:', verification.verified ? 'VERIFIED' : 'FAILED')
    console.log('  ClickPesa API Status:', verification.status)
    console.log('  Transaction ID:', verification.transactionId || 'N/A')
    console.log('  Amount:', verification.amount || 'N/A', verification.currency || 'N/A')
    if (verification.error) {
      console.log('  Error:', verification.error)
    }
    
    // If verification failed, reject the webhook
    if (!verification.verified) {
      console.log('\n❌ SECURITY REJECTION: Transaction verification failed')
      console.log('  Status: 401 Unauthorized')
      console.log('  Reason: Could not verify transaction with ClickPesa API')
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
        console.log('\n❌ SECURITY REJECTION: Transaction ID mismatch!')
        console.log('  Status: 401 Unauthorized')
        console.log('  Webhook Transaction ID:', transactionId)
        console.log('  API Transaction ID:', verification.transactionId)
        console.log('  ⚠️ Possible tampering detected - REJECTING webhook')
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
        console.log('  ✅ Transaction ID matches:', transactionId)
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
        console.log('\n❌ SECURITY REJECTION: Status mismatch detected!')
        console.log('  Status: 401 Unauthorized')
        console.log('  Webhook Status:', status, '(mapped:', webhookMappedStatus, ')')
        console.log('  API Status (mapped):', apiMappedStatus)
        console.log('  ⚠️ Possible tampering detected - REJECTING webhook')
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
    
    console.log('\n✅ TRANSACTION VERIFIED:')
    console.log('  ClickPesa API Status:', verifiedStatus, '(for reference only)')
    console.log('  Webhook Status (USED):', status)
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
    
    console.log('\n📊 PROCESSING PAYMENT STATUS:')
    console.log('  Webhook Status (USED):', status)
    console.log('  Status Upper:', statusUpper)
    console.log('  Status Lower:', statusLower)
    
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
          console.log('  Payment Expires At:', expirationDate.toISOString())
        }
      }
      
      console.log('  ✅ Status: PAID (VERIFIED)')
      console.log('  💳 Transaction ID:', finalTransactionId || 'N/A')
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
      console.log('  ❌ Status: FAILED')
      console.log('  📝 Reason:', updateData.payment_failure_reason)
      console.log('  💳 Transaction ID:', finalTransactionId)
      logger.log('Setting payment status to FAILED')
    } else {
      updateData.payment_status = 'pending'
      // Always set transaction ID even for pending payments
      updateData.clickpesa_transaction_id = finalTransactionId
      console.log('  ⚠️ Status: PENDING (unknown status:', status, ')')
      console.log('  💳 Transaction ID:', finalTransactionId)
      logger.log('Setting payment status to PENDING (unknown status)')
    }

    console.log('\n💾 UPDATING DATABASE:')
    console.log('  Update Data:', JSON.stringify(updateData, null, 2))
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', profile.id)

    if (updateError) {
      console.log('\n❌ ERROR: Database update failed')
      console.log('  Status: 500 Internal Server Error')
      console.log('  Error:', updateError.message)
      console.log('  Error Code:', updateError.code)
      console.log('  Error Details:', updateError.details)
      logger.error('Error updating payment transaction:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update transaction' },
        { status: 500 }
      )
    }

    const processingTime = Date.now() - startTime
    console.log('\n✅ WEBHOOK SUCCESS:')
    console.log('  Payment Status:', updateData.payment_status)
    console.log('  Reference ID:', orderReference)
    console.log('  Transaction ID:', transactionId || 'N/A')
    console.log('  Processing Time:', processingTime, 'ms')
    console.log('='.repeat(80))
    console.log('')
    
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
        
        console.log('✅ Notification created for supplier payment success')
        logger.log('Created payment success notification for supplier', {
          userId: profile.id,
          planName: planName,
          transactionId: finalTransactionId || orderReference
        })
      } catch (notifError) {
        console.error('Error creating payment success notification for supplier:', notifError)
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
        console.error('Error notifying admins of payment:', notifError)
        // Don't fail the webhook if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully'
    })
  } catch (error: any) {
    const processingTime = Date.now() - startTime
    console.log('\n❌ WEBHOOK ERROR:')
    console.log('  Status: 500 Internal Server Error')
    console.log('  Error Type:', error instanceof Error ? error.constructor.name : typeof error)
    console.log('  Error Message:', error?.message || String(error))
    if (error?.stack) {
      console.log('  Stack Trace:')
      console.log(error.stack.split('\n').slice(0, 10).map((line: string) => '    ' + line).join('\n'))
    }
    console.log('  Processing Time:', processingTime, 'ms')
    console.log('='.repeat(80))
    console.log('')
    logger.error('Error processing supplier upgrade webhook:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}



