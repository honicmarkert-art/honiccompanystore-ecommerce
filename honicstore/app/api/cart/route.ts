import { NextRequest, NextResponse } from 'next/server'
import { validateAuth, copyCookies } from '@/lib/auth-server'
import { logger } from '@/lib/logger'
import { validateProductId } from '@/lib/input-validation'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { sanitizeString } from '@/lib/input-validation'

// GET /api/cart - Return full cart with product details
export async function GET(request: NextRequest) {
  try {
    logger.log('🛒 [CART GET] ========== API ROUTE CALLED ==========')
  const { user, error: authError, response, supabase } = await validateAuth(request)
  
  if (authError || !user) {
    logger.error('Cart API: Authentication error:', authError)
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

    logger.log('🛒 [CART GET] User authenticated:', { userId: user.id })

    // Fetch cart items with product details, variant information, and supplier info
    // Note: We can't directly join product_variants from cart_items, so we'll fetch it separately
    let { data, error: cartErr } = await supabase
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
          stock_quantity,
          supplier_id,
          user_id
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

    // Check for cart query error immediately
  if (cartErr) {
      logger.error('🛒 [CART GET] Failed to fetch cart:', cartErr)
      // Sanitize error message to prevent JSON parsing issues
      const errorMessage = cartErr?.message ? String(cartErr.message).substring(0, 200) : 'Database query failed'
      return NextResponse.json({ 
        error: 'Failed to fetch cart',
        details: errorMessage
      }, { status: 500 })
    }

    logger.log('🛒 [CART GET] Initial cart query result:', {
      itemsCount: (data || []).length,
      firstItem: data?.[0] ? {
        id: data[0].id,
        product_id: data[0].product_id,
        variant_id: data[0].variant_id,
        variant_idType: typeof data[0].variant_id,
        products: data[0].products ? {
          id: data[0].products.id,
          name: data[0].products.name,
          supplier_id: data[0].products.supplier_id,
          user_id: data[0].products.user_id,
          hasSupplierId: !!data[0].products.supplier_id,
          hasUserId: !!data[0].products.user_id
        } : null
      } : null
    })

    // Validate all product IDs exist in database
    const productIds = [...new Set((data || []).map((item: any) => item.product_id).filter((id: any) => id && !isNaN(Number(id))))]
    if (productIds.length > 0) {
      const { data: validProducts, error: productErr } = await supabase
        .from('products')
        .select('id')
        .in('id', productIds)
      
      if (productErr) {
        logger.error('Error validating products:', productErr)
      } else {
        const validProductIds = new Set((validProducts || []).map((p: any) => p.id))
        const invalidProductIds = productIds.filter(id => !validProductIds.has(id))
        if (invalidProductIds.length > 0) {
          logger.error('Invalid product IDs found in cart:', invalidProductIds)
          // Filter out invalid products
          data = (data || []).filter((item: any) => validProductIds.has(item.product_id))
        }
      }
    }

    // Fetch variant names for numeric variant IDs
    const allVariantIds = (data || []).map((item: any) => item.variant_id)
    const variantIds = allVariantIds
      .filter((id: any) => id !== null && id !== undefined && id !== 'default' && !String(id).startsWith('combination-') && !isNaN(Number(id)))
      .map((id: any) => Number(id))

    logger.log('🛒 [CART GET] Step 1: Extracted variant IDs from cart items', {
      totalCartItems: (data || []).length,
      allVariantIds: allVariantIds,
      allVariantIdsTypes: allVariantIds.map((id: any) => ({ id, type: typeof id, asNumber: Number(id), isValid: !isNaN(Number(id)) })),
      numericVariantIds: variantIds,
      uniqueVariantIds: [...new Set(variantIds)]
    })

    let variantMap: { [key: number]: { variant_name: string | null } } = {}
    if (variantIds.length > 0) {
      logger.log('🛒 [CART GET] Step 2: Fetching variant names from database', {
        variantIdsToFetch: variantIds
      })
      
      logger.log('🛒 [CART GET] Step 2: About to query database', {
        table: 'product_variants',
        columns: ['id', 'variant_name'],
        variantIdsToQuery: variantIds,
        variantIdsType: variantIds.map(id => ({ id, type: typeof id }))
      })
      
      const { data: variants, error: variantError } = await supabase
        .from('product_variants')
        .select('id, variant_name, product_id')
        .in('id', variantIds)
      
      logger.log('🛒 [CART GET] Step 2 Result: Variants fetched from database', {
        found: variants?.length || 0,
        requestedCount: variantIds.length,
        variants: variants?.map((v: any) => ({
          id: v.id,
          idType: typeof v.id,
          variant_name: v.variant_name,
          variant_nameType: typeof v.variant_name,
          isNull: v.variant_name === null,
          isEmpty: v.variant_name === '',
          rawVariant: v
        })) || [],
        error: variantError?.message,
        errorDetails: variantError
      })
      
      if (variants) {
        variants.forEach((v: any) => {
          variantMap[v.id] = { variant_name: v.variant_name }
        })
      }
      
      logger.log('🛒 [CART GET] Step 2b: Variant map created', {
        variantMapSize: Object.keys(variantMap).length,
        variantMap: Object.entries(variantMap).map(([id, data]) => ({
          id: Number(id),
          variant_name: data.variant_name
        }))
      })
    } else {
      logger.log('🛒 [CART GET] Step 2: Skipped (no numeric variant IDs found)')
    }
    
    // Fetch supplier information for products
    const allSupplierIds = (data || []).map((item: any) => ({
      productId: item.product_id,
      supplier_id: item.products?.supplier_id,
      user_id: item.products?.user_id,
      extracted: item.products?.supplier_id || item.products?.user_id
    }))
    
    logger.log('🛒 [CART GET] Step 2a: Extracting supplier IDs from products', {
      allSupplierIds: allSupplierIds,
      sampleProduct: data?.[0]?.products ? {
        id: data[0].products.id,
        name: data[0].products.name,
        supplier_id: data[0].products.supplier_id,
        user_id: data[0].products.user_id,
        supplier_idType: typeof data[0].products.supplier_id,
        user_idType: typeof data[0].products.user_id
      } : null
    })
    
    const supplierIds = [...new Set(allSupplierIds.map(item => item.extracted).filter(Boolean))]
    let supplierMap: { [key: string]: { company_name?: string, is_verified?: boolean, location?: string, region?: string, nation?: string } } = {}
    
    logger.log('🛒 [CART GET] Step 2a: Fetching supplier info', {
      supplierIdsCount: supplierIds.length,
      supplierIds: supplierIds,
      supplierIdsTypes: supplierIds.map(id => ({ id, type: typeof id }))
    })
    
    if (supplierIds.length > 0) {
      const { data: suppliers, error: supplierErr } = await supabase
        .from('profiles')
        .select('id, company_name, is_verified, location, region, nation, company_logo') // Fetch company_name, verification status, location, and logo
        .in('id', supplierIds)
      
      if (supplierErr) {
        logger.error('🛒 [CART GET] Error fetching suppliers:', supplierErr)
      }
      
      if (suppliers) {
        suppliers.forEach((s: any) => {
          // Use string key to ensure consistent lookup
          const supplierKey = String(s.id)
          supplierMap[supplierKey] = {
            company_name: s.company_name,
            is_verified: s.is_verified || false,
            location: s.location || null,
            region: s.region || null,
            nation: s.nation || null,
            company_logo: s.company_logo || null
          }
        })
        
        logger.log('🛒 [CART GET] Step 2a Result: Supplier map created', {
          suppliersFound: suppliers.length,
          supplierMap: Object.keys(supplierMap).map(key => ({
            id: key,
            company_name: supplierMap[key].company_name
          }))
        })
      } else {
        logger.log('🛒 [CART GET] Step 2a Result: No suppliers found')
      }
    } else {
      logger.log('🛒 [CART GET] Step 2a: Skipped (no supplier IDs found)')
  }

  // Transform and group data for frontend consumption
    // SECURITY: Remove supplier_id and user_id (UUIDs) from product object before sending to client
    // But keep them temporarily for server-side supplier lookup
    const rawCartItems = (data || []).map((item: any) => {
    const productData = item.products || {}
    // Store supplierId temporarily for server-side lookup (will be removed before sending to client)
    const supplierId = productData.supplier_id || productData.user_id
    // Remove sensitive UUID fields from product before sending to client
    const { supplier_id, user_id, ...productWithoutIds } = productData
    
    // Normalize variant_id: null -> 'default' for consistency
    const normalizedVariantId = (item.variant_id === null || item.variant_id === undefined || String(item.variant_id).trim() === '')
      ? 'default'
      : String(item.variant_id)
    
    // Normalize currency: default to TZS if invalid
    const normalizedCurrency = (item.currency === 'TZS' || item.currency === 'USD') 
      ? item.currency 
      : 'TZS' // Default to TZS
    
    return {
    id: item.id,
    productId: item.product_id,
      variantId: normalizedVariantId,
    quantity: item.quantity,
    price: item.price,
      currency: normalizedCurrency,
    appliedDiscount: item.applied_discount,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
      product: productWithoutIds, // Product without supplier_id/user_id UUIDs
      _supplierId: supplierId // Temporary server-side only field (will be removed)
    }
    })

  // Group cart items by product ID
  const groupedCartItems: { [key: number]: any } = {}
  
    // Use for...of loop instead of forEach to support async/await
    for (const item of rawCartItems) {
    const productId = item.productId
    
    if (!groupedCartItems[productId]) {
      // SECURITY: Get supplierId from temporary field (server-side only)
      // We need supplierId server-side to lookup supplier info, but don't expose it to client
      const supplierId = (item as any)._supplierId
      // Use string key for consistent lookup
      const supplierKey = supplierId ? String(supplierId) : null
      const supplierInfo = supplierKey ? supplierMap[supplierKey] : null
      
      logger.log('🛒 [CART GET] Step 3: Setting supplier info for product', {
        productId,
        supplierId,
        supplierIdType: typeof supplierId,
        supplierKey,
        supplierKeyInMap: supplierKey ? supplierKey in supplierMap : false,
        supplierMapKeys: Object.keys(supplierMap),
        supplierInfoFound: !!supplierInfo,
        company_name: supplierInfo?.company_name || null,
        is_verified: supplierInfo?.is_verified || false,
        location: supplierInfo?.location || null,
        region: supplierInfo?.region || null,
        supplierMapSize: Object.keys(supplierMap).length
      })
      
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
        product: item.product,
        // SECURITY: supplierId stored server-side only, will be removed before sending to client
        _supplierId: supplierId,
        supplierCompanyName: supplierInfo?.company_name || null,
        supplierIsVerified: supplierInfo?.is_verified || false,
        supplierLocation: supplierInfo?.location || null,
        supplierRegion: supplierInfo?.region || null,
        supplierNation: supplierInfo?.nation || null,
        supplierCompanyLogo: supplierInfo?.company_logo || null
      }
    }
    
    // Get variant name from database if variant_id is numeric
    let variantName: string | null = null
    logger.log('🛒 [CART GET] Step 3: Processing cart item', {
      productId: item.productId,
      variantId: item.variantId,
      variantIdType: typeof item.variantId,
      isDefault: item.variantId === 'default',
      isCombination: item.variantId?.toString().startsWith('combination-'),
      isNumeric: item.variantId && !isNaN(Number(item.variantId))
    })
    
    if (item.variantId && item.variantId !== 'default' && !item.variantId.toString().startsWith('combination-')) {
      const variantIdNum = Number(item.variantId)
      logger.log('🛒 [CART GET] Step 3a: Looking up variant name', {
        variantIdNum,
        isInMap: !isNaN(variantIdNum) && variantMap[variantIdNum] !== undefined,
        variantMapEntry: variantMap[variantIdNum]
      })
      
      if (!isNaN(variantIdNum) && variantMap[variantIdNum]) {
        variantName = variantMap[variantIdNum].variant_name
        logger.log('🛒 [CART GET] Step 3a Result: Found variant name in map', {
          variantId: variantIdNum,
          variant_name: variantName,
          variant_nameType: typeof variantName,
          isNull: variantName === null,
          isEmpty: variantName === ''
        })
      } else {
        logger.log('🛒 [CART GET] Step 3a Result: Variant name NOT found in map, trying direct fetch', {
          variantId: variantIdNum,
          variantMapKeys: Object.keys(variantMap).map(Number),
          variantMapSize: Object.keys(variantMap).length,
          reason: !isNaN(variantIdNum) ? 'Not in variantMap' : 'Not a number'
        })
        
        // Fallback: Try to fetch directly from database if not in map
        try {
          const { data: directVariant, error: directError } = await supabase
            .from('product_variants')
            .select('id, variant_name')
            .eq('id', variantIdNum)
            .maybeSingle()
          
          logger.log('🛒 [CART GET] Step 3a Fallback: Direct fetch result', {
            variantId: variantIdNum,
            found: !!directVariant,
            variant_name: directVariant?.variant_name || null,
            error: directError?.message
          })
          
          if (directVariant) {
            variantName = directVariant.variant_name
            // Also add to map for future lookups
            variantMap[variantIdNum] = { variant_name: directVariant.variant_name }
          }
        } catch (fallbackError) {
          logger.error('🛒 [CART GET] Step 3a Fallback: Error fetching variant:', fallbackError)
        }
      }
    } else {
      logger.log('🛒 [CART GET] Step 3a: Skipped (default or combination variant)')
    }
    
    // Add variant to the group
    const variantToAdd = {
      variantId: item.variantId || 'default',
      variant_name: variantName,
      quantity: item.quantity,
      price: item.price,
      sku: undefined,
      image: undefined
    }
    
    logger.log('🛒 [CART GET] Step 3b: Adding variant to group', {
      productId,
      variant: variantToAdd
    })
    
    groupedCartItems[productId].variants.push(variantToAdd)
    
    // Update totals
    groupedCartItems[productId].totalQuantity += item.quantity
    groupedCartItems[productId].totalPrice += item.price * item.quantity
    }
  
  // Convert grouped items back to array
  const cartItems = Object.values(groupedCartItems)

    logger.log('🛒 [CART GET] Step 4: Final cart items before sending', {
    totalItems: cartItems.length,
    items: cartItems.map((item: any) => ({
      productId: item.productId,
      supplierCompanyName: item.supplierCompanyName,
      variants: (item.variants || []).map((v: any) => ({
        variantId: v.variantId,
        variant_name: v.variant_name,
        variant_nameType: typeof v.variant_name,
        isNull: v.variant_name === null,
        isEmpty: v.variant_name === '',
        quantity: v.quantity,
        price: v.price
      }))
    }))
    })

  // Calculate totals manually
  const totals = {
    total_items: cartItems.reduce((sum, item) => sum + item.totalQuantity, 0),
    subtotal: cartItems.reduce((sum, item) => sum + item.totalPrice, 0),
    total_discount: cartItems.reduce((sum, item) => sum + ((item.appliedDiscount || 0) * item.totalQuantity), 0),
    final_total: cartItems.reduce((sum, item) => sum + (item.totalPrice - ((item.appliedDiscount || 0) * item.totalQuantity)), 0)
  }

    // Ensure variant_name and supplier info are always included in response (even if null)
    // SECURITY: Do NOT expose supplierId (UUID) or _supplierId to client - only send display name and safe info
    const finalCartItems = cartItems.map((item: any) => {
    const { supplierId, _supplierId, ...itemWithoutSupplierIds } = item // Remove all supplier UUIDs before sending to client
    return {
      ...itemWithoutSupplierIds,
      supplierCompanyName: item.supplierCompanyName || null,
      supplierIsVerified: item.supplierIsVerified || false,
      supplierLocation: item.supplierLocation || null,
      supplierRegion: item.supplierRegion || null,
      supplierNation: item.supplierNation || null,
      supplierCompanyLogo: item.supplierCompanyLogo || null,
      variants: (item.variants || []).map((v: any) => ({
        ...v,
        variant_name: v.variant_name !== undefined ? v.variant_name : null
      }))
    }
    })
    
    logger.log('🛒 [CART GET] Step 5: Final response being sent', {
      status: 200,
      itemsCount: finalCartItems.length,
      sampleItem: finalCartItems[0] ? {
        productId: finalCartItems[0].productId,
        // supplierId removed from response for security (not exposed to client)
        supplierCompanyName: finalCartItems[0].supplierCompanyName,
        variants: (finalCartItems[0].variants || []).map((v: any) => ({
          variantId: v.variantId,
          variant_name: v.variant_name,
          hasVariantName: !!v.variant_name
        }))
      } : null
    })

  const finalResponse = NextResponse.json({ 
      items: finalCartItems,
    totals
  }, { 
    status: 200,
    headers: {
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Cart-Items': finalCartItems.length.toString()
    }
  })
    
    logger.log('🛒 [CART GET] Step 6: Response sent to client', {
      status: 200,
      itemsCount: finalCartItems.length
  })

  copyCookies(response, finalResponse)
  return finalResponse
  } catch (error: any) {
    logger.error('🛒 [CART GET] Unexpected error:', {
      error: error?.message || error,
      stack: error?.stack,
      name: error?.name
    })
    // Sanitize error message to prevent JSON parsing issues
    const errorMessage = error?.message ? String(error.message).substring(0, 200) : 'An unexpected error occurred'
    const errorResponse = NextResponse.json({ 
      error: 'Failed to fetch cart',
      message: errorMessage
    }, { status: 500 })
    return errorResponse
  }
}

