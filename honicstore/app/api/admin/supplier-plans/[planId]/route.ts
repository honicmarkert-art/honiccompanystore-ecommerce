import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { clearSupplierPlansCache } from '../../../supplier-plans/route'

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
  { params }: { params: { planId: string } }
) {
  try {
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const { planId } = params
    const body = await request.json()
    const validatedData = planUpdateSchema.parse(body)

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
      logger.error('Error updating supplier plan:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update supplier plan' },
        { status: 500 }
      )
    }

    logger.log(`Supplier plan updated: ${updatedPlan.name} by admin ${user.email}`)

    // Clear public cache
    clearSupplierPlansCache()

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
    logger.error('Error in PUT /api/admin/supplier-plans/[planId]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a supplier plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const { planId } = params
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
      logger.error('Error checking plan usage:', suppliersError)
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
      logger.error('Error deleting supplier plan:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete supplier plan' },
        { status: 500 }
      )
    }

    logger.log(`Supplier plan deleted: ${plan.name} by admin ${user.email}`)

    // Clear public cache
    clearSupplierPlansCache()

    return NextResponse.json({
      success: true,
      message: 'Plan deleted successfully'
    })
  } catch (error: any) {
    logger.error('Error in DELETE /api/admin/supplier-plans/[planId]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}



