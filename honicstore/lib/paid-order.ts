import { logger } from "@/lib/logger"

export async function processPaidOrderStockAndCart(supabase: any, order: any): Promise<void> {
  try {
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("id, product_id, quantity, variant_attributes, variant_id, variant_name")
      .eq("order_id", order.id)

    if (itemsError) {
      logger.error("Error fetching order items for stock reduction", itemsError)
      throw itemsError
    } else if (orderItems && orderItems.length > 0) {
      const dirtyVariantProductIds = new Set<number>()
      const productVariantsCache = new Map<number, Array<{ id: number; primary_values: any }>>()
      const getProductVariants = async (productId: number) => {
        const cached = productVariantsCache.get(productId)
        if (cached) return cached
        const { data: variants, error: variantsError } = await supabase
          .from("product_variants")
          .select("id, primary_values")
          .eq("product_id", productId)
        if (variantsError || !variants) return null
        productVariantsCache.set(productId, variants as Array<{ id: number; primary_values: any }>)
        return variants as Array<{ id: number; primary_values: any }>
      }

      for (const item of orderItems) {
        try {
          let variantAttributes = item.variant_attributes
          if (typeof variantAttributes === "string") {
            try {
              variantAttributes = JSON.parse(variantAttributes)
            } catch {
              logger.warn(`Could not parse variant_attributes for item ${item.product_id}`)
              variantAttributes = null
            }
          }

          if ((!variantAttributes || Object.keys(variantAttributes || {}).length === 0) && item.variant_name) {
            const productVariants = await getProductVariants(item.product_id)
            if (productVariants) {
              for (const variant of productVariants) {
                let pvArray = variant.primary_values
                if (typeof pvArray === "string") {
                  try {
                    pvArray = JSON.parse(pvArray)
                  } catch {
                    continue
                  }
                }
                if (pvArray && Array.isArray(pvArray)) {
                  const matchingPv = pvArray.find((pv: any) => String(pv.value) === String(item.variant_name))
                  if (matchingPv) {
                    variantAttributes = { [matchingPv.attribute]: matchingPv.value }
                    break
                  }
                }
              }
            }
          }

          if (variantAttributes && typeof variantAttributes === "object" && Object.keys(variantAttributes).length > 0) {
            const variants = await getProductVariants(item.product_id)
            if (!variants || variants.length === 0) continue
            for (const variant of variants) {
              let primaryValues = variant.primary_values
              if (typeof primaryValues === "string") {
                try {
                  primaryValues = JSON.parse(primaryValues)
                } catch (e) {
                  logger.error(`Error parsing primary_values for variant ${variant.id}`, e)
                  continue
                }
              }
              if (!primaryValues || !Array.isArray(primaryValues)) continue
              let updated = false
              const updatedPrimaryValues = primaryValues.map((pv: any) => {
                const matches = Object.entries(variantAttributes).some(
                  ([key, value]) => pv.attribute === key && String(pv.value) === String(value)
                )
                if (!matches) return pv
                const currentQty = typeof pv.quantity === "number" ? pv.quantity : parseInt(String(pv.quantity)) || 0
                updated = true
                return { ...pv, quantity: Math.max(0, currentQty - item.quantity) }
              })
              if (!updated) continue
              const { error: variantUpdateError } = await supabase
                .from("product_variants")
                .update({ primary_values: updatedPrimaryValues })
                .eq("id", variant.id)
              if (variantUpdateError) {
                logger.error(`Error updating variant ${variant.id}`, variantUpdateError)
                continue
              }
              const cachedVariants = productVariantsCache.get(item.product_id)
              if (cachedVariants) {
                const target = cachedVariants.find((cv) => cv.id === variant.id)
                if (target) target.primary_values = updatedPrimaryValues
              }
              dirtyVariantProductIds.add(item.product_id)
            }
          } else {
            const { data: product, error: fetchError } = await supabase
              .from("products")
              .select("stock_quantity, in_stock")
              .eq("id", item.product_id)
              .single()
            if (fetchError) {
              logger.error("Error fetching product for stock reduction", fetchError)
              continue
            }
            const newStock = Math.max(0, (product.stock_quantity || 0) - item.quantity)
            const { error: updateError } = await supabase
              .from("products")
              .update({ stock_quantity: newStock, in_stock: newStock > 0, updated_at: new Date().toISOString() })
              .eq("id", item.product_id)
            if (updateError) logger.error("Error updating product stock", updateError)
          }
        } catch (stockError) {
          logger.error(`Error in stock reduction for product ${item.product_id}`, stockError)
        }
      }

      for (const productId of dirtyVariantProductIds) {
        const allVariants = (await getProductVariants(productId)) || []
        let totalStock = 0
        for (const variant of allVariants) {
          let pvArray = variant.primary_values
          if (typeof pvArray === "string") {
            try {
              pvArray = JSON.parse(pvArray)
            } catch {
              continue
            }
          }
          if (Array.isArray(pvArray)) {
            for (const pv of pvArray) {
              totalStock += typeof pv.quantity === "number" ? pv.quantity : parseInt(String(pv.quantity)) || 0
            }
          }
        }
        const { error: productUpdateError } = await supabase
          .from("products")
          .update({ stock_quantity: totalStock, in_stock: totalStock > 0, updated_at: new Date().toISOString() })
          .eq("id", productId)
        if (productUpdateError) logger.error("Error updating product stock", productUpdateError)
      }
    }
  } catch (stockReductionError) {
    logger.error("Error in stock reduction process", stockReductionError)
  }

  if (order.user_id) {
    try {
      const { error: clearCartError } = await supabase.from("cart_items").delete().eq("user_id", order.user_id)
      if (clearCartError) logger.warn("Failed to clear cart after payment")
    } catch {
      logger.warn("Error clearing cart after payment")
    }
  }
}
