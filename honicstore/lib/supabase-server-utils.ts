/**
 * Production-ready Supabase server utilities
 * Provides validated Supabase client creation with proper error handling
 */

import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

export interface SupabaseCredentials {
  url: string
  anonKey: string
}

/**
 * Get and validate Supabase credentials from environment variables
 * @throws Error if credentials are missing
 */
export function getSupabaseCredentials(): SupabaseCredentials {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    const missing = []
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    logger.error('Missing Supabase environment variables', { missing })
    
    throw new Error(
      `Missing required Supabase environment variables: ${missing.join(', ')}. ` +
      'Please check your .env.local file and ensure all required variables are set.'
    )
  }

  return { url, anonKey }
}

/**
 * Create a Supabase server client with validated credentials
 * This ensures the client is always created with valid credentials
 * 
 * @param request - NextRequest object for cookie handling
 * @returns Supabase server client
 * @throws Error if credentials are missing
 */
export function createValidatedSupabaseClient(request: NextRequest) {
  const { url, anonKey } = getSupabaseCredentials()
  
  // Track cookies that Supabase wants to set
  const cookiesToSet: Array<{ name: string; value: string; options: any }> = []
  
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        // Store cookie to set later
        cookiesToSet.push({ name, value, options })
      },
      remove(name: string, options: any) {
        // Store cookie to remove later
        cookiesToSet.push({ name, value: '', options: { ...options, maxAge: 0 } })
      },
    },
  })

  return {
    supabase,
    cookiesToSet,
  }
}

/**
 * Apply Supabase cookies to a NextResponse
 * 
 * @param response - NextResponse to apply cookies to
 * @param cookiesToSet - Array of cookies from createValidatedSupabaseClient
 */
export function applySupabaseCookies(
  response: Response,
  cookiesToSet: Array<{ name: string; value: string; options: any }>
): void {
  const isProd = process.env.NODE_ENV === 'production'
  
  for (const cookie of cookiesToSet) {
    if (cookie.value) {
      // Set cookie
      if (response instanceof Response && 'cookies' in response) {
        (response as any).cookies.set(cookie.name, cookie.value, {
          httpOnly: cookie.options?.httpOnly !== false,
          secure: cookie.options?.secure ?? isProd,
          sameSite: cookie.options?.sameSite ?? 'lax',
          path: cookie.options?.path ?? '/',
          maxAge: cookie.options?.maxAge ?? 60 * 60 * 24 * 7, // 7 days default
        })
      }
    } else {
      // Remove cookie
      if (response instanceof Response && 'cookies' in response) {
        (response as any).cookies.delete(cookie.name)
      }
    }
  }
}
