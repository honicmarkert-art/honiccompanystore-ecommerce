import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/user/profile',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { success: false, error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }
    // Create Supabase client with proper cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Cookies will be set by the response
          },
          remove(name: string, options: any) {
            // Cookies will be removed by the response
          },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fetch profile'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      profile
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: 'An unexpected error occurred. Please try again later.'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/user/profile',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { success: false, error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }

    // Create Supabase client with proper cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { full_name, phone, avatar_url } = body

    // Validate input
    if (full_name && typeof full_name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid full_name format' },
        { status: 400 }
      )
    }

    if (phone && typeof phone !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid phone format' },
        { status: 400 }
      )
    }

    // Update user profile - ensure user can only update their own profile
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (full_name !== undefined) {
      updateData.full_name = full_name.trim()
    }

    if (phone !== undefined) {
      updateData.phone = phone.trim()
    }

    if (avatar_url !== undefined) {
      updateData.avatar = avatar_url
    }

    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id) // Ensure user can only update their own profile
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to update profile'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      profile
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: 'An unexpected error occurred. Please try again later.'
      },
      { status: 500 }
    )
  }
}
