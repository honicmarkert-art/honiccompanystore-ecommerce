import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData } from '@/lib/database-optimization'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Service IDs mapping
const SERVICE_IDS = {
  'retail': 'retail-sales',
  'prototyping': 'project-prototyping', 
  'pcb': 'pcb-printing',
  'ai': 'ai-consultancy',
  'stem': 'stem-training-kits'
} as const

export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_service_images_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/service-images',
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

      const { searchParams } = new URL(request.url)
      const serviceId = searchParams.get('serviceId')

      if (!serviceId) {
        return NextResponse.json(
          { success: false, error: 'Service ID is required' },
          { status: 400 }
        )
      }

      // Check cache
      const cacheKey = `admin_service_images_${serviceId}`
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
          action: 'admin_service_images_get',
          endpoint: '/api/admin/service-images'
        })
        return authError
      }

      // Use service role key for admin operations
      const supabase = createAdminSupabaseClient()

      // Get all images for the specific service
      const { data: files, error } = await supabase.storage
        .from('hero-images')
        .list(`service-${serviceId}`, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        })

      if (error) {
        logError(error, {
          userId: user.id,
          action: 'admin_service_images_get',
          endpoint: '/api/admin/service-images',
          metadata: { serviceId }
        })
        return createErrorResponse(error, 500)
      }

      // Get public URLs for all images
      const images = files.map(file => {
        const { data: urlData } = supabase.storage
          .from('hero-images')
          .getPublicUrl(`service-${serviceId}/${file.name}`)
        
        return {
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size,
          createdAt: file.created_at
        }
      })

      const responseData = {
        success: true,
        serviceId,
        images
      }

      // Cache response (5 minutes TTL)
      setCachedData(cacheKey, responseData, 300000)

      return NextResponse.json(responseData, {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'private, max-age=300'
        }
      })

    } catch (error) {
      logError(error, {
        action: 'admin_service_images_get',
        endpoint: '/api/admin/service-images'
      })
      return createErrorResponse(error, 500)
    }
  })
}

export async function DELETE(request: NextRequest) {
  return performanceMonitor.measure('admin_service_images_delete', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/service-images',
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
          action: 'admin_service_images_delete',
          endpoint: '/api/admin/service-images'
        })
        return authError
      }

      // Use service role key for admin operations
      const supabase = createAdminSupabaseClient()

      const { searchParams } = new URL(request.url)
      const serviceId = searchParams.get('serviceId')
      const fileName = searchParams.get('fileName')

      if (!serviceId || !fileName) {
        return NextResponse.json(
          { success: false, error: 'Service ID and file name are required' },
          { status: 400 }
        )
      }

      // Delete the specific image
      const { error } = await supabase.storage
        .from('hero-images')
        .remove([`service-${serviceId}/${fileName}`])

      if (error) {
        logError(error, {
          userId: user.id,
          action: 'admin_service_images_delete',
          endpoint: '/api/admin/service-images',
          metadata: { serviceId, fileName }
        })
        return createErrorResponse(error, 500)
      }

      // Clear cache
      setCachedData(`admin_service_images_${serviceId}`, null, 0)

      // Log admin action
      logSecurityEvent('SERVICE_IMAGE_DELETED', user.id, {
        serviceId,
        fileName,
        endpoint: '/api/admin/service-images'
      })

      return NextResponse.json({
        success: true,
        message: 'Image deleted successfully'
      })

    } catch (error) {
      logError(error, {
        action: 'admin_service_images_delete',
        endpoint: '/api/admin/service-images'
      })
      return createErrorResponse(error, 500)
    }
  })
}
