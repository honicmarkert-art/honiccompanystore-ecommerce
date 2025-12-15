import { NextRequest, NextResponse } from "next/server"
import { logger } from '@/lib/logger'
import { 
  createCheckoutLink, 
  generateOrderReference,
  formatAmountForClickPesa,
  formatPhoneForClickPesa,
  generateChecksum,
  isClickPesaConfigured,
  getConfigStatus,
  testChecksumGeneration,
  validateWebhook,
  parseWebhookPayload,
  CLICKPESA_CLIENT_ID,
  CLICKPESA_API_KEY,
  CLICKPESA_CHECKSUM_KEY,
  type CheckoutLinkRequest 
} from "@/lib/clickpesa-api"
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/payment/clickpesa',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { success: false, error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }

    // Log the incoming request for debugging
    logger.log('ClickPesa API Request:', {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      timestamp: new Date().toISOString()
    })

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('ClickPesa API: Failed to parse request body:', parseError)
      return NextResponse.json({
        success: false,
        error: "Invalid JSON in request body",
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }, { status: 400 })
    }

    const { 
      action, 
      amount, 
      currency = "TZS",
      orderId,
      returnUrl,
      cancelUrl,
      customerDetails
    } = body

    logger.log('ClickPesa API: Parsed request body:', { action, amount, currency, orderId })

    // Check if ClickPesa is properly configured
    if (!isClickPesaConfigured()) {
      console.error("ClickPesa Configuration Status:", getConfigStatus())
      return NextResponse.json(
        { 
          success: false, 
          error: "Payment gateway is not properly configured. Please contact support.",
          debug: process.env.NODE_ENV === "development" ? getConfigStatus() : undefined
        },
        { status: 500 }
      )
    }

    if (action === "create-checkout-link") {
      // Validate required fields
      if (!amount || !orderId) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Missing required fields: amount and orderId are required" 
          },
          { status: 400 }
        )
      }

      if (!customerDetails) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Customer details are required" 
          },
          { status: 400 }
        )
      }

      // Validate currency
      if (!['TZS', 'USD'].includes(currency)) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Invalid currency. Supported currencies: TZS, USD" 
          },
          { status: 400 }
        )
      }

      // Validate amount
      const numAmount = parseFloat(amount)
      if (isNaN(numAmount) || numAmount <= 0) {
        logSecurityEvent('INVALID_AMOUNT', {
          endpoint: '/api/payment/clickpesa',
          amount: amount,
          orderId: orderId
        }, request)
        return NextResponse.json(
          { 
            success: false, 
            error: "Invalid amount. Amount must be a positive number" 
          },
          { status: 400 }
        )
      }

      // SECURITY: Validate order exists and amount matches (prevent tampering)
      const adminSupabase = createAdminSupabaseClient()
      const normalizedOrderRef = orderId.replace(/-/g, '')
      
      // Try to find order by reference_id (normalized, without hyphens)
      const { data: order, error: orderError } = await adminSupabase
        .from('orders')
        .select('id, reference_id, total_amount, currency, payment_status, status')
        .or(`reference_id.eq.${orderId},reference_id.eq.${normalizedOrderRef}`)
        .maybeSingle()

      if (orderError || !order) {
        logSecurityEvent('ORDER_NOT_FOUND', {
          endpoint: '/api/payment/clickpesa',
          orderId: orderId,
          normalizedRef: normalizedOrderRef,
          error: orderError?.message
        }, request)
        return NextResponse.json(
          { 
            success: false, 
            error: "Order not found. Please create an order first." 
          },
          { status: 404 }
        )
      }

      // SECURITY: Verify payment amount matches order total (prevent tampering)
      const orderTotal = parseFloat(order.total_amount?.toString() || '0')
      const amountDifference = Math.abs(numAmount - orderTotal)
      const tolerance = 0.01 // Allow 0.01 difference for floating point precision

      if (amountDifference > tolerance) {
        logSecurityEvent('AMOUNT_MISMATCH', {
          endpoint: '/api/payment/clickpesa',
          orderId: order.id,
          orderReference: order.reference_id,
          orderTotal: orderTotal,
          providedAmount: numAmount,
          difference: amountDifference,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }, request)
        return NextResponse.json(
          { 
            success: false, 
            error: "Payment amount does not match order total. Possible tampering detected." 
          },
          { status: 400 }
        )
      }

      // SECURITY: Verify order is in pending status (prevent double payment)
      if (order.payment_status === 'paid' || order.payment_status === 'success') {
        logSecurityEvent('DUPLICATE_PAYMENT_ATTEMPT', {
          endpoint: '/api/payment/clickpesa',
          orderId: order.id,
          orderReference: order.reference_id,
          currentStatus: order.payment_status,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }, request)
        return NextResponse.json(
          { 
            success: false, 
            error: "This order has already been paid." 
          },
          { status: 400 }
        )
      }

      // Use order currency if available, otherwise use provided currency
      const finalCurrency = (order.currency || currency) as 'TZS' | 'USD'
      
      logger.log('✅ Order validation passed:', {
        orderId: order.id,
        referenceId: order.reference_id,
        orderTotal: orderTotal,
        providedAmount: numAmount,
        currency: finalCurrency,
        paymentStatus: order.payment_status
      })

      try {
        // Log customer details for debugging
        logger.log('ClickPesa: Customer details received:', {
          fullName: customerDetails.fullName,
          email: customerDetails.email,
          phone: customerDetails.phone,
          firstName: customerDetails.firstName,
          lastName: customerDetails.lastName,
          address: customerDetails.address,
          city: customerDetails.city,
          country: customerDetails.country
        })

        // Prepare ClickPesa checkout link request
        // ClickPesa supports multiple payment methods: mobile money, cards, bank transfers
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                       process.env.NEXT_PUBLIC_APP_URL ||
                       (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined)
        
        if (!baseUrl) {
          console.error('❌ NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_APP_URL not configured')
          return NextResponse.json(
            { error: 'Server configuration error: Base URL not configured. Please set NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL environment variable.' },
            { status: 500 }
          )
        }
        
        const webhookUrl = `${baseUrl}/api/webhooks/clickpesa`
        
        const checkoutRequest: CheckoutLinkRequest = {
          totalPrice: formatAmountForClickPesa(numAmount),
          orderReference: normalizedOrderRef, // Use normalized reference (without hyphens)
          orderCurrency: finalCurrency,
          customerName: customerDetails.fullName || 
                       (customerDetails.firstName && customerDetails.lastName ? 
                        `${customerDetails.firstName} ${customerDetails.lastName}` : 
                        customerDetails.firstName || 'Customer'),
          customerEmail: customerDetails.email,
          customerPhone: customerDetails.phone ? formatPhoneForClickPesa(customerDetails.phone) : undefined,
          returnUrl: returnUrl,
          cancelUrl: cancelUrl,
          webhookUrl: webhookUrl
        }

        // Log final ClickPesa request for debugging and security
        logger.log('ClickPesa: Final checkout request (validated):', {
          orderId: order.id,
          orderReference: checkoutRequest.orderReference,
          totalPrice: checkoutRequest.totalPrice,
          orderCurrency: checkoutRequest.orderCurrency,
          orderTotal: orderTotal,
          amountValidated: true,
          customerName: checkoutRequest.customerName,
          customerEmail: checkoutRequest.customerEmail,
          customerPhone: checkoutRequest.customerPhone ? '***MASKED***' : undefined,
          returnUrl: checkoutRequest.returnUrl,
          cancelUrl: checkoutRequest.cancelUrl,
          webhookUrl: checkoutRequest.webhookUrl
        })
        
        logSecurityEvent('PAYMENT_LINK_CREATED', {
          endpoint: '/api/payment/clickpesa',
          orderId: order.id,
          orderReference: checkoutRequest.orderReference,
          amount: numAmount,
          currency: finalCurrency,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }, request)

        // Checksum will be generated automatically in createCheckoutLink function

        // Create checkout link
        // Create checkout link using regular credentials (not supplier)
        const checkoutResult = await createCheckoutLink(checkoutRequest, false)

        return NextResponse.json({
          success: true,
          checkoutLink: checkoutResult.checkoutLink,
          clientId: checkoutResult.clientId || CLICKPESA_CLIENT_ID,
          orderReference: checkoutRequest.orderReference,
          amount: checkoutRequest.totalPrice,
          currency: checkoutRequest.orderCurrency,
          configuredClientId: CLICKPESA_CLIENT_ID,
          supportedPaymentMethods: [
            'mobile_money',
            'credit_card',
            'debit_card',
            'bank_transfer'
          ],
          message: 'ClickPesa checkout link created successfully. Supports mobile money, cards, and bank transfers.'
        })

      } catch (error) {
        console.error("ClickPesa API Error:", error)
        
        return NextResponse.json(
          { 
            success: false, 
            error: error instanceof Error ? error.message : "Failed to create checkout link",
            debug: process.env.NODE_ENV === "development" ? {
              originalError: error instanceof Error ? error.message : String(error),
              config: getConfigStatus()
            } : undefined
          },
          { status: 500 }
        )
      }

    } else if (action === "webhook") {
      // Handle ClickPesa webhook with proper validation
      return await handleClickPesaWebhook(request)

    } else {
      return NextResponse.json(
        { success: false, error: "Invalid action. Supported actions: create-checkout-link, webhook" },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error("ClickPesa Route Error:", error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Internal server error. Please try again.",
        debug: process.env.NODE_ENV === "development" ? {
          error: error instanceof Error ? error.message : String(error)
        } : undefined
      },
      { status: 500 }
    )
  }
}

