import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function sessionClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value },
        set() {},
        remove() {},
      },
    },
  )
}

async function requireUser(req: NextRequest) {
  const { data: { user } } = await sessionClient(req).auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    if (!user) return NextResponse.json({ alerts: [] }, { status: 401 })

    const { data, error } = await getSupabaseClient()
      .from('price_alerts')
      .select('id, product_id, target_price, current_price, is_active, email_sent, products(id, name, image, price, slug)')
      .eq('user_id', user.id)
      .order('id', { ascending: false })

    if (error) return NextResponse.json({ error: 'Failed to load price alerts' }, { status: 500 })
    return NextResponse.json({ alerts: data || [] })
  } catch {
    return NextResponse.json({ error: 'Failed to load price alerts' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const productId = Number(body?.productId)
    const targetPrice = Number(body?.targetPrice)
    if (!Number.isFinite(productId) || !Number.isFinite(targetPrice) || targetPrice <= 0) {
      return NextResponse.json({ error: 'Enter a valid target price' }, { status: 400 })
    }

    const admin = getSupabaseClient()
    const { data: product, error: productError } = await admin
      .from('products')
      .select('id, price')
      .eq('id', productId)
      .maybeSingle()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const { data: existing } = await admin
      .from('price_alerts')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .eq('is_active', true)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await admin
        .from('price_alerts')
        .update({
          target_price: targetPrice,
          current_price: product.price,
          email_sent: false,
          is_active: true,
        })
        .eq('id', existing.id)
        .eq('user_id', user.id)
      if (error) return NextResponse.json({ error: 'Failed to update price alert' }, { status: 500 })
      return NextResponse.json({ success: true, id: existing.id })
    }

    const { data: created, error } = await admin
      .from('price_alerts')
      .insert({
        user_id: user.id,
        product_id: productId,
        target_price: targetPrice,
        current_price: product.price,
        is_active: true,
        email_sent: false,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: 'Failed to save price alert' }, { status: 500 })
    return NextResponse.json({ success: true, id: created.id })
  } catch {
    return NextResponse.json({ error: 'Failed to save price alert' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing alert id' }, { status: 400 })

    const { error } = await getSupabaseClient()
      .from('price_alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: 'Failed to remove price alert' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to remove price alert' }, { status: 500 })
  }
}
