import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/admin-auth'
import { getSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schemas
const trackingAssignSchema = z.object({
  orderId: z.string().uuid().optional(),
  orderNumber: z.string().optional(),
  supplierId: z.string().uuid('Invalid supplier ID format'),
  trackingNumber: z.string().min(1, 'Tracking number is required').max(100, 'Tracking number is too long'),
})

/**
 * PATCH /api/admin/orders/items/tracking
 * Assign tracking number to order items from a specific supplier
 */
export async function PATCH(request: NextRequest) {
  return performanceMonitor.measure('admin_orders_tracking_patch', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/orders/items/tracking',
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

      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_orders_tracking_patch',
          metadata: {
            endpoint: '/api/admin/orders/items/tracking'
          }
        })
        return authError
      }

      const supabase = getSupabaseClient()
      const body = await request.json()

      // Validate input with Zod
      let validatedData
      try {
        validatedData = trackingAssignSchema.parse(body)
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return NextResponse.json(
            { 
              error: 'Validation failed',
              details: validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            },
            { status: 400 }
          )
        }
        throw validationError
      }

      const { orderId, orderNumber, supplierId, trackingNumber } = validatedData

      if (!orderId && !orderNumber) {
        return NextResponse.json({ error: 'Either orderId or orderNumber is required' }, { status: 400 })
      }

      logger.log('📦 Assigning tracking number:', {
        orderId,
        orderNumber,
        supplierId,
        trackingNumber
      })

      // Find the order
      let order
      if (orderId) {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('id')
          .eq('id', orderId)
          .single()

        if (orderError || !orderData) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }
        order = orderData
      } else {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('id')
          .eq('order_number', orderNumber)
          .single()

        if (orderError || !orderData) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }
        order = orderData
      }

      // Get order items for this supplier
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          product_id,
          products!inner (
            supplier_id,
            user_id
          )
        `)
        .eq('order_id', order.id)

      if (itemsError) {
        logError(itemsError, {
          userId: user?.id,
          action: 'admin_orders_tracking_patch',
          metadata: {
            endpoint: '/api/admin/orders/items/tracking',
            orderId: order.id
          }
        })
        return createErrorResponse(itemsError, 500)
      }

      // Filter items for this supplier
      const supplierItems = orderItems?.filter((item: any) => {
        const product = item.products
        return (product?.supplier_id === supplierId || product?.user_id === supplierId)
      }) || []

      if (supplierItems.length === 0) {
        return NextResponse.json(
          { error: 'No order items found for this supplier' },
          { status: 404 }
        )
      }

      // Update tracking numbers for all items from this supplier
      const itemIds = supplierItems.map((item: any) => item.id)
      const { error: updateError } = await supabase
        .from('order_items')
        .update({ tracking_number: trackingNumber })
        .in('id', itemIds)

      if (updateError) {
        logError(updateError, {
          userId: user?.id,
          action: 'admin_orders_tracking_patch',
          metadata: {
            endpoint: '/api/admin/orders/items/tracking',
            orderId: order.id,
            supplierId,
            trackingNumber
          }
        })
        return createErrorResponse(updateError, 500)
      }

      // Create or update tracking record
      const { error: trackingError } = await supabase
        .from('order_tracking')
        .upsert({
          order_id: order.id,
          supplier_id: supplierId,
          tracking_number: trackingNumber,
          carrier: 'Standard Shipping',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'order_id,supplier_id'
        })

      if (trackingError) {
        logger.warn('Failed to update tracking record:', trackingError)
        // Don't fail the request if tracking record update fails
      }

      logger.log(`✅ Tracking number assigned: ${trackingNumber} for supplier ${supplierId}`)

      // Log admin action
      logSecurityEvent('TRACKING_NUMBER_ASSIGNED', {
        userId: user?.id,
        orderId: order.id,
        supplierId,
        trackingNumber,
        itemCount: supplierItems.length,
        endpoint: '/api/admin/orders/items/tracking'
      }, request)

      return NextResponse.json({
        success: true,
        message: 'Tracking number assigned successfully',
        trackingNumber,
        itemsUpdated: supplierItems.length
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_orders_tracking_patch',
        metadata: {
          endpoint: '/api/admin/orders/items/tracking'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}

/**
 * GET /api/admin/orders/items/tracking
 * Get tracking numbers for order items by supplier
 */
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_orders_tracking_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/orders/items/tracking',
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

      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_orders_tracking_get',
          metadata: {
            endpoint: '/api/admin/orders/items/tracking'
          }
        })
        return authError
      }

      const supabase = getSupabaseClient()
      const { searchParams } = new URL(request.url)
      const orderId = searchParams.get('orderId')
      const orderNumber = searchParams.get('orderNumber')

      if (!orderId && !orderNumber) {
        return NextResponse.json({ error: 'Either orderId or orderNumber is required' }, { status: 400 })
      }

      // Find the order
      let order
      if (orderId) {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(orderId)) {
          return NextResponse.json({ error: 'Invalid order ID format' }, { status: 400 })
        }

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('id')
          .eq('id', orderId)
          .single()

        if (orderError || !orderData) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }
        order = orderData
      } else {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('id')
          .eq('order_number', orderNumber)
          .single()

        if (orderError || !orderData) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }
        order = orderData
      }

      // Get all order items with their products and tracking numbers
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          product_id,
          tracking_number,
          products!inner (
            id,
            supplier_id,
            user_id
          )
        `)
        .eq('order_id', order.id)

      if (itemsError) {
        logError(itemsError, {
          userId: user?.id,
          action: 'admin_orders_tracking_get',
          metadata: {
            endpoint: '/api/admin/orders/items/tracking',
            orderId: order.id
          }
        })
        return createErrorResponse(itemsError, 500)
      }

      // Group by supplier
      const supplierTrackingMap = new Map<string, {
        supplierId: string
        trackingNumber: string | null
        itemIds: string[]
        productIds: number[]
      }>()

      orderItems?.forEach((item: any) => {
        const product = item.products
        const supplierId = product?.supplier_id || product?.user_id
        
        if (supplierId) {
          const key = supplierId
          if (!supplierTrackingMap.has(key)) {
            supplierTrackingMap.set(key, {
              supplierId: key,
              trackingNumber: item.tracking_number,
              itemIds: [],
              productIds: []
            })
          }
          
          const entry = supplierTrackingMap.get(key)!
          entry.itemIds.push(item.id)
          entry.productIds.push(item.product_id)
          // If any item has a tracking number, use it (they should all be the same)
          if (item.tracking_number && !entry.trackingNumber) {
            entry.trackingNumber = item.tracking_number
          }
        }
      })

      return NextResponse.json({
        success: true,
        data: Array.from(supplierTrackingMap.values())
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_orders_tracking_get',
        metadata: {
          endpoint: '/api/admin/orders/items/tracking'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}
