/**
 * Stock decrement helper for simplified variant system
 * Decrements both variant stock_quantity AND product stock_quantity when order is paid
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

interface OrderItem {
  id?: string
  product_id: number
  variant_id: number | null
  variant_name: string | null
  quantity: number
}

/**
 * Decrement stock for an order item using simplified variant system
 * - If variant_id exists: decrement variant stock_quantity
 * - Always decrement product stock_quantity (from Stock & Delivery Settings)
 * - Recalculate product total stock from all variants
 */
export async function decrementStockForOrderItem(
  supabase: SupabaseClient,
  item: OrderItem
): Promise<void> {
  try {
    logger.log(`📦 Decrementing stock for order item:`, {
      product_id: item.product_id,
      variant_id: item.variant_id,
      variant_name: item.variant_name,
      quantity: item.quantity
    })

    // Step 1: Decrement variant stock_quantity if variant_id exists
    if (item.variant_id) {
      const { data: variant, error: variantFetchError } = await supabase
        .from('product_variants')
        .select('id, stock_quantity')
        .eq('id', item.variant_id)
        .single()

      if (variantFetchError || !variant) {
        logger.log(`⚠️ Variant ${item.variant_id} not found, skipping variant stock decrement:`, variantFetchError)
      } else {
        const currentVariantStock = typeof variant.stock_quantity === 'number' ? variant.stock_quantity : 0
        const newVariantStock = Math.max(0, currentVariantStock - item.quantity)

        const { error: variantUpdateError } = await supabase
          .from('product_variants')
          .update({ 
            stock_quantity: newVariantStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.variant_id)

        if (variantUpdateError) {
          logger.log(`❌ Error updating variant ${item.variant_id} stock:`, variantUpdateError)
        } else {
          logger.log(`✅ Variant ${item.variant_id} stock decremented: ${currentVariantStock} -> ${newVariantStock}`)
        }
      }
    }

    // Step 2: Decrement product stock_quantity (from Stock & Delivery Settings)
    const { data: product, error: productFetchError } = await supabase
      .from('products')
      .select('id, stock_quantity')
      .eq('id', item.product_id)
      .single()

    if (productFetchError || !product) {
      logger.log(`❌ Error fetching product ${item.product_id} for stock decrement:`, productFetchError)
      return
    }

    const currentProductStock = typeof product.stock_quantity === 'number' ? product.stock_quantity : 0
    const newProductStock = Math.max(0, currentProductStock - item.quantity)

    // Step 3: Recalculate total stock from all variants
    const { data: allVariants, error: allVariantsError } = await supabase
      .from('product_variants')
      .select('stock_quantity')
      .eq('product_id', item.product_id)

    let calculatedTotalStock = 0
    if (!allVariantsError && allVariants && allVariants.length > 0) {
      // Sum all variant stock_quantity
      allVariants.forEach((variant: any) => {
        const qty = typeof variant.stock_quantity === 'number' ? variant.stock_quantity : 0
        calculatedTotalStock += qty
      })
    } else {
      // No variants: use the decremented product stock_quantity
      calculatedTotalStock = newProductStock
    }

    // Step 4: Update product with recalculated stock
    const { error: productUpdateError } = await supabase
      .from('products')
      .update({
        stock_quantity: calculatedTotalStock,
        in_stock: calculatedTotalStock > 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.product_id)

    if (productUpdateError) {
      logger.log(`❌ Error updating product ${item.product_id} stock:`, productUpdateError)
    } else {
      logger.log(`✅ Product ${item.product_id} stock updated:`, {
        previousProductStock: currentProductStock,
        newProductStock: newProductStock,
        calculatedTotalStock: calculatedTotalStock,
        hasVariants: !allVariantsError && allVariants && allVariants.length > 0
      })
    }

  } catch (error) {
    logger.log(`❌ Error in stock decrement for product ${item.product_id}:`, error)
    throw error
  }
}




