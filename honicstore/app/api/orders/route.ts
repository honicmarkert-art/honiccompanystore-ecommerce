import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateOrderIds, formatPickupId } from '@/lib/order-ids'
import { logger } from '@/lib/logger'
import { secureOrderCreation, ReferenceIdSecurity } from '@/lib/reference-id-security'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { securityUtils } from '@/lib/secure-config'
import { validateAuth } from '@/lib/auth-server'
import { emailService } from '@/lib/email-service'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
function getSupabaseClient() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!url || !serviceKey) {
      throw new Error('Missing Supabase environment variables')
    }
    
    return createClient(url, serviceKey, { 
      auth: { autoRefreshToken: false, persistSession: false } 
    })
  } catch (error: any) {
    throw new Error(error.message)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/orders',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }

    const supabase = getSupabaseClient()
    
    // Parse order data
    const orderData = await request.json()

    // Security: If userId is provided (not null), validate authentication
    // Guest checkout: userId can be null, which is allowed without authentication
    if (orderData.userId !== null && orderData.userId !== undefined) {
      const { user: authUser, error: authError } = await validateAuth(request)
      
      if (authError || !authUser) {
        logSecurityEvent('UNAUTHENTICATED_USER_ID_PROVIDED', {
          endpoint: '/api/orders',
          providedUserId: orderData.userId,
          error: authError
        }, request)
        return NextResponse.json(
          { error: 'Authentication required when userId is provided' },
          { status: 401 }
        )
      }

      // Security: Ensure userId matches authenticated user
      if (authUser.id !== orderData.userId) {
        logSecurityEvent('USER_ID_MISMATCH', {
          endpoint: '/api/orders',
          providedUserId: orderData.userId,
          authenticatedUserId: authUser.id
        }, request)
        return NextResponse.json(
          { error: 'User ID mismatch' },
          { status: 403 }
        )
      }
    }
    // Guest checkout: If userId is null, proceed without authentication (allowed)
    
    // SECURITY: Validate and fetch prices from database (prevent price tampering)
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      logSecurityEvent('INVALID_ORDER_ITEMS', {
        endpoint: '/api/orders',
        itemsCount: orderData.items?.length || 0
      }, request)
      return NextResponse.json(
        { error: 'Order must contain at least one item' },
        { status: 400 }
      )
    }

    // Fetch all product IDs and variant IDs from order
    const productIds = [...new Set(orderData.items.map((item: any) => item.productId).filter(Boolean))]
    const variantIds = orderData.items
      .map((item: any) => item.variantId)
      .filter((id: any) => id !== null && id !== undefined)
      .map((id: any) => parseInt(id))
      .filter((id: number) => !isNaN(id))

    // Fetch products from database
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, name, in_stock, stock_quantity')
      .in('id', productIds)

    if (productsError || !products) {
      logSecurityEvent('PRODUCTS_FETCH_ERROR', {
        endpoint: '/api/orders',
        error: productsError?.message
      }, request)
      return NextResponse.json(
        { error: 'Failed to validate products', details: productsError?.message },
        { status: 500 }
      )
    }

    // Create product map for quick lookup
    const productMap = new Map(products.map((p: any) => [p.id, p]))

    // Fetch variants if any exist
    let variantMap = new Map()
    if (variantIds.length > 0) {
      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, product_id, price, primary_values')
        .in('id', variantIds)

      if (variantsError) {
        logSecurityEvent('VARIANTS_FETCH_ERROR', {
          endpoint: '/api/orders',
          error: variantsError.message
        }, request)
        return NextResponse.json(
          { error: 'Failed to validate product variants', details: variantsError.message },
          { status: 500 }
        )
      }

      if (variants) {
        variantMap = new Map(variants.map((v: any) => [v.id, v]))
      }
    }

    // SECURITY: Validate and recalculate prices server-side
    const validatedItems: any[] = []
    let serverCalculatedSubtotal = 0

    for (const clientItem of orderData.items) {
      // Validate required fields
      if (!clientItem.productId || !clientItem.quantity) {
        logSecurityEvent('INVALID_ORDER_ITEM', {
          endpoint: '/api/orders',
          productId: clientItem.productId,
          quantity: clientItem.quantity
        }, request)
        return NextResponse.json(
          { error: 'Invalid order item: missing productId or quantity' },
          { status: 400 }
        )
      }

      // Validate quantity is positive integer
      const quantity = parseInt(String(clientItem.quantity))
      if (isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
        logSecurityEvent('INVALID_QUANTITY', {
          endpoint: '/api/orders',
          productId: clientItem.productId,
          quantity: clientItem.quantity
        }, request)
        return NextResponse.json(
          { error: `Invalid quantity for product ${clientItem.productId}` },
          { status: 400 }
        )
      }

      // Get product from database
      const product = productMap.get(clientItem.productId)
      if (!product) {
        logSecurityEvent('PRODUCT_NOT_FOUND', {
          endpoint: '/api/orders',
          productId: clientItem.productId
        }, request)
        return NextResponse.json(
          { error: `Product ${clientItem.productId} not found` },
          { status: 404 }
        )
      }

      // Check stock availability
      if (!product.in_stock) {
        return NextResponse.json(
          { error: `Product ${product.name || clientItem.productId} is out of stock` },
          { status: 400 }
        )
      }

      // Determine actual price: use variant price if variant exists, otherwise product price
      let actualUnitPrice = product.price
      if (clientItem.variantId) {
        const variantId = parseInt(String(clientItem.variantId))
        if (!isNaN(variantId)) {
          const variant = variantMap.get(variantId)
          if (variant && variant.product_id === clientItem.productId) {
            // Check if variant has price in primary_values
            if (variant.primary_values && Array.isArray(variant.primary_values)) {
              const primaryValueWithPrice = variant.primary_values.find((pv: any) => pv.price)
              if (primaryValueWithPrice && primaryValueWithPrice.price) {
                actualUnitPrice = parseFloat(primaryValueWithPrice.price)
              } else if (variant.price) {
                actualUnitPrice = parseFloat(variant.price)
              }
            } else if (variant.price) {
              actualUnitPrice = parseFloat(variant.price)
            }
          }
        }
      }

      // Validate price is valid number
      if (isNaN(actualUnitPrice) || actualUnitPrice <= 0) {
        logSecurityEvent('INVALID_PRICE', {
          endpoint: '/api/orders',
          productId: clientItem.productId,
          variantId: clientItem.variantId,
          calculatedPrice: actualUnitPrice
        }, request)
        return NextResponse.json(
          { error: `Invalid price for product ${clientItem.productId}` },
          { status: 400 }
        )
      }

      // Calculate server-side total
      const serverTotalPrice = actualUnitPrice * quantity

      // SECURITY: Compare client-provided price with server-calculated price
      const clientUnitPrice = parseFloat(clientItem.unitPrice || clientItem.price || '0')
      const clientTotalPrice = parseFloat(clientItem.totalPrice || '0')
      const priceTolerance = 0.01 // Allow 0.01 difference for floating point precision

      const unitPriceDifference = Math.abs(clientUnitPrice - actualUnitPrice)
      const totalPriceDifference = Math.abs(clientTotalPrice - serverTotalPrice)

      if (unitPriceDifference > priceTolerance || totalPriceDifference > priceTolerance) {
        logSecurityEvent('PRICE_TAMPERING_DETECTED', {
          endpoint: '/api/orders',
          productId: clientItem.productId,
          variantId: clientItem.variantId,
          clientUnitPrice: clientUnitPrice,
          serverUnitPrice: actualUnitPrice,
          clientTotalPrice: clientTotalPrice,
          serverTotalPrice: serverTotalPrice,
          unitPriceDiff: unitPriceDifference,
          totalPriceDiff: totalPriceDifference,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }, request)
        return NextResponse.json(
          { error: 'Price mismatch detected. Please refresh and try again.' },
          { status: 400 }
        )
      }

      // Sanitize product and variant names
      const sanitizedProductName = securityUtils.sanitizeInput(
        product.name || clientItem.productName || `Product ${clientItem.productId}`
      )
      const sanitizedVariantName = clientItem.variantName 
        ? securityUtils.sanitizeInput(clientItem.variantName)
        : 'Default'

      // Use server-calculated prices (more secure)
      validatedItems.push({
        order_id: null, // Will be set after order creation
        product_id: clientItem.productId,
        product_name: sanitizedProductName,
        variant_id: clientItem.variantId ? parseInt(String(clientItem.variantId)) : null,
        variant_name: sanitizedVariantName,
        quantity: quantity,
        price: actualUnitPrice, // Use server-fetched price
        total_price: serverTotalPrice, // Use server-calculated total
        created_at: new Date().toISOString(),
      })

      serverCalculatedSubtotal += serverTotalPrice
    }

    // SECURITY: Calculate shipping fee server-side
    const FREE_SHIPPING_THRESHOLD = 100000
    const SHIPPING_COST = 5000
    let serverShippingFee = 0

    if (orderData.deliveryOption !== 'pickup') {
      if (serverCalculatedSubtotal >= FREE_SHIPPING_THRESHOLD) {
        serverShippingFee = 0
      } else {
        // Check if all products have free delivery
        const allProductsHaveFreeDelivery = validatedItems.every((item: any) => {
          const product = productMap.get(item.product_id)
          return product && (product as any).free_delivery === true
        })
        serverShippingFee = allProductsHaveFreeDelivery ? 0 : SHIPPING_COST
      }
    }

    // SECURITY: Validate and recalculate promotion discount server-side
    let serverPromotionDiscount = 0
    if (orderData.promotionCode) {
      try {
        const promotionCode = String(orderData.promotionCode).toUpperCase().trim()
        const now = new Date().toISOString()
        
        // Fetch promotion from database
        const { data: promotion, error: promoError } = await supabase
          .from('supplier_promotions')
          .select('*')
          .eq('code', promotionCode)
          .eq('is_active', true)
          .gte('end_date', now)
          .lte('start_date', now)
          .single()

        if (promoError || !promotion) {
          logSecurityEvent('INVALID_PROMOTION_CODE', {
            endpoint: '/api/orders',
            code: promotionCode,
            error: promoError?.message
          }, request)
          return NextResponse.json(
            { error: 'Invalid or expired promotion code' },
            { status: 400 }
          )
        }

        // Check usage limit
        if (promotion.usage_limit && promotion.used_count >= promotion.usage_limit) {
          logSecurityEvent('PROMOTION_USAGE_LIMIT_EXCEEDED', {
            endpoint: '/api/orders',
            code: promotionCode,
            usedCount: promotion.used_count,
            limit: promotion.usage_limit
          }, request)
          return NextResponse.json(
            { error: 'Promotion code has reached its usage limit' },
            { status: 400 }
          )
        }

        // Get product IDs from order items
        const orderProductIds = validatedItems.map(item => item.product_id)
        
        // Fetch products to verify supplier ownership
        const { data: orderProducts, error: productsError } = await supabase
          .from('products')
          .select('id, supplier_id, user_id, price')
          .in('id', orderProductIds)

        if (productsError || !orderProducts) {
          logSecurityEvent('PROMOTION_PRODUCTS_FETCH_ERROR', {
            endpoint: '/api/orders',
            error: productsError?.message
          }, request)
          return NextResponse.json(
            { error: 'Failed to validate promotion products' },
            { status: 500 }
          )
        }

        // Filter products that belong to the promotion's supplier
        const supplierProductIds = orderProducts
          .filter((p: any) => p.supplier_id === promotion.supplier_id || p.user_id === promotion.supplier_id)
          .map((p: any) => p.id)

        // Check if order contains any products from the promotion's supplier
        if (supplierProductIds.length === 0) {
          logSecurityEvent('PROMOTION_SUPPLIER_MISMATCH', {
            endpoint: '/api/orders',
            code: promotionCode,
            promotionSupplierId: promotion.supplier_id
          }, request)
          return NextResponse.json(
            { error: 'Promotion code does not apply to items in your order' },
            { status: 400 }
          )
        }

        // Check if promotion applies to specific products
        if (!promotion.applies_to_all_products && promotion.product_ids && promotion.product_ids.length > 0) {
          const hasApplicableProduct = supplierProductIds.some((id: number) => 
            promotion.product_ids.includes(String(id))
          )
          
          if (!hasApplicableProduct) {
            logSecurityEvent('PROMOTION_PRODUCT_MISMATCH', {
              endpoint: '/api/orders',
              code: promotionCode
            }, request)
            return NextResponse.json(
              { error: 'Promotion code does not apply to items in your order' },
              { status: 400 }
            )
          }
        }

        // Calculate subtotal only for products from the promotion's supplier
        const supplierOrderItems = validatedItems.filter(item => 
          supplierProductIds.includes(item.product_id)
        )

        const supplierSubtotal = supplierOrderItems.reduce((sum: number, item: any) => {
          return sum + item.total_price
        }, 0)

        // Check minimum purchase amount
        if (promotion.min_purchase_amount && supplierSubtotal < promotion.min_purchase_amount) {
          logSecurityEvent('PROMOTION_MIN_PURCHASE_NOT_MET', {
            endpoint: '/api/orders',
            code: promotionCode,
            supplierSubtotal: supplierSubtotal,
            minPurchase: promotion.min_purchase_amount
          }, request)
          return NextResponse.json(
            { 
              error: `Minimum purchase of ${promotion.min_purchase_amount} TZS required for this promotion`,
              minPurchase: promotion.min_purchase_amount
            },
            { status: 400 }
          )
        }

        // Calculate discount based on supplier's products subtotal only
        if (promotion.discount_type === 'percentage') {
          serverPromotionDiscount = (supplierSubtotal * promotion.discount_value) / 100
          // Apply max discount cap if set
          if (promotion.max_discount_amount && serverPromotionDiscount > promotion.max_discount_amount) {
            serverPromotionDiscount = promotion.max_discount_amount
          }
        } else {
          serverPromotionDiscount = promotion.discount_value
        }

        // Ensure discount doesn't exceed supplier subtotal
        serverPromotionDiscount = Math.min(serverPromotionDiscount, supplierSubtotal)

        // SECURITY: Compare client-provided discount with server-calculated discount
        const clientDiscount = parseFloat(orderData.promotionDiscount || '0') || 0
        const discountDifference = Math.abs(clientDiscount - serverPromotionDiscount)
        const discountTolerance = 0.01

        if (discountDifference > discountTolerance) {
          logSecurityEvent('PROMOTION_DISCOUNT_TAMPERING_DETECTED', {
            endpoint: '/api/orders',
            code: promotionCode,
            clientDiscount: clientDiscount,
            serverDiscount: serverPromotionDiscount,
            difference: discountDifference,
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
          }, request)
          return NextResponse.json(
            { error: 'Promotion discount mismatch detected. Please refresh and try again.' },
            { status: 400 }
          )
        }

      } catch (promoValidationError: any) {
        logSecurityEvent('PROMOTION_VALIDATION_ERROR', {
          endpoint: '/api/orders',
          error: promoValidationError?.message
        }, request)
        return NextResponse.json(
          { error: 'Failed to validate promotion code' },
          { status: 500 }
        )
      }
    }

    // Calculate server-side total
    const serverCalculatedTotal = serverCalculatedSubtotal + serverShippingFee - serverPromotionDiscount

    // SECURITY: Compare client-provided total with server-calculated total
    const clientTotal = parseFloat(orderData.totalAmount || '0')
    const totalDifference = Math.abs(clientTotal - serverCalculatedTotal)
    const totalTolerance = 0.01

    if (totalDifference > totalTolerance) {
      logSecurityEvent('TOTAL_AMOUNT_TAMPERING_DETECTED', {
        endpoint: '/api/orders',
        clientTotal: clientTotal,
        serverTotal: serverCalculatedTotal,
        difference: totalDifference,
        subtotal: serverCalculatedSubtotal,
        shipping: serverShippingFee,
        promotion: serverPromotionDiscount,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      }, request)
      return NextResponse.json(
        { error: 'Order total mismatch detected. Please refresh and try again.' },
        { status: 400 }
      )
    }

    // Generate dual ID system
    console.log('📝 [ORDER-API] Step 1: Generating order IDs...')
    const { referenceId, pickupId } = generateOrderIds()
    
    // Remove hyphens from UUID for consistent format
    const cleanReferenceId = referenceId.replace(/-/g, '')
    console.log('📝 [ORDER-API] Step 1: Order IDs generated', { 
      referenceId: cleanReferenceId, 
      pickupId 
    })
    
    // Create order record with server-calculated total
    const basicOrderData = {
      order_number: orderData.orderNumber,
      reference_id: cleanReferenceId,
      pickup_id: pickupId,
      user_id: orderData.userId || null,
      shipping_address: orderData.shippingAddress,
      billing_address: orderData.sameAsShipping ? orderData.shippingAddress : orderData.billingAddress,
      delivery_option: orderData.deliveryOption,
      total_amount: serverCalculatedTotal, // Use server-calculated total
      payment_method: 'clickpesa',
      payment_status: 'pending',
      status: 'pending',
      created_at: orderData.timestamp,
      updated_at: new Date().toISOString(),
    } as any

    // Use secure order creation with reference_id validation
    console.log('💾 [ORDER-API] Step 2: Creating order in database...', {
      orderNumber: basicOrderData.order_number,
      referenceId: basicOrderData.reference_id,
      totalAmount: basicOrderData.total_amount
    })
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    const creationResult = await secureOrderCreation(basicOrderData, null, clientIP)
    
    if (!creationResult.success) {
      console.error('❌ [ORDER-API] Step 2: Order creation failed', { 
        error: creationResult.error 
      })
      return NextResponse.json(
        { error: 'Order creation failed', details: creationResult.error },
        { status: 500 }
      )
    }
    
    const order = creationResult.data
    console.log('✅ [ORDER-API] Step 2: Order created successfully', {
      orderId: order.id,
      referenceId: order.reference_id
    })

    // Set order_id for all items
    const orderItemsData = validatedItems.map(item => ({
      ...item,
      order_id: order.id
    }))

    // Create order items with server-validated prices
    console.log('📦 [ORDER-API] Step 3: Creating order items...', {
      itemCount: orderItemsData.length,
      orderId: order.id
    })
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) {
      console.error('❌ [ORDER-API] Step 3: Order items creation failed', {
        error: itemsError.message
      })
      return NextResponse.json(
        { error: 'Order items creation failed', details: itemsError.message },
        { status: 500 }
      )
    }
    
    console.log('✅ [ORDER-API] Step 3: Order items created successfully')

    // Send order notification email to admin (optional - doesn't block order creation)
    try {
      console.log('📧 [ORDER-API] Step 4: Sending admin notification...', {
        orderId: order.id,
        orderNumber: order.order_number
      })

      const adminEmail = process.env.NEXT_PUBLIC_ORDER_EMAIL
      if (!adminEmail) {
        console.log('⚠️ [ORDER-API] Step 4: NEXT_PUBLIC_ORDER_EMAIL not configured, skipping email notification')
        console.log('📧 [EMAIL] Status: SKIPPED - No admin email configured')
      } else {
        console.log('📧 [EMAIL] Status: STARTING - Preparing to send order notification email')
        console.log('📧 [EMAIL] Configuration:', {
          adminEmail: adminEmail,
          hasResendApiKey: !!process.env.RESEND_API_KEY,
          smtpHost: process.env.SMTP_HOST || 'Not configured',
          smtpUser: process.env.SMTP_USER || 'Not configured'
        })
        // Format order items for email
        const orderItemsHtml = orderItemsData.map((item, index) => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${index + 1}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product_name || `Product ${item.product_id}`}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.variant_name || 'Default'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.price || 0).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS' })}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.total_price || 0).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS' })}</td>
          </tr>
        `).join('')

        const orderItemsText = orderItemsData.map((item, index) => 
          `${index + 1}. ${item.product_name || `Product ${item.product_id}`} (${item.variant_name || 'Default'}) - Qty: ${item.quantity} - ${(item.total_price || 0).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS' })}`
        ).join('\n')

        // Get customer info
        const customerName = orderData.shippingAddress?.fullName || orderData.billingAddress?.fullName || 'Guest Customer'
        const customerEmail = orderData.shippingAddress?.email || orderData.billingAddress?.email || 'No email provided'
        const customerPhone = orderData.shippingAddress?.phone || orderData.billingAddress?.phone || 'No phone provided'
        const deliveryOption = orderData.deliveryOption || 'shipping'
        
        // Get sender email
        const smtpUser = process.env.SMTP_USER
        const isResendSmtp = process.env.SMTP_HOST?.includes('resend.com') || smtpUser?.toLowerCase() === 'resend'
        let senderEmail = process.env.SMTP_SENDER_EMAIL_NOREPLY || 
                          process.env.NOREPLY_EMAIL || 
                          (isResendSmtp ? (process.env.SMTP_SENDER_EMAIL_INFO || 'noreply@mail.honiccompanystore.com') : smtpUser) ||
                          'noreply@mail.honiccompanystore.com'

        const emailSubject = `New Order Received: ${order.order_number}`
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Order Notification</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0;">New Order Received</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <h2 style="color: #1f2937; margin-top: 0;">Order Details</h2>
              
              <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                <p style="margin: 5px 0;"><strong>Order Number:</strong> ${order.order_number}</p>
                <p style="margin: 5px 0;"><strong>Reference ID:</strong> ${order.reference_id}</p>
                ${order.pickup_id ? `<p style="margin: 5px 0;"><strong>Pickup ID:</strong> ${order.pickup_id}</p>` : ''}
                <p style="margin: 5px 0;"><strong>Delivery Option:</strong> ${deliveryOption === 'pickup' ? 'Pickup' : 'Shipping'}</p>
                <p style="margin: 5px 0;"><strong>Total Amount:</strong> <span style="color: #059669; font-size: 1.2em; font-weight: bold;">${order.total_amount.toLocaleString('en-TZ', { style: 'currency', currency: 'TZS' })}</span></p>
                <p style="margin: 5px 0;"><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleString('en-TZ', { timeZone: 'Africa/Dar_es_Salaam' })}</p>
              </div>

              <h3 style="color: #1f2937; margin-top: 20px;">Customer Information</h3>
              <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 5px 0;"><strong>Name:</strong> ${customerName}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${customerEmail}</p>
                <p style="margin: 5px 0;"><strong>Phone:</strong> ${customerPhone}</p>
              </div>

              ${deliveryOption === 'shipping' && orderData.shippingAddress ? `
              <h3 style="color: #1f2937; margin-top: 20px;">Shipping Address</h3>
              <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 5px 0;">${orderData.shippingAddress.address1 || ''}</p>
                ${orderData.shippingAddress.address2 ? `<p style="margin: 5px 0;">${orderData.shippingAddress.address2}</p>` : ''}
                <p style="margin: 5px 0;">${orderData.shippingAddress.city || ''}, ${orderData.shippingAddress.state || ''}</p>
                <p style="margin: 5px 0;">${orderData.shippingAddress.postalCode || ''}</p>
                <p style="margin: 5px 0;">${orderData.shippingAddress.country || 'Tanzania'}</p>
              </div>
              ` : ''}

              <h3 style="color: #1f2937; margin-top: 20px;">Order Items</h3>
              <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">#</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Product</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Variant</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Unit Price</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderItemsHtml}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="5" style="padding: 12px; text-align: right; font-weight: bold; border-top: 2px solid #e5e7eb;">Total:</td>
                    <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 1.1em; color: #059669; border-top: 2px solid #e5e7eb;">${order.total_amount.toLocaleString('en-TZ', { style: 'currency', currency: 'TZS' })}</td>
                  </tr>
                </tfoot>
              </table>

              <div style="margin-top: 30px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;">
                <p style="margin: 0; color: #92400e;"><strong>Action Required:</strong> Please review this order and process it accordingly.</p>
              </div>
            </div>

            <div style="margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 0 0 8px 8px; text-align: center; color: #6b7280; font-size: 12px;">
              <p style="margin: 0;">This is an automated notification from the Honic Store order system.</p>
              <p style="margin: 5px 0 0 0;">Order ID: ${order.id}</p>
            </div>
          </body>
          </html>
        `

        const emailText = `
