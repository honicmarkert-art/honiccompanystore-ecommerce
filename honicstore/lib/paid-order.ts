import { logger } from "@/lib/logger"

export async function processPaidOrderStockAndCart(supabase: any, order: any): Promise<void> {
  // count the coupon use now that the order is paid (one-time offer codes then stop working)
  try {
    const { data: row } = await supabase.from("orders").select("promotion_code").eq("id", order.id).maybeSingle()
    if (row?.promotion_code) await supabase.rpc("use_promotion", { p_code: row.promotion_code })
  } catch (e) {
    logger.error("Counting coupon use failed", e)
  }
  await adjustOrderStock(supabase, order.id, -1)

  if (order.user_id) {
    try {
      const { error: clearCartError } = await supabase.from("cart_items").delete().eq("user_id", order.user_id)
      if (clearCartError) logger.warn("Failed to clear cart after payment")
    } catch {
      logger.warn("Error clearing cart after payment")
    }
  }
}

type StockItem = { product_id: number; quantity: number; variant_id: number | null; variant_name: string | null }

/**
 * Change stock for every item of an order: -1 when it is paid (takes stock), +1 when a paid order is
 * cancelled (puts it back).
 *  - Item with an option (variant_id, or variant_name matched within the product): that option's
 *    stock changes, then the product's stock is set to the sum of its options (how the shop shows it).
 *  - Plain product: the product's own stock changes.
 * Errors are logged per item and never stop the rest.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function adjustOrderStock(supabase: any, orderId: string, direction: 1 | -1): Promise<void> {
  const { data: items, error } = await supabase.from("order_items").select("product_id, quantity, variant_id, variant_name").eq("order_id", orderId)
  if (error) { logger.error("Stock: could not read order items", error); return }
  const now = new Date().toISOString()
  const productsWithOptions = new Set<number>()

  for (const item of (items || []) as StockItem[]) {
    const qty = Math.max(0, Number(item.quantity) || 0)
    if (!item.product_id || !qty) continue
    try {
      let variant: { id: number; stock_quantity: number | null } | null = null
      if (item.variant_id) {
        variant = (await supabase.from("product_variants").select("id, stock_quantity").eq("id", item.variant_id).eq("product_id", item.product_id).maybeSingle()).data
      } else if (item.variant_name) {
        variant = (await supabase.from("product_variants").select("id, stock_quantity").eq("product_id", item.product_id).eq("variant_name", item.variant_name).limit(1).maybeSingle()).data
      }
      if (variant) {
        const stock = Math.max(0, (Number(variant.stock_quantity) || 0) + direction * qty)
        const { error: e } = await supabase.from("product_variants").update({ stock_quantity: stock, in_stock: stock > 0, updated_at: now }).eq("id", variant.id)
        if (e) logger.error(`Stock: option ${variant.id}`, e)
        productsWithOptions.add(item.product_id)
        continue
      }
      const { data: product } = await supabase.from("products").select("stock_quantity").eq("id", item.product_id).maybeSingle()
      if (!product) continue
      const stock = Math.max(0, (Number(product.stock_quantity) || 0) + direction * qty)
      const { error: e } = await supabase.from("products").update({ stock_quantity: stock, in_stock: stock > 0, updated_at: now }).eq("id", item.product_id)
      if (e) logger.error(`Stock: product ${item.product_id}`, e)
    } catch (e) {
      logger.error(`Stock: item of product ${item.product_id}`, e)
    }
  }

  // products with options show the total of their options
  for (const productId of productsWithOptions) {
    const { data: rows } = await supabase.from("product_variants").select("stock_quantity").eq("product_id", productId)
    const total = ((rows || []) as { stock_quantity: number | null }[]).reduce((s, r) => s + (Number(r.stock_quantity) || 0), 0)
    const { error: e } = await supabase.from("products").update({ stock_quantity: total, in_stock: total > 0, updated_at: now }).eq("id", productId)
    if (e) logger.error(`Stock: total for product ${productId}`, e)
  }
}
