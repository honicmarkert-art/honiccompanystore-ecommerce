import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// GET - Fetch active advertisements for public display
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placement = searchParams.get('placement')
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    let query = supabase
      .from('advertisements')
      .select('*')
      .eq('is_active', true)
    
    // Filter by placement if specified
    if (placement) {
      query = query.eq('placement', placement)
    }
    
    const { data: advertisements, error } = await query
      .order('display_order', { ascending: true })
    
    if (error) throw error
    
    return NextResponse.json(advertisements || [])
  } catch (error) {
    console.error('Error fetching advertisements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch advertisements' },
      { status: 500 }
    )
  }
}



