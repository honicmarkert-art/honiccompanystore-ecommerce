import { createClient } from '@supabase/supabase-js'

// Client-side Supabase client for browser usage
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  {
    auth: {
      persistSession: true,        // Store session in localStorage
      autoRefreshToken: true,      // Automatically refresh expired tokens
      detectSessionInUrl: true,    // Detect auth tokens in URL
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'supabase.auth.token'
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'aliexpress-clone-client'
      }
    }
  }
)

// Client-side auth helper functions
export const clientAuth = {
  // Get current session (for client-side)
  getSession: async () => {
    const { data: { session }, error } = await supabaseClient.auth.getSession()
    return { session, error }
  },

  // Get current user (for client-side)
  getUser: async () => {
    const { data: { user }, error } = await supabaseClient.auth.getUser()
    return { user, error }
  },

  // Sign in with email and password (client-side)
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    })
    return { data, error }
  },

  // Sign out (client-side)
  signOut: async () => {
    const { error } = await supabaseClient.auth.signOut()
    return { error }
  },

  // Listen to auth state changes (client-side)
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabaseClient.auth.onAuthStateChange(callback)
  },

  // Refresh session (client-side)
  refreshSession: async () => {
    const { data, error } = await supabaseClient.auth.refreshSession()
    return { data, error }
  }
}






