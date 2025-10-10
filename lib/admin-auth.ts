import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export interface AdminUser {
  id: string
  email: string
  role: string
  isAdmin: boolean
}

export async function validateAdminAccess(): Promise<{ user: AdminUser | null; error: NextResponse | null }> {
  try {
    
    // Get cookies at the top level (this must be called at the top level of the API route)
    const cookieStore = await cookies()
    
    // Create Supabase client with user session (not service role)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    
    if (sessionError || !session) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Authentication required', message: 'Please log in to access admin features' },
          { status: 401 }
        )
      }
    }

    // Get user profile with role information
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()


    if (profileError || !profile) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Profile not found', message: 'User profile could not be retrieved' },
          { status: 404 }
        )
      }
    }

    // Check if user is admin (check is_admin boolean field)
    const isAdmin = profile.is_admin === true

    if (!isAdmin) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Access denied', message: 'Admin privileges required' },
          { status: 403 }
        )
      }
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email || '',
        role: 'admin',
        isAdmin: true
      },
      error: null
    }

  } catch (error) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Authentication failed', message: 'Unable to verify admin access', details: error.message },
        { status: 500 }
      )
    }
  }
}

export function createAdminSupabaseClient() {
  // Create admin client using service role for database operations
  // but only after user authentication is verified
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  return createClient(url, serviceKey, { 
    auth: { autoRefreshToken: false, persistSession: false } 
  })
}

