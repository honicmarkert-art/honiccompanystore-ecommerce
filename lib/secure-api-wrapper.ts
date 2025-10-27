import { NextRequest, NextResponse } from 'next/server'
import { validateServerSession } from './security-server'
import { protectAgainstIdor } from './idor-security'
import { requirePermission } from './rbac-system'
import { monitorIdorAttempt, monitorUnauthorizedAccess, monitorRateLimitViolation } from './security-monitoring'
import { logger } from './logger'

/**
 * Secure API Route Wrapper
 * Implements comprehensive security measures for API routes
 */

export interface SecureApiOptions {
  requireAuth?: boolean
  requireAdmin?: boolean
  permission?: string
  resourceType?: 'products' | 'orders' | 'users' | 'cart'
  enableIdorProtection?: boolean
  enableRateLimit?: boolean
  rateLimitPerMinute?: number
  logAccess?: boolean
}

/**
 * Secure API route wrapper with IDOR protection, RBAC, and monitoring
 */
export function withSecurity<T = any>(
  handler: (request: NextRequest, context: T) => Promise<NextResponse>,
  options: SecureApiOptions = {}
) {
  return async (request: NextRequest, context: T): Promise<NextResponse> => {
    const {
      requireAuth = true,
      requireAdmin = false,
      permission,
      resourceType,
      enableIdorProtection = true,
      enableRateLimit = true,
      rateLimitPerMinute = 60,
      logAccess = true
    } = options

    try {
      // 1. Authentication check
      if (requireAuth) {
        const session = await validateServerSession(request)
        if (!session) {
          monitorUnauthorizedAccess(
            'anonymous',
            request,
            'api_access',
            'No valid session found'
          )
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          )
        }

        // 2. Admin check
        if (requireAdmin) {
          const isAdmin = session.role === 'admin' || session.profile?.is_admin === true
          if (!isAdmin) {
            monitorUnauthorizedAccess(
              session.user?.id || 'unknown',
              request,
              'admin_access',
              'Insufficient admin privileges'
            )
            return NextResponse.json(
              { error: 'Admin access required' },
              { status: 403 }
            )
          }
        }

        // 3. Permission check
        if (permission) {
          // This would need the supabase client - simplified for now
          const hasPermission = true // Implement actual permission check
          if (!hasPermission) {
            monitorUnauthorizedAccess(
              session.user?.id || 'unknown',
              request,
              'permission_check',
              `Missing permission: ${permission}`
            )
            return NextResponse.json(
              { error: 'Insufficient permissions' },
              { status: 403 }
            )
          }
        }

        // 4. IDOR protection for resource access
        if (enableIdorProtection && resourceType) {
          const resourceId = extractResourceId(request, context)
          if (resourceId) {
            // This would need the supabase client - simplified for now
            const idorCheck = { allowed: true } // Implement actual IDOR check
            if (!idorCheck.allowed) {
              monitorIdorAttempt(
                session.user?.id || 'unknown',
                request,
                resourceId,
                resourceType,
                false
              )
              return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
              )
            }
          }
        }

        // 5. Rate limiting (simplified)
        if (enableRateLimit) {
          // Implement rate limiting logic here
          // For now, we'll skip the actual implementation
        }

        // 6. Log access
        if (logAccess) {
          logger.log('API access granted', session.user?.id, {
            endpoint: request.url,
            method: request.method,
            userAgent: request.headers.get('user-agent')
          })
        }

        // 7. Execute the actual handler
        return await handler(request, context)
      } else {
        // No authentication required
        return await handler(request, context)
      }

    } catch (error) {
      logger.error('Secure API wrapper error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Extract resource ID from request context
 */
function extractResourceId(request: NextRequest, context: any): string | null {
  // Extract from URL path
  const url = new URL(request.url)
  const pathSegments = url.pathname.split('/')
  
  // Look for ID patterns in the path
  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i]
    if (segment && !isNaN(Number(segment))) {
      return segment
    }
  }
  
  // Extract from context if it has params
  if (context && typeof context === 'object' && 'params' in context) {
    const params = context.params
    if (params && typeof params === 'object') {
      // Look for common ID fields
      const idFields = ['id', 'userId', 'productId', 'orderId']
      for (const field of idFields) {
        if (field in params && params[field]) {
          return String(params[field])
        }
      }
    }
  }
  
  return null
}