// Handle GET requests for webhook verification (if needed by ClickPesa)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const challenge = searchParams.get('challenge')
  
  // Some payment providers require webhook endpoint verification
  if (challenge) {
    return NextResponse.json({ challenge })
  }
  
  return NextResponse.json({ 
    message: "ClickPesa webhook endpoint",
    status: "active",
    timestamp: new Date().toISOString()
  })
}

// Handle ClickPesa webhook with proper validation
async function handleClickPesaWebhook(request: NextRequest) {
  try {
    // Get webhook signature for validation
    const signature = request.headers.get('x-clickpesa-signature') || 
                     request.headers.get('signature') ||
                     request.headers.get('authorization')
    
    if (!signature) {
      console.error('ClickPesa webhook: Missing signature')
      return NextResponse.json(
        { success: false, error: "Missing webhook signature" },
        { status: 401 }
      )
    }

    // Parse webhook payload
    const payload = await request.json()
    
    // Validate webhook signature
    const isValidSignature = validateWebhook(payload, signature, process.env.CLICKPESA_WEBHOOK_SECRET || '')
    
    if (!isValidSignature) {
      console.error('ClickPesa webhook: Invalid signature', { signature, payload })
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature" },
        { status: 401 }
      )
    }

    // Parse and validate webhook payload
    const webhookData = parseWebhookPayload(payload)
    
    logger.log('ClickPesa webhook received:', webhookData)

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null as any

    // Find order by reference
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', webhookData.orderReference)
      .single()

    if (orderError || !order) {
      console.error('ClickPesa webhook: Order not found', { orderReference: webhookData.orderReference, error: orderError })
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      )
    }

    // Update order status based on webhook data
    let newStatus = 'pending'
    let paymentStatus = 'pending'
    let updateData: any = {
      updated_at: new Date().toISOString()
    }

    switch (webhookData.status.toLowerCase()) {
      case 'completed':
      case 'success':
        newStatus = 'confirmed'
        paymentStatus = 'paid'
        updateData.status = newStatus
        updateData.payment_status = paymentStatus
        updateData.payment_confirmed_at = new Date().toISOString()
        updateData.payment_transaction_id = webhookData.transactionId
        break
      
      case 'failed':
      case 'error':
        newStatus = 'failed'
        paymentStatus = 'failed'
        updateData.status = newStatus
        updateData.payment_status = paymentStatus
        updateData.payment_failed_at = new Date().toISOString()
        updateData.payment_failure_reason = webhookData.status
        break
      
      case 'cancelled':
        newStatus = 'cancelled'
        paymentStatus = 'cancelled'
        updateData.status = newStatus
        updateData.payment_status = paymentStatus
        updateData.cancelled_at = new Date().toISOString()
        break
      
      default:
        console.warn('ClickPesa webhook: Unknown status', webhookData.status)
        newStatus = 'pending'
        paymentStatus = 'pending'
    }

    // Update order in database
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order.id)

    if (updateError) {
      console.error('ClickPesa webhook: Failed to update order', { orderId: order.id, error: updateError })
      return NextResponse.json(
        { success: false, error: "Failed to update order" },
        { status: 500 }
      )
    }

    // If payment is successful, reduce stock quantities (only if not already reduced)
    if (paymentStatus === 'paid' && order.payment_status !== 'paid' && order.payment_status !== 'success') {
      try {
        logger.log('📦 Reducing stock for paid order via payment webhook:', order.id)
        
        // Get order items to reduce stock
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, quantity, variant_attributes')
          .eq('order_id', order.id)

        if (itemsError) {
          console.error('❌ Error fetching order items for stock reduction:', itemsError)
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
                  console.error('❌ Error fetching variants for stock reduction:', item.product_id, variantsError)
                  continue
                }

                // Find and update the matching primaryValue quantities
                // Each attribute in variant_attributes should match a primaryValue
                for (const variant of variants) {
                  if (!variant.primary_values || !Array.isArray(variant.primary_values)) continue

                  let updated = false
                  const updatedPrimaryValues = variant.primary_values.map((pv: any) => {
                    // Check if this primaryValue matches any attribute in the order item
                    // For each attribute in variant_attributes, find the matching primaryValue
                    const matchingAttribute = Object.entries(item.variant_attributes).find(
                      ([key, value]) => pv.attribute === key && pv.value === value
                    )

                    if (matchingAttribute) {
                      // This primaryValue matches one of the ordered attributes
                      const currentQty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                      const newQty = Math.max(0, currentQty - item.quantity)
                      updated = true
                      logger.log(`✅ Reducing attribute stock: ${pv.attribute}="${pv.value}" by ${item.quantity} (${currentQty} -> ${newQty})`)
                      return { ...pv, quantity: newQty }
                    }
                    return pv
                  })

                  if (updated) {
                    // Update variant with decremented primaryValues
                    const { error: variantUpdateError } = await supabase
                      .from('product_variants')
                      .update({ primary_values: updatedPrimaryValues })
                      .eq('id', variant.id)

                    if (variantUpdateError) {
                      console.error(`❌ Error updating variant ${variant.id}:`, variantUpdateError)
                      continue
                    }

                    logger.log(`✅ Variant ${variant.id} updated with new primary_values`)

                    // Recalculate total stock from ALL variants for this product
                    const { data: allVariants, error: allVariantsError } = await supabase
                      .from('product_variants')
                      .select('primary_values')
                      .eq('product_id', item.product_id)

                    if (!allVariantsError && allVariants) {
                      // Sum up all quantities from all primaryValues across all variants
                      let totalStock = 0
                      for (const v of allVariants) {
                        if (v.primary_values && Array.isArray(v.primary_values)) {
                          for (const pv of v.primary_values) {
                            const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                            totalStock += qty
                          }
                        }
                      }

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
                        console.error(`❌ Error updating product stock:`, productUpdateError)
                      } else {
                        logger.log(`✅ Product ${item.product_id} total stock updated to: ${totalStock}`)
                      }
                    }
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
                  console.error('❌ Error fetching product for stock reduction:', item.product_id, fetchError)
                  continue
                }

                const currentStock = product.stock_quantity || 0
                const newStock = Math.max(0, currentStock - item.quantity)
                const isInStock = newStock > 0

                const { error: stockUpdateError } = await supabase
                  .from('products')
                  .update({
                    stock_quantity: newStock,
                    in_stock: isInStock,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', item.product_id)

                if (stockUpdateError) {
                  console.error('❌ Error updating stock for product:', item.product_id, stockUpdateError)
                } else {
                  logger.log('✅ Stock reduced for product:', item.product_id, 'by', item.quantity, `(${currentStock} -> ${newStock})`)
                }
              }
            } catch (stockError) {
              console.error('❌ Error in stock reduction for product:', item.product_id, stockError)
            }
          }
        }
      } catch (stockReductionError) {
        console.error('❌ Error in stock reduction process:', stockReductionError)
      }
    }

    // If payment failed or cancelled, release reserved stock (if any was reserved)
    if (newStatus === 'failed' || newStatus === 'cancelled') {
      // Note: Stock is not reserved during checkout, so no need to release
      logger.log('📦 Payment failed/cancelled - no stock to release (stock not reserved during checkout)')
    }

    // Log successful webhook processing
    logger.log(`ClickPesa webhook processed successfully: Order ${order.id} -> Status: ${newStatus}`)

    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully",
      orderId: order.id,
      status: newStatus
    })

  } catch (error) {
    console.error('ClickPesa webhook error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Webhook processing failed",
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    )
  }
}


