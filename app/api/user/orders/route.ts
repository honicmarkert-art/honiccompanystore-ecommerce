import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

async function getClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch orders for the user with product images and confirmed order status
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
          created_at,
          products (
            id,
            name,
            image,
            gallery
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // Check confirmed orders for status updates
    const orderIds = orders?.map(order => order.id) || []
    let confirmedOrdersMap = new Map()
    
    if (orderIds.length > 0) {
      const { data: confirmedOrders } = await supabase
        .from('confirmed_orders')
        .select('original_order_id, status, confirmed_at, notes')
        .in('original_order_id', orderIds)
      
      if (confirmedOrders) {
        confirmedOrders.forEach(confirmed => {
          confirmedOrdersMap.set(confirmed.original_order_id, confirmed)
        })
      }
    }

    // Transform the data to match our frontend interface
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
          productName: item.product_name || item.products?.name || 'Unknown Product',
          productImage: item.products?.image || '/placeholder-product.jpg',
          variantName: item.variant_name,
          variantAttributes: item.variant_attributes,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.total_price
        })) || [],
        notes: confirmedOrder?.notes || order.notes
      }
    }) || []

    return NextResponse.json({ orders: transformedOrders })

  } catch (error) {
    console.error('Error in orders API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
      console.error('Error creating order:', orderError)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    // Create order items
    if (items && items.length > 0) {
      const orderItems = items.map((item: any) => ({
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        console.error('Error creating order items:', itemsError)
        return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 })
      }
    }

    return NextResponse.json({ order })

  } catch (error) {
    console.error('Error in orders POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
