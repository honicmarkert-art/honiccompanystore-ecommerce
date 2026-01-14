import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { clearSupplierPlansCache } from '../../supplier-plans/route'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData } from '@/lib/database-optimization'
import { logError, createErrorResponse } from '@/lib/error-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Schema for plan creation/update
const planSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().optional(),
  price: z.number().min(0),
  yearly_price: z.number().min(0).nullable().optional(),
  currency: z.string().default('TZS'),
  is_active: z.boolean().default(true),
  max_products: z.number().nullable().optional(),
  commission_rate: z.number().min(0).max(100).nullable().optional(),
  display_order: z.number().default(0)
})

// GET - Fetch all supplier plans (including inactive)
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('admin_supplier_plans_get', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/supplier-plans',
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
      const cacheKey = 'admin_supplier_plans_all'
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'private, max-age=300' // 5 minutes cache
          }
        })
      }

      const { user, error: authError } = await validateAdminAccess()
      if (authError) {
        logError(new Error('Admin authentication failed'), {
          userId: user?.id,
          action: 'admin_supplier_plans_get',
          endpoint: '/api/admin/supplier-plans'
        })
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
        logError(error, {
          userId: user.id,
          action: 'admin_supplier_plans_get',
          endpoint: '/api/admin/supplier-plans'
        })
        return createErrorResponse(error, 500)
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

      const responseData = {
        success: true,
        plans: transformedPlans
      }

      // Cache response (5 minutes TTL)
      setCachedData(cacheKey, responseData, 300000)

      return NextResponse.json(responseData, {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'private, max-age=300'
        }
      })
    } catch (error: any) {
      logError(error, {
        action: 'admin_supplier_plans_get',
        endpoint: '/api/admin/supplier-plans'
      })
      return createErrorResponse(error, 500)
    }
  })
}

// POST - Create a new supplier plan
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('admin_supplier_plans_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/admin/supplier-plans',
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
          action: 'admin_supplier_plans_post',
          endpoint: '/api/admin/supplier-plans'
        })
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
        logError(planError, {
          userId: user.id,
          action: 'admin_supplier_plans_post',
          endpoint: '/api/admin/supplier-plans'
        })
        return createErrorResponse(planError, 500)
      }

      // Log admin action
      logSecurityEvent('SUPPLIER_PLAN_CREATED', user.id, {
        planId: plan.id,
        planName: plan.name,
        endpoint: '/api/admin/supplier-plans'
      })

      // Clear caches
      clearSupplierPlansCache()
      setCachedData('admin_supplier_plans_all', null, 0)

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
      logError(error, {
        action: 'admin_supplier_plans_post',
        endpoint: '/api/admin/supplier-plans'
      })
      return createErrorResponse(error, 500)
    }
  })
}



