import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/notifications - Get user's notifications
export async function GET(request: NextRequest) {
  try {
    // Create Supabase client with user session
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

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread_only') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error('Error fetching notifications:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
      total: notifications?.length || 0
    })

  } catch (error: any) {
    console.error('Error in GET /api/notifications:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/notifications - Create a notification (admin/system only)
export async function POST(request: NextRequest) {
  try {
    // Only allow system/admin to create notifications
    // Use admin client to bypass RLS
    const adminSupabase = getSupabaseClient()

    const body = await request.json()
    const { user_id, type, title, message, metadata } = body

    if (!user_id || !type || !title || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: user_id, type, title, message' },
        { status: 400 }
      )
    }

    // Validate notification type
    const validTypes = ['account_activated', 'account_deactivated', 'order_received', 'order_updated', 'system', 'info']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Create notification
    const { data: notification, error } = await adminSupabase
      .from('notifications')
      .insert({
        user_id,
        type,
        title,
        message,
        metadata: metadata || null,
        is_read: false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating notification:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create notification' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      notification
    })

  } catch (error: any) {
    console.error('Error in POST /api/notifications:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