// POST /api/cart - Add product (or increment if exists)
export async function POST(request: NextRequest) {
  // Security: Rate limiting
  const rateLimitCheck = enhancedRateLimit(request)
  if (!rateLimitCheck.allowed) {
    logSecurityEvent('Rate limit exceeded on cart POST', { 
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      path: request.nextUrl.pathname 
    }, request)
    return NextResponse.json({ 
      error: rateLimitCheck.reason || 'Rate limit exceeded',
      retryAfter: rateLimitCheck.retryAfter 
    }, { 
      status: 429,
      headers: {
        'Retry-After': rateLimitCheck.retryAfter?.toString() || '60'
      }
    })
  }

  // Security: Request size validation (prevent DoS)
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > 10000) { // 10KB max
    logSecurityEvent('Request too large on cart POST', { 
      size: contentLength 
    }, request)
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  const { user, error: authError, response, supabase } = await validateAuth(request)
  
  if (authError || !user) {
    logSecurityEvent('Unauthorized cart POST attempt', { 
      error: authError 
    }, request)
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch (error) {
    logSecurityEvent('Invalid JSON in cart POST', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, request)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  
  logger.log('Cart POST request body:', body)
  
  // Security: Input validation and sanitization
  const { productId: rawProductId, variantId: rawVariantId, quantity: rawQuantity, variantAttributes } = body
  
  // Validate and sanitize productId
  const validatedProductId = validateProductId(rawProductId)
  if (!validatedProductId) {
    logSecurityEvent('Invalid product ID in cart POST', { 
      productId: rawProductId 
    }, request)
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
  }
  const productId = validatedProductId
  
  // Validate and sanitize quantity
  const quantity = typeof rawQuantity === 'number' 
    ? Math.floor(Math.max(1, Math.min(1000, rawQuantity))) // Clamp between 1 and 1000
    : (typeof rawQuantity === 'string' 
      ? Math.floor(Math.max(1, Math.min(1000, parseInt(rawQuantity) || 1)))
      : 1)
  
  if (!quantity || quantity <= 0 || quantity > 1000) {
    logSecurityEvent('Invalid quantity in cart POST', { 
      quantity: rawQuantity 
    }, request)
    return NextResponse.json({ error: 'Invalid quantity. Must be between 1 and 1000.' }, { status: 400 })
  }
  
  // Security: Validate and sanitize variantAttributes if provided
  let sanitizedVariantAttributes: { [key: string]: string | string[] } | undefined = undefined
  if (variantAttributes && typeof variantAttributes === 'object') {
    sanitizedVariantAttributes = {}
    for (const [key, value] of Object.entries(variantAttributes)) {
      // Sanitize key
      const sanitizedKey = sanitizeString(String(key), 50)
      if (!sanitizedKey) continue
      
      // Sanitize value
      if (Array.isArray(value)) {
        sanitizedVariantAttributes[sanitizedKey] = value
          .map(v => sanitizeString(String(v), 100))
          .filter(Boolean)
          .slice(0, 10) // Limit to 10 values max
      } else {
        const sanitizedValue = sanitizeString(String(value), 100)
        if (sanitizedValue) {
          sanitizedVariantAttributes[sanitizedKey] = sanitizedValue
        }
      }
    }
    // Limit to 10 attributes max
    const entries = Object.entries(sanitizedVariantAttributes).slice(0, 10)
    sanitizedVariantAttributes = Object.fromEntries(entries)
  }
  
  // Normalize variantId with sanitization
  // IMPORTANT: For simple products (no attributes/variant), persist a stable key 'default'
  // so the unique (user_id, product_id, variant_id) constraint merges quantities instead of creating rows with NULLs
  let variantId: string
  if (rawVariantId === undefined || rawVariantId === null || String(rawVariantId).trim() === '') {
    variantId = 'default'
  } else {
    // Security: Sanitize variantId to prevent injection
    const sanitized = sanitizeString(String(rawVariantId), 100)
    variantId = sanitized || 'default'
    
    // Security: Validate variantId format
    if (variantId !== 'default' && !variantId.startsWith('combination-')) {
      const variantIdNum = Number(variantId)
      if (isNaN(variantIdNum) || variantIdNum <= 0 || variantIdNum > Number.MAX_SAFE_INTEGER) {
        logSecurityEvent('Invalid variant ID format in cart POST', { 
          variantId: rawVariantId 
        }, request)
        return NextResponse.json({ error: 'Invalid variant ID format' }, { status: 400 })
      }
    }
  }
  
  logger.log('🛒 Cart add request:', { 
    productId, 
    rawVariantId, 
    normalizedVariantId: variantId, 
    quantity,
    variantIdType: typeof variantId
  })

  // Fetch authoritative pricing + stock from database - VALIDATE product exists
  // Also fetch supplier_id/user_id to get supplier info
  const { data: product, error: pErr } = await supabase
    .from('products')
    .select('id, price, original_price, in_stock, stock_quantity, return_time_type, return_time_value, supplier_id, user_id')
    .eq('id', Number(productId))
    .single()

  if (pErr || !product) {
    logger.error('Product validation failed:', { productId, error: pErr })
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // Fetch supplier information for this product (company_name, verification status, location, logo)
  const supplierId = (product as any).supplier_id || (product as any).user_id
  let supplierCompanyName: string | null = null
  let supplierIsVerified: boolean = false
  let supplierLocation: string | null = null
  let supplierRegion: string | null = null
  let supplierNation: string | null = null
  let supplierCompanyLogo: string | null = null
  
  if (supplierId) {
    logger.log('🛒 [CART POST] ========== FETCHING SUPPLIER INFO ==========', {
      productId,
      supplierId,
      supplierIdType: typeof supplierId,
      hasSupplierId: !!(product as any).supplier_id,
      hasUserId: !!(product as any).user_id
    })
    
    const { data: supplier, error: supplierErr } = await supabase
      .from('profiles')
      .select('company_name, is_verified, location, region, nation, company_logo')
      .eq('id', supplierId)
      .maybeSingle()
    
    if (!supplierErr && supplier) {
      supplierCompanyName = supplier.company_name || null
      supplierIsVerified = supplier.is_verified || false
      supplierLocation = supplier.location || null
      supplierRegion = supplier.region || null
      supplierNation = supplier.nation || null
      supplierCompanyLogo = supplier.company_logo || null
      logger.log('🛒 [CART POST] ✅ SUPPLIER INFO FETCHED SUCCESSFULLY', {
        productId,
        supplierId,
        company_name: supplierCompanyName,
        is_verified: supplierIsVerified,
        location: supplierLocation,
        region: supplierRegion,
        nation: supplierNation,
        company_logo: supplierCompanyLogo
      })
    } else {
      logger.log('🛒 [CART POST] ❌ SUPPLIER NOT FOUND OR ERROR', {
        productId,
        supplierId,
        error: supplierErr?.message,
        errorCode: supplierErr?.code,
        errorDetails: supplierErr?.details
      })
    }
  } else {
    logger.log('🛒 [CART POST] ⚠️ NO SUPPLIER ID FOUND FOR PRODUCT', {
      productId,
      supplier_id: (product as any).supplier_id,
      user_id: (product as any).user_id,
      hasSupplierId: !!(product as any).supplier_id,
      hasUserId: !!(product as any).user_id
    })
  }
  
  // Security: Validate variant ID exists in database if it's numeric
  if (variantId && variantId !== 'default' && !variantId.startsWith('combination-') && !isNaN(Number(variantId))) {
    const variantIdNum = Number(variantId)
    
    // Additional security: Validate variantId is within safe range
    if (variantIdNum <= 0 || variantIdNum > Number.MAX_SAFE_INTEGER) {
      logSecurityEvent('Variant ID out of range in cart POST', { 
        variantId: variantIdNum 
      }, request)
      return NextResponse.json({ error: 'Invalid variant ID' }, { status: 400 })
    }
    
    const { data: variantExists, error: variantErr } = await supabase
      .from('product_variants')
      .select('id, product_id')
      .eq('id', variantIdNum)
      .eq('product_id', productId) // Security: Ensure variant belongs to product
      .maybeSingle()
    
    if (variantErr || !variantExists) {
      logSecurityEvent('Variant validation failed in cart POST', { 
        variantId, 
        productId, 
        error: variantErr?.message 
      }, request)
      return NextResponse.json({ error: 'Variant not found or does not belong to this product' }, { status: 404 })
    }
  }

  // Server-side quantity validation based on product price
  // Products under 500 TZS require minimum quantity of 5
  const productPrice = parseFloat(product.price) || 0
  if (productPrice < 500 && quantity < 5) {
    return NextResponse.json({ 
      error: 'Minimum order quantity is 5 for products under 500 TZS',
      minQuantity: 5,
      requestedQuantity: quantity,
      productPrice: productPrice
    }, { status: 400 })
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
    
    // Fetch variant data from database (variant_name and price) - NEVER trust client-provided data
    let newVariantNamePartial: string | null = null
    let variantPriceFromDBPartial: number | null = null
    
    if (variantId && variantId !== 'default' && !isNaN(Number(variantId))) {
      const { data: newVariantPartial } = await supabase
        .from('product_variants')
        .select('id, variant_name, price')
        .eq('id', Number(variantId))
        .single()
      
      if (newVariantPartial) {
        newVariantNamePartial = newVariantPartial.variant_name
        variantPriceFromDBPartial = parseFloat(newVariantPartial.price) || null
      }
    }

    // Check ALL existing cart items for this product
    const { data: existingItemsPartial, error: checkErrorPartial } = await supabase
      .from('cart_items')
      .select('id, quantity, variant_id')
      .eq('user_id', user.id)
      .eq('product_id', productId)

    // ALWAYS use database price - NEVER trust client-provided price
    const finalPricePartial = variantPriceFromDBPartial !== null ? variantPriceFromDBPartial : parseFloat(product.price) || 0

    // Find matching item by comparing both variant_id AND variant_name
    let matchingItemPartial: any = null
    
    if (existingItemsPartial && existingItemsPartial.length > 0) {
      // Fetch variant names for all existing items
      const existingVariantIdsPartial = existingItemsPartial
        .map((item: any) => item.variant_id)
        .filter((id: any) => id && id !== 'default' && !isNaN(Number(id)))
        .map((id: any) => Number(id))
      
      let existingVariantMapPartial: { [key: number]: string | null } = {}
      if (existingVariantIdsPartial.length > 0) {
        const { data: existingVariantsPartial } = await supabase
          .from('product_variants')
          .select('id, variant_name')
          .in('id', existingVariantIdsPartial)
        
        if (existingVariantsPartial) {
          existingVariantsPartial.forEach((v: any) => {
            existingVariantMapPartial[v.id] = v.variant_name
          })
        }
      }
      
      // Compare each existing item with the new one
      for (const existingItemPartial of existingItemsPartial) {
        const existingVariantIdPartial = String(existingItemPartial.variant_id || 'default')
        const newVariantIdPartial = String(variantId || 'default')
        
        // First check variant_id
        if (existingVariantIdPartial === newVariantIdPartial) {
          // If variant_id matches, also check variant_name
          let existingVariantNamePartial: string | null = null
          if (existingItemPartial.variant_id && !isNaN(Number(existingItemPartial.variant_id))) {
            existingVariantNamePartial = existingVariantMapPartial[Number(existingItemPartial.variant_id)] || null
          }
          
          // Compare variant names (both must match or both must be null/empty)
          const namesMatchPartial = (existingVariantNamePartial === newVariantNamePartial) || 
                                    (!existingVariantNamePartial && !newVariantNamePartial)
          
          if (namesMatchPartial) {
            matchingItemPartial = existingItemPartial
            break
          }
        }
      }
    }

    // Only update if item exists with same variant_id AND variant_name
    if (matchingItemPartial) {
      // Item exists with same variant - update to maximum available
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: adjustedQuantity })
        .eq('id', matchingItemPartial.id)
      
      if (updateError) {
        return NextResponse.json({ error: 'Failed to update cart item' }, { status: 500 })
      }
    } else {
      // Item doesn't exist - insert new item
      const { error: insertError } = await supabase
        .from('cart_items')
        .insert({
          user_id: user.id,
          product_id: productId,
          variant_id: variantId,
          quantity: adjustedQuantity,
          price: finalPricePartial,
          currency: 'TZS'
        })
      
      if (insertError) {
        return NextResponse.json({ error: 'Failed to add item to cart' }, { status: 500 })
      }
    }

    // SECURITY: Only send supplier display names, never UUIDs
    logger.log('🛒 [CART POST] ========== SENDING RESPONSE (PARTIAL STOCK - ADJUSTED) ==========', {
      productId,
      supplierCompanyName,
      supplierIsVerified,
      supplierLocation,
      supplierRegion
    })

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
            email: process.env.SUPPORT_EMAIL || 'support@honicco.com',
            phone: '+255-123-456-789',
            hours: 'Monday-Friday 8AM-6PM EAT'
          }
        }
      },
      supplierCompanyName: supplierCompanyName || null,
      supplierIsVerified: supplierIsVerified || false,
      supplierLocation: supplierLocation || null,
      supplierRegion: supplierRegion || null,
      supplierNation: supplierNation || null,
      supplierCompanyLogo: supplierCompanyLogo || null
    }
    
    logger.log('Sending partial stock response:', partialStockResponse)
    return NextResponse.json(partialStockResponse, { status: 200 })
  }

  // Fetch variant data from database (variant_name and price) - NEVER trust client-provided data
  let newVariantName: string | null = null
  let variantPriceFromDB: number | null = null
  
  if (variantId && variantId !== 'default' && !isNaN(Number(variantId))) {
    const { data: newVariant, error: variantError } = await supabase
      .from('product_variants')
      .select('id, variant_name, price')
      .eq('id', Number(variantId))
      .single()
    
    if (newVariant) {
      newVariantName = newVariant.variant_name
      variantPriceFromDB = parseFloat(newVariant.price) || null
    }
  }
  
  // ALWAYS use database price - NEVER trust client-provided price
  // Use variant price if available, otherwise use product price
  const finalPrice = variantPriceFromDB !== null ? variantPriceFromDB : parseFloat(product.price) || 0
  
  logger.log('🛒 [CART ADD] Price determination:', {
    clientProvidedPrice: variantPrice,
    variantPriceFromDB,
    productPrice: product.price,
    finalPriceUsed: finalPrice,
    source: variantPriceFromDB !== null ? 'variant' : 'product'
  })

  // Check ALL existing cart items for this product (not just one)
  const { data: existingItems, error: checkError } = await supabase
    .from('cart_items')
    .select('id, quantity, variant_id')
    .eq('user_id', user.id)
    .eq('product_id', productId)

  // Find matching item by comparing both variant_id AND variant_name
  let matchingItem: any = null
  
  if (existingItems && existingItems.length > 0) {
    // Fetch variant names for all existing items
    const existingVariantIds = existingItems
      .map((item: any) => item.variant_id)
      .filter((id: any) => id && id !== 'default' && !isNaN(Number(id)))
      .map((id: any) => Number(id))
    
    let existingVariantMap: { [key: number]: string | null } = {}
    if (existingVariantIds.length > 0) {
      const { data: existingVariants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, variant_name')
        .in('id', existingVariantIds)
      
      if (existingVariants) {
        existingVariants.forEach((v: any) => {
          existingVariantMap[v.id] = v.variant_name
        })
      }
    }
    
    // Compare each existing item with the new one
    for (let i = 0; i < existingItems.length; i++) {
      const existingItem = existingItems[i]
      const existingVariantId = String(existingItem.variant_id || 'default')
      const newVariantId = String(variantId || 'default')
      
      // First check variant_id
      if (existingVariantId === newVariantId) {
        // If variant_id matches, also check variant_name
        let existingVariantName: string | null = null
        if (existingItem.variant_id && !isNaN(Number(existingItem.variant_id))) {
          existingVariantName = existingVariantMap[Number(existingItem.variant_id)] || null
        }
        
        // Compare variant names (both must match or both must be null/empty)
        const namesMatch = (existingVariantName === newVariantName) || 
                          (!existingVariantName && !newVariantName)
        
        if (namesMatch) {
          matchingItem = existingItem
          break
          }
        }
    }
    }

  // Only increment if we found a matching item (same variant_id AND variant_name)
  logger.log('🛒 [CART POST] Matching item check:', {
    hasMatchingItem: !!matchingItem,
    matchingItemId: matchingItem?.id || null,
    matchingItemQuantity: matchingItem?.quantity || null
  })
  
  if (matchingItem) {
      // Item exists with same variant_id AND variant_name - increment quantity
      const newQuantity = matchingItem.quantity + quantity
      
      // Check stock limits
      if (availableStock !== Infinity && newQuantity > availableStock) {
        const maxAddable = availableStock - matchingItem.quantity
        if (maxAddable <= 0) {
          return NextResponse.json({ 
            error: 'Maximum stock limit reached for this variant',
            availableStock,
            currentQuantity: matchingItem.quantity
          }, { status: 400 })
        }
        
        // Update to maximum available
        const { error: updateError } = await supabase
      .from('cart_items')
          .update({ quantity: availableStock })
          .eq('id', matchingItem.id)
        
        if (updateError) {
          return NextResponse.json({ error: 'Failed to update cart item' }, { status: 500 })
        }
        
        // SECURITY: Only send supplier display names, never UUIDs
        logger.log('🛒 [CART POST] ========== SENDING RESPONSE (PARTIAL STOCK) ==========', {
          productId,
          supplierCompanyName,
          supplierIsVerified,
          supplierLocation,
          supplierRegion
        })
        
        return NextResponse.json({ 
          success: true, 
          message: `Updated quantity to maximum available (${availableStock})`,
          partialStock: {
            requested: newQuantity,
            available: availableStock,
            added: maxAddable
          },
          supplierCompanyName: supplierCompanyName || null,
          supplierIsVerified: supplierIsVerified || false,
          supplierLocation: supplierLocation || null,
          supplierRegion: supplierRegion || null,
          supplierNation: supplierNation || null
        }, { status: 200 })
      }
      
      // Update quantity
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', matchingItem.id)
      
      if (updateError) {
        return NextResponse.json({ error: 'Failed to update cart item' }, { status: 500 })
      }
      
      logger.log('✅ Incremented existing cart item quantity:', { 
        itemId: matchingItem.id, 
        oldQuantity: matchingItem.quantity, 
        newQuantity,
        variantId: String(variantId || 'default'),
        variantName: newVariantName
      })
      
      // SECURITY: Only send supplier display names, never UUIDs
      logger.log('🛒 [CART POST] ========== SENDING RESPONSE (INCREMENT) ==========', {
        productId,
        supplierCompanyName,
        supplierIsVerified,
        supplierLocation,
        supplierRegion
      })
      
      const finalResponse = NextResponse.json({ 
        success: true, 
        message: 'Item quantity updated in cart',
        supplierCompanyName: supplierCompanyName || null,
        supplierIsVerified: supplierIsVerified || false,
        supplierLocation: supplierLocation || null,
        supplierRegion: supplierRegion || null,
        supplierNation: supplierNation || null
      }, { status: 200 })
      
      copyCookies(response, finalResponse)
      return finalResponse
  }
  
  // Item doesn't exist or different variant - insert new item
  const { error: insertError } = await supabase
    .from('cart_items')
    .insert({
        user_id: user.id,
        product_id: productId,
        variant_id: variantId,
        quantity,
      price: finalPrice,
        currency: 'TZS' // Security: Always use TZS, never trust client-provided currency
    })
  
  if (insertError) {
    logger.error('Failed to insert cart item:', insertError)
      return NextResponse.json({ error: 'Failed to add item to cart' }, { status: 500 })
  }
  
  logger.log('✅ Added new cart item:', { productId, variantId, quantity })

  // SECURITY: Only send supplier display names, never UUIDs
  logger.log('🛒 [CART POST] ========== SENDING RESPONSE (NEW ITEM) ==========', {
    productId,
    supplierCompanyName,
    supplierIsVerified,
    supplierLocation,
    supplierRegion
  })

  const finalResponse = NextResponse.json({ 
    success: true, 
    message: 'Item added to cart successfully',
    supplierCompanyName: supplierCompanyName || null,
    supplierIsVerified: supplierIsVerified || false,
    supplierLocation: supplierLocation || null,
    supplierRegion: supplierRegion || null,
    supplierNation: supplierNation || null
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

  const { itemId, productId, quantity } = await request.json()
  if ((!itemId && !productId) || quantity == null || quantity < 0) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  if (quantity === 0) {
    // Remove ALL cart items for this product (including all variants)
    const deleteQuery = supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id)
    
    if (productId) {
      // Delete all variants of the product
      deleteQuery.eq('product_id', productId)
    } else {
      // Delete specific cart item (legacy support)
      deleteQuery.eq('id', itemId)
    }
    
    const { error: delErr } = await deleteQuery

    if (delErr) {
      return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 })
    }
  } else {
    // Security: Update quantity with user ownership validation
    const { error: updErr } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', itemId)
      .eq('user_id', user.id) // Security: Ensure user owns the cart item

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
  // Security: Rate limiting
  const rateLimitCheck = enhancedRateLimit(request)
  if (!rateLimitCheck.allowed) {
    logSecurityEvent('Rate limit exceeded on cart DELETE', { 
      ip: request.headers.get('x-forwarded-for') || 'unknown' 
    }, request)
    return NextResponse.json({ 
      error: rateLimitCheck.reason || 'Rate limit exceeded',
      retryAfter: rateLimitCheck.retryAfter 
    }, { 
      status: 429,
      headers: {
        'Retry-After': rateLimitCheck.retryAfter?.toString() || '60'
      }
    })
  }

  const { user, error: authError, response, supabase } = await validateAuth(request)
  
  if (authError || !user) {
    logSecurityEvent('Unauthorized cart DELETE attempt', { 
      error: authError 
    }, request)
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
