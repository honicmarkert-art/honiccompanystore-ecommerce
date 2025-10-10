import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// GET - Fetch advertisement rotation time setting
export async function GET() {
  try {
    const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null
    
    // Try the new schema first (direct column)
    const { data: newData, error: newError } = await supabase
      .from('admin_settings')
      .select('ad_rotation_time')
      .eq('id', 1)
      .single()
    
    if (!newError && newData) {
      const rotationTime = newData.ad_rotation_time || 10
      return NextResponse.json({ rotationTime })
    }
    
    // Fallback to old key-value schema
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'ad_rotation_time')
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching rotation time:', error)
      return NextResponse.json({ rotationTime: 10 })
    }
    
    const rotationTime = data?.value ? parseInt(data.value) : 10
    
    return NextResponse.json({ rotationTime })
  } catch (error) {
    console.error('Error fetching rotation time:', error)
    return NextResponse.json({ rotationTime: 10 }) // Default to 10 seconds
  }
}

// POST - Save advertisement rotation time setting
export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null
    const body = await request.json()
    const { rotationTime } = body
    
    if (!rotationTime || rotationTime < 3 || rotationTime > 60) {
      return NextResponse.json(
        { error: 'Rotation time must be between 3 and 60 seconds' },
        { status: 400 }
      )
    }
    
    // Try new schema first (direct column)
    const { error: updateError } = await supabase
      .from('admin_settings')
      .update({ ad_rotation_time: rotationTime })
      .eq('id', 1)
    
    if (!updateError) {
      return NextResponse.json({ success: true, rotationTime })
    }
    
    // Fallback to old key-value schema
    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        key: 'ad_rotation_time',
        value: rotationTime.toString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
    
    if (error) throw error
    
    return NextResponse.json({ success: true, rotationTime })
  } catch (error) {
    console.error('Error saving rotation time:', error)
    return NextResponse.json(
      { error: 'Failed to save rotation time' },
      { status: 500 }
    )
  }
}

