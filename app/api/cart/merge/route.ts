import { NextRequest, NextResponse } from 'next/server'
import { validateAuth, copyCookies } from '@/lib/auth-server'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// POST /api/cart/merge - Merge guest cart with server cart
export async function POST(request: NextRequest) {
  const { user, error: authError, response, supabase } = await validateAuth(request)
  
  if (authError || !user) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const { guestCart } = await request.json()
  
  if (!Array.isArray(guestCart)) {
    return NextResponse.json({ error: 'Invalid guest cart format' }, { status: 400 })
  }

  if (guestCart.length === 0) {
    return NextResponse.json({ success: true, message: 'No items to merge' }, { status: 200 })
  }

  try {
    const mergedItems = []
    const conflicts = []

    for (const guestItem of guestCart) {
      const { productId, variantId, quantity } = guestItem

      if (!productId || !quantity || quantity <= 0) {
        continue
      }

      // Fetch product info to validate and get authoritative price
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, price, in_stock, stock_quantity')
        .eq('id', productId)
        .single()

      if (productError || !product) {
        conflicts.push({
          productId,
          variantId,
          reason: 'Product not found'
        })
        continue
      }

      if (!product.in_stock || product.stock_quantity < quantity) {
        conflicts.push({
          productId,
          variantId,
          reason: 'Product out of stock',
          available: product.stock_quantity
        })
        continue
      }

      // Check if item already exists in server cart
      const { data: existingItem } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .eq('variant_id', variantId || null)
        .single()

      if (existingItem) {
        // Merge quantities (cap at available stock)
        const newQuantity = Math.min(
          existingItem.quantity + quantity,
          product.stock_quantity
        )

        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ quantity: newQuantity })
          .eq('id', existingItem.id)

        if (updateError) {
          conflicts.push({
            productId,
            variantId,
            reason: 'Failed to update existing item'
          })
        } else {
          mergedItems.push({
            productId,
            variantId,
            quantity: newQuantity - existingItem.quantity, // Only the merged portion
            action: 'merged'
          })
        }
      } else {
        // Add new item
        const payload: any = {
          user_id: user.id,
          product_id: productId,
          quantity,
          price: product.price
        }

        if (variantId) {
          payload.variant_id = variantId
        } else {
          payload.variant_id = null
        }

        const { error: insertError } = await supabase
          .from('cart_items')
          .insert(payload)

        if (insertError) {
          conflicts.push({
            productId,
            variantId,
            reason: 'Failed to add item'
          })
        } else {
          mergedItems.push({
            productId,
            variantId,
            quantity,
            action: 'added'
          })
        }
      }
    }

    const finalResponse = NextResponse.json({
      success: true,
      message: 'Cart merge completed',
      mergedItems,
      conflicts,
      summary: {
        totalItems: guestCart.length,
        merged: mergedItems.length,
        conflicts: conflicts.length
      }
    }, { status: 200 })

    copyCookies(response, finalResponse)
    return finalResponse

  } catch (error) {
    console.error('Cart merge error:', error)
    const errorResponse = NextResponse.json({
      error: 'Failed to merge cart',
      message: 'An unexpected error occurred while merging your cart'
    }, { status: 500 })

    copyCookies(response, errorResponse)
    return errorResponse
  }
}
