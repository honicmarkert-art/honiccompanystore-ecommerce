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

export async function GET(req: NextRequest) {
	try {
		const supabase = getClient(req)
		const { data: { user } } = await supabase.auth.getUser()
		if (!user) return NextResponse.json({ items: [] })
		const { data, error } = await supabase.from('profiles').select('saved_later_product_ids').eq('id', user.id).single()
		if (error) return NextResponse.json({ items: [] })
		const ids: number[] = Array.isArray(data?.saved_later_product_ids) ? data!.saved_later_product_ids : []
		return NextResponse.json({ items: ids.map((id: number) => ({ productId: id, addedAt: new Date().toISOString() })) })
	} catch {
		return NextResponse.json({ items: [] })
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json()
		const productId = Number(body?.productId)
		if (!Number.isFinite(productId)) return NextResponse.json({ error: 'Invalid productId' }, { status: 400 })
		const supabase = getClient(req)
		const { data: { user } } = await supabase.auth.getUser()
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		const { data, error } = await supabase.from('profiles').select('saved_later_product_ids').eq('id', user.id).single()
		if (error && error.code !== 'PGRST116') return NextResponse.json({ error: 'DB error' }, { status: 500 })
		const prev: number[] = Array.isArray(data?.saved_later_product_ids) ? data!.saved_later_product_ids : []
		const next = [productId, ...prev.filter(id => id !== productId)]
		await supabase.from('profiles').upsert({ id: user.id, saved_later_product_ids: next }, { onConflict: 'id' })
		return NextResponse.json({ success: true })
	} catch {
		return NextResponse.json({ error: 'Failed' }, { status: 500 })
	}
}

export async function DELETE(req: NextRequest) {
	try {
		const productId = Number(new URL(req.url).searchParams.get('productId'))
		if (!Number.isFinite(productId)) return NextResponse.json({ error: 'Invalid productId' }, { status: 400 })
		const supabase = getClient(req)
		const { data: { user } } = await supabase.auth.getUser()
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		const { data, error } = await supabase.from('profiles').select('saved_later_product_ids').eq('id', user.id).single()
		if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
		const prev: number[] = Array.isArray(data?.saved_later_product_ids) ? data!.saved_later_product_ids : []
		const next = prev.filter(id => id !== productId)
		await supabase.from('profiles').upsert({ id: user.id, saved_later_product_ids: next }, { onConflict: 'id' })
		return NextResponse.json({ success: true })
	} catch {
		return NextResponse.json({ error: 'Failed' }, { status: 500 })
	}
}


