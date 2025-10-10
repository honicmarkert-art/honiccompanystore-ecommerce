import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null as any

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    // Create client with user's access token for getUser() validation
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // Critical action: validate session with getUser()
    const { data: user, error: authError } = await userSupabase.auth.getUser()
    
    if (authError || !user?.user) {
      console.error('Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    // Parse request body
    const paymentData = await request.json()
    
    // Validate required payment data
    if (!paymentData.orderId || !paymentData.amount) {
      return NextResponse.json(
        { error: 'Missing required payment data' },
        { status: 400 }
      )
    }

    // Verify order belongs to authenticated user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', paymentData.orderId)
      .eq('user_id', user.user.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found or access denied' },
        { status: 404 }
      )
    }

    // Process payment (simulate)
    const paymentResult = {
      paymentId: `PAY_${Date.now()}`,
      status: 'completed',
      amount: paymentData.amount,
      orderId: paymentData.orderId,
      timestamp: new Date().toISOString(),
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'paid',
        payment_id: paymentResult.paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentData.orderId)
      .eq('user_id', user.user.id)

    if (updateError) {
      console.error('Failed to update order:', updateError)
      return NextResponse.json(
        { error: 'Payment processed but failed to update order' },
        { status: 500 }
      )
    }

    // Log payment transaction
    const { error: logError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: user.user.id,
        order_id: paymentData.orderId,
        payment_id: paymentResult.paymentId,
        amount: paymentData.amount,
        status: paymentResult.status,
        payment_method: paymentData.method || 'clickpesa',
        created_at: new Date().toISOString(),
      })

    if (logError) {
      console.error('Failed to log payment transaction:', logError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      payment: paymentResult,
    })

  } catch (error) {
    console.error('Payment processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    // Create client with user's access token for getUser() validation
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // Critical action: validate session with getUser()
    const { data: user, error: authError } = await userSupabase.auth.getUser()
    
    if (authError || !user?.user) {
      console.error('Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    // Get payment history for user
    const { data: payments, error: paymentsError } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        orders!inner(user_id)
      `)
      .eq('user_id', user.user.id)
      .order('created_at', { ascending: false })

    if (paymentsError) {
      console.error('Failed to fetch payments:', paymentsError)
      return NextResponse.json(
        { error: 'Failed to fetch payment history' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      payments: payments || [],
    })

  } catch (error) {
    console.error('Payments fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}








