import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
    console.log('🔍 [ORDERS API] Starting GET request')
    
    const supabase = await getClient()
    console.log('✅ [ORDERS API] Supabase client created')
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('👤 [ORDERS API] User auth result:', { 
      hasUser: !!user, 
      userId: user?.id, 
      userEmail: user?.email,
      authError 
    })
    
    if (authError || !user) {
      console.error('❌ [ORDERS API] Authentication failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('🔍 [ORDERS API] Fetching orders for user:', user.id)
    console.log('🔍 [ORDERS API] Query details:', {
      table: 'orders',
      filter: 'user_id = ' + user.id,
      select: 'orders.*, order_items(*)'
    })
    
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

    console.log('📦 [ORDERS API] Query result:', {
      hasOrders: !!orders,
      ordersCount: orders?.length,
      hasError: !!ordersError,
      errorCode: ordersError?.code,
      errorMessage: ordersError?.message,
      errorDetails: ordersError
    })

    if (ordersError) {
      console.error('❌ [ORDERS API] Orders fetch error:', {
        code: ordersError.code,
        message: ordersError.message,
        details: ordersError.details,
        hint: ordersError.hint,
        fullError: JSON.stringify(ordersError, null, 2)
      })
      return NextResponse.json({ 
        error: 'Failed to fetch orders', 
        details: ordersError.message,
        code: ordersError.code
      }, { status: 500 })
    }
    
    console.log('✅ [ORDERS API] Successfully fetched', orders?.length || 0, 'orders')

    // Fetch product images for all order items
    console.log('🖼️ [ORDERS API] Fetching product images...')
    const allProductIds = new Set<number>()
    orders?.forEach(order => {
      order.order_items?.forEach((item: any) => {
        if (item.product_id) allProductIds.add(item.product_id)
      })
    })
    
    console.log('📦 [ORDERS API] Unique product IDs to fetch:', Array.from(allProductIds))
    
    let productImagesMap = new Map<number, string>()
    if (allProductIds.size > 0) {
      try {
        // Fetch product images (public read access)
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, image')
          .in('id', Array.from(allProductIds))
        
        console.log('✅ [ORDERS API] Products fetch result:', {
          hasData: !!products,
          count: products?.length,
          hasError: !!productsError
        })
        
        if (products && !productsError) {
          products.forEach(product => {
            productImagesMap.set(product.id, product.image || '/placeholder.jpg')
          })
        }
      } catch (error) {
        console.error('⚠️ [ORDERS API] Error fetching product images:', error)
      }
    }

    // Check confirmed orders for status updates
    console.log('🔍 [ORDERS API] Checking confirmed orders...')
    const orderIds = orders?.map(order => order.id) || []
    console.log('📋 [ORDERS API] Order IDs to check:', orderIds)
    let confirmedOrdersMap = new Map()
    
    if (orderIds.length > 0) {
      console.log('🔍 [ORDERS API] Querying confirmed_orders table...')
      const { data: confirmedOrders, error: confirmedOrdersError } = await supabase
        .from('confirmed_orders')
        .select('order_id, status, confirmed_at')
        .in('order_id', orderIds)
      
      console.log('✅ [ORDERS API] Confirmed orders query result:', {
        hasData: !!confirmedOrders,
        count: confirmedOrders?.length,
        hasError: !!confirmedOrdersError,
        errorDetails: confirmedOrdersError ? {
          code: confirmedOrdersError.code,
          message: confirmedOrdersError.message
        } : null
      })
      
      if (confirmedOrders) {
        confirmedOrders.forEach(confirmed => {
          confirmedOrdersMap.set(confirmed.order_id, confirmed)
        })
      }
    }

    // Transform the data to match our frontend interface
    console.log('🔄 [ORDERS API] Transforming orders data...')
    const transformedOrders = orders?.map(order => {
      const confirmedOrder = confirmedOrdersMap.get(order.id)
      const finalStatus = confirmedOrder?.status || order.status
      
      return {
        id: order.id,
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
        items: order.order_items?.map((item: any) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name || 'Unknown Product',
          productImage: productImagesMap.get(item.product_id) || '/placeholder.jpg',
          variantName: item.variant_name,
          variantAttributes: item.variant_attributes,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.total_price
        })) || [],
        notes: order.notes
      }
    }) || []

    console.log('✅ [ORDERS API] Successfully transformed', transformedOrders.length, 'orders')
    console.log('✅ [ORDERS API] Returning response with', transformedOrders.length, 'orders')

    return NextResponse.json({ orders: transformedOrders })

  } catch (error: any) {
    console.error('❌ [ORDERS API] Exception caught:', {
      message: error.message,
      stack: error.stack,
      error: error.toString(),
      fullError: JSON.stringify(error, null, 2)
    })
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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
        variant_attributes: item.variantAttributes || null,
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
