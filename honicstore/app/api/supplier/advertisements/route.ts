import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData, CACHE_TTL, clearCache, generateCacheKey } from '@/lib/database-optimization'
import { createErrorResponse, logError } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schemas
const advertisementCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  link_url: z.string().url().optional().or(z.literal('')),
  display_order: z.number().int().min(1).max(1000).optional().default(1),
  placement: z.enum(['products', 'home', 'category']).optional().default('products')
})

// GET - Fetch supplier's advertisements
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('supplier_advertisements_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = await enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/advertisements',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { success: false, error: rateLimitResult.reason },
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
        )
      }

      const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', undefined, {
          endpoint: '/api/supplier/advertisements',
          action: 'GET'
        })
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Verify supplier status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_supplier, is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_supplier && !profile?.is_admin) {
        logSecurityEvent('FORBIDDEN_ACCESS_ATTEMPT', user.id, {
          endpoint: '/api/supplier/advertisements',
          action: 'GET',
          reason: 'Not a supplier'
        })
        return NextResponse.json(
          { success: false, error: 'Access denied. Supplier account required.' },
          { status: 403 }
        )
      }

      // Check cache
      const cacheKey = generateCacheKey('supplier_advertisements', { supplierId: user.id })
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData) {
        return NextResponse.json({
          success: true,
          advertisements: cachedData.advertisements || [],
          cached: true
        })
      }

      const { data: advertisements, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('supplier_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        logError(error, {
          context: 'supplier_advertisements_get',
          userId: user.id
        })
        return createErrorResponse(error, 'Failed to fetch advertisements', 500)
      }

      const responseData = {
        advertisements: advertisements || []
      }

      // Cache response
      setCachedData(cacheKey, responseData, CACHE_TTL.ADVERTISEMENTS)

      return NextResponse.json({
        success: true,
        ...responseData
      })
    } catch (error: any) {
      logError(error, {
        context: 'supplier_advertisements_get'
      })
      return createErrorResponse(error, 'An unexpected error occurred', 500)
    }
  })
}

// DELETE - Delete advertisement (handled via query param for compatibility)
export async function DELETE(request: NextRequest) {
  return performanceMonitor.measure('supplier_advertisements_delete', async () => {
    try {
      // Rate limiting
      const rateLimitResult = await enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/advertisements',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { success: false, error: rateLimitResult.reason },
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
        )
      }

      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')
      
      if (!id) {
        return NextResponse.json(
          { success: false, error: 'Advertisement ID is required' },
          { status: 400 }
        )
      }

      const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', undefined, {
          endpoint: '/api/supplier/advertisements',
          action: 'DELETE',
          advertisementId: id
        })
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Verify supplier owns this advertisement
      const { data: ad, error: adError } = await supabase
        .from('advertisements')
        .select('supplier_id, media_url')
        .eq('id', id)
        .single()

      if (adError || !ad) {
        return NextResponse.json(
          { success: false, error: 'Advertisement not found' },
          { status: 404 }
        )
      }

      if (ad.supplier_id !== user.id) {
        logSecurityEvent('FORBIDDEN_ACCESS_ATTEMPT', user.id, {
          endpoint: '/api/supplier/advertisements',
          action: 'DELETE',
          advertisementId: id,
          reason: 'Advertisement ownership mismatch'
        })
        return NextResponse.json(
          { success: false, error: 'Access denied. You can only delete your own advertisements.' },
          { status: 403 }
        )
      }

      // Use service role key for storage operations
      const supabaseService = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      )

      // Delete media file from storage
      if (ad.media_url) {
        const urlParts = ad.media_url.split('/advertisements/')
        if (urlParts.length > 1) {
          const filePath = `advertisements/${urlParts[1]}`
          await supabaseService.storage
            .from('advertisements')
            .remove([filePath])
        }
      }

      // Delete from database
      const { error: deleteError } = await supabaseService
        .from('advertisements')
        .delete()
        .eq('id', id)

      if (deleteError) {
        logError(deleteError, {
          context: 'supplier_advertisements_delete',
          userId: user.id,
          advertisementId: id
        })
        return createErrorResponse(deleteError, 'Failed to delete advertisement', 500)
      }

      // Clear cache
      clearCache()

      logSecurityEvent('SUPPLIER_ADVERTISEMENT_DELETED', user.id, {
        advertisementId: id,
        endpoint: '/api/supplier/advertisements'
      })

      return NextResponse.json({
        success: true,
        message: 'Advertisement deleted successfully'
      })

    } catch (error: any) {
      logError(error, {
        context: 'supplier_advertisements_delete'
      })
      return createErrorResponse(error, 'An unexpected error occurred', 500)
    }
  })
}

