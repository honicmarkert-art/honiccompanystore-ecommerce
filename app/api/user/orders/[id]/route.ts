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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    
    // Fetch the specific order with product images and confirmed order status
    const { data: order, error: orderError } = await supabase
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
      .eq('id', resolvedParams.id)
      .eq('user_id', user.id)
      .single()

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      console.error('Error fetching order:', orderError)
      return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
    }

    // Check confirmed order for status updates
    const { data: confirmedOrder } = await supabase
      .from('confirmed_orders')
      .select('original_order_id, status, confirmed_at, notes')
      .eq('original_order_id', resolvedParams.id)
      .single()

    const finalStatus = confirmedOrder?.status || order.status

    // Transform the data to match our frontend interface
    const transformedOrder = {
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

    return NextResponse.json({ order: transformedOrder })

  } catch (error) {
    console.error('Error in order detail API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const body = await request.json()
    const { status, trackingNumber, estimatedDelivery, notes } = body

    // Update the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .update({
        status,
        tracking_number: trackingNumber,
        estimated_delivery: estimatedDelivery,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedParams.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      console.error('Error updating order:', orderError)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    return NextResponse.json({ order })

  } catch (error) {
    console.error('Error in order update API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
