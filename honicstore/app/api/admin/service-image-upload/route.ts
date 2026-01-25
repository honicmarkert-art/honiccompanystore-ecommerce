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
const serviceImageUploadSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
})

export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_service_image_upload_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/service-image-upload',
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
          action: 'admin_service_image_upload_post',
          metadata: {
            endpoint: '/api/admin/service-image-upload'
          }
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()

      const formData = await request.formData()
      const file = formData.get('file') as File
      const serviceId = formData.get('serviceId') as string

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        )
      }

      // Validate serviceId
      try {
        serviceImageUploadSchema.parse({ serviceId })
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
      }

      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: 'Invalid file type. Only images and videos are allowed.' },
          { status: 400 }
        )
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: 'File size must be less than 10MB' },
          { status: 400 }
        )
      }

      // Create a unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${serviceId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('service-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        })

      if (error) {
        logError(error, {
          userId: user?.id,
          action: 'admin_service_image_upload_post',
          metadata: {
            endpoint: '/api/admin/service-image-upload',
            serviceId,
            fileName
          }
        })
        
        // Check if it's a bucket not found error
        if (error.message && error.message.includes('Bucket not found')) {
          return NextResponse.json(
            { 
              error: 'Storage bucket "service-images" not found. Please create it in Supabase Dashboard: Storage → New bucket → Name: "service-images" (public, 10MB limit)',
              details: error.message 
            },
            { status: 500 }
          )
        }
        
        return createErrorResponse(error, 500)
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('service-images')
        .getPublicUrl(fileName)

      // Log admin action
      logSecurityEvent('SERVICE_IMAGE_UPLOADED', {
        userId: user?.id,
        serviceId,
        fileName,
        fileSize: file.size,
        fileType: file.type,
        endpoint: '/api/admin/service-image-upload'
      }, request)

      return NextResponse.json({
        success: true,
        url: urlData.publicUrl,
        fileName: fileName
      })

    } catch (error) {
      logError(error, {
        action: 'admin_service_image_upload_post',
        metadata: {
          endpoint: '/api/admin/service-image-upload'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}
