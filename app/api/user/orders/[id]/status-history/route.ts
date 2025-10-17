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
    
    // Verify the order belongs to the user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, delivery_option, status')
      .eq('id', resolvedParams.id)
      .eq('user_id', user.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Fetch status history for the order
    const { data: statusHistory, error: statusError } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', resolvedParams.id)
      .order('created_at', { ascending: true })

    if (statusError) {
      console.error('Error fetching status history:', statusError)
      // If table doesn't exist yet, return empty array instead of error
      if (statusError.code === 'PGRST116' || statusError.message.includes('relation') || statusError.message.includes('does not exist')) {
        return NextResponse.json({ statusHistory: [] })
      }
      return NextResponse.json({ error: 'Failed to fetch status history' }, { status: 500 })
    }

    // Transform the data
    const transformedHistory = statusHistory?.map(status => ({
      status: status.status,
      timestamp: status.created_at,
      description: status.description,
      location: status.location
    })) || []

    // If no status history exists, create a basic one based on current order status
    if (transformedHistory.length === 0) {
      const basicStatus = {
        status: order.status || 'pending',
        timestamp: new Date().toISOString(),
        description: 'Order placed and payment pending',
        location: 'Online'
      }
      transformedHistory.push(basicStatus)
    }

    return NextResponse.json({ statusHistory: transformedHistory })

  } catch (error) {
    console.error('Error in status history API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
