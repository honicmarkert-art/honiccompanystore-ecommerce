import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client using service role key for admin operations
// This client BYPASSES Row Level Security (RLS) due to the service role key
// Used by: Webhooks, Admin operations, Background jobs
export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      // Service role key bypasses RLS - use with caution!
      headers: {
        'x-client-info': 'supabase-js-service-role'
      }
    }
  })
}

// Alternative function for user-based operations (with user session)
export function getSupabaseClientWithUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}






