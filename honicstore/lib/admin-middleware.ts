import { NextRequest, NextResponse } from 'next/server'
import { validateServerSession } from './security-server'

export interface AdminAccessResult {
  allowed: boolean
  user?: any
  error?: string
  statusCode?: number
}

/**
 * Comprehensive admin access control middleware
 * Use this for all admin-only API routes
 */
export async function requireAdminAccess(request: NextRequest): Promise<AdminAccessResult> {
  try {
    // 1. Validate session exists
    const session = await validateServerSession(request)
    if (!session) {
      return {
        allowed: false,
        error: 'Authentication required',
        statusCode: 401
      }
    }

    // 2. Check if user is admin
    const isAdmin = session?.role === 'admin' || session?.profile?.is_admin === true
    if (!isAdmin) {
      return {
        allowed: false,
        user: session,
        error: 'Admin access required',
        statusCode: 403
      }
    }

    // 3. Additional security checks
    const userAgent = request.headers.get('user-agent')
    const origin = request.headers.get('origin')
    
    // Log admin access for security monitoring
    console.log('🔐 Admin access granted:', {
      userId: session.user?.id,
      email: session.user?.email,
      role: session.role,
      userAgent: userAgent?.substring(0, 50),
      origin,
      timestamp: new Date().toISOString()
    })

    return {
      allowed: true,
      user: session
    }

  } catch (error) {
    console.error('❌ Admin access validation failed:', error)
    return {
      allowed: false,
      error: 'Access validation failed',
      statusCode: 500
    }
  }
}

/**
 * Block non-admin users with proper error responses
 */
export function blockNonAdmin(accessResult: AdminAccessResult): NextResponse | null {
  if (accessResult.allowed) {
    return null // Allow access
  }

  // Log security event
  console.log('🚫 Admin access blocked:', {
    error: accessResult.error,
    statusCode: accessResult.statusCode,
    user: accessResult.user?.user?.id,
    timestamp: new Date().toISOString()
  })

  // Return appropriate error response
  return NextResponse.json(
    { 
      error: accessResult.error || 'Access denied',
      message: 'This action requires administrator privileges',
      timestamp: new Date().toISOString()
    },
    { status: accessResult.statusCode || 403 }
  )
}

/**
 * Enhanced admin route wrapper
 * Use this instead of manual checks
 */
export async function withAdminAccess(
  request: NextRequest,
  handler: (request: NextRequest, user: any) => Promise<NextResponse>
): Promise<NextResponse> {
  const accessResult = await requireAdminAccess(request)
  
  const blockResponse = blockNonAdmin(accessResult)
  if (blockResponse) {
    return blockResponse
  }

  // User is admin, proceed with handler
  return handler(request, accessResult.user)
}

/**
 * Admin-only API route decorator
 * Usage: export const GET = withAdminRoute(async (request, user) => { ... })
 */
export function withAdminRoute(
  handler: (request: NextRequest, user: any) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    return withAdminAccess(request, handler)
  }
}