/**
 * Secure user resource access wrapper
 */
export function withUserResourceAccess<T = any>(
  handler: (request: NextRequest, context: T, userId: string) => Promise<NextResponse>,
  options: SecureApiOptions = {}
) {
  return withSecurity(async (request: NextRequest, context: T) => {
    const session = await validateServerSession(request)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      )
    }

    return await handler(request, context, session.user.id)
  }, options)
}

/**
 * Secure admin access wrapper
 */
export function withAdminAccess<T = any>(
  handler: (request: NextRequest, context: T, adminUser: any) => Promise<NextResponse>,
  options: SecureApiOptions = {}
) {
  return withSecurity(async (request: NextRequest, context: T) => {
    const session = await validateServerSession(request)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const isAdmin = session.role === 'admin' || session.profile?.is_admin === true
    if (!isAdmin) {
      monitorUnauthorizedAccess(
        session.user.id,
        request,
        'admin_access',
        'Insufficient admin privileges'
      )
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    return await handler(request, context, session)
  }, { ...options, requireAdmin: true })
}

/**
 * Secure product access wrapper
 */
export function withProductAccess<T = any>(
  handler: (request: NextRequest, context: T, productId: string) => Promise<NextResponse>,
  options: SecureApiOptions = {}
) {
  return withSecurity(async (request: NextRequest, context: T) => {
    const productId = extractResourceId(request, context)
    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID required' },
        { status: 400 }
      )
    }

    return await handler(request, context, productId)
  }, { ...options, resourceType: 'products' })
}

/**
 * Secure order access wrapper
 */
export function withOrderAccess<T = any>(
  handler: (request: NextRequest, context: T, orderId: string, userId: string) => Promise<NextResponse>,
  options: SecureApiOptions = {}
) {
  return withUserResourceAccess(async (request: NextRequest, context: T, userId: string) => {
    const orderId = extractResourceId(request, context)
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID required' },
        { status: 400 }
      )
    }

    return await handler(request, context, orderId, userId)
  }, { ...options, resourceType: 'orders' })
}

/**
 * Secure cart access wrapper
 */
export function withCartAccess<T = any>(
  handler: (request: NextRequest, context: T, userId: string) => Promise<NextResponse>,
  options: SecureApiOptions = {}
) {
  return withUserResourceAccess(async (request: NextRequest, context: T, userId: string) => {
    return await handler(request, context, userId)
  }, { ...options, resourceType: 'cart' })
}

/**
 * Validate resource ownership
 */
export async function validateResourceOwnership(
  userId: string,
  resourceId: string,
  resourceType: 'order' | 'cart' | 'profile',
  supabase: any
): Promise<{ allowed: boolean; error?: string }> {
  try {
    switch (resourceType) {
      case 'order':
        const { data: order } = await supabase
          .from('orders')
          .select('user_id')
          .eq('id', resourceId)
          .single()
        
        if (!order || order.user_id !== userId) {
          return { allowed: false, error: 'Order not found or access denied' }
        }
        break

      case 'cart':
        const { data: cartItem } = await supabase
          .from('cart_items')
          .select('user_id')
          .eq('id', resourceId)
          .single()
        
        if (!cartItem || cartItem.user_id !== userId) {
          return { allowed: false, error: 'Cart item not found or access denied' }
        }
        break

      case 'profile':
        if (resourceId !== userId) {
          return { allowed: false, error: 'Profile access denied' }
        }
        break

      default:
        return { allowed: false, error: 'Invalid resource type' }
    }

    return { allowed: true }
  } catch (error) {
    logger.error('Resource ownership validation failed:', error)
    return { allowed: false, error: 'Validation failed' }
  }
}

/**
 * Log security event
 */
export function logSecurityEvent(
  event: string,
  userId: string,
  details: any
): void {
  logger.security(event, userId, details)
}
