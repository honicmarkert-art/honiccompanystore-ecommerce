import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { z } from 'zod'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData, CACHE_TTL } from '@/lib/database-optimization'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { sanitizeString } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { handleAdminAuthError } from '@/lib/admin-api-wrapper'

// Validation schemas
const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
  slug: z.string().min(1, 'Slug is required').max(100, 'Slug is too long').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  image_url: z.string().url('Invalid image URL').optional().or(z.literal('')),
  is_active: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
  parent_id: z.string().uuid().optional().or(z.null()),
})

// GET /api/admin/categories - Get all categories
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_categories_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/categories',
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
        return handleAdminAuthError(authError, user, 'admin_categories_get', '/api/admin/categories')
      }

      // Check cache
      const cacheKey = 'admin_categories_all'
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'private, max-age=300' // 5 minutes
          }
        })
      }

      const supabase = createAdminSupabaseClient()
      
      const { data: categories, error } = await supabase
        .from('categories')
        .select(`
          *,
          parent:parent_id(name, slug)
        `)
        .order('display_order', { ascending: true })

      if (error) {
        logError(error, {
          userId: user.id,
          action: 'admin_categories_get',
          endpoint: '/api/admin/categories'
        })
        return createErrorResponse(error, 500)
      }

      const responseData = categories || []

      // Cache response
      setCachedData(cacheKey, responseData, CACHE_TTL.CATEGORIES)

      return NextResponse.json(responseData, {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'private, max-age=300'
        }
      })
    } catch (error) {
      logError(error, {
        action: 'admin_categories_get',
        endpoint: '/api/admin/categories'
      })
      return createErrorResponse(error, 500)
    }
  })
}

// POST /api/admin/categories - Create new category
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_categories_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/categories',
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
        return handleAdminAuthError(authError, user, 'admin_categories_post', '/api/admin/categories')
      }

      const body = await request.json()

      // Validate input with Zod
      let validatedData
      try {
        validatedData = categorySchema.parse(body)
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

      // Sanitize inputs
      const sanitizedName = sanitizeString(validatedData.name)
      const sanitizedSlug = sanitizeString(validatedData.slug).toLowerCase()
      const sanitizedDescription = validatedData.description ? sanitizeString(validatedData.description) : null

      const supabase = createAdminSupabaseClient()

      // Check if category with same name or slug already exists
      const { data: existingCategory } = await supabase
        .from('categories')
        .select('id')
        .or(`name.eq.${sanitizedName},slug.eq.${sanitizedSlug}`)
        .single()

      if (existingCategory) {
        return NextResponse.json(
          { error: 'Category with this name or slug already exists' },
          { status: 409 }
        )
      }

      // Insert new category
      const { data: category, error } = await supabase
        .from('categories')
        .insert({
          name: sanitizedName,
          description: sanitizedDescription,
          slug: sanitizedSlug,
          image_url: validatedData.image_url || null,
          is_active: validatedData.is_active ?? true,
          display_order: validatedData.display_order ?? 0,
          parent_id: validatedData.parent_id || null
        })
        .select(`
          *,
          parent:parent_id(name, slug)
        `)
        .single()

      if (error) {
        logError(error, {
          userId: user.id,
          action: 'admin_categories_post',
          endpoint: '/api/admin/categories',
          metadata: { categoryName: sanitizedName }
        })
        return createErrorResponse(error, 500)
      }

      // Clear cache
      setCachedData('admin_categories_all', null, 0) // Invalidate cache

      // Log admin action
      logSecurityEvent('CATEGORY_CREATED', user.id, {
        categoryId: category.id,
        categoryName: sanitizedName,
        endpoint: '/api/admin/categories'
      })

      return NextResponse.json(category, { status: 201 })
    } catch (error) {
      logError(error, {
        action: 'admin_categories_post',
        endpoint: '/api/admin/categories'
      })
      return createErrorResponse(error, 500)
    }
  })
}

