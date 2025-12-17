import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// GET /api/user/orders/[orderNumber]/status-history - Get order status history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params
    const cookieStore = await cookies()
    
    // Create response to handle cookie updates
    const response = new NextResponse()
    
    const supabase = createServerClient(
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
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Find order by order_number
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, status, created_at, updated_at')
      .eq('order_number', orderNumber)
      .single()
    
    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    // Check user authorization
    if (order.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    // Check confirmed_orders for additional status history
    const { data: confirmedOrder } = await supabase
      .from('confirmed_orders')
      .select('status, confirmed_at')
      .eq('order_id', order.id)
      .single()
    
    // Build status history based on current order status
    const statusHistory: Array<{ status: string; timestamp: string; description: string; location?: string }> = []
    
    // Always add pending status
    statusHistory.push({
      status: 'pending',
      timestamp: new Date(order.created_at).toISOString(),
      description: 'Order placed and awaiting confirmation',
      location: 'Processing Center'
    })
    
    // If confirmed, add confirmed status
    if (order.status === 'confirmed' || confirmedOrder?.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered' || order.status === 'ready_for_pickup' || order.status === 'picked_up') {
      statusHistory.push({
        status: 'confirmed',
        timestamp: confirmedOrder?.confirmed_at || order.updated_at || order.created_at,
        description: 'Order confirmed by seller',
        location: 'Processing Center'
      })
    }
    
    // If shipped or delivered, add shipped status
    if (order.status === 'shipped' || order.status === 'delivered') {
      statusHistory.push({
        status: 'shipped',
        timestamp: order.updated_at || order.created_at,
        description: 'Order shipped and in transit',
        location: 'In Transit'
      })
    }
    
    // If delivered, add delivered status
    if (order.status === 'delivered') {
      statusHistory.push({
        status: 'delivered',
        timestamp: order.updated_at || order.created_at,
        description: 'Order delivered successfully',
        location: order.shipping_address?.city || 'Destination'
      })
    }
    
    // If pickup order with ready_for_pickup status
    if (order.status === 'ready_for_pickup') {
      statusHistory.push({
        status: 'ready_for_pickup',
        timestamp: order.updated_at || order.created_at,
        description: 'Order ready for pickup',
        location: 'Store'
      })
    }
    
    // If picked up, add picked_up status
    if (order.status === 'picked_up') {
      statusHistory.push({
        status: 'picked_up',
        timestamp: order.updated_at || order.created_at,
        description: 'Order picked up by customer',
        location: 'Store'
      })
    }
    
    // If cancelled, add cancelled status
    if (order.status === 'cancelled') {
      statusHistory.push({
        status: 'cancelled',
        timestamp: order.updated_at || order.created_at,
        description: 'Order cancelled',
        location: 'Processing Center'
      })
    }
    
    return NextResponse.json(statusHistory)
    
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

