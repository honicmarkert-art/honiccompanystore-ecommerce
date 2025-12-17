import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST - Toggle featured status for a product (Premium Plan only)
export async function POST(request: NextRequest) {
  try {
    // Create Supabase client with proper cookie handling
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

    // Get authenticated user
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
        { success: false, error: 'Featured product placement is available in Premium Plan only.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { productId, isFeatured } = body

    if (!productId || typeof isFeatured !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Product ID and featured status are required' },
        { status: 400 }
      )
    }

    // Verify the product belongs to this supplier
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, supplier_id, user_id')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check ownership
    if (product.supplier_id !== user.id && product.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only feature your own products' },
        { status: 403 }
      )
    }

    // Update featured status
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({ is_featured: isFeatured })
      .eq('id', productId)
      .select('id, is_featured')
      .single()

    if (updateError) {
      console.error('Error updating featured status:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update featured status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      product: updatedProduct
    })

  } catch (error) {
    console.error('Toggle featured error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}




