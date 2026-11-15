import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const now = new Date().toISOString()
    const { data, error } = await getSupabaseClient()
      .from('supplier_promotions')
      .select('id, name, code, description, discount_type, discount_value, min_purchase_amount, max_discount_amount, end_date, usage_limit, used_count')
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('end_date', { ascending: true })

    if (error) return NextResponse.json({ promotions: [] })

    const promotions = (data || []).filter((row) => {
      if (row.usage_limit == null) return true
      return Number(row.used_count || 0) < Number(row.usage_limit)
    })

    return NextResponse.json({ promotions })
  } catch {
    return NextResponse.json({ promotions: [] })
  }
}
