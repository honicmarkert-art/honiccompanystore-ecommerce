import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getClient() {
  const cookieStore = await cookies()
  
  // Create a response to handle cookie updates
  const response = new NextResponse()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set(name, value, options)
        },
        remove(name: string, options: any) {
          response.cookies.delete(name)
        },
      },
    }
  )
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/user/orders',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }

    // SECURITY: Don't log UUIDs or sensitive user information
    const supabase = await getClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Fetch orders for the user (without products JOIN to avoid RLS issues)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          product_name,
          variant_id,
          variant_name,
          variant_attributes,
          quantity,
          price,
          total_price,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (ordersError) {
      return NextResponse.json({ 
        error: 'Failed to fetch orders'
      }, { status: 500 })
    }

    // Fetch product images and supplier information for all order items
    const allProductIds = new Set<number>()
    orders?.forEach(order => {
      order.order_items?.forEach((item: any) => {
        if (item.product_id) allProductIds.add(item.product_id)
      })
    })
    
    let productImagesMap = new Map<number, string>()
    let productSuppliersMap = new Map<number, { supplierName: string | null }>()
    
    if (allProductIds.size > 0) {
      try {
        // Fetch product images and supplier IDs (public read access)
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, image, supplier_id, user_id')
          .in('id', Array.from(allProductIds))
        
        if (products && !productsError) {
          // Get unique supplier IDs
          const supplierIds = [...new Set(products.map(p => p.supplier_id || p.user_id).filter(Boolean))]
          
          // Fetch supplier names (SECURITY: Only send display names, never UUIDs)
          let suppliersMap = new Map<string, string>()
          if (supplierIds.length > 0) {
            const { data: suppliers } = await supabase
              .from('profiles')
              .select('id, company_name, full_name')
              .in('id', supplierIds)
            
            if (suppliers) {
              suppliers.forEach(supplier => {
                suppliersMap.set(supplier.id, supplier.company_name || supplier.full_name || 'Unknown Supplier')
              })
            }
          }
          
          products.forEach(product => {
            productImagesMap.set(product.id, product.image || '/placeholder.jpg')
            const supplierId = product.supplier_id || product.user_id
            const supplierName = supplierId ? (suppliersMap.get(supplierId) || 'Unknown Supplier') : null
            productSuppliersMap.set(product.id, { supplierName })
          })
        }
      } catch (error) {
        // Silently handle errors - don't expose details
      }
    }

    // Check confirmed orders for status updates
    const orderIds = orders?.map(order => order.id) || []
    let confirmedOrdersMap = new Map()
    let confirmedOrderItemsMap = new Map<string, any[]>() // Map order_id to confirmed items
    
    if (orderIds.length > 0) {
      const { data: confirmedOrders } = await supabase
        .from('confirmed_orders')
        .select('order_id, status, confirmed_at, is_received, received_at')
        .in('order_id', orderIds)
      
      if (confirmedOrders) {
        confirmedOrders.forEach(confirmed => {
          confirmedOrdersMap.set(confirmed.order_id, confirmed)
        })
        
        // Fetch confirmed order items with status
        // Note: confirmed_order_items.confirmed_order_id links to confirmed_orders.id (UUID), not order_id
        const confirmedOrderIdMap = new Map<string, string>() // Map confirmed_orders.id -> order_id
        confirmedOrders.forEach(co => {
          confirmedOrderIdMap.set(co.id, co.order_id)
        })
        
        const confirmedOrderUuids = Array.from(confirmedOrderIdMap.keys())
        if (confirmedOrderUuids.length > 0) {
          const { data: confirmedItems } = await supabase
            .from('confirmed_order_items')
            .select('confirmed_order_id, product_id, status, tracking_number')
            .in('confirmed_order_id', confirmedOrderUuids)
          
          if (confirmedItems) {
            // Group items by order_id (map confirmed_order_id -> order_id)
            confirmedItems.forEach(item => {
              const orderId = confirmedOrderIdMap.get(item.confirmed_order_id)
              if (orderId) {
                if (!confirmedOrderItemsMap.has(orderId)) {
                  confirmedOrderItemsMap.set(orderId, [])
                }
                confirmedOrderItemsMap.get(orderId)!.push(item)
              }
            })
          }
        }
      }
    }

    // Transform the data to match our frontend interface
    // SECURITY: Never expose UUIDs (order.id, supplierId, item.id) to clients
    const transformedOrders = orders?.map(order => {
      const confirmedOrder = confirmedOrdersMap.get(order.id)
      const finalStatus = confirmedOrder?.status || order.status
      
      return {
        // id: order.id, // REMOVED: UUID should never be exposed to client
        orderNumber: order.order_number,
        referenceId: order.reference_id,
        pickupId: order.pickup_id,
        status: finalStatus,
        totalAmount: order.total_amount,
        currency: order.currency || 'TZS',
        itemCount: order.order_items?.length || 0,
        totalItems: order.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0,
        createdAt: order.created_at,
        updatedAt: confirmedOrder?.confirmed_at || order.updated_at,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        clickpesaTransactionId: order.clickpesa_transaction_id,
        paymentTimestamp: order.payment_timestamp,
        failureReason: order.failure_reason,
        deliveryOption: order.delivery_option || 'shipping',
        trackingNumber: order.tracking_number,
        estimatedDelivery: order.estimated_delivery,
        isReceived: confirmedOrder?.is_received || false,
        receivedAt: confirmedOrder?.received_at || null,
        confirmedAt: confirmedOrder?.confirmed_at || null,
        shippingAddress: {
          fullName: order.shipping_address?.fullName || order.shipping_address?.full_name || '',
          address: order.shipping_address?.address1 || order.shipping_address?.address || '',
          address2: order.shipping_address?.address2,
          city: order.shipping_address?.city || '',
          state: order.shipping_address?.state || order.shipping_address?.region || '',
          postalCode: order.shipping_address?.postalCode || order.shipping_address?.postal_code || '',
          country: order.shipping_address?.country || '',
          phone: order.shipping_address?.phone || ''
        },
        items: order.order_items?.map((item: any, index: number) => {
          // SECURITY: Generate a safe hash key instead of exposing UUID
          const safeItemKey = `${item.product_id}-${item.variant_id || 'default'}-${index}`
          const confirmedItem = confirmedOrderItemsMap.get(order.id)?.find(ci => ci.product_id === item.product_id)
          const supplierInfo = productSuppliersMap.get(item.product_id) || { supplierName: null }
          
          return {
            // id: item.id, // REMOVED: UUID should never be exposed to client
            itemKey: safeItemKey, // Safe, non-UUID identifier for client-side operations
            productId: item.product_id,
            productName: item.product_name || 'Unknown Product',
            productImage: productImagesMap.get(item.product_id) || '/placeholder.jpg',
            variantName: item.variant_name,
            variantAttributes: item.variant_attributes,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.total_price,
            // supplierId: REMOVED - UUID should never be exposed to client
            supplierName: supplierInfo.supplierName, // Only send display name, never UUID
            status: confirmedItem?.status || 'confirmed', // Per-item status from confirmed_order_items
            trackingNumber: confirmedItem?.tracking_number || null
          }
        }) || [],
        notes: order.notes
      }
    }) || []

    return NextResponse.json({ orders: transformedOrders })

  } catch (error: any) {
    // SECURITY: Don't expose error details that might leak system information
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/user/orders',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }

    const supabase = await getClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      orderNumber, 
      status, 
      totalAmount, 
      paymentMethod, 
      paymentStatus, 
      shippingAddress, 
      billingAddress, 
      items, 
      notes 
    } = body

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        order_number: orderNumber,
        status: status || 'pending',
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: paymentStatus || 'pending',
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        notes: notes
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    // Create order items
    if (items && items.length > 0) {
      const orderItems = items.map((item: any) => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.productName || 'Unknown Product',
        variant_id: item.variantId,
        variant_name: item.variantName || null,
        variant_attributes: null, // No longer used in simplified variant system
        quantity: item.quantity,
        price: item.unitPrice || item.price, // Use unitPrice if available, fallback to price
        total_price: item.totalPrice
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 })
      }
    }


    return NextResponse.json({ order })

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
