/**
 * Utility functions for authentication and authorization
 * Provides secure token retrieval and user validation
 */

/**
 * Get authentication token from Supabase session
 * Replaces direct Supabase client usage in components
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const { supabase } = await import('@/lib/supabase-auth')
    const { data: sessionData } = await supabase.auth.getSession()
    return sessionData.session?.access_token || null
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

/**
 * Get authenticated user from Supabase session
 * Returns user object or null if not authenticated
 */
export async function getAuthenticatedUser() {
  try {
    const { supabase } = await import('@/lib/supabase-auth')
    const { data: sessionData } = await supabase.auth.getSession()
    return sessionData.session?.user || null
  } catch (error) {
    console.error('Error getting authenticated user:', error)
    return null
  }
}

/**
 * Validate order ownership
 * Checks if the authenticated user owns the order
 */
export function validateOrderOwnership(orderUserId: string | null, authenticatedUserId: string): boolean {
  if (!orderUserId || !authenticatedUserId) {
    return false
  }
  return orderUserId === authenticatedUserId
}

/**
 * Sanitize order number for display
 * Removes sensitive information and validates format
 */
export function sanitizeOrderNumber(orderNumber: string | null | undefined): string | null {
  if (!orderNumber) return null
  
  // Remove any potentially dangerous characters
  const sanitized = orderNumber.replace(/[^A-Za-z0-9-]/g, '')
  
  // Validate format (alphanumeric with optional hyphens)
  if (!/^[A-Za-z0-9-]+$/.test(sanitized)) {
    return null
  }
  
  // Limit length to prevent abuse
  if (sanitized.length > 100) {
    return null
  }
  
  return sanitized
}
