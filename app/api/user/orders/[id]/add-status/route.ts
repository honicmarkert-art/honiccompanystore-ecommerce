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

export async function POST(
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
    const { status, description, location } = body

    // Verify the order belongs to the user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id')
      .eq('id', resolvedParams.id)
      .eq('user_id', user.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Add status to history
    const { data: statusEntry, error: statusError } = await supabase
      .from('order_status_history')
      .insert({
        order_id: resolvedParams.id,
        status: status,
        description: description,
        location: location
      })
      .select()
      .single()

    if (statusError) {
      console.error('Error adding status to history:', statusError)
      return NextResponse.json({ error: 'Failed to add status to history' }, { status: 500 })
    }

    return NextResponse.json({ statusEntry })

  } catch (error) {
    console.error('Error in add status API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
