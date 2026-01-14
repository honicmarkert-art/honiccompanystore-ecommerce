import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_hero_upload_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/hero-upload',
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
          action: 'admin_hero_upload_post',
          endpoint: '/api/admin/hero-upload'
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()
      
      logger.log('📤 Hero image upload API called')
      
      const formData = await request.formData()
      const file = formData.get('file') as File

      logger.log('📋 Upload details:', {
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type
      })

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ 
          error: 'Invalid file type. Please upload a PNG, JPG, GIF, or WebP image.' 
        }, { status: 400 })
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        return NextResponse.json({ 
          error: 'File too large. Maximum size is 10MB.' 
        }, { status: 400 })
      }

      // Generate unique filename
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const fileExtension = file.name.split('.').pop()
      const fileName = `hero_${timestamp}_${randomString}.${fileExtension}`
      
      logger.log('📝 Generated filename:', fileName)

      // Convert file to buffer
      const fileBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(fileBuffer)

      // Upload to Supabase Storage
      logger.log('⬆️ Uploading to hero-images bucket...')
      const { data, error } = await supabase.storage
        .from('hero-images')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false
        })

      if (error) {
        logError(error, {
          userId: user.id,
          action: 'admin_hero_upload_post',
          endpoint: '/api/admin/hero-upload',
          metadata: { fileName }
        })
        return createErrorResponse(error, 500)
      }

      logger.log('✅ Upload successful:', data)

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('hero-images')
        .getPublicUrl(fileName)

      logger.log('✅ Public URL generated:', urlData.publicUrl)

      // Log admin action
      logSecurityEvent('HERO_IMAGE_UPLOADED', user.id, {
        fileName,
        fileSize: file.size,
        fileType: file.type,
        endpoint: '/api/admin/hero-upload'
      })

      return NextResponse.json({
        success: true,
        url: urlData.publicUrl,
        fileName: fileName,
        fileSize: file.size,
        fileType: file.type
      })

    } catch (error) {
      logError(error, {
        action: 'admin_hero_upload_post',
        endpoint: '/api/admin/hero-upload'
      })
      return createErrorResponse(error, 500)
    }
  })
}

export async function DELETE(request: NextRequest) {
  return performanceMonitor.measure('admin_hero_upload_delete', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/hero-upload',
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
          action: 'admin_hero_upload_delete',
          endpoint: '/api/admin/hero-upload'
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()
      
      logger.log('🗑️ Hero image delete API called')
      
      const { fileName } = await request.json()

      if (!fileName) {
        return NextResponse.json({ error: 'No filename provided' }, { status: 400 })
      }

      logger.log('🗑️ Deleting file:', fileName)

      // Delete from Supabase Storage
      const { error } = await supabase.storage
        .from('hero-images')
        .remove([fileName])

      if (error) {
        logError(error, {
          userId: user.id,
          action: 'admin_hero_upload_delete',
          endpoint: '/api/admin/hero-upload',
          metadata: { fileName }
        })
        return createErrorResponse(error, 500)
      }

      logger.log('✅ File deleted successfully')

      // Log admin action
      logSecurityEvent('HERO_IMAGE_DELETED', user.id, {
        fileName,
        endpoint: '/api/admin/hero-upload'
      })

      return NextResponse.json({
        success: true,
        message: 'File deleted successfully'
      })

    } catch (error) {
      logError(error, {
        action: 'admin_hero_upload_delete',
        endpoint: '/api/admin/hero-upload'
      })
      return createErrorResponse(error, 500)
    }
  })
}

export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_hero_upload_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/hero-upload',
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
          action: 'admin_hero_upload_get',
          endpoint: '/api/admin/hero-upload'
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()
      
      logger.log('📋 Hero images list API called')
      
      // List all files in hero-images bucket
      const { data, error } = await supabase.storage
        .from('hero-images')
        .list()

      if (error) {
        logError(error, {
          userId: user.id,
          action: 'admin_hero_upload_get',
          endpoint: '/api/admin/hero-upload'
        })
        return createErrorResponse(error, 500)
      }

      // Get public URLs for all files
      const filesWithUrls = data.map(file => {
        const { data: urlData } = supabase.storage
          .from('hero-images')
          .getPublicUrl(file.name)
        
        return {
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          lastModified: file.updated_at
        }
      })

      logger.log('✅ Listed files:', filesWithUrls.length)

      return NextResponse.json({
        success: true,
        files: filesWithUrls
      })

    } catch (error) {
      logError(error, {
        action: 'admin_hero_upload_get',
        endpoint: '/api/admin/hero-upload'
      })
      return createErrorResponse(error, 500)
    }
  })
}
