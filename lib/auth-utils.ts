import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

/**
 * Creates a Supabase client with user authentication
 * @param request - NextRequest object containing authorization header
 * @returns Supabase client configured with user's access token
 */
export function createAuthenticatedClient(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    }
  )
}

/**
 * Validates user session using getUser() for critical operations
 * @param request - NextRequest object
 * @returns Promise with user data or throws error
 */
export async function validateUserSession(request: NextRequest) {
  const userSupabase = createAuthenticatedClient(request)
  
  // Critical action: validate session with getUser()
  const { data: user, error: authError } = await userSupabase.auth.getUser()
  
  if (authError || !user?.user) {
    console.error('Authentication failed:', authError)
    throw new Error('Authentication failed')
  }

  return user.user
}

/**
 * Creates a service role Supabase client for admin operations
 * @returns Supabase client with service role key
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

/**
 * Handles authentication errors consistently
 * @param error - Error object
 * @returns NextResponse with appropriate error message and status
 */
export function handleAuthError(error: any) {
  if (error.message === 'Missing or invalid authorization header') {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid authorization header' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }
  
  if (error.message === 'Authentication failed') {
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  console.error('Unexpected auth error:', error)
  return new Response(
    JSON.stringify({ error: 'Internal server error' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  )
}

/**
 * Validates user ownership of a resource
 * @param userId - User ID from validated session
 * @param resourceUserId - User ID from the resource
 * @throws Error if user doesn't own the resource
 */
export function validateResourceOwnership(userId: string, resourceUserId: string) {
  if (userId !== resourceUserId) {
    throw new Error('Access denied: Resource does not belong to user')
  }
}

/**
 * Client-side authentication helper for frontend components
 */
export class ClientAuthHelper {
  private supabase: any

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    
    this.supabase = (url && key) ? createClient(url, key) : null
  }

  /**
   * Get current user (for quick UI state checks)
   * Uses cookies for fast detection
   */
  async getCurrentUser() {
    const { data: { user } } = await this.supabase.auth.getUser()
    return user
  }

  /**
   * Validate user session for critical client-side operations
   * Always calls getUser() to ensure session is valid
   */
  async validateSession() {
    const { data: user, error } = await this.supabase.auth.getUser()
    
    if (error || !user?.user) {
      throw new Error('Authentication failed')
    }

    return user.user
  }

  /**
   * Get access token for API calls
   */
  async getAccessToken() {
    const { data: { session } } = await this.supabase.auth.getSession()
    return session?.access_token
  }

  /**
   * Make authenticated API call
   */
  async authenticatedFetch(url: string, options: RequestInit = {}) {
    const token = await this.getAccessToken()
    
    if (!token) {
      throw new Error('No access token available')
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
  }
}









