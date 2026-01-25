import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schema
const userUpdateSchema = z.object({
  is_active: z.boolean(),
})

// PATCH /api/admin/users/[id] - Update user status (activate/deactivate)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return performanceMonitor.measure('admin_users_patch', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/users/[id]',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
            }
          }
        )
      }

      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_users_patch',
          metadata: {
            endpoint: '/api/admin/users/[id]'
          }
        })
        return authError
      }

      const { id } = await params
      const body = await request.json()

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id)) {
        return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 })
      }

      // Validate input with Zod
      let validatedData
      try {
        validatedData = userUpdateSchema.parse(body)
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return NextResponse.json(
            { 
              error: 'Validation failed',
              details: validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            },
            { status: 400 }
          )
        }
        throw validationError
      }

      const supabase = createAdminSupabaseClient()

      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email, full_name, is_active')
        .eq('id', id)
        .single()

      if (fetchError || !existingUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      // Prevent self-deactivation
      if (user?.id === id && !validatedData.is_active) {
        return NextResponse.json(
          { error: 'You cannot deactivate your own account' },
          { status: 403 }
        )
      }

      // Update user status
      const { data: updatedUser, error: updateError } = await supabase
        .from('profiles')
        .update({ 
          is_active: validatedData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        logError(updateError, {
          userId: user?.id,
          action: 'admin_users_patch',
          metadata: {
            endpoint: '/api/admin/users/[id]',
            targetUserId: id,
            isActive: validatedData.is_active
          }
        })
        return createErrorResponse(updateError, 500)
      }

      // Log admin action
      logSecurityEvent('USER_STATUS_UPDATED', {
        userId: user?.id,
        targetUserId: id,
        targetUserEmail: existingUser.email,
        isActive: validatedData.is_active,
        previousStatus: existingUser.is_active,
        endpoint: '/api/admin/users/[id]'
      }, request)

      // Clear user list cache
      const { getCachedData, setCachedData } = await import('@/lib/database-optimization')
      setCachedData('admin_users_all', null, 0)

      return NextResponse.json({
        success: true,
        message: `User ${validatedData.is_active ? 'activated' : 'deactivated'} successfully`,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          full_name: updatedUser.full_name,
          is_active: updatedUser.is_active
        }
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_users_patch',
        metadata: {
          endpoint: '/api/admin/users/[id]'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}
