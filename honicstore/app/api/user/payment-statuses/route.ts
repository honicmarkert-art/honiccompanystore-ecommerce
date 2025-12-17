import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

function getClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value },
        set() {},
        remove() {},
      },
    },
  )
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getClient(request)
    
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ paymentStatuses: [], count: 0 })
    }

    // Get user's payment statuses from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('payment_statuses')
      .eq('id', user.id)
      .single()

    // Parse payment statuses and sort by created_at (newest first)
    const paymentStatuses = profile?.payment_statuses || []
    const sortedStatuses = Array.isArray(paymentStatuses) 
      ? paymentStatuses.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      : []

    return NextResponse.json({ 
      paymentStatuses: sortedStatuses,
      count: sortedStatuses.length
    })

  } catch (error) {
    console.error('Payment statuses API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getClient(request)
    
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, orderNumber, paymentStatus, amount, paymentMethod, transactionId } = body

    if (!orderId || !orderNumber || !paymentStatus || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create payment status entry
    const paymentStatusEntry = {
      id: orderId,
      order_number: orderNumber,
      payment_status: paymentStatus,
      amount: amount,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      payment_method: paymentMethod || 'Unknown',
      transaction_id: transactionId || ''
    }

    // Add to user's payment statuses
    const { data: profile } = await supabase
      .from('profiles')
      .select('payment_statuses')
      .eq('id', user.id)
      .single()

    const currentStatuses = profile?.payment_statuses || []
    const updatedStatuses = [paymentStatusEntry, ...currentStatuses].slice(0, 50) // Keep last 50

    await supabase
      .from('profiles')
      .update({ payment_statuses: updatedStatuses })
      .eq('id', user.id)

    return NextResponse.json({ 
      success: true,
      paymentStatus: paymentStatusEntry
    })

  } catch (error) {
    console.error('Add payment status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
