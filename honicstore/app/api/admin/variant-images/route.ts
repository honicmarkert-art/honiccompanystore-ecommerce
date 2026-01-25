import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schemas
const variantImageCreateSchema = z.object({
  productId: z.number().int().positive('Product ID must be a positive number'),
  variantId: z.string().optional(),
  imageUrl: z.string().url('Invalid image URL'),
})

// GET - Fetch all variant images
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_variant_images_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/variant-images',
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
          action: 'admin_variant_images_get',
          metadata: {
            endpoint: '/api/admin/variant-images'
          }
        })
        return authError
      }

      // In a real app, you would fetch from a variant_images table
      // For now, we'll return an empty array
      return NextResponse.json({
        success: true,
        variantImages: []
      })

    } catch (error) {
      logError(error, {
        action: 'admin_variant_images_get',
        metadata: {
          endpoint: '/api/admin/variant-images'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}

// POST - Create new variant image
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_variant_images_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/variant-images',
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
          action: 'admin_variant_images_post',
          metadata: {
            endpoint: '/api/admin/variant-images'
          }
        })
        return authError
      }

      const body = await request.json()

      // Validate input with Zod
      let validatedData
      try {
        validatedData = variantImageCreateSchema.parse(body)
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

      // In a real app, you would save to a variant_images table
      // For now, we'll just return success
      logSecurityEvent('VARIANT_IMAGE_CREATED', {
        userId: user?.id,
        productId: validatedData.productId,
        variantId: validatedData.variantId,
        endpoint: '/api/admin/variant-images'
      }, request)

      return NextResponse.json({
        success: true,
        message: 'Variant image created successfully',
        variantImage: {
          id: Date.now(), // Temporary ID
          ...validatedData,
          createdAt: new Date().toISOString()
        }
      }, { status: 201 })

    } catch (error) {
      logError(error, {
        action: 'admin_variant_images_post',
        metadata: {
          endpoint: '/api/admin/variant-images'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}

// DELETE - Delete variant image
export async function DELETE(request: NextRequest) {
  return performanceMonitor.measure('admin_variant_images_delete', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/variant-images',
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
          action: 'admin_variant_images_delete',
          metadata: {
            endpoint: '/api/admin/variant-images'
          }
        })
        return authError
      }

      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')

      if (!id) {
        return NextResponse.json({ error: 'Variant image ID required' }, { status: 400 })
      }

      // In a real app, you would delete from the variant_images table
      logSecurityEvent('VARIANT_IMAGE_DELETED', {
        userId: user?.id,
        id,
        endpoint: '/api/admin/variant-images'
      }, request)

      return NextResponse.json({
        success: true,
        message: 'Variant image deleted successfully'
      })

    } catch (error) {
      logError(error, {
        action: 'admin_variant_images_delete',
        metadata: {
          endpoint: '/api/admin/variant-images'
        }
      })
      return createErrorResponse(error, 500)
    }
  })
}
