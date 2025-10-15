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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getClient(request)
  const { data: session } = await supabase.auth.getUser()
  const user = session.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orderId = params.id
  const { data, error } = await supabase
    .from('orders')
    .select('id, reference, status, total, currency, created_at, items, shipping_address, payment_method')
    .eq('user_id', user.id)
    .eq('id', orderId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ order: data })
}


