import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { clearSupplierPlansCache } from '../../../supplier-plans/route'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { logError, createErrorResponse } from '@/lib/error-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const planUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  yearly_price: z.number().min(0).nullable().optional(),
  currency: z.string().optional(),
  is_active: z.boolean().optional(),
  max_products: z.number().nullable().optional(),
  commission_rate: z.number().min(0).max(100).nullable().optional(),
  display_order: z.number().optional()
})

// PUT - Update a supplier plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  return performanceMonitor.measure('admin_supplier_plans_put', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/supplier-plans/[planId]',
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

      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_supplier_plans_put',
          endpoint: '/api/admin/supplier-plans/[planId]'
        })
        return authError
      }

      const { planId } = await params

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(planId)) {
        return NextResponse.json({ error: 'Invalid plan ID format' }, { status: 400 })
      }

      const body = await request.json()

      // Validate input with Zod
      let validatedData
      try {
        validatedData = planUpdateSchema.parse(body)
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return NextResponse.json(
            { success: false, error: 'Validation error', details: validationError.errors },
            { status: 400 }
          )
        }
        throw validationError
      }

      const supabase = createAdminSupabaseClient()

      // Check if plan exists
      const { data: existingPlan, error: fetchError } = await supabase
        .from('supplier_plans')
        .select('id, name')
        .eq('id', planId)
        .single()

      if (fetchError || !existingPlan) {
        return NextResponse.json(
          { success: false, error: 'Plan not found' },
          { status: 404 }
        )
      }

      // If slug is being updated, check for conflicts
      if (validatedData.slug && validatedData.slug !== existingPlan.slug) {
        const { data: conflictingPlan } = await supabase
          .from('supplier_plans')
          .select('id')
          .eq('slug', validatedData.slug)
          .neq('id', planId)
          .single()

        if (conflictingPlan) {
          return NextResponse.json(
            { success: false, error: 'A plan with this slug already exists' },
            { status: 400 }
          )
        }
      }

      // Update plan
      const { data: updatedPlan, error: updateError } = await supabase
        .from('supplier_plans')
        .update({
          ...validatedData,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .select()
        .single()

      if (updateError) {
        logError(updateError, {
          userId: user.id,
          action: 'admin_supplier_plans_put',
          endpoint: '/api/admin/supplier-plans/[planId]',
          metadata: { planId }
        })
        return createErrorResponse(updateError, 500)
      }

      // Log admin action
      logSecurityEvent('SUPPLIER_PLAN_UPDATED', user.id, {
        planId,
        planName: updatedPlan.name,
        endpoint: '/api/admin/supplier-plans/[planId]'
      })

      // Clear caches
      clearSupplierPlansCache()
      const { setCachedData } = await import('@/lib/database-optimization')
      setCachedData('admin_supplier_plans_all', null, 0)

      return NextResponse.json({
        success: true,
        plan: updatedPlan
      })
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, error: 'Validation error', details: error.errors },
          { status: 400 }
        )
      }
      logError(error, {
        action: 'admin_supplier_plans_put',
        endpoint: '/api/admin/supplier-plans/[planId]'
      })
      return createErrorResponse(error, 500)
    }
  })
}

// DELETE - Delete a supplier plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  return performanceMonitor.measure('admin_supplier_plans_delete', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/supplier-plans/[planId]',
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

      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_supplier_plans_delete',
          endpoint: '/api/admin/supplier-plans/[planId]'
        })
        return authError
      }

      const { planId } = await params

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(planId)) {
        return NextResponse.json({ error: 'Invalid plan ID format' }, { status: 400 })
      }

      const supabase = createAdminSupabaseClient()

      // Check if plan exists and get name for logging
      const { data: plan, error: fetchError } = await supabase
        .from('supplier_plans')
        .select('id, name')
        .eq('id', planId)
        .single()

      if (fetchError || !plan) {
        return NextResponse.json(
          { success: false, error: 'Plan not found' },
          { status: 404 }
        )
      }

      // Check if any suppliers are using this plan
      const { data: suppliers, error: suppliersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('supplier_plan_id', planId)
        .limit(1)

      if (suppliersError) {
        logError(suppliersError, {
          userId: user.id,
          action: 'admin_supplier_plans_delete',
          endpoint: '/api/admin/supplier-plans/[planId]',
          metadata: { planId }
        })
      }

      if (suppliers && suppliers.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Cannot delete plan. Some suppliers are currently using this plan.' },
          { status: 400 }
        )
      }

      // Delete plan features first (cascade should handle this, but being explicit)
      await supabase
        .from('supplier_plan_features')
        .delete()
        .eq('plan_id', planId)

      // Delete plan
      const { error: deleteError } = await supabase
        .from('supplier_plans')
        .delete()
        .eq('id', planId)

      if (deleteError) {
        logError(deleteError, {
          userId: user.id,
          action: 'admin_supplier_plans_delete',
          endpoint: '/api/admin/supplier-plans/[planId]',
          metadata: { planId }
        })
        return createErrorResponse(deleteError, 500)
      }

      // Log admin action
      logSecurityEvent('SUPPLIER_PLAN_DELETED', user.id, {
        planId,
        planName: plan.name,
        endpoint: '/api/admin/supplier-plans/[planId]'
      })

      // Clear caches
      clearSupplierPlansCache()
      const { setCachedData } = await import('@/lib/database-optimization')
      setCachedData('admin_supplier_plans_all', null, 0)

      return NextResponse.json({
        success: true,
        message: 'Plan deleted successfully'
      })
    } catch (error: any) {
      logError(error, {
        action: 'admin_supplier_plans_delete',
        endpoint: '/api/admin/supplier-plans/[planId]'
      })
      return createErrorResponse(error, 500)
    }
  })
}
