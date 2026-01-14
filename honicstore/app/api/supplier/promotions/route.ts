import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData, CACHE_TTL, generateCacheKey, clearCache } from '@/lib/database-optimization'
import { createErrorResponse, logError } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schemas
const promotionCreateSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50).regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric'),
  description: z.string().max(1000).optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0).max(1000000),
  minPurchaseAmount: z.number().min(0).optional().default(0),
  maxDiscountAmount: z.number().min(0).optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  appliesToAllProducts: z.boolean().optional().default(true),
  productIds: z.array(z.union([z.string(), z.number()])).optional().default([])
}).refine((data) => {
  if (data.discountType === 'percentage' && data.discountValue > 100) {
    return false
  }
  return true
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['discountValue']
}).refine((data) => {
  const start = new Date(data.startDate)
  const end = new Date(data.endDate)
  return end > start
}, {
  message: 'End date must be after start date',
  path: ['endDate']
})

// GET - Fetch promotions for the authenticated supplier
export async function GET(request: NextRequest) {
  return performanceMonitor.measure('supplier_promotions_get', async () => {
    try {
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
          endpoint: '/api/supplier/promotions',
          action: 'GET'
        })
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Verify user is a supplier
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_supplier, is_admin, supplier_plan_id')
        .eq('id', user.id)
        .single()

      if (!profile?.is_supplier && !profile?.is_admin) {
        logSecurityEvent('FORBIDDEN_ACCESS_ATTEMPT', user.id, {
          endpoint: '/api/supplier/promotions',
          action: 'GET',
          reason: 'Not a supplier'
        })
        return NextResponse.json(
          { success: false, error: 'Access denied. Supplier account required.' },
          { status: 403 }
        )
      }

      // Check if user has Premium Plan
      const { getSupplierPlan } = await import('@/lib/supplier-plan-utils')
      const plan = await getSupplierPlan(user.id, supabase)
      
      if (plan?.slug !== 'premium') {
        return NextResponse.json(
          { success: false, error: 'Marketing tools are available in Premium Plan only.' },
          { status: 403 }
        )
      }

      // Check cache
      const cacheKey = generateCacheKey('supplier_promotions', { supplierId: user.id })
      const cachedData = getCachedData<any>(cacheKey)
      if (cachedData) {
        return NextResponse.json({
          success: true,
          promotions: cachedData.promotions || [],
          cached: true
        })
      }

      // Fetch promotions
      const { data: promotions, error } = await supabase
        .from('supplier_promotions')
        .select('*')
        .eq('supplier_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        logError(error, {
          context: 'supplier_promotions_get',
          userId: user.id
        })
        return createErrorResponse(error, 'Failed to fetch promotions', 500)
      }

      const responseData = {
        promotions: promotions || []
      }

      // Cache response (10 minutes TTL)
      setCachedData(cacheKey, responseData, 10 * 60 * 1000)

      return NextResponse.json({
        success: true,
        ...responseData
      })

    } catch (error: any) {
      logError(error, {
        context: 'supplier_promotions_get'
      })
      return createErrorResponse(error, 'An unexpected error occurred', 500)
    }
  })
}

// POST - Create a new promotion
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('supplier_promotions_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/promotions',
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
          endpoint: '/api/supplier/promotions',
          action: 'POST'
        })
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Verify user is a supplier
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_supplier, is_admin, supplier_plan_id')
        .eq('id', user.id)
        .single()

      if (!profile?.is_supplier && !profile?.is_admin) {
        logSecurityEvent('FORBIDDEN_ACCESS_ATTEMPT', user.id, {
          endpoint: '/api/supplier/promotions',
          action: 'POST',
          reason: 'Not a supplier'
        })
        return NextResponse.json(
          { success: false, error: 'Access denied. Supplier account required.' },
          { status: 403 }
        )
      }

      // Check if user has Premium Plan
      const { getSupplierPlan } = await import('@/lib/supplier-plan-utils')
      const plan = await getSupplierPlan(user.id, supabase)
      
      if (plan?.slug !== 'premium') {
        return NextResponse.json(
          { success: false, error: 'Marketing tools are available in Premium Plan only.' },
          { status: 403 }
        )
      }

      const body = await request.json()

      // Validate input with Zod
      let validatedData
      try {
        validatedData = promotionCreateSchema.parse(body)
      } catch (validationError: any) {
        return NextResponse.json(
          { success: false, error: 'Invalid input data', details: validationError.errors },
          { status: 400 }
        )
      }

      const {
        name,
        code,
        description,
        discountType,
        discountValue,
        minPurchaseAmount,
        maxDiscountAmount,
        usageLimit,
        startDate,
        endDate,
        appliesToAllProducts,
        productIds
      } = validatedData

      const start = new Date(startDate)
      const end = new Date(endDate)

      // Check if code already exists
      const { data: existingPromo } = await supabase
        .from('supplier_promotions')
        .select('id')
        .eq('code', code.toUpperCase())
        .single()

      if (existingPromo) {
        return NextResponse.json(
          { success: false, error: 'Promotion code already exists' },
          { status: 400 }
        )
      }

      // Create promotion
      const { data: promotion, error } = await supabase
        .from('supplier_promotions')
        .insert({
          supplier_id: user.id,
          name: name.trim(),
          code: code.toUpperCase().trim(),
          description: description?.trim() || null,
          discount_type: discountType,
          discount_value: discountValue,
          min_purchase_amount: minPurchaseAmount || 0,
          max_discount_amount: maxDiscountAmount || null,
          usage_limit: usageLimit || null,
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          applies_to_all_products: appliesToAllProducts !== false,
          product_ids: productIds && Array.isArray(productIds) && productIds.length > 0 ? productIds.map(id => String(id)) : []
        })
        .select()
        .single()

      if (error) {
        logError(error, {
          context: 'supplier_promotions_post',
          userId: user.id
        })
        return createErrorResponse(error, 'Failed to create promotion', 500)
      }

      // Clear cache
      clearCache()

      logSecurityEvent('SUPPLIER_PROMOTION_CREATED', user.id, {
        promotionId: promotion.id,
        code: promotion.code,
        discountType,
        endpoint: '/api/supplier/promotions'
      })

      return NextResponse.json({
        success: true,
        promotion
      }, { status: 201 })

    } catch (error: any) {
      logError(error, {
        context: 'supplier_promotions_post'
      })
      return createErrorResponse(error, 'An unexpected error occurred', 500)
    }
  })
}

