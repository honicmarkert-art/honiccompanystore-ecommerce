/**
 * Auto-generate and assign tracking numbers for order items by supplier
 */

import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'

/**
 * Generate a unique tracking number
 * Format: TRK-{YYYYMMDD}-{6 random alphanumeric characters}
 */
export function generateTrackingNumber(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dateStr = `${year}${month}${day}`
  
  // Generate 6 random alphanumeric characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let randomStr = ''
  for (let i = 0; i < 6; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return `TRK-${dateStr}-${randomStr}`
}

/**
 * Auto-generate and assign tracking numbers for all suppliers in an order
 * @param orderId - The UUID of the order in the orders table
 * @returns Promise with assignment results
 */
export async function autoAssignTrackingNumbers(orderId: string): Promise<{
  success: boolean
  assigned: number
  errors: string[]
}> {
  // Use admin client to bypass RLS policies
  const supabase = createAdminSupabaseClient()
  const errors: string[] = []
  let assigned = 0

  try {
    logger.log('📦 Auto-assigning tracking numbers for order:', orderId)

    // Get all order items for this order
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id')
      .eq('order_id', orderId)

    if (itemsError) {
      logger.error('❌ Error fetching order items:', itemsError)
      return { success: false, assigned: 0, errors: [itemsError.message] }
    }

    if (!orderItems || orderItems.length === 0) {
      logger.log('ℹ️ No order items found for order:', orderId)
      return { success: true, assigned: 0, errors: [] }
    }

    // Get product IDs
    const productIds = orderItems.map(item => item.product_id).filter(Boolean)
    
    // Get products with supplier information
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, supplier_id, user_id')
      .in('id', productIds)

    if (productsError) {
      logger.error('❌ Error fetching products:', productsError)
      return { success: false, assigned: 0, errors: [productsError.message] }
    }

    // Group order items by supplier
    const supplierItemsMap = new Map<string, string[]>() // supplierId -> order_item IDs

    orderItems.forEach(item => {
      const product = products?.find(p => p.id === item.product_id)
      if (!product) {
        // If no product found, treat as Honic Company (no supplier)
        const noSupplierKey = 'no-supplier'
        if (!supplierItemsMap.has(noSupplierKey)) {
          supplierItemsMap.set(noSupplierKey, [])
        }
        supplierItemsMap.get(noSupplierKey)!.push(item.id)
        return
      }

      const supplierId = product.supplier_id || product.user_id
      if (!supplierId) {
        // Items without a supplier go to Honic Company
        const noSupplierKey = 'no-supplier'
        if (!supplierItemsMap.has(noSupplierKey)) {
          supplierItemsMap.set(noSupplierKey, [])
        }
        supplierItemsMap.get(noSupplierKey)!.push(item.id)
        return
      }

      if (!supplierItemsMap.has(supplierId)) {
        supplierItemsMap.set(supplierId, [])
      }
      supplierItemsMap.get(supplierId)!.push(item.id)
    })

    // Generate and assign tracking number for each supplier
    for (const [supplierId, itemIds] of supplierItemsMap.entries()) {
      // Skip if no items
      if (itemIds.length === 0) continue

      // Check if tracking number already exists for this supplier's items
      const { data: existingItems, error: checkError } = await supabase
        .from('order_items')
        .select('tracking_number')
        .in('id', itemIds)
        .limit(1)

      if (checkError) {
        const supplierLabel = supplierId === 'no-supplier' ? 'Honic Company' : supplierId
        logger.error(`❌ Error checking existing tracking for ${supplierLabel}:`, checkError)
        errors.push(`Failed to check existing tracking for ${supplierLabel}`)
        continue
      }

      // If tracking number already exists, skip
      if (existingItems && existingItems.length > 0 && existingItems[0].tracking_number) {
        const supplierLabel = supplierId === 'no-supplier' ? 'Honic Company' : supplierId
        logger.log(`ℹ️ Tracking number already exists for ${supplierLabel}, skipping`)
        continue
      }

      // Generate new tracking number
      const trackingNumber = generateTrackingNumber()

      // Update all order items from this supplier with the same tracking number
      const { error: updateError } = await supabase
        .from('order_items')
        .update({ 
          tracking_number: trackingNumber
        })
        .in('id', itemIds)

      if (updateError) {
        const supplierLabel = supplierId === 'no-supplier' ? 'Honic Company' : supplierId
        logger.error(`❌ Error assigning tracking number for ${supplierLabel}:`, updateError)
        errors.push(`Failed to assign tracking for ${supplierLabel}: ${updateError.message}`)
        continue
      }

      // Also update confirmed_order_items if they exist (for confirmed orders)
      // Find confirmed_order_id from order_items
      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('order_id')
        .in('id', itemIds)
        .limit(1)

      if (!orderItemsError && orderItemsData && orderItemsData.length > 0) {
        const orderId = orderItemsData[0].order_id
        
        // Find confirmed_order_id
        const { data: confirmedOrderData, error: confirmedOrderError } = await supabase
          .from('confirmed_orders')
          .select('id')
          .eq('order_id', orderId)
          .single()

        if (!confirmedOrderError && confirmedOrderData) {
          // Get product IDs for these items
          const { data: itemsWithProducts } = await supabase
            .from('order_items')
            .select('product_id')
            .in('id', itemIds)

          if (itemsWithProducts && itemsWithProducts.length > 0) {
            const productIds = itemsWithProducts.map(item => item.product_id).filter(Boolean)
            
            // Update confirmed_order_items with same tracking number
            const { error: confirmedUpdateError } = await supabase
              .from('confirmed_order_items')
              .update({ tracking_number: trackingNumber })
              .eq('confirmed_order_id', confirmedOrderData.id)
              .in('product_id', productIds)

            if (confirmedUpdateError) {
              logger.warn(`⚠️ Failed to update confirmed_order_items tracking:`, confirmedUpdateError)
            } else {
              logger.log(`✅ Updated confirmed_order_items tracking number`)
            }
          }
        }
      }

      const supplierLabel = supplierId === 'no-supplier' ? 'Honic Company' : supplierId
      logger.log(`✅ Assigned tracking number ${trackingNumber} to ${itemIds.length} items for ${supplierLabel}`)
      assigned += itemIds.length
    }

    return {
      success: errors.length === 0,
      assigned,
      errors
    }

  } catch (error: any) {
    logger.error('❌ Error in auto-assign tracking numbers:', error)
    return {
      success: false,
      assigned,
      errors: [error.message || 'Unknown error']
    }
  }
}

