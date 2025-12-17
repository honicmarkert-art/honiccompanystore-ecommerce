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

// Toggle verbose debug logs for admin access flow
const DEBUG = false

export async function validateAdminAccess(): Promise<{ user: AdminUser | null; error: NextResponse | null }> {
  try {
    // Check environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('❌ Missing Supabase environment variables')
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Server configuration error', message: 'Missing Supabase configuration' },
          { status: 500 }
        )
      }
    }
    
    // Get cookies at the top level (this must be called at the top level of the API route)
    const cookieStore = await cookies()
    
    // Create Supabase client with user session (not service role)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Don't set cookies in server context
          },
          remove(name: string, options: any) {
            // Don't remove cookies in server context
          },
        },
      }
    )

    // Debug cookies
    const allCookies = cookieStore.getAll()
    if (DEBUG) console.log('🔍 [DEBUG] validateAdminAccess: Available cookies:', allCookies.map(c => ({ name: c.name, hasValue: !!c.value, valueLength: c.value?.length || 0 })))
    
    // Check for specific Supabase session cookies
    const sessionCookies = allCookies.filter(c => c.name.includes('sb-') || c.name.includes('supabase'))
    if (DEBUG) console.log('🔍 [DEBUG] validateAdminAccess: Supabase cookies:', sessionCookies.map(c => ({ name: c.name, hasValue: !!c.value })))
    
    // Get current session
    if (DEBUG) console.log('🔍 [DEBUG] validateAdminAccess: Getting session...')
    const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession()
    let session = initialSession
    
    if (DEBUG) console.log('🔍 [DEBUG] validateAdminAccess: Session result:', {
      hasSession: !!session,
      hasError: !!sessionError,
      errorMessage: sessionError?.message,
      userId: session?.user?.id,
      userEmail: session?.user?.email
    })
    
    if (sessionError || !session) {
      if (DEBUG) console.log('❌ [DEBUG] validateAdminAccess: No session found')
      if (DEBUG) console.log('❌ [DEBUG] validateAdminAccess: Session error details:', {
        error: sessionError?.message,
        code: sessionError?.code,
        status: sessionError?.status
      })
      
      // Try alternative session retrieval
      if (DEBUG) console.log('🔄 [DEBUG] validateAdminAccess: Trying alternative session retrieval...')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (DEBUG) console.log('🔄 [DEBUG] validateAdminAccess: Alternative user check:', {
        hasUser: !!user,
        userError: userError?.message
      })
      
      if (userError || !user) {
        return {
          user: null,
          error: NextResponse.json(
            { error: 'Authentication required', message: 'Please log in to access admin features' },
            { status: 401 }
          )
        }
      }
      
      // If we have a user but no session, create a minimal session object
      const minimalSession = {
        user: user,
        access_token: null,
        refresh_token: null,
        expires_in: 0,
        expires_at: 0,
        token_type: 'bearer'
      }
      
      if (DEBUG) console.log('✅ [DEBUG] validateAdminAccess: Using minimal session for user:', user.email)
      // Continue with the minimal session
      session = minimalSession as any
    }

    // Ensure session is not null at this point
    if (!session) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Authentication required', message: 'Please log in to access admin features' },
          { status: 401 }
        )
      }
    }

    // Get user profile with role information
    const { data: initialProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    let profile = initialProfile

    if (DEBUG) console.log('🔍 Profile lookup result:', {
      userId: session.user.id,
      profileError,
      profile,
      hasProfile: !!profile
    })

    if (profileError || !profile) {
      console.error('❌ Profile not found:', {
        userId: session.user.id,
        error: profileError,
        message: 'User profile could not be retrieved'
      })
      
      // Check if the error is due to network issues vs profile not existing
      if (profileError && profileError.code === 'PGRST116') {
        // Profile truly doesn't exist, try to create it
        console.log('🔄 Profile does not exist, attempting to create profile for user:', session.user.id)
        
        try {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'User',
              is_admin: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single()
          
          if (createError) {
            // Check if it's a duplicate key error (profile already exists)
            if (createError.code === '23505') {
              console.log('⚠️ Profile already exists, attempting to fetch it again')
              // Try to fetch the profile again
              const { data: existingProfile, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single()
              
              if (fetchError || !existingProfile) {
                console.error('❌ Still cannot fetch existing profile:', fetchError)
                return {
                  user: null,
                  error: NextResponse.json(
                    { error: 'Profile access failed', message: 'Unable to access user profile' },
                    { status: 500 }
                  )
                }
              }
              
              profile = existingProfile
              console.log('✅ Successfully fetched existing profile:', profile)
            } else {
              console.error('❌ Failed to create profile - Supabase error:', createError)
              return {
                user: null,
                error: NextResponse.json(
                  { error: 'Profile creation failed', message: `Database error: ${createError.message}` },
                  { status: 500 }
                )
              }
            }
          } else if (newProfile) {
            console.log('✅ Profile created successfully:', newProfile)
            profile = newProfile
          } else {
            console.error('❌ Failed to create profile - No data returned')
            return {
              user: null,
              error: NextResponse.json(
                { error: 'Profile creation failed', message: 'No profile data returned from database' },
                { status: 500 }
              )
            }
          }
        } catch (createError) {
          console.error('❌ Failed to create profile - Network error:', createError)
          return {
            user: null,
            error: NextResponse.json(
              { error: 'Profile creation failed', message: `Network error: ${createError instanceof Error ? createError.message : 'Unknown error'}` },
              { status: 500 }
            )
          }
        }
      } else {
        // Network or other error, don't try to create profile
        console.error('❌ Network or other error accessing profile, not attempting creation')
        return {
          user: null,
          error: NextResponse.json(
            { error: 'Profile access failed', message: 'Unable to access user profile due to network issues' },
            { status: 500 }
          )
        }
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
        { error: 'Authentication failed', message: 'Unable to verify admin access', details: error instanceof Error ? error.message : 'Unknown error' },
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

