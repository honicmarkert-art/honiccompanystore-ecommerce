import { NextRequest, NextResponse } from 'next/server'
import { validateAuth, copyCookies } from '@/lib/auth-server'
import { logger } from '@/lib/logger'

// GET /api/cart - Return full cart with product details
export async function GET(request: NextRequest) {
  const { user, error: authError, response, supabase } = await validateAuth(request)
  
  if (authError || !user) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  // Join products so UI gets a single payload with all needed data
  const { data, error: cartErr } = await supabase
    .from('cart_items')
    .select(`
      id, 
      product_id, 
      variant_id, 
      quantity, 
      price,
      currency,
      applied_discount,
      created_at,
      updated_at,
      products (
        id, 
        name, 
        image, 
        price,
        original_price,
        in_stock,
        stock_quantity
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (cartErr) {
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 })
  }

  // Transform and group data for frontend consumption
  const rawCartItems = (data || []).map((item: any) => ({
    id: item.id,
    productId: item.product_id,
    variantId: item.variant_id,
    quantity: item.quantity,
    price: item.price,
    currency: item.currency,
    appliedDiscount: item.applied_discount,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    product: item.products
  }))

  // Group cart items by product ID
  const groupedCartItems: { [key: number]: any } = {}
  
  rawCartItems.forEach((item: any) => {
    const productId = item.productId
    
    if (!groupedCartItems[productId]) {
      groupedCartItems[productId] = {
        id: item.id, // Use first item's ID as the group ID
        productId: productId,
        variants: [],
        totalQuantity: 0,
        totalPrice: 0,
        currency: item.currency,
        appliedDiscount: item.appliedDiscount,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        product: item.product
      }
    }
    
    // Extract attributes from variant ID if it's a combination ID
    let attributes = {}
    if (item.variantId && item.variantId.startsWith('combination-')) {
      // Parse combination ID like "combination-brand:Honic Uno-model:Arduino R3"
      const attributeString = item.variantId.replace('combination-', '')
      
      // Split by pattern that looks for "-attributeName:" to handle spaces in values
      const attributeMatches = attributeString.match(/([^:]+):([^-]+?)(?=-[^:]+:|$)/g)
      
      if (attributeMatches) {
        attributeMatches.forEach((match: string) => {
          // Remove leading dash if present
          const cleanMatch = match.startsWith('-') ? match.substring(1) : match
          const colonIndex = cleanMatch.indexOf(':')
          if (colonIndex > 0) {
            const key = cleanMatch.substring(0, colonIndex).trim()
            const value = cleanMatch.substring(colonIndex + 1).trim()
            if (key && value) {
              (attributes as any)[key] = value
            }
          }
        })
      }
    }
    
    // Add variant to the group
    groupedCartItems[productId].variants.push({
      variantId: item.variantId || 'default',
      attributes: attributes,
      quantity: item.quantity,
      price: item.price,
      sku: undefined,
      image: undefined
    })
    
    // Update totals
    groupedCartItems[productId].totalQuantity += item.quantity
    groupedCartItems[productId].totalPrice += item.price * item.quantity
  })
  
  // Convert grouped items back to array
  const cartItems = Object.values(groupedCartItems)

  // Calculate totals manually
  const totals = {
    total_items: cartItems.reduce((sum, item) => sum + item.totalQuantity, 0),
    subtotal: cartItems.reduce((sum, item) => sum + item.totalPrice, 0),
    total_discount: cartItems.reduce((sum, item) => sum + ((item.appliedDiscount || 0) * item.totalQuantity), 0),
    final_total: cartItems.reduce((sum, item) => sum + (item.totalPrice - ((item.appliedDiscount || 0) * item.totalQuantity)), 0)
  }

  const finalResponse = NextResponse.json({ 
    items: cartItems,
    totals
  }, { 
    status: 200,
    headers: {
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'X-Cart-Items': cartItems.length.toString()
    }
  })

  copyCookies(response, finalResponse)
  return finalResponse
}

// POST /api/cart - Add product (or increment if exists)
export async function POST(request: NextRequest) {
  const { user, error: authError, response, supabase } = await validateAuth(request)
  
  if (authError || !user) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  logger.log('Cart POST request body:', body)
  
  const { productId, variantId: rawVariantId, quantity, price: variantPrice, variantAttributes } = body
  // Normalize variantId
  // IMPORTANT: For simple products (no attributes/variant), persist a stable key 'default'
  // so the unique (user_id, product_id, variant_id) constraint merges quantities instead of creating rows with NULLs
  const variantId = (rawVariantId === undefined || rawVariantId === null || String(rawVariantId).trim() === '')
    ? 'default'
    : String(rawVariantId)
  
  logger.log('🛒 Cart add request:', { 
    productId, 
    rawVariantId, 
    normalizedVariantId: variantId, 
    quantity,
    variantPrice,
    variantAttributes,
    variantIdType: typeof variantId
  })
  
  logger.log('🛒 DEBUG: variantPrice received:', variantPrice, 'type:', typeof variantPrice)
  logger.log('🛒 DEBUG: variantAttributes received:', variantAttributes)
  
  if (!productId || !quantity || quantity <= 0) {
    logger.log('Validation failed:', { productId, variantId, quantity })
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Fetch authoritative pricing + stock from database
  const { data: product, error: pErr } = await supabase
    .from('products')
    .select('id, price, original_price, in_stock, stock_quantity, return_time_type, return_time_value')
    .eq('id', productId)
    .single()

  if (pErr || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // Optimized stock calculation
  const stockQuantity = product.stock_quantity
  const availableStock = stockQuantity === null ? Infinity : (Number.isFinite(stockQuantity) ? stockQuantity : 0)
  // Use database in_stock field (managed by trigger) with fallback
  const effectiveInStock = product.in_stock ?? ((stockQuantity === null) || (Number.isFinite(stockQuantity) && stockQuantity > 0))

  // Check if product is completely out of stock
  if (!effectiveInStock) {
    logger.log('Product completely out of stock:', { 
      in_stock: product.in_stock, 
      stock_quantity: product.stock_quantity, 
      availableStock,
      effectiveInStock,
      requested_quantity: quantity 
    })
    
    // Calculate return time message
    const returnTimeType = product.return_time_type || 'days'
    const returnTimeValue = product.return_time_value || 3
    
    let returnTimeMessage = ''
    if (returnTimeValue === 1) {
      returnTimeMessage = `Please return in ${returnTimeValue} ${returnTimeType.slice(0, -1)}`
    } else {
      returnTimeMessage = `Please return in ${returnTimeValue} ${returnTimeType}`
    }
    
    const errorResponse = { 
      error: 'Product out of stock',
      message: `This product is currently unavailable. ${returnTimeMessage}.`,
      returnTime: {
        type: returnTimeType,
        value: returnTimeValue,
        message: returnTimeMessage
      }
    }
    
    logger.log('Sending stock error response:', errorResponse)
    return NextResponse.json(errorResponse, { status: 400 })
  }

  // Check if requested quantity exceeds available stock
  if (availableStock !== Infinity && availableStock < quantity) {
    logger.log('Partial stock available:', { 
      availableStock,
      requested_quantity: quantity,
      will_add: availableStock
    })
    
    // Calculate return time message for restock
    const returnTimeType = product.return_time_type || 'days'
    const returnTimeValue = product.return_time_value || 3
    
    let restockMessage = ''
    if (returnTimeValue === 1) {
      restockMessage = `We expect more stock in ${returnTimeValue} ${returnTimeType.slice(0, -1)}`
    } else {
      restockMessage = `We expect more stock in ${returnTimeValue} ${returnTimeType}`
    }
    
    // Adjust quantity to available stock
    const adjustedQuantity = availableStock
    
    // Add the maximum available quantity to cart
    const payload: any = {
      user_id: user.id,
      product_id: productId,
      quantity: adjustedQuantity,
      price: product.price,
      currency: 'USD'
    }
    payload.variant_id = variantId

    // Try RPC for atomic quantity add
    let upsertErr = null as any
    try {
      const { error } = await supabase
        .rpc('upsert_cart_item', {
          p_user_id: user.id,
          p_product_id: productId,
          p_variant_id: variantId,
          p_quantity: adjustedQuantity,
          p_price: product.price,
          p_currency: 'USD'
        })
      upsertErr = error
    } catch (e) {
      upsertErr = e
    }

    if (upsertErr) {
      
      const finalPrice = variantPrice || product.price
      logger.log('🛒 DEBUG: Using price for database:', finalPrice, 'variantPrice:', variantPrice, 'product.price:', product.price)
      
      const { error: upsertFallbackErr } = await supabase
        .from('cart_items')
        .upsert({
          user_id: user.id,
          product_id: productId,
          variant_id: variantId,
          quantity: adjustedQuantity,
          price: finalPrice,
          currency: 'USD'
        }, {
          onConflict: 'user_id,product_id,variant_id'
        })

      if (upsertFallbackErr) {
        return NextResponse.json({ error: 'Failed to add item to cart' }, { status: 500 })
      }
    }

    const partialStockResponse = {
      success: true,
      message: `Added ${adjustedQuantity} items to cart (maximum available).`,
      partialStock: {
        requested: quantity,
        available: availableStock,
        added: adjustedQuantity,
        remaining: quantity - adjustedQuantity,
        restockMessage,
        customerCare: {
          message: `For the remaining ${quantity - adjustedQuantity} items, please contact our customer care to confirm availability and restock timing.`,
          contactInfo: {
            email: 'support@honicco.com',
            phone: '+255-123-456-789',
            hours: 'Monday-Friday 8AM-6PM EAT'
          }
        }
      }
    }
    
    logger.log('Sending partial stock response:', partialStockResponse)
    return NextResponse.json(partialStockResponse, { status: 200 })
  }

  // Use UPSERT for atomic increment with quantity addition
  const payload: any = {
    user_id: user.id,
    product_id: productId,
    quantity,
    price: variantPrice || product.price, // Use variant price if provided, otherwise fallback to product price
    currency: 'USD' // Default currency
  }

  // Handle variant_id properly (null-safe)
  payload.variant_id = variantId

  // Try RPC for atomic quantity add; if missing, fallback to safe upsert
  let upsertErr = null as any
  let upsertResult = null as any
  try {
    logger.log('🔄 Attempting RPC upsert with params:', {
      p_user_id: user.id,
      p_product_id: productId,
      p_variant_id: variantId,
      p_quantity: quantity,
      p_price: variantPrice || product.price,
      p_currency: 'USD'
    })
    
    const { data, error } = await supabase
      .rpc('upsert_cart_item', {
        p_user_id: user.id,
        p_product_id: productId,
        p_variant_id: variantId,
        p_quantity: quantity,
        p_price: variantPrice || product.price,
        p_currency: 'USD'
      })
    upsertErr = error
    upsertResult = data
    
    if (error) {
    } else {
      logger.log('✅ RPC upsert successful:', data)
    }
  } catch (e) {
    upsertErr = e
  }

  if (upsertErr) {

    // ⚡ Use Supabase upsert instead of manual SELECT → INSERT
    // This is atomic and safe under concurrency
    const finalPrice2 = variantPrice || product.price
    logger.log('🛒 DEBUG: Using price for database (fallback):', finalPrice2, 'variantPrice:', variantPrice, 'product.price:', product.price)
    
    const { error: upsertFallbackErr } = await supabase
      .from('cart_items')
      .upsert({
        user_id: user.id,
        product_id: productId,
        variant_id: variantId,
        quantity,
        price: finalPrice2,
        currency: 'USD'
      }, {
        onConflict: 'user_id,product_id,variant_id'
      })

    if (upsertFallbackErr) {
      return NextResponse.json({ error: 'Failed to add item to cart' }, { status: 500 })
    }
  }

  const finalResponse = NextResponse.json({ 
    success: true, 
    message: 'Item added to cart successfully' 
  }, { status: 200 })

  copyCookies(response, finalResponse)
  return finalResponse
}

// PATCH /api/cart - Update quantity or remove if 0
export async function PATCH(request: NextRequest) {
  const { user, error: authError, response, supabase } = await validateAuth(request)
  
  if (authError || !user) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const { itemId, quantity } = await request.json()
  if (!itemId || quantity == null || quantity < 0) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  if (quantity === 0) {
    // Remove item
    const { error: delErr } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', user.id)

    if (delErr) {
      return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 })
    }
  } else {
    // Update quantity
    const { error: updErr } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', itemId)
      .eq('user_id', user.id)

    if (updErr) {
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
    }
  }

  const finalResponse = NextResponse.json({ 
    success: true, 
    message: quantity === 0 ? 'Item removed from cart' : 'Cart updated successfully' 
  }, { status: 200 })

  copyCookies(response, finalResponse)
  return finalResponse
}

// DELETE /api/cart - Clear entire cart
export async function DELETE(request: NextRequest) {
  const { user, error: authError, response, supabase } = await validateAuth(request)
  
  if (authError || !user) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to clear cart' }, { status: 500 })
  }

  const finalResponse = NextResponse.json({ 
    success: true, 
    message: 'Cart cleared successfully' 
  }, { status: 200 })

  copyCookies(response, finalResponse)
  return finalResponse
}
