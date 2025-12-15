import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { logger } from '@/lib/logger'

// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Rate limit logging helper
const logRateLimitEvent = (endpoint: string, reason: string | undefined, request: NextRequest) => {
  const clientIP = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('cf-connecting-ip') || 
                   'unknown'
  logger.security(`Rate limit exceeded on ${endpoint}`, undefined, {
    ip: clientIP,
    reason,
    path: request.nextUrl.pathname
  })
}

// GET - Fetch advertisement rotation time for public use
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = enhancedRateLimit(request)
  if (!rateLimitResult.allowed) {
    logRateLimitEvent('/api/advertisements/rotation-time', rateLimitResult.reason, request)
    
    return NextResponse.json(
      { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
        }
      }
    )
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    const { data, error } = await supabase
      .from('admin_settings')
      .select('service_image_rotation_time')
      .eq('id', 1)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      throw error
    }
    
    const rotationTime = data?.service_image_rotation_time ? parseInt(data.service_image_rotation_time.toString()) : 10
    
    return NextResponse.json({ rotationTime })
  } catch (error) {
    console.error('Error fetching rotation time:', error)
    return NextResponse.json({ rotationTime: 10 }) // Default to 10 seconds
  }
}







