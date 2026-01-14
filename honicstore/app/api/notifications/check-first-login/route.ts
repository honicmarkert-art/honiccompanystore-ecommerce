import { NextRequest, NextResponse } from 'next/server'
import { validateAuth } from '@/lib/auth-server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/notifications/check-first-login - Check if user is logging in for the first time
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await validateAuth(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const adminSupabase = createAdminSupabaseClient()

    // Check if user has any welcome notifications
    const { data: existingWelcome, error: welcomeError } = await adminSupabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'welcome')
      .limit(1)
      .single()

    // Check if user profile was created recently (within last 24 hours)
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('created_at')
      .eq('id', user.id)
      .single()

    const isRecentUser = profile?.created_at 
      ? (Date.now() - new Date(profile.created_at).getTime()) < 24 * 60 * 60 * 1000 // 24 hours
      : false

    // First login if no welcome notification exists and user is recent
    const isFirstLogin = !existingWelcome && isRecentUser

    return NextResponse.json({
      success: true,
      isFirstLogin,
      hasWelcomeNotification: !!existingWelcome,
      isRecentUser
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

