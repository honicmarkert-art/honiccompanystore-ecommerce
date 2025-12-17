import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { logger } from '@/lib/logger'

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

// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// GET - Fetch active advertisements for public display
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = enhancedRateLimit(request)
  if (!rateLimitResult.allowed) {
    logRateLimitEvent('/api/advertisements', rateLimitResult.reason, request)
    
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
    return NextResponse.json(
      { error: 'Failed to fetch advertisements' },
      { status: 500 }
    )
  }
}



