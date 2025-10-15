import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

function getClient(request: NextRequest) {
  const supabase = createServerClient(
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
  return supabase
}

export async function GET(request: NextRequest) {
  const supabase = getClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .select('saved_for_later')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
  return NextResponse.json({ items: data?.saved_for_later || [] })
}

export async function POST(request: NextRequest) {
  const supabase = getClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const items = Array.isArray(body?.items) ? body.items : []

  // Load existing
  const { data: existing } = await supabase
    .from('profiles')
    .select('saved_for_later')
    .eq('id', user.id)
    .single()

  const prev: any[] = existing?.saved_for_later || []
  const mergedMap = new Map<number, any>()
  ;[...prev, ...items].forEach((i: any) => {
    if (i && typeof i.productId === 'number') mergedMap.set(i.productId, i)
  })
  const merged = Array.from(mergedMap.values())

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, saved_for_later: merged })

  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  return NextResponse.json({ success: true, items: merged })
}

export async function DELETE(request: NextRequest) {
  const supabase = getClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const productId = Number(searchParams.get('productId'))
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  const { data: existing } = await supabase
    .from('profiles')
    .select('saved_for_later')
    .eq('id', user.id)
    .single()

  const prev: any[] = existing?.saved_for_later || []
  const next = prev.filter((i: any) => i?.productId !== productId)

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, saved_for_later: next })

  if (error) return NextResponse.json({ error: 'Failed to remove' }, { status: 500 })
  return NextResponse.json({ success: true, items: next })
}


