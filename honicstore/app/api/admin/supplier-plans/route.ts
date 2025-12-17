import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { clearSupplierPlansCache } from '../../supplier-plans/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Schema for plan creation/update
const planSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().optional(),
  price: z.number().min(0),
  currency: z.string().default('TZS'),
  is_active: z.boolean().default(true),
  max_products: z.number().nullable().optional(),
  commission_rate: z.number().min(0).max(100).nullable().optional(),
  display_order: z.number().default(0)
})

// GET - Fetch all supplier plans (including inactive)
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const supabase = createAdminSupabaseClient()

    const { data: plans, error } = await supabase
      .from('supplier_plans')
      .select(`
        *,
        supplier_plan_features (
          id,
          feature_name,
          feature_description,
          is_included,
          display_order
        )
      `)
      .order('display_order', { ascending: true })

    if (error) {
      logger.error('Error fetching supplier plans:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch supplier plans' },
        { status: 500 }
      )
    }

    // Transform features
    const transformedPlans = (plans || []).map((plan: any) => {
      const features = (plan.supplier_plan_features || [])
        .filter((f: any) => f.is_included)
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((f: any) => ({
          id: f.id,
          name: f.feature_name,
          description: f.feature_description,
          display_order: f.display_order
        }))

      return {
        ...plan,
        features
      }
    })

    return NextResponse.json({
      success: true,
      plans: transformedPlans
    })
  } catch (error: any) {
    logger.error('Error in GET /api/admin/supplier-plans:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new supplier plan
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const body = await request.json()
    const validatedData = planSchema.parse(body)

    const supabase = createAdminSupabaseClient()

    // Check if slug already exists
    const { data: existingPlan } = await supabase
      .from('supplier_plans')
      .select('id')
      .eq('slug', validatedData.slug)
      .single()

    if (existingPlan) {
      return NextResponse.json(
        { success: false, error: 'A plan with this slug already exists' },
        { status: 400 }
      )
    }

    // Create plan
    const { data: plan, error: planError } = await supabase
      .from('supplier_plans')
      .insert({
        ...validatedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (planError) {
      logger.error('Error creating supplier plan:', planError)
      return NextResponse.json(
        { success: false, error: 'Failed to create supplier plan' },
        { status: 500 }
      )
    }

    logger.log(`Supplier plan created: ${plan.name} by admin ${user.email}`)

    // Clear public cache
    clearSupplierPlansCache()

    return NextResponse.json({
      success: true,
      plan
    }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error in POST /api/admin/supplier-plans:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}



