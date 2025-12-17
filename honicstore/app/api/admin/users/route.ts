import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/users - Fetch all users with their auth data
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const supabase = createAdminSupabaseClient()
    
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('[API][Admin][Users] Database error:', profilesError)
      return NextResponse.json(
        { error: 'Failed to fetch users', details: profilesError.message },
        { status: 500 }
      )
    }

    // Fetch auth data for all users (last_sign_in_at, email_confirmed_at)
    // Note: Supabase admin API doesn't support batch fetching, so we fetch individually
    // but we'll do it in parallel with Promise.all for better performance
    const userIds = (profiles || []).map(p => p.id)
    const authUsersMap: Record<string, any> = {}
    
    if (userIds.length > 0) {
      // Fetch auth users in parallel (with concurrency limit to avoid overwhelming the API)
      const concurrencyLimit = 10
      for (let i = 0; i < userIds.length; i += concurrencyLimit) {
        const batch = userIds.slice(i, i + concurrencyLimit)
        const authPromises = batch.map(async (userId) => {
          try {
            const { data: authUser } = await supabase.auth.admin.getUserById(userId)
            if (authUser?.user) {
              return { userId, authUser: authUser.user }
            }
            return null
          } catch (error) {
            // User might not exist in auth, continue
            return null
          }
        })
        
        const results = await Promise.all(authPromises)
        results.forEach(result => {
          if (result) {
            authUsersMap[result.userId] = result.authUser
          }
        })
      }
    }

    // Transform the data
    const users = (profiles || []).map((profile: any) => {
      const authUser = authUsersMap[profile.id]
      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        is_admin: profile.is_admin || false,
        is_supplier: profile.is_supplier || false,
        is_active: profile.is_active !== false, // Default to true if null
        company_name: profile.company_name,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        email_confirmed_at: authUser?.email_confirmed_at || null,
      }
    })

    return NextResponse.json({
      success: true,
      users
    })

  } catch (error: any) {
    console.error('[API][Admin][Users] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    )
  }
}
