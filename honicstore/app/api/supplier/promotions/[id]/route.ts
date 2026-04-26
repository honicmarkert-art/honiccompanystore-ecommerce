import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { clearCache } from '@/lib/database-optimization'
import { createErrorResponse, logError } from '@/lib/error-handler'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schema for promotion updates
const promotionUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  discountValue: z.number().min(0).max(1000000).optional(),
  minPurchaseAmount: z.number().min(0).optional(),
  maxDiscountAmount: z.number().min(0).optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  appliesToAllProducts: z.boolean().optional(),
  productIds: z.array(z.union([z.string(), z.number()])).optional()
}).refine((data) => {
  if (data.discountType === 'percentage' && data.discountValue !== undefined && data.discountValue > 100) {
    return false
  }
  return true
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['discountValue']
}).refine((data) => {
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    return end > start
  }
  return true
}, {
  message: 'End date must be after start date',
  path: ['endDate']
})

// DELETE - Delete a promotion
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return performanceMonitor.measure('supplier_promotions_delete', async () => {
    try {
      // Rate limiting
      const rateLimitResult = await enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/promotions/[id]',
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
          endpoint: '/api/supplier/promotions/[id]',
          action: 'DELETE',
          promotionId: params.id
        })
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Verify ownership
      const { data: promotion } = await supabase
        .from('supplier_promotions')
        .select('supplier_id')
        .eq('id', params.id)
        .single()

      if (!promotion || promotion.supplier_id !== user.id) {
        logSecurityEvent('FORBIDDEN_ACCESS_ATTEMPT', user.id, {
          endpoint: '/api/supplier/promotions/[id]',
          action: 'DELETE',
          promotionId: params.id,
          reason: 'Promotion ownership mismatch'
        })
        return NextResponse.json(
          { success: false, error: 'Promotion not found or access denied' },
          { status: 404 }
        )
      }

      // Delete promotion
      const { error } = await supabase
        .from('supplier_promotions')
        .delete()
        .eq('id', params.id)

      if (error) {
        logError(error, {
          context: 'supplier_promotions_delete',
          userId: user.id,
          promotionId: params.id
        })
        return createErrorResponse(error, 'Failed to delete promotion', 500)
      }

      // Clear cache
      clearCache()

      logSecurityEvent('SUPPLIER_PROMOTION_DELETED', user.id, {
        promotionId: params.id,
        endpoint: '/api/supplier/promotions/[id]'
      })

      return NextResponse.json({
        success: true
      })

    } catch (error: any) {
      logError(error, {
        context: 'supplier_promotions_delete'
      })
      return createErrorResponse(error, 'An unexpected error occurred', 500)
    }
  })
}

// PATCH - Update a promotion
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return performanceMonitor.measure('supplier_promotions_patch', async () => {
    try {
      // Rate limiting
      const rateLimitResult = await enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/promotions/[id]',
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
          endpoint: '/api/supplier/promotions/[id]',
          action: 'PATCH',
          promotionId: params.id
        })
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Verify ownership
      const { data: promotion } = await supabase
        .from('supplier_promotions')
        .select('supplier_id')
        .eq('id', params.id)
        .single()

      if (!promotion || promotion.supplier_id !== user.id) {
        logSecurityEvent('FORBIDDEN_ACCESS_ATTEMPT', user.id, {
          endpoint: '/api/supplier/promotions/[id]',
          action: 'PATCH',
          promotionId: params.id,
          reason: 'Promotion ownership mismatch'
        })
        return NextResponse.json(
          { success: false, error: 'Promotion not found or access denied' },
          { status: 404 }
        )
      }

      const body = await request.json()

      // Validate input with Zod
      try {
        promotionUpdateSchema.parse(body)
      } catch (validationError: any) {
        return NextResponse.json(
          { success: false, error: 'Invalid input data', details: validationError.errors },
          { status: 400 }
        )
      }

      const updateData: any = {}

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.discountType !== undefined) updateData.discount_type = body.discountType
    if (body.discountValue !== undefined) updateData.discount_value = parseFloat(body.discountValue)
    if (body.minPurchaseAmount !== undefined) updateData.min_purchase_amount = parseFloat(body.minPurchaseAmount)
    if (body.maxDiscountAmount !== undefined) updateData.max_discount_amount = body.maxDiscountAmount ? parseFloat(body.maxDiscountAmount) : null
    if (body.usageLimit !== undefined) updateData.usage_limit = body.usageLimit ? parseInt(body.usageLimit) : null
    if (body.startDate !== undefined) updateData.start_date = new Date(body.startDate).toISOString()
    if (body.endDate !== undefined) updateData.end_date = new Date(body.endDate).toISOString()
    if (body.isActive !== undefined) updateData.is_active = body.isActive
    if (body.appliesToAllProducts !== undefined) updateData.applies_to_all_products = body.appliesToAllProducts
    if (body.productIds !== undefined) {
      updateData.product_ids = body.productIds && Array.isArray(body.productIds) && body.productIds.length > 0 
        ? body.productIds.map((id: any) => String(id)) 
        : []
    }

    updateData.updated_at = new Date().toISOString()

    // Update promotion
    const { data: updatedPromotion, error } = await supabase
      .from('supplier_promotions')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

      if (error) {
        logError(error, {
          context: 'supplier_promotions_patch',
          userId: user.id,
          promotionId: params.id
        })
        return createErrorResponse(error, 'Failed to update promotion', 500)
      }

      // Clear cache
      clearCache()

      logSecurityEvent('SUPPLIER_PROMOTION_UPDATED', user.id, {
        promotionId: params.id,
        endpoint: '/api/supplier/promotions/[id]'
      })

      return NextResponse.json({
        success: true,
        promotion: updatedPromotion
      })

    } catch (error: any) {
      logError(error, {
        context: 'supplier_promotions_patch'
      })
      return createErrorResponse(error, 'An unexpected error occurred', 500)
    }
  })
}

