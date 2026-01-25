import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { autoAssignTrackingNumbers } from '@/lib/tracking-number-generator'
import { buildUrl } from '@/lib/url-utils'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData } from '@/lib/database-optimization'
import { logError, createErrorResponse } from '@/lib/error-handler'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
function getAdminClient() {
  try {
    return { client: createAdminSupabaseClient(), error: null as string | null }
  } catch (error: any) {
    return { client: null as any, error: error.message }
  }
}

export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_confirmed_orders_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/confirmed-orders',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
            }
          }
        )
      }

      // Check cache
      const cacheKey = 'admin_confirmed_orders_all'
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'private, max-age=30' // 30 seconds cache
          }
        })
      }

      // Validate admin access first
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_confirmed_orders_get',
          metadata: {
            endpoint: '/api/admin/confirmed-orders'
          }
        })
        return authError
      }

    const { client: supabase, error: envError } = getAdminClient()
    if (envError) {
      return NextResponse.json({ error: 'Server not configured', details: envError }, { status: 500 })
    }
    
    // Fetch all confirmed orders with their order items
    const { data: orders, error: ordersError } = await supabase
      .from('confirmed_orders')
      .select(`
        *,
        confirmed_order_items (
          id,
          product_id,
          product_name,
          variant_id,
          variant_name,
          quantity,
          price,
          total_price,
          status,
          created_at
        )
      `)
      .order('confirmed_at', { ascending: false })

      if (ordersError) {
        logError(ordersError, {
          userId: user?.id,
          action: 'admin_confirmed_orders_get',
          metadata: {
            endpoint: '/api/admin/confirmed-orders'
          }
        })
        return createErrorResponse(ordersError, 500)
      }

    // Get all product IDs to fetch supplier information
    const allProductIds = new Set<number>()
    orders?.forEach((order: any) => {
      order.confirmed_order_items?.forEach((item: any) => {
        if (item.product_id) allProductIds.add(item.product_id)
      })
    })

    // Fetch supplier information for all products
    const supplierMap = new Map<number, { supplierId: string | null, supplierName: string | null }>()
    if (allProductIds.size > 0) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, supplier_id, user_id')
        .in('id', Array.from(allProductIds))

      if (products && !productsError) {
        // Get unique supplier IDs
        const supplierIds = [...new Set(products.map(p => p.supplier_id || p.user_id).filter(Boolean))]
        
        // Fetch supplier names
        if (supplierIds.length > 0) {
          const { data: suppliers } = await supabase
            .from('profiles')
            .select('id, company_name, full_name')
            .in('id', supplierIds)
          
          if (suppliers) {
            const suppliersMap = new Map<string, string>()
            suppliers.forEach(supplier => {
              suppliersMap.set(supplier.id, supplier.company_name || supplier.full_name || 'Unknown Supplier')
            })
            
            products.forEach(product => {
              const supplierId = product.supplier_id || product.user_id
              const supplierName = supplierId ? (suppliersMap.get(supplierId) || 'Unknown Supplier') : null
              supplierMap.set(product.id, {
                supplierId: supplierId,
                supplierName: supplierName
              })
            })
          }
        }
      }
    }

    // Transform the data to include order items and supplier information
    const transformedOrders = (orders || []).map((order: any) => {
      const orderItems = (order.confirmed_order_items || []).map((item: any) => {
        const supplierInfo = supplierMap.get(item.product_id) || { supplierId: null, supplierName: null }
        return {
          ...item,
          supplierId: supplierInfo.supplierId,
          supplierName: supplierInfo.supplierName
        }
      })
      
      // Get unique suppliers for this order
      const suppliers = [...new Set(orderItems.map((item: any) => item.supplierName).filter(Boolean))]
      
      return {
        ...order,
        order_items: orderItems,
        suppliers: suppliers, // Array of supplier names
        hasSuppliers: suppliers.length > 0, // Boolean flag
        // Calculate total items count from confirmed_order_items
        total_items: orderItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
        // Calculate total amount from confirmed_order_items if not present in order
        calculated_total: orderItems.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0)
      }
    })

      const responseData = {
        success: true,
        orders: transformedOrders,
      }

      // Cache response (30 seconds TTL)
      setCachedData(cacheKey, responseData, 30000)

      return NextResponse.json(responseData, {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'private, max-age=30'
        }
      })
    } catch (error) {
      logError(error, {
        action: 'admin_confirmed_orders_get',
        metadata: {
          endpoint: '/api/admin/confirmed-orders'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}

// POST /api/admin/confirmed-orders - Create a new confirmed order
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_confirmed_orders_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/confirmed-orders',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
            }
          }
        )
      }

      // Validate admin access first
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_confirmed_orders_post',
          metadata: {
            endpoint: '/api/admin/confirmed-orders'
          }
        })
        return authError
      }

    const { client: supabase, error: envError } = getAdminClient()
    if (envError) {
      return NextResponse.json({ error: 'Server not configured', details: envError }, { status: 500 })
    }

    const orderData = await request.json()
    
    logger.log('📦 Received order confirmation request:', {
      originalOrderId: orderData.originalOrderId,
      orderNumber: orderData.orderNumber,
      hasOrderItems: !!orderData.orderItems && orderData.orderItems.length > 0
    })
    
    // Create confirmed order record
    // Note: Only include fields that definitely exist in the table
    const confirmedOrderData: any = {
      order_id: orderData.originalOrderId, // Link to original order
      order_number: orderData.orderNumber,
      reference_id: orderData.referenceId,
      pickup_id: orderData.pickupId,
      user_id: orderData.userId || null,
      delivery_option: orderData.deliveryOption || 'shipping',
      total_amount: orderData.totalAmount,
      payment_method: orderData.paymentMethod || 'clickpesa',
      payment_status: 'paid',
      status: 'confirmed',
      confirmed_by: orderData.confirmedBy || user?.id || null,
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Only include shipping/billing if they exist as JSONB columns
    // Try adding them as JSON strings if needed
    if (orderData.shippingAddress && typeof orderData.shippingAddress === 'object') {
      try {
        confirmedOrderData.shipping_address = JSON.stringify(orderData.shippingAddress)
      } catch (e) {
        // Ignore error
      }
    }
    
    if (orderData.billingAddress && typeof orderData.billingAddress === 'object') {
      try {
        confirmedOrderData.billing_address = JSON.stringify(orderData.billingAddress)
      } catch (e) {
        // Ignore error
      }
    }
    const { data: confirmedOrder, error: orderError } = await supabase
      .from('confirmed_orders')
      .insert(confirmedOrderData)
      .select()
      .single()

      if (orderError) {
        logError(orderError, {
          userId: user?.id,
          action: 'admin_confirmed_orders_post',
          metadata: {
            endpoint: '/api/admin/confirmed-orders',
            orderNumber: orderData.orderNumber
          }
        })
        return createErrorResponse(orderError, 500)
      }

    logger.log('✅ Successfully created confirmed order:', confirmedOrder.id)

    // Auto-generate and assign tracking numbers for all suppliers
    if (confirmedOrder.order_id) {
      try {
        const trackingResult = await autoAssignTrackingNumbers(confirmedOrder.order_id)
        if (trackingResult.success) {
          logger.log(`✅ Auto-assigned ${trackingResult.assigned} tracking numbers`)
        } else {
          logger.warn('⚠️ Some tracking numbers failed to assign:', trackingResult.errors)
        }
      } catch (trackingError) {
        logger.error('❌ Error auto-assigning tracking numbers:', trackingError)
        // Don't fail the order confirmation if tracking assignment fails
      }
    }

    // Copy order items from original order
    if (orderData.orderItems && Array.isArray(orderData.orderItems)) {
      const orderItems = orderData.orderItems.map((item: any) => ({
        confirmed_order_id: confirmedOrder.id,
        product_id: item.product_id,
        product_name: item.product_name,
        variant_id: item.variant_id,
        variant_name: item.variant_name,
        quantity: item.quantity,
        price: item.price,
        total_price: item.total_price,
        status: 'confirmed', // Initial status for all items
        tracking_number: item.tracking_number || null, // Copy tracking number from order_items
        created_at: new Date().toISOString()
      }))

      const { error: orderItemsError } = await supabase
        .from('confirmed_order_items')
        .insert(orderItems)

      if (orderItemsError) {
        logger.error('Failed to create confirmed order items:', orderItemsError)
      } else {
        logger.log('Successfully created confirmed order items:', orderItems.length, 'items')
      }
    }

      // Clear cache
      setCachedData('admin_confirmed_orders_all', null, 0)

      // Log admin action
      logSecurityEvent('CONFIRMED_ORDER_CREATED', {
        userId: user?.id,
        orderId: confirmedOrder.id,
        orderNumber: confirmedOrder.order_number,
        endpoint: '/api/admin/confirmed-orders'
      }, request)

      return NextResponse.json({
        success: true,
        order: {
          id: confirmedOrder.id,
          orderNumber: confirmedOrder.order_number,
          status: confirmedOrder.status,
          confirmedAt: confirmedOrder.confirmed_at
        }
      })

    } catch (error) {
      logError(error, {
        action: 'admin_confirmed_orders_post',
        metadata: {
          endpoint: '/api/admin/confirmed-orders'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}

// PATCH /api/admin/confirmed-orders - Update confirmed order status
export async function PATCH(request: NextRequest) {
  return performanceMonitor.measure('admin_confirmed_orders_patch', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/confirmed-orders',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
            }
          }
        )
      }

      // Validate admin access first
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_confirmed_orders_patch',
          metadata: {
            endpoint: '/api/admin/confirmed-orders'
          }
        })
        return authError
      }

    const { client: supabase, error: envError } = getAdminClient()
    if (envError) {
      return NextResponse.json({ error: 'Server not configured', details: envError }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { id, status, notes } = body || {}

    if (!id) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 })
    }

    const update: any = { updated_at: new Date().toISOString() }
    if (status) update.status = status
    if (notes) update.notes = notes

    const { error: updateError } = await supabase
      .from('confirmed_orders')
      .update(update)
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update confirmed order', details: updateError.message }, { status: 500 })
    }

    // Get order details for email sending
    const { data: confirmedOrder, error: fetchError } = await supabase
      .from('confirmed_orders')
      .select('*, orders(shipping_address, billing_address, user_id)')
      .eq('id', id)
      .single()

    // If status is being updated to 'confirmed', auto-assign tracking numbers
    if (status === 'confirmed') {
      if (!fetchError && confirmedOrder?.order_id) {
        try {
          const trackingResult = await autoAssignTrackingNumbers(confirmedOrder.order_id)
          if (trackingResult.success) {
            logger.log(`✅ Auto-assigned ${trackingResult.assigned} tracking numbers after status update`)
          } else {
            logger.warn('⚠️ Some tracking numbers failed to assign:', trackingResult.errors)
          }
        } catch (trackingError) {
          logger.error('❌ Error auto-assigning tracking numbers:', trackingError)
          // Don't fail the status update if tracking assignment fails
        }
      }
    }

    // Send order status update email if status changed
    if (status && confirmedOrder && !fetchError) {
      try {
        // Get customer email - Priority: logged-in user's email, then shipping/billing email
        let customerEmail: string | null = null
        
        // First, try to get email from logged-in user account
        if (confirmedOrder.user_id) {
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
            const { data: { user: authUser } } = await adminSupabase.auth.admin.getUserById(confirmedOrder.user_id)
            if (authUser?.email) {
              customerEmail = authUser.email
            }
          } catch (authError) {
            logger.warn('Failed to get user email from auth:', authError)
          }
        }
        
        // Fallback to shipping/billing email if no user account email
        if (!customerEmail) {
          const shippingAddress = typeof confirmedOrder.shipping_address === 'string' 
            ? JSON.parse(confirmedOrder.shipping_address) 
            : confirmedOrder.shipping_address
          customerEmail = shippingAddress?.email || 
                         (typeof confirmedOrder.billing_address === 'string' 
                           ? JSON.parse(confirmedOrder.billing_address)?.email 
                           : confirmedOrder.billing_address?.email) ||
                         null
        }

        if (customerEmail) {
          // Get order items
          const { data: orderItems } = await supabase
            .from('confirmed_order_items')
            .select('product_name, quantity, products(image)')
            .eq('confirmed_order_id', id)

          // Handle pickup reminder separately
          if (status === 'ready_for_pickup') {
            const { sendPickupReminderEmail } = await import('@/lib/user-email-service')
            
            await sendPickupReminderEmail(customerEmail, {
              orderNumber: confirmedOrder.order_number || id.toString(),
              pickupLocation: shippingAddress?.address || 'Store Location',
              pickupDate: confirmedOrder.estimated_delivery || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString(),
              items: orderItems?.map((item: any) => ({
                name: item.product_name,
                quantity: item.quantity
              })) || [],
              orderUrl: buildUrl(`/account/orders/${confirmedOrder.order_number || id}`)
            })
          }
          // Handle shipping notification separately
          else if (status === 'shipped') {
            const { sendShippingNotificationEmail } = await import('@/lib/user-email-service')
            
            // Get tracking info
            const { data: trackingInfo } = await supabase
              .from('order_tracking')
              .select('tracking_number, carrier')
              .eq('order_id', confirmedOrder.order_id)
              .single()

            if (trackingInfo) {
              await sendShippingNotificationEmail(customerEmail, {
                orderNumber: confirmedOrder.order_number || id.toString(),
                trackingNumber: trackingInfo.tracking_number,
                carrier: trackingInfo.carrier || 'Standard Shipping',
                trackingUrl: buildUrl(`/account/orders/${confirmedOrder.order_number || id}`),
                estimatedDelivery: confirmedOrder.estimated_delivery || '5-7 business days',
                shippingAddress: shippingAddress || {},
                items: orderItems?.map((item: any) => ({
                  name: item.product_name,
                  quantity: item.quantity,
                  image: item.products?.image
                })) || []
              })
            }
          } else {
            // Send general status update
            const { sendOrderStatusUpdateEmail } = await import('@/lib/user-email-service')

            // Handle cancellation separately with cancellation email
            if (status === 'cancelled') {
              const { sendOrderCancellationEmail } = await import('@/lib/user-email-service')
              
              await sendOrderCancellationEmail(customerEmail, {
                orderNumber: confirmedOrder.order_number || id.toString(),
                cancellationReason: notes || 'Order cancelled by administrator',
                refundAmount: confirmedOrder.total_amount,
                refundMethod: 'Original payment method',
                refundTimeline: '5-7 business days'
              })
            } else {
              const statusMessages: Record<string, string> = {
                confirmed: 'Your order has been confirmed and is being prepared for shipment.',
                delivered: 'Your order has been delivered successfully.',
              }

              await sendOrderStatusUpdateEmail(customerEmail, {
                orderNumber: confirmedOrder.order_number || id.toString(),
                status: status.charAt(0).toUpperCase() + status.slice(1),
                statusMessage: statusMessages[status] || `Your order status has been updated to ${status}.`,
                items: orderItems?.map((item: any) => ({
                  name: item.product_name,
                  quantity: item.quantity
                })) || []
              })
            }
          }
        }
      } catch (emailError) {
        logger.error('Error sending order status update email:', emailError)
        // Don't fail the request if email fails
      }
    }

      // Clear cache
      setCachedData('admin_confirmed_orders_all', null, 0)

      // Log admin action
      logSecurityEvent('CONFIRMED_ORDER_UPDATED', {
        userId: user?.id,
        orderId: id,
        status,
        endpoint: '/api/admin/confirmed-orders'
      }, request)

      return NextResponse.json({ success: true })
    } catch (error) {
      logError(error, {
        action: 'admin_confirmed_orders_patch',
        metadata: {
          endpoint: '/api/admin/confirmed-orders'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}

