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

    // Process each guest cart item (which may have multiple variants)
    for (const guestItem of guestCart) {
      const { productId, variants } = guestItem

      if (!productId) {
        continue
      }

      // Handle both old format (flat) and new format (nested variants)
      const variantList = variants && Array.isArray(variants) && variants.length > 0
        ? variants // New format: nested variants array
        : guestItem.variantId // Old format: single variantId
          ? [{ variantId: guestItem.variantId, quantity: guestItem.quantity || 1 }]
          : [{ variantId: 'default', quantity: guestItem.quantity || 1 }] // Fallback

      // Process each variant in the item
      for (const variant of variantList) {
        const variantId = variant.variantId || variant.id || 'default'
        const quantity = variant.quantity || 1

        if (quantity <= 0) {
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

        // Fetch variant-specific price if variantId is numeric
        let variantPrice = product.price
        if (variantId && variantId !== 'default' && !isNaN(Number(variantId))) {
          const { data: variant } = await supabase
            .from('product_variants')
            .select('price, stock_quantity')
            .eq('id', Number(variantId))
            .eq('product_id', productId)
            .maybeSingle()
          
          if (variant && variant.price) {
            variantPrice = parseFloat(variant.price)
          }
        }

        // Check stock availability (variant stock if available, otherwise product stock)
        const availableStock = variantId && variantId !== 'default' && !isNaN(Number(variantId))
          ? (await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('id', Number(variantId))
              .eq('product_id', productId)
              .maybeSingle()).data?.stock_quantity ?? product.stock_quantity
          : product.stock_quantity

        if (!product.in_stock || availableStock < quantity) {
          conflicts.push({
            productId,
            variantId,
            reason: 'Product out of stock',
            available: availableStock
          })
          continue
        }

        // Normalize variantId for database (null for 'default')
        const normalizedVariantId = variantId === 'default' ? null : variantId

        // Check if item already exists in server cart
        const { data: existingItem } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('product_id', productId)
          .eq('variant_id', normalizedVariantId)
          .maybeSingle()

        if (existingItem) {
          // Merge quantities (cap at available stock)
          const newQuantity = Math.min(
            existingItem.quantity + quantity,
            availableStock
          )

          const { error: updateError } = await supabase
            .from('cart_items')
            .update({ 
              quantity: newQuantity,
              price: variantPrice // Update price to latest from database
            })
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
            price: variantPrice // Use variant-specific price if available
          }

          if (normalizedVariantId) {
            payload.variant_id = normalizedVariantId
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
    const errorResponse = NextResponse.json({
      error: 'Failed to merge cart',
      message: 'An unexpected error occurred while merging your cart'
    }, { status: 500 })

    copyCookies(response, errorResponse)
    return errorResponse
  }
}
