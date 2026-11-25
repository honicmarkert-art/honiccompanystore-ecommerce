import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/team-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/team/offers?status=new|all  (admins only) -> latest price offers */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const status = request.nextUrl.searchParams.get('status') || 'new'
  let q = getSupabaseClient().from('price_offers').select('*').order('created_at', { ascending: false }).limit(100)
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: 'Could not load offers' }, { status: 500 })
  return NextResponse.json({ offers: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}
