/**
 * Centralized Supabase Client Factory
 * This prevents build-time crashes by only creating clients when env vars are available
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cachedAnonClient: SupabaseClient | null = null
let cachedServiceClient: SupabaseClient | null = null

/**
 * Get Supabase client with anon key (for public operations)
 * Safe to use during build - returns null if env vars not available
 */
export function getSupabaseClient(): SupabaseClient | null {
  // Return cached client if available
  if (cachedAnonClient) return cachedAnonClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Only create if both variables exist and are not empty
  if (!url || !key || url === '' || key === '') {
    return null
  }

  try {
    cachedAnonClient = createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
    return cachedAnonClient
  } catch (error) {
    console.error('Failed to create Supabase anon client:', error)
    return null
  }
}

/**
 * Get Supabase client with service role key (for admin operations)
 * Safe to use during build - returns null if env vars not available
 */
export function getSupabaseServiceClient(): SupabaseClient | null {
  // Return cached client if available
  if (cachedServiceClient) return cachedServiceClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Only create if both variables exist and are not empty
  if (!url || !key || url === '' || key === '') {
    return null
  }

  try {
    cachedServiceClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    return cachedServiceClient
  } catch (error) {
    console.error('Failed to create Supabase service client:', error)
    return null
  }
}

/**
 * Create a one-time Supabase client with custom config
 * Useful for per-request clients with specific auth tokens
 */
export function createSupabaseClient(
  accessToken?: string,
  useServiceRole: boolean = false
): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = useServiceRole 
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url === '' || key === '') {
    return null
  }

  try {
    const config: any = {
      auth: {
        autoRefreshToken: !useServiceRole,
        persistSession: !useServiceRole
      }
    }

    if (accessToken) {
      config.global = {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }

    return createClient(url, key, config)
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    return null
  }
}

