import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET - Fetch promotions for the authenticated supplier
export async function GET(request: NextRequest) {
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

    // Fetch promotions
    const { data: promotions, error } = await supabase
      .from('supplier_promotions')
      .select('*')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching promotions:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch promotions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      promotions: promotions || []
    })

  } catch (error) {
    console.error('Promotions GET error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST - Create a new promotion
export async function POST(request: NextRequest) {
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
    } = body

    // Validate required fields
    if (!name || !code || !discountType || !discountValue || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate discount value
    if (discountType === 'percentage' && discountValue > 100) {
      return NextResponse.json(
        { success: false, error: 'Percentage discount cannot exceed 100%' },
        { status: 400 }
      )
    }

    // Validate date range
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end <= start) {
      return NextResponse.json(
        { success: false, error: 'End date must be after start date' },
        { status: 400 }
      )
    }

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
        discount_value: parseFloat(discountValue),
        min_purchase_amount: minPurchaseAmount ? parseFloat(minPurchaseAmount) : 0,
        max_discount_amount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
        usage_limit: usageLimit ? parseInt(usageLimit) : null,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      applies_to_all_products: appliesToAllProducts !== false,
      product_ids: productIds && Array.isArray(productIds) && productIds.length > 0 ? productIds.map(id => String(id)) : []
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating promotion:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create promotion' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      promotion
    }, { status: 201 })

  } catch (error) {
    console.error('Promotions POST error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

