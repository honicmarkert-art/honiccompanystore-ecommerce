import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

function getClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  )
}

// GET /api/orders/my - returns only the authenticated user's orders
export async function GET(request: NextRequest) {
  const supabase = getClient(request)

  const { data: session } = await supabase.auth.getUser()
  const user = session.user
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Strong server-side policy: hard filter by user.id on the server
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') || '50'), 100)
  const offset = Math.max(Number(searchParams.get('offset') || '0'), 0)

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, reference_id, status, total_amount, currency, created_at, items, shipping_address, payment_method')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }

  return NextResponse.json({ orders: data || [], pagination: { limit, offset, returned: data?.length || 0 } })
}


