import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST - Validate and apply promotion code
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const publicClient = createClient(supabaseUrl, supabaseAnonKey)

    const body = await request.json()
    const { code, cartItems, subtotal } = body

    if (!code || !cartItems || subtotal === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Find active promotion by code
    const now = new Date().toISOString()
    const { data: promotion, error } = await publicClient
      .from('supplier_promotions')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .gte('end_date', now)
      .lte('start_date', now)
      .single()

    if (error || !promotion) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired promotion code' },
        { status: 404 }
      )
    }

    // Check usage limit
    if (promotion.usage_limit && promotion.used_count >= promotion.usage_limit) {
      return NextResponse.json(
        { success: false, error: 'Promotion code has reached its usage limit' },
        { status: 400 }
      )
    }

    // Get cart product IDs
    const cartProductIds = cartItems.map((item: any) => item.productId || item.product_id).filter(Boolean)
    
    if (cartProductIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cart is empty' },
        { status: 400 }
      )
    }

    // Fetch products from cart to verify supplier ownership
    const { data: cartProducts, error: productsError } = await publicClient
      .from('products')
      .select('id, supplier_id, user_id')
      .in('id', cartProductIds)

    if (productsError || !cartProducts || cartProducts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to validate cart products' },
        { status: 500 }
      )
    }

    // Filter products that belong to the promotion's supplier
    const supplierProductIds = cartProducts
      .filter((p: any) => p.supplier_id === promotion.supplier_id || p.user_id === promotion.supplier_id)
      .map((p: any) => p.id)

    // Check if cart contains any products from the promotion's supplier
    if (supplierProductIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Promotion code does not apply to items in your cart. This code is only valid for products from the supplier who created it.' },
        { status: 400 }
      )
    }

    // Check if promotion applies to specific products
    if (!promotion.applies_to_all_products && promotion.product_ids && promotion.product_ids.length > 0) {
      // Check if any supplier's products in cart match the promotion's product list
      const hasApplicableProduct = supplierProductIds.some((id: number) => 
        promotion.product_ids.includes(String(id))
      )
      
      if (!hasApplicableProduct) {
        return NextResponse.json(
          { success: false, error: 'Promotion code does not apply to items in your cart' },
          { status: 400 }
        )
      }
    }

    // Calculate subtotal only for products from the promotion's supplier
    // We need to get the prices of supplier's products from cart items
    const supplierCartItems = cartItems.filter((item: any) => {
      const productId = item.productId || item.product_id
      return supplierProductIds.includes(productId)
    })

    // Calculate supplier subtotal (sum of prices for supplier's products only)
    const supplierSubtotal = supplierCartItems.reduce((sum: number, item: any) => {
      const itemTotal = (item.price || 0) * (item.quantity || 1)
      return sum + itemTotal
    }, 0)

    // Use supplier subtotal for minimum purchase check
    if (promotion.min_purchase_amount && supplierSubtotal < promotion.min_purchase_amount) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Minimum purchase of ${promotion.min_purchase_amount} TZS required for this supplier's products`,
          minPurchase: promotion.min_purchase_amount
        },
        { status: 400 }
      )
    }

    // Calculate discount based on supplier's products subtotal only
    let discountAmount = 0
    if (promotion.discount_type === 'percentage') {
      discountAmount = (supplierSubtotal * promotion.discount_value) / 100
      // Apply max discount cap if set
      if (promotion.max_discount_amount && discountAmount > promotion.max_discount_amount) {
        discountAmount = promotion.max_discount_amount
      }
    } else {
      discountAmount = promotion.discount_value
    }

    // Ensure discount doesn't exceed supplier subtotal
    discountAmount = Math.min(discountAmount, supplierSubtotal)

    // Calculate final totals
    const supplierFinalTotal = supplierSubtotal - discountAmount
    const finalTotal = subtotal - discountAmount

    return NextResponse.json({
      success: true,
      promotion: {
        id: promotion.id,
        code: promotion.code,
        name: promotion.name,
        discountType: promotion.discount_type,
        discountValue: promotion.discount_value,
        discountAmount,
        finalTotal,
        supplierSubtotal, // Subtotal for supplier's products only
        supplierFinalTotal // Final total for supplier's products after discount
      }
    })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