// POST - Create new advertisement (inactive by default)
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('supplier_advertisements_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = await enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/advertisements',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { success: false, error: rateLimitResult.reason },
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
        )
      }

      const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', undefined, {
          endpoint: '/api/supplier/advertisements',
          action: 'POST'
        })
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Verify supplier status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_supplier, is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_supplier && !profile?.is_admin) {
        logSecurityEvent('FORBIDDEN_ACCESS_ATTEMPT', user.id, {
          endpoint: '/api/supplier/advertisements',
          action: 'POST',
          reason: 'Not a supplier'
        })
        return NextResponse.json(
          { success: false, error: 'Access denied. Supplier account required.' },
          { status: 403 }
        )
      }

      const formData = await request.formData()
      const file = formData.get('file') as File
      const title = formData.get('title') as string
      const description = formData.get('description') as string
      const link_url = formData.get('link_url') as string
      const display_order = parseInt(formData.get('display_order') as string) || 1
      const placement = formData.get('placement') as string || 'products'

      // Validate file
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No file provided' },
          { status: 400 }
        )
      }

      // Validate file size (max 10MB)
      const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: 'File size exceeds 10MB limit' },
          { status: 400 }
        )
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: 'Invalid file type. Only images and videos are allowed.' },
          { status: 400 }
        )
      }

      // Validate input data
      try {
        advertisementCreateSchema.parse({
          title,
          description: description || undefined,
          link_url: link_url || undefined,
          display_order,
          placement
        })
      } catch (validationError: any) {
        return NextResponse.json(
          { success: false, error: 'Invalid input data', details: validationError.errors },
          { status: 400 }
        )
      }

    // Use service role key for storage operations
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Determine media type
    const media_type = file.type.startsWith('video/') ? 'video' : 'image'

    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `advertisements/${fileName}`

    // Convert File to ArrayBuffer for Supabase
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from('advertisements')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

      if (uploadError) {
        logError(uploadError, {
          context: 'supplier_advertisements_post',
          userId: user.id,
          fileName: file.name
        })
        return createErrorResponse(uploadError, 'Failed to upload file', 500)
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseService.storage
        .from('advertisements')
        .getPublicUrl(filePath)

      // Insert advertisement record (inactive by default for suppliers)
      const { data: advertisement, error: insertError } = await supabaseService
        .from('advertisements')
        .insert({
          title,
          description,
          media_url: publicUrl,
          media_type,
          link_url: link_url || null,
          display_order,
          placement,
          supplier_id: user.id,
          is_active: false // Suppliers create inactive ads - admin must activate
        })
        .select()
        .single()

      if (insertError) {
        logError(insertError, {
          context: 'supplier_advertisements_post',
          userId: user.id
        })
        return createErrorResponse(insertError, 'Failed to create advertisement', 500)
      }

      // Clear cache
      clearCache()

      logSecurityEvent('SUPPLIER_ADVERTISEMENT_CREATED', user.id, {
        advertisementId: advertisement.id,
        title,
        placement,
        endpoint: '/api/supplier/advertisements'
      })

      return NextResponse.json({
        success: true,
        advertisement,
        message: 'Advertisement created successfully. It will be reviewed and activated by administration.'
      })

    } catch (error: any) {
      logError(error, {
        context: 'supplier_advertisements_post'
      })
      return createErrorResponse(error, 'An unexpected error occurred', 500)
    }
  })
}

