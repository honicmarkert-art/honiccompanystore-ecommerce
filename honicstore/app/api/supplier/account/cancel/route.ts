import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// POST /api/supplier/account/cancel - Delete supplier account
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { reason, feedback } = body

    if (!reason) {
      return NextResponse.json(
        { error: 'Deletion reason is required' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminSupabaseClient()

    // Get supplier profile - store info before deletion
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, company_name, email, is_supplier')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    if (!profile.is_supplier) {
      return NextResponse.json(
        { error: 'User is not a supplier' },
        { status: 400 }
      )
    }

    const companyName = profile.company_name || profile.email || 'Unknown'
    const userEmail = profile.email || user.email || 'Unknown'

    // Step 1: Create admin notification BEFORE deleting user (so we can store the info)
    // Get all admin users to notify them
    const { data: adminProfiles } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('is_active', true)

    if (adminProfiles && adminProfiles.length > 0) {
      const adminNotifications = adminProfiles.map(admin => ({
        user_id: admin.id,
        type: 'account_deleted' as const,
        title: 'Account Deleted',
        message: `Supplier account "${companyName}" (${userEmail}) has been deleted by the user. Reason: ${reason}${feedback ? `. Feedback: ${feedback}` : ''}`,
        metadata: {
          deletion_reason: reason,
          deletion_feedback: feedback,
          company_name: companyName,
          deleted_user_email: userEmail,
          deleted_user_id: user.id,
          deleted_at: new Date().toISOString()
        },
        is_read: false
      }))

      await adminSupabase
        .from('notifications')
        .insert(adminNotifications)
    }

    // Step 2: Hide all products
    const { error: productsError } = await adminSupabase
      .from('products')
      .update({ is_hidden: true })
      .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`)

    if (productsError) {
      // Don't fail the request, just log the error
    }

    // Step 3: Delete profile record first
    // Note: We delete profile first before auth user to avoid foreign key constraint issues.
    // If the profile has ON DELETE CASCADE from auth.users, deleting auth will auto-delete profile,
    // but this ensures we handle both cases correctly.
    const { error: profileDeleteError } = await adminSupabase
      .from('profiles')
      .delete()
      .eq('id', user.id)

    if (profileDeleteError) {
      // Continue with auth deletion even if profile deletion fails
      // (profile might get auto-deleted via cascade when we delete from auth)
    }

    // Step 4: Permanently delete user from Supabase Auth Users table
    // This is the final step that actually removes the user from Supabase Auth
    const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(user.id)

    if (authDeleteError) {
      return NextResponse.json(
        { error: 'Failed to delete user account', details: authDeleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