New Order Received: ${order.order_number}

Order Details:
- Order Number: ${order.order_number}
- Reference ID: ${order.reference_id}
${order.pickup_id ? `- Pickup ID: ${order.pickup_id}` : ''}
- Delivery Option: ${deliveryOption === 'pickup' ? 'Pickup' : 'Shipping'}
- Total Amount: ${order.total_amount.toLocaleString('en-TZ', { style: 'currency', currency: 'TZS' })}
- Order Date: ${new Date(order.created_at).toLocaleString('en-TZ', { timeZone: 'Africa/Dar_es_Salaam' })}

Customer Information:
- Name: ${customerName}
- Email: ${customerEmail}
- Phone: ${customerPhone}

${deliveryOption === 'shipping' && orderData.shippingAddress ? `
Shipping Address:
${orderData.shippingAddress.address1 || ''}
${orderData.shippingAddress.address2 || ''}
${orderData.shippingAddress.city || ''}, ${orderData.shippingAddress.state || ''}
${orderData.shippingAddress.postalCode || ''}
${orderData.shippingAddress.country || 'Tanzania'}
` : ''}

Order Items:
${orderItemsText}

Total: ${order.total_amount.toLocaleString('en-TZ', { style: 'currency', currency: 'TZS' })}

---
This is an automated notification from the Honic Store order system.
Order ID: ${order.id}
        `.trim()

        // Send email using Resend API
        const emailResult = await emailService.sendEmailViaResend({
          to: adminEmail,
          from: senderEmail,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
          replyTo: customerEmail !== 'No email provided' ? customerEmail : undefined
        })

        if (emailResult.success) {
          console.log('✅ [ORDER-API] Step 4: Admin notification email sent successfully', {
            orderId: order.id,
            orderNumber: order.order_number,
            messageId: emailResult.messageId
          })
        } else {
          console.error('❌ [ORDER-API] Step 4: Failed to send admin notification email', {
            orderId: order.id,
            orderNumber: order.order_number,
            error: emailResult.error
          })
          logger.error('Failed to send order notification email', new Error(emailResult.error || 'Unknown error'), {
            orderId: order.id,
            orderNumber: order.order_number
          })
        }
      }
    } catch (emailError: any) {
      // Log email error but don't fail the order creation
      console.error('❌ [ORDER-API] Step 4: Email notification error (non-blocking)', emailError)
      console.error('📧 [EMAIL] Status: ERROR - Exception occurred', {
        error: emailError?.message || String(emailError),
        errorName: emailError?.name || 'Unknown',
        stack: emailError?.stack || 'No stack trace',
        timestamp: new Date().toISOString()
      })
      logger.error('Failed to send order notification email', emailError, {
        orderId: order.id,
        userId: orderData.userId,
      })
    }

    // Return order data with stored IDs
    const responseData = {
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        referenceId: order.reference_id, // Use stored reference ID
        pickupId: order.pickup_id,       // Use stored pickup ID
        totalAmount: order.total_amount,
        paymentStatus: order.payment_status,
        status: order.status,
        deliveryOption: order.delivery_option,
        createdAt: order.created_at,
      },
    }

    return NextResponse.json(responseData)

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
