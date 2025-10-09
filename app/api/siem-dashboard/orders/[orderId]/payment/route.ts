import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess, createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params
    // Validate admin access first
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const { paymentStatus, paymentId, paymentMethod } = await request.json()
    
    const supabase = createAdminSupabaseClient()
    
    // Validate payment status
    if (!['paid', 'failed', 'pending'].includes(paymentStatus)) {
      return NextResponse.json(
        { error: 'Invalid payment status' },
        { status: 400 }
      )
    }
    
    // Update order payment status using orderId as reference_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .update({
        payment_status: paymentStatus,
        payment_id: paymentId || null,
        payment_method: paymentMethod || null,
        updated_at: new Date().toISOString(),
      })
      .eq('reference_id', orderId)
      .select()
      .single()

    if (orderError) {
      return NextResponse.json(
        { error: 'Failed to update payment status' },
        { status: 500 }
      )
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Send notification and reduce stock if payment is successful (only if not already reduced)
    if (paymentStatus === 'paid' && order.payment_status !== 'paid' && order.payment_status !== 'success') {
      await sendPaymentConfirmation(order)
      
      // Reduce stock quantities for paid orders
      try {
        logger.log('📦 Reducing stock for admin-confirmed paid order:', order.id)
        
        // Get order items to reduce stock
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, quantity')
          .eq('order_id', order.id)

        if (itemsError) {
          console.error('❌ Error fetching order items for stock reduction:', itemsError)
        } else if (orderItems && orderItems.length > 0) {
          // Reduce stock for each item
          for (const item of orderItems) {
            try {
              // Check if item has variant_attributes (attribute-level stock)
              if (item.variant_attributes && typeof item.variant_attributes === 'object') {
                // Decrement specific attribute quantity
                const { data: variants, error: variantsError } = await supabase
                  .from('product_variants')
                  .select('id, primary_values')
                  .eq('product_id', item.product_id)

                if (variantsError || !variants || variants.length === 0) {
                  console.error('❌ Error fetching variants for stock reduction:', item.product_id, variantsError)
                  continue
                }

                // Find and update the matching primaryValue quantity
                for (const variant of variants) {
                  if (!variant.primary_values || !Array.isArray(variant.primary_values)) continue

                  let updated = false
                  const updatedPrimaryValues = variant.primary_values.map((pv: any) => {
                    // Match by attribute values
                    const matches = Object.entries(item.variant_attributes).every(([key, value]) => {
                      return pv.attribute === key && pv.value === value
                    })

                    if (matches) {
                      const currentQty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                      const newQty = Math.max(0, currentQty - item.quantity)
                      updated = true
                      logger.log(`✅ Reducing attribute stock: ${pv.attribute}="${pv.value}" by ${item.quantity} (${currentQty} -> ${newQty})`)
                      return { ...pv, quantity: newQty }
                    }
                    return pv
                  })

                  if (updated) {
                    await supabase
                      .from('product_variants')
                      .update({ primary_values: updatedPrimaryValues })
                      .eq('id', variant.id)

                    // Recalculate and update product total stock
                    const totalStock = updatedPrimaryValues.reduce((sum: number, pv: any) => {
                      const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                      return sum + qty
                    }, 0)

                    await supabase
                      .from('products')
                      .update({
                        stock_quantity: totalStock,
                        in_stock: totalStock > 0,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', item.product_id)

                    logger.log(`✅ Product total stock updated to: ${totalStock}`)
                  }
                }
              } else {
                // Fallback: Old product-level stock reduction
                const { data: product, error: fetchError } = await supabase
                  .from('products')
                  .select('stock_quantity, in_stock')
                  .eq('id', item.product_id)
                  .single()

                if (fetchError) {
                  console.error('❌ Error fetching product for stock reduction:', item.product_id, fetchError)
                  continue
                }

                const currentStock = product.stock_quantity || 0
                const newStock = Math.max(0, currentStock - item.quantity)
                const isInStock = newStock > 0

                const { error: updateError } = await supabase
                  .from('products')
                  .update({
                    stock_quantity: newStock,
                    in_stock: isInStock,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', item.product_id)

                if (updateError) {
                  console.error('❌ Error updating stock for product:', item.product_id, updateError)
                } else {
                  logger.log('✅ Stock reduced for product:', item.product_id, 'by', item.quantity, `(${currentStock} -> ${newStock})`)
                }
              }
            } catch (stockError) {
              console.error('❌ Error in stock reduction for product:', item.product_id, stockError)
            }
          }
        }
      } catch (stockReductionError) {
        console.error('❌ Error in stock reduction process:', stockReductionError)
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        referenceId: order.reference_id,
        pickupId: order.pickup_id,
        paymentStatus: order.payment_status,
        status: order.status,
      },
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params
    // Validate admin access first
    const { user, error: authError } = await validateAdminAccess()
    if (authError) {
      return authError
    }

    const supabase = createAdminSupabaseClient()
    
    // Get order payment status using orderId as reference_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('reference_id, pickup_id, payment_status, status, total_amount')
      .eq('reference_id', orderId)
      .single()

    if (orderError) {
      return NextResponse.json(
        { error: 'Failed to fetch payment status' },
        { status: 500 }
      )
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      order: {
        referenceId: order.reference_id,
        pickupId: order.pickup_id,
        paymentStatus: order.payment_status,
        status: order.status,
        totalAmount: order.total_amount,
      },
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Function to send payment confirmation
async function sendPaymentConfirmation(order: any) {
  try {
    // In a real app, you would:
    // 1. Send confirmation email to customer
    // 2. Send notification to admin
    // 3. Update order status to 'confirmed'
    // 4. Trigger fulfillment process
    
    return { success: true }
  } catch (error) {
    throw error
  }
}



