import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData } from '@/lib/database-optimization'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { sanitizeString } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schemas
const advertisementUpdateSchema = z.object({
  id: z.string().uuid('Invalid advertisement ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(1000, 'Description is too long').optional(),
  link_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  display_order: z.number().int().min(0).optional(),
  placement: z.enum(['products', 'home', 'category']).optional(),
})

const advertisementToggleSchema = z.object({
  id: z.string().uuid('Invalid advertisement ID'),
  is_active: z.boolean(),
})

// GET - Fetch all advertisements with supplier info
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_advertisements_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/advertisements',
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
      const cacheKey = 'admin_advertisements_all'
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'private, max-age=180' // 3 minutes cache
          }
        })
      }

      // Validate admin access
      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_advertisements_get',
          metadata: {
            endpoint: '/api/admin/advertisements'
          }
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()
      
      const { data: advertisements, error } = await supabase
        .from('advertisements')
        .select('*')
        .order('display_order', { ascending: true })
      
      if (error) {
        logError(error, {
          userId: user?.id,
          action: 'admin_advertisements_get',
          metadata: {
            endpoint: '/api/admin/advertisements'
          }
        })
        return createErrorResponse(error, 500)
      }
      
      // Fetch supplier info separately for ads with supplier_id
      const adsWithSupplierInfo = await Promise.all(
        (advertisements || []).map(async (ad: any) => {
          if (!ad.supplier_id) {
            return { ...ad, supplier: null, plan: null }
          }
          
          // Fetch supplier profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_name, full_name, email, supplier_plan_id')
            .eq('id', ad.supplier_id)
            .single()
          
          let plan = null
          if (profile?.supplier_plan_id) {
            const { data: planData } = await supabase
              .from('supplier_plans')
              .select('name, slug')
              .eq('id', profile.supplier_plan_id)
              .single()
            plan = planData
          }
          
          return {
            ...ad,
            supplier: profile,
            plan
          }
        })
      )
      
      const responseData = { advertisements: adsWithSupplierInfo }

      // Cache response (3 minutes TTL)
      setCachedData(cacheKey, responseData, 180000)

      return NextResponse.json(responseData, {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'private, max-age=180'
        }
      })
    } catch (error) {
      logError(error, {
        action: 'admin_advertisements_get',
        metadata: {
          endpoint: '/api/admin/advertisements'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}

// POST - Create new advertisement
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_advertisements_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/advertisements',
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
          action: 'admin_advertisements_post',
          metadata: {
            endpoint: '/api/admin/advertisements'
          }
        })
        return authError
      }

      const supabase = createAdminSupabaseClient()
      
      const formData = await request.formData()
      const file = formData.get('file') as File
      const title = formData.get('title') as string
      const description = formData.get('description') as string
      const link_url = formData.get('link_url') as string
      const display_order = parseInt(formData.get('display_order') as string) || 1
      const placement = formData.get('placement') as string || 'products'
      
      // Validate inputs
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      
      if (!title || title.trim().length === 0) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 })
      }

      // Sanitize inputs
      const sanitizedTitle = sanitizeString(title)
      const sanitizedDescription = description ? sanitizeString(description) : null
      const sanitizedLinkUrl = link_url ? sanitizeString(link_url) : null

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: 'Invalid file type. Only images and videos are allowed.' },
          { status: 400 }
        )
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: 'File size exceeds 10MB limit' },
          { status: 400 }
        )
      }

      // Determine media type
      const media_type = file.type.startsWith('video/') ? 'video' : 'image'
      
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `advertisements/${fileName}`
      
      // Convert File to ArrayBuffer for Supabase
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('advertisements')
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false
        })
      
      if (uploadError) {
        logError(uploadError, {
          userId: user?.id,
          action: 'admin_advertisements_post',
          metadata: {
            endpoint: '/api/admin/advertisements',
            fileName
          }
        })
        return NextResponse.json(
          { error: 'Failed to upload file: ' + uploadError.message },
          { status: 500 }
        )
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('advertisements')
        .getPublicUrl(filePath)
      
      // Insert advertisement record
      const { data: advertisement, error: insertError } = await supabase
        .from('advertisements')
        .insert({
          title: sanitizedTitle,
          description: sanitizedDescription,
          media_url: publicUrl,
          media_type,
          link_url: sanitizedLinkUrl,
          display_order,
          placement,
          is_active: true
        })
        .select()
        .single()
      
      if (insertError) {
        logError(insertError, {
          userId: user?.id,
          action: 'admin_advertisements_post',
          metadata: {
            endpoint: '/api/admin/advertisements'
          }
        })
        return createErrorResponse(insertError, 500)
      }

      // Clear cache
      setCachedData('admin_advertisements_all', null, 0)

      // Log admin action
      logSecurityEvent('ADVERTISEMENT_CREATED', {
        userId: user?.id,
        advertisementId: advertisement.id,
        title: sanitizedTitle,
        endpoint: '/api/admin/advertisements'
      }, request)
      
      return NextResponse.json({ advertisement })
    } catch (error) {
      logError(error, {
        action: 'admin_advertisements_post',
        metadata: {
          endpoint: '/api/admin/advertisements'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}

// PUT - Update advertisement details
export async function PUT(request: NextRequest) {
  return performanceMonitor.measure('admin_advertisements_put', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/advertisements',
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
          action: 'admin_advertisements_put',
          metadata: {
            endpoint: '/api/admin/advertisements'
          }
        })
        return authError
      }

      const body = await request.json()

      // Validate input with Zod
      let validatedData
      try {
        validatedData = advertisementUpdateSchema.parse(body)
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
      
      // Sanitize inputs
      const sanitizedTitle = sanitizeString(validatedData.title)
      const sanitizedDescription = validatedData.description ? sanitizeString(validatedData.description) : null
      const sanitizedLinkUrl = validatedData.link_url ? sanitizeString(validatedData.link_url) : null
      
      const updateData: any = {
        title: sanitizedTitle,
        description: sanitizedDescription,
        link_url: sanitizedLinkUrl,
        updated_at: new Date().toISOString()
      }
      
      if (validatedData.display_order !== undefined) updateData.display_order = validatedData.display_order
      if (validatedData.placement !== undefined) updateData.placement = validatedData.placement
      
      const { data, error } = await supabase
        .from('advertisements')
        .update(updateData)
        .eq('id', validatedData.id)
        .select()
        .single()
      
      if (error) {
        logError(error, {
          userId: user?.id,
          action: 'admin_advertisements_put',
          metadata: {
            endpoint: '/api/admin/advertisements',
            advertisementId: validatedData.id
          }
        })
        return createErrorResponse(error, 500)
      }

      // Clear cache
      setCachedData('admin_advertisements_all', null, 0)

      // Log admin action
      logSecurityEvent('ADVERTISEMENT_UPDATED', {
        userId: user?.id,
        advertisementId: validatedData.id,
        endpoint: '/api/admin/advertisements'
      }, request)
      
      return NextResponse.json({ advertisement: data })
    } catch (error) {
      logError(error, {
        action: 'admin_advertisements_put',
        metadata: {
          endpoint: '/api/admin/advertisements'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}

// PATCH - Update advertisement (toggle active status)
export async function PATCH(request: NextRequest) {
  return performanceMonitor.measure('admin_advertisements_patch', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/advertisements',
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
          action: 'admin_advertisements_patch',
          metadata: {
            endpoint: '/api/admin/advertisements'
          }
        })
        return authError
      }

      const body = await request.json()

      // Validate input with Zod
      let validatedData
      try {
        validatedData = advertisementToggleSchema.parse(body)
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
      
      const { data, error } = await supabase
        .from('advertisements')
        .update({ is_active: validatedData.is_active })
        .eq('id', validatedData.id)
        .select()
        .single()
      
      if (error) {
        logError(error, {
          userId: user?.id,
          action: 'admin_advertisements_patch',
          metadata: {
            endpoint: '/api/admin/advertisements',
            advertisementId: validatedData.id
          }
        })
        return createErrorResponse(error, 500)
      }

      // Clear cache
      setCachedData('admin_advertisements_all', null, 0)

      // Log admin action
      logSecurityEvent('ADVERTISEMENT_TOGGLED', {
        userId: user?.id,
        advertisementId: validatedData.id,
        isActive: validatedData.is_active,
        endpoint: '/api/admin/advertisements'
      }, request)
      
      return NextResponse.json({ advertisement: data })
    } catch (error) {
      logError(error, {
        action: 'admin_advertisements_patch',
        metadata: {
          endpoint: '/api/admin/advertisements'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}

// DELETE - Delete advertisement
export async function DELETE(request: NextRequest) {
  return performanceMonitor.measure('admin_advertisements_delete', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/advertisements',
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
          action: 'admin_advertisements_delete',
          metadata: {
            endpoint: '/api/admin/advertisements'
          }
        })
        return authError
      }

      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')
      
      if (!id) {
        return NextResponse.json({ error: 'Advertisement ID is required' }, { status: 400 })
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id)) {
        return NextResponse.json({ error: 'Invalid advertisement ID format' }, { status: 400 })
      }

      const supabase = createAdminSupabaseClient()
      
      // Get advertisement to get media URL
      const { data: ad } = await supabase
        .from('advertisements')
        .select('media_url, title')
        .eq('id', id)
        .single()
      
      if (!ad) {
        return NextResponse.json({ error: 'Advertisement not found' }, { status: 404 })
      }

      if (ad.media_url) {
        // Extract file path from URL
        const urlParts = ad.media_url.split('/advertisements/')
        if (urlParts.length > 1) {
          const filePath = `advertisements/${urlParts[1]}`
          // Delete from storage
          const { error: storageError } = await supabase.storage
            .from('advertisements')
            .remove([filePath])
          
          if (storageError) {
            logger.warn('Failed to delete advertisement file from storage:', storageError)
            // Continue with database deletion even if storage deletion fails
          }
        }
      }
      
      // Delete from database
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', id)
      
      if (error) {
        logError(error, {
          userId: user?.id,
          action: 'admin_advertisements_delete',
          metadata: {
            endpoint: '/api/admin/advertisements',
            advertisementId: id
          }
        })
        return createErrorResponse(error, 500)
      }

      // Clear cache
      setCachedData('admin_advertisements_all', null, 0)

      // Log admin action
      logSecurityEvent('ADVERTISEMENT_DELETED', {
        userId: user?.id,
        advertisementId: id,
        title: ad.title,
        endpoint: '/api/admin/advertisements'
      }, request)
      
      return NextResponse.json({ success: true })
    } catch (error) {
      logError(error, {
        action: 'admin_advertisements_delete',
        metadata: {
          endpoint: '/api/admin/advertisements'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}
