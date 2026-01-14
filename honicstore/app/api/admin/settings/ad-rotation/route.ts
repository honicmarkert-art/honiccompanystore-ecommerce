import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData } from '@/lib/database-optimization'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schema
const rotationTimeSchema = z.object({
  rotationTime: z.number().int().min(3, 'Rotation time must be at least 3 seconds').max(60, 'Rotation time must be at most 60 seconds'),
})

// GET - Fetch advertisement rotation time setting
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_ad_rotation_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/settings/ad-rotation',
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
      const cacheKey = 'admin_ad_rotation_time'
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'private, max-age=300' // 5 minutes cache
          }
        })
      }

      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_ad_rotation_get',
          endpoint: '/api/admin/settings/ad-rotation'
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()
      
      // Try the new schema first (direct column)
      const { data: newData, error: newError } = await supabase
        .from('admin_settings')
        .select('ad_rotation_time')
        .eq('id', 1)
        .single()
      
      if (!newError && newData) {
        const rotationTime = newData.ad_rotation_time || 10
        const responseData = { rotationTime }

        // Cache response
        setCachedData(cacheKey, responseData, 300000)

        return NextResponse.json(responseData, {
          headers: {
            'X-Cache': 'MISS',
            'Cache-Control': 'private, max-age=300'
          }
        })
      }
      
      // Fallback to old key-value schema
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'ad_rotation_time')
        .single()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logError(error, {
          userId: user.id,
          action: 'admin_ad_rotation_get',
          endpoint: '/api/admin/settings/ad-rotation'
        })
        return NextResponse.json({ rotationTime: 10 })
      }
      
      const rotationTime = data?.value ? parseInt(data.value) : 10
      const responseData = { rotationTime }

      // Cache response
      setCachedData(cacheKey, responseData, 300000)
      
      return NextResponse.json(responseData, {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'private, max-age=300'
        }
      })
    } catch (error) {
      logError(error, {
        action: 'admin_ad_rotation_get',
        endpoint: '/api/admin/settings/ad-rotation'
      })
      return NextResponse.json({ rotationTime: 10 }) // Default to 10 seconds
    }
  })
}

// POST - Save advertisement rotation time setting
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_ad_rotation_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/settings/ad-rotation',
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
          action: 'admin_ad_rotation_post',
          endpoint: '/api/admin/settings/ad-rotation'
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()
      const body = await request.json()

      // Validate input with Zod
      let validatedData
      try {
        validatedData = rotationTimeSchema.parse(body)
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
      
      // Try new schema first (direct column)
      const { error: updateError } = await supabase
        .from('admin_settings')
        .update({ ad_rotation_time: validatedData.rotationTime })
        .eq('id', 1)
      
      if (!updateError) {
        // Clear cache
        setCachedData('admin_ad_rotation_time', null, 0)

        // Log admin action
        logSecurityEvent('AD_ROTATION_TIME_UPDATED', user.id, {
          rotationTime: validatedData.rotationTime,
          endpoint: '/api/admin/settings/ad-rotation'
        })

        return NextResponse.json({ success: true, rotationTime: validatedData.rotationTime })
      }
      
      // Fallback to old key-value schema
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          key: 'ad_rotation_time',
          value: validatedData.rotationTime.toString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        })
      
      if (error) {
        logError(error, {
          userId: user.id,
          action: 'admin_ad_rotation_post',
          endpoint: '/api/admin/settings/ad-rotation'
        })
        return createErrorResponse(error, 500)
      }

      // Clear cache
      setCachedData('admin_ad_rotation_time', null, 0)

      // Log admin action
      logSecurityEvent('AD_ROTATION_TIME_UPDATED', user.id, {
        rotationTime: validatedData.rotationTime,
        endpoint: '/api/admin/settings/ad-rotation'
      })
      
      return NextResponse.json({ success: true, rotationTime: validatedData.rotationTime })
    } catch (error) {
      logError(error, {
        action: 'admin_ad_rotation_post',
        endpoint: '/api/admin/settings/ad-rotation'
      })
      return createErrorResponse(error, 500)
    }
  })
}
