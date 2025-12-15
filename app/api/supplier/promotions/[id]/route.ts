import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// DELETE - Delete a promotion
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify ownership
    const { data: promotion } = await supabase
      .from('supplier_promotions')
      .select('supplier_id')
      .eq('id', params.id)
      .single()

    if (!promotion || promotion.supplier_id !== user.id) {
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
      console.error('Error deleting promotion:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete promotion' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    console.error('Promotion DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// PATCH - Update a promotion
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify ownership
    const { data: promotion } = await supabase
      .from('supplier_promotions')
      .select('supplier_id')
      .eq('id', params.id)
      .single()

    if (!promotion || promotion.supplier_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Promotion not found or access denied' },
        { status: 404 }
      )
    }

    const body = await request.json()
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
      console.error('Error updating promotion:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update promotion' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      promotion: updatedPromotion
    })

  } catch (error) {
    console.error('Promotion PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

