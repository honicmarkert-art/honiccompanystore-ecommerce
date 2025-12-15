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
                logger.log(`📦 Processing variant stock decrement for product ${item.product_id}:`, {
                  variant_attributes: item.variant_attributes,
                  quantity: item.quantity
                })
                
                // Decrement specific attribute quantity
                const { data: variants, error: variantsError } = await supabase
                  .from('product_variants')
                  .select('id, primary_values')
                  .eq('product_id', item.product_id)

                if (variantsError || !variants || variants.length === 0) {
                  console.error('❌ Error fetching variants for stock reduction:', item.product_id, variantsError)
                  continue
                }

                logger.log(`🔍 Found ${variants.length} variant(s) for product ${item.product_id}`)

                // Find and update the matching primaryValue quantities
                // Each attribute in variant_attributes should match a primaryValue
                for (const variant of variants) {
                  // Parse primary_values if it's a JSON string
                  let primaryValues = variant.primary_values
                  if (typeof primaryValues === 'string') {
                    try {
                      primaryValues = JSON.parse(primaryValues)
                    } catch (e) {
                      logger.log(`❌ Error parsing primary_values for variant ${variant.id}:`, e)
                      continue
                    }
                  }
                  
                  if (!primaryValues || !Array.isArray(primaryValues)) {
                    logger.log(`⚠️ Variant ${variant.id} has invalid primary_values:`, primaryValues)
                    continue
                  }

                  logger.log(`🔍 Checking variant ${variant.id} with ${primaryValues.length} primaryValues:`, 
                    primaryValues.map((pv: any) => `${pv.attribute}="${pv.value}" (qty: ${pv.quantity})`).join(', '))

                  let updated = false
                  const updatedPrimaryValues = primaryValues.map((pv: any) => {
                    // Check if this primaryValue matches any attribute in the order item
                    // For each attribute in variant_attributes, find the matching primaryValue
                    const matchingAttribute = Object.entries(item.variant_attributes).find(
                      ([key, value]) => {
                        const matches = pv.attribute === key && String(pv.value) === String(value)
                        if (matches) {
                          logger.log(`✅ Found match: ${pv.attribute}="${pv.value}" matches order attribute ${key}="${value}"`)
                        }
                        return matches
                      }
                    )

                    if (matchingAttribute) {
                      // This primaryValue matches one of the ordered attributes
                      const currentQty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(String(pv.quantity)) || 0
                      const newQty = Math.max(0, currentQty - item.quantity)
                      updated = true
                      logger.log(`✅ Reducing attribute stock: ${pv.attribute}="${pv.value}" by ${item.quantity} (${currentQty} -> ${newQty})`)
                      return { ...pv, quantity: newQty }
                    }
                    return pv
                  })

                  if (updated) {
                    logger.log(`🔄 Updating variant ${variant.id} with decremented primaryValues`)
                    
                    // Update variant with decremented primaryValues
                    const { error: variantUpdateError } = await supabase
                      .from('product_variants')
                      .update({ primary_values: updatedPrimaryValues })
                      .eq('id', variant.id)

                    if (variantUpdateError) {
                      console.error(`❌ Error updating variant ${variant.id}:`, variantUpdateError)
                      continue
                    }

                    logger.log(`✅ Variant ${variant.id} updated successfully`)

                    // Recalculate total stock from ALL variants for this product
                    const { data: allVariants, error: allVariantsError } = await supabase
                      .from('product_variants')
                      .select('primary_values')
                      .eq('product_id', item.product_id)

                    if (!allVariantsError && allVariants) {
                      // Sum up all quantities from all primaryValues across all variants
                      let totalStock = 0
                      for (const v of allVariants) {
                        let pvArray = v.primary_values
                        // Parse if string
                        if (typeof pvArray === 'string') {
                          try {
                            pvArray = JSON.parse(pvArray)
                          } catch (e) {
                            continue
                          }
                        }
                        
                        if (pvArray && Array.isArray(pvArray)) {
                          for (const pv of pvArray) {
                            const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(String(pv.quantity)) || 0
                            totalStock += qty
                          }
                        }
                      }

                      logger.log(`📊 Calculated total stock for product ${item.product_id}: ${totalStock}`)

                      // Update product total stock
                      const { error: productUpdateError } = await supabase
                        .from('products')
                        .update({
                          stock_quantity: totalStock,
                          in_stock: totalStock > 0,
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', item.product_id)

                      if (productUpdateError) {
                        console.error(`❌ Error updating product stock:`, productUpdateError)
                      } else {
                        logger.log(`✅ Product ${item.product_id} total stock updated to: ${totalStock}`)
                      }
                    } else {
                      logger.log(`⚠️ Could not fetch all variants for recalculation:`, allVariantsError)
                    }
                  } else {
                    logger.log(`⚠️ No matching primaryValues found in variant ${variant.id} for order attributes:`, item.variant_attributes)
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
    const { sendOrderConfirmationEmail } = await import('@/lib/user-email-service')
    const supabase = createAdminSupabaseClient()
    
    // Get customer email - Priority: logged-in user's email, then shipping/billing email
    let customerEmail: string | null = null
    
    // First, try to get email from logged-in user account
    if (order.user_id) {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(order.user_id)
      if (authUser?.email) {
        customerEmail = authUser.email
      }
    }
    
    // Fallback to shipping/billing email if no user account email
    if (!customerEmail) {
      customerEmail = order.shipping_address?.email || 
                     order.billing_address?.email || 
                     order.user_email ||
                     null
    }
    
    if (!customerEmail) {
      logger.warn('No customer email found for order confirmation:', order.id)
      return { success: false, error: 'No customer email' }
    }

    // Get order items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('*, products(name, image)')
      .eq('order_id', order.id)

    const items = (orderItems || []).map((item: any) => ({
      name: item.product_name || item.products?.name || 'Product',
      quantity: item.quantity,
      price: item.price || 0, // Unit price
      totalPrice: item.total_price || (item.price || 0) * (item.quantity || 1), // Use total_price if available
      image: item.products?.image || item.product_image
    }))

    // Calculate totals - use total_price from database if available, otherwise calculate
    const subtotal = items.reduce((sum: number, item: any) => {
      // Use total_price from database (most accurate), fallback to price * quantity
      const itemTotal = item.totalPrice || (item.price * item.quantity) || 0
      return sum + itemTotal
    }, 0)
    const shipping = order.shipping_cost || 0
    const tax = order.tax_amount || 0
    const total = order.total_amount || (subtotal + shipping + tax)

    // Send order confirmation email
    const emailResult = await sendOrderConfirmationEmail(customerEmail, {
      orderNumber: order.order_number || order.id.toString(),
      orderDate: new Date(order.created_at || Date.now()).toLocaleDateString(),
      items,
      subtotal,
      shipping,
      tax,
      total,
      shippingAddress: order.shipping_address || {},
      billingAddress: order.billing_address,
      paymentMethod: order.payment_method || 'ClickPesa',
      trackingUrl: order.tracking_url || `${process.env.NEXT_PUBLIC_APP_URL || 'https://honiccompanystore.com'}/account/orders/${order.order_number || order.id}`,
      invoiceUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://honiccompanystore.com'}/api/user/orders/${order.order_number || order.id}/invoice`
    })

    if (!emailResult.success) {
      logger.error('Failed to send order confirmation email:', emailResult.error)
    }

    return emailResult
  } catch (error: any) {
    logger.error('Error in sendPaymentConfirmation:', error)
    return { success: false, error: error.message }
  }
}



