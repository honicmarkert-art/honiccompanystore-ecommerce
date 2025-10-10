import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// GET - Fetch advertisement rotation time for public use
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'ad_rotation_time')
      .single()
    
    if (error && error.code !== 'PGRST116') {
      throw error
    }
    
    const rotationTime = data?.value ? parseInt(data.value) : 10
    
    return NextResponse.json({ rotationTime })
  } catch (error) {
    console.error('Error fetching rotation time:', error)
    return NextResponse.json({ rotationTime: 10 }) // Default to 10 seconds
  }
}