// PUT /api/admin/categories - Update category
export async function PUT(request: NextRequest) {
  return performanceMonitor.measure('admin_categories_put', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/categories',
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
        return handleAdminAuthError(authError, user, 'admin_categories_put', '/api/admin/categories')
      }

      const body = await request.json()
      const { id, ...updateFields } = body

      if (!id) {
        return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
      }

      // Convert ID to string for consistent handling (supports both UUID and numeric IDs)
      const categoryId = String(id)
      
      // Validate ID format (UUID or numeric)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const numericRegex = /^\d+$/
      if (!uuidRegex.test(categoryId) && !numericRegex.test(categoryId)) {
        return NextResponse.json({ error: 'Invalid category ID format' }, { status: 400 })
      }

      // Validate update fields with Zod (partial schema)
      let validatedData
      try {
        validatedData = categorySchema.partial().parse(updateFields)
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

      // Check if category exists
      // Convert to number if it's numeric, otherwise use as string (UUID)
      const queryId = numericRegex.test(categoryId) ? Number(categoryId) : categoryId
      const { data: existingCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('id', queryId)
        .single()

      if (!existingCategory) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 })
      }

      // Check if another category with same name or slug exists
      if (validatedData.name || validatedData.slug) {
        const sanitizedName = validatedData.name ? sanitizeString(validatedData.name) : ''
        const sanitizedSlug = validatedData.slug ? sanitizeString(validatedData.slug).toLowerCase() : ''
        const { data: duplicateCategory } = await supabase
          .from('categories')
          .select('id')
          .or(`name.eq.${sanitizedName || ''},slug.eq.${sanitizedSlug || ''}`)
          .neq('id', queryId)
          .single()

        if (duplicateCategory) {
          return NextResponse.json(
            { error: 'Another category with this name or slug already exists' },
            { status: 409 }
          )
        }
      }

      // Update category
      const updateData: any = {}
      if (validatedData.name !== undefined) updateData.name = sanitizeString(validatedData.name)
      if (validatedData.description !== undefined) updateData.description = validatedData.description ? sanitizeString(validatedData.description) : null
      if (validatedData.slug !== undefined) updateData.slug = sanitizeString(validatedData.slug).toLowerCase()
      if (validatedData.image_url !== undefined) updateData.image_url = validatedData.image_url || null
      if (validatedData.is_active !== undefined) updateData.is_active = validatedData.is_active
      if (validatedData.display_order !== undefined) updateData.display_order = validatedData.display_order
      if (validatedData.parent_id !== undefined) updateData.parent_id = validatedData.parent_id || null

      const { data: category, error } = await supabase
        .from('categories')
        .update(updateData)
        .eq('id', queryId)
        .select(`
          *,
          parent:parent_id(name, slug)
        `)
        .single()

      if (error) {
        logError(error, {
          userId: user.id,
          action: 'admin_categories_put',
          endpoint: '/api/admin/categories',
          metadata: { categoryId: id }
        })
        return createErrorResponse(error, 500)
      }

      // Clear cache
      setCachedData('admin_categories_all', null, 0) // Invalidate cache

      // Log admin action
      logSecurityEvent('CATEGORY_UPDATED', user.id, {
        categoryId: categoryId,
        endpoint: '/api/admin/categories'
      })

      return NextResponse.json(category)
    } catch (error) {
      logError(error, {
        action: 'admin_categories_put',
        endpoint: '/api/admin/categories'
      })
      return createErrorResponse(error, 500)
    }
  })
}

// DELETE /api/admin/categories - Delete category
export async function DELETE(request: NextRequest) {
  return performanceMonitor.measure('admin_categories_delete', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/categories',
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
        return handleAdminAuthError(authError, user, 'admin_categories_delete', '/api/admin/categories')
      }

      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')

      if (!id) {
        return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id)) {
        return NextResponse.json({ error: 'Invalid category ID format' }, { status: 400 })
      }

      const supabase = createAdminSupabaseClient()

      // Check if category exists
      const { data: existingCategory } = await supabase
        .from('categories')
        .select('id, name')
        .eq('id', id)
        .single()

      if (!existingCategory) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 })
      }

      // Check if category has children (prevent orphaned categories)
      const { data: children } = await supabase
        .from('categories')
        .select('id')
        .eq('parent_id', id)
        .limit(1)

      if (children && children.length > 0) {
        return NextResponse.json(
          { error: 'Cannot delete category with subcategories. Please delete or reassign subcategories first.' },
          { status: 409 }
        )
      }

      // Delete category
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

      if (error) {
        logError(error, {
          userId: user.id,
          action: 'admin_categories_delete',
          endpoint: '/api/admin/categories',
          metadata: { categoryId: id, categoryName: existingCategory.name }
        })
        return createErrorResponse(error, 500)
      }

      // Clear cache
      setCachedData('admin_categories_all', null, 0) // Invalidate cache

      // Log admin action
      logSecurityEvent('CATEGORY_DELETED', user.id, {
        categoryId: id,
        categoryName: existingCategory.name,
        endpoint: '/api/admin/categories'
      })

      return NextResponse.json({ message: 'Category deleted successfully' })
    } catch (error) {
      logError(error, {
        action: 'admin_categories_delete',
        endpoint: '/api/admin/categories'
      })
      return createErrorResponse(error, 500)
    }
  })
}




