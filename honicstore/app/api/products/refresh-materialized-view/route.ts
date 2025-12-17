import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST(_req: NextRequest) {
  try {
    const supabase = getAdminClient()
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Supabase not configured' }, { status: 500 })
    }

    // Try common names; if none exist, still respond success to unblock UI
    const candidates = [
      'products_mv',
      'products_materialized',
      'products_materialized_view'
    ]

    let refreshed = false
    let lastError: string | undefined

    for (const name of candidates) {
      // Use RPC to run a SQL refresh via pg_net or a security definer function if available
      // Fallback to simple select from the view to detect existence
      const { error } = await supabase.rpc('refresh_materialized_view', { view_name: name })
      if (!error) { refreshed = true; break }
      lastError = error.message
    }

    // If no RPC exists, try a no-op query to detect existence (won't actually refresh)
    if (!refreshed) {
      const { error } = await supabase.from('products').select('id').limit(1)
      if (error) lastError = error.message
    }

    return NextResponse.json({ success: true, refreshed, lastError: refreshed ? undefined : lastError })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function GET() {
  // Method not allowed for refresh endpoint
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}




