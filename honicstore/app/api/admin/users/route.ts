import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData, CACHE_TTL } from '@/lib/database-optimization'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/users - Fetch all users with their auth data
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_users_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/users',
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

      // Check cache
      const cacheKey = 'admin_users_all'
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'private, max-age=60' // 1 minute cache
          }
        })
      }

      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_users_get',
          metadata: {
            endpoint: '/api/admin/users'
          }
        })
        return authError
      }

    const supabase = createAdminSupabaseClient()
    
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

      if (profilesError) {
        logError(profilesError, {
          userId: user?.id,
          action: 'admin_users_get',
          metadata: {
            endpoint: '/api/admin/users'
          }
        })
        return createErrorResponse(profilesError, 500)
      }

    // Fetch auth data for all users (last_sign_in_at, email_confirmed_at)
    // Note: Supabase admin API doesn't support batch fetching, so we fetch individually
    // but we'll do it in parallel with Promise.all for better performance
    const userIds = (profiles || []).map(p => p.id)
    const authUsersMap: Record<string, any> = {}
    
    if (userIds.length > 0) {
      // Fetch auth users in parallel (with concurrency limit to avoid overwhelming the API)
      const concurrencyLimit = 10
      for (let i = 0; i < userIds.length; i += concurrencyLimit) {
        const batch = userIds.slice(i, i + concurrencyLimit)
        const authPromises = batch.map(async (userId) => {
          try {
            const { data: authUser } = await supabase.auth.admin.getUserById(userId)
            if (authUser?.user) {
              return { userId, authUser: authUser.user }
            }
            return null
          } catch (error) {
            // User might not exist in auth, continue
            return null
          }
        })
        
        const results = await Promise.all(authPromises)
        results.forEach(result => {
          if (result) {
            authUsersMap[result.userId] = result.authUser
          }
        })
      }
    }

    // Transform the data
    const users = (profiles || []).map((profile: any) => {
      const authUser = authUsersMap[profile.id]
      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        is_admin: profile.is_admin || false,
        is_supplier: profile.is_supplier || false,
        is_active: profile.is_active !== false, // Default to true if null
        company_name: profile.company_name,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        email_confirmed_at: authUser?.email_confirmed_at || null,
      }
    })

      const responseData = {
        success: true,
        users
      }

      // Cache response (1 minute TTL for user list)
      setCachedData(cacheKey, responseData, 60000)

      return NextResponse.json(responseData, {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'private, max-age=60'
        }
      })

    } catch (error: any) {
      logError(error, {
        action: 'admin_users_get',
        metadata: {
          endpoint: '/api/admin/users'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}
