import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData, generateCacheKey } from '@/lib/database-optimization'
import { createErrorResponse, logError } from '@/lib/error-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/supplier/orders/unread-count - Get count of unread orders for supplier
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('supplier_orders_unread_count_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/orders/unread-count',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { success: false, error: rateLimitResult.reason },
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
        )
      }
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
      if (authError || !user) {
        logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', undefined, {
          endpoint: '/api/supplier/orders/unread-count',
          action: 'GET'
        })
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Check if user is a supplier
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_supplier')
        .eq('id', user.id)
        .single()

      if (profileError || !profile?.is_supplier) {
        logSecurityEvent('FORBIDDEN_ACCESS_ATTEMPT', user.id, {
          endpoint: '/api/supplier/orders/unread-count',
          action: 'GET',
          reason: 'Not a supplier'
        })
        return NextResponse.json(
          { success: false, error: 'Access denied. Supplier access required.' },
          { status: 403 }
        )
      }

      // Check cache (30 seconds TTL for unread count)
      const cacheKey = generateCacheKey('supplier_orders_unread_count', { supplierId: user.id })
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData !== null) {
        return NextResponse.json({
          success: true,
          unreadCount: cachedData.unreadCount || 0,
          cached: true
        })
      }

    // Get all product IDs owned by this supplier
    const { data: supplierProducts, error: productsError } = await supabase
      .from('products')
      .select('id')
      .or(`user_id.eq.${user.id},supplier_id.eq.${user.id}`)

      if (productsError) {
        logError(productsError, {
          context: 'supplier_orders_unread_count_get',
          userId: user.id
        })
        return createErrorResponse(productsError, 'Failed to fetch supplier products', 500)
      }

      if (!supplierProducts || supplierProducts.length === 0) {
        const responseData = { unreadCount: 0 }
        setCachedData(cacheKey, responseData, 30 * 1000) // 30 seconds
        return NextResponse.json({
          success: true,
          ...responseData
        })
      }

    const supplierProductIds = supplierProducts.map(p => p.id)

    // Get confirmed orders with supplier's products that were created in the last 24 hours
    // (considering them as "new" orders)
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    // Fetch confirmed order items that belong to supplier's products
    const { data: supplierOrderItems, error: itemsError } = await supabase
      .from('confirmed_order_items')
      .select('confirmed_order_id')
      .in('product_id', supplierProductIds)

      if (itemsError) {
        logError(itemsError, {
          context: 'supplier_orders_unread_count_get',
          userId: user.id
        })
        return createErrorResponse(itemsError, 'Failed to fetch order items', 500)
      }

      if (!supplierOrderItems || supplierOrderItems.length === 0) {
        const responseData = { unreadCount: 0 }
        setCachedData(cacheKey, responseData, 30 * 1000) // 30 seconds
        return NextResponse.json({
          success: true,
          ...responseData
        })
      }

    // Get unique confirmed_order_ids
    const orderIds = [...new Set(supplierOrderItems.map(item => item.confirmed_order_id))]

    // Count orders created in the last 24 hours
    const { count, error: countError } = await supabase
      .from('confirmed_orders')
      .select('*', { count: 'exact', head: true })
      .in('id', orderIds)
      .gte('confirmed_at', twentyFourHoursAgo.toISOString())

      if (countError) {
        logError(countError, {
          context: 'supplier_orders_unread_count_get',
          userId: user.id
        })
        return createErrorResponse(countError, 'Failed to count orders', 500)
      }

      const unreadCount = count || 0
      const responseData = { unreadCount }

      // Cache response (30 seconds TTL)
      setCachedData(cacheKey, responseData, 30 * 1000)

      return NextResponse.json({
        success: true,
        ...responseData
      })

    } catch (error: any) {
      logError(error, {
        context: 'supplier_orders_unread_count_get'
      })
      return createErrorResponse(error, 'Internal server error', 500)
    }
  })
}









