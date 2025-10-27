import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { validateServerSession } from '@/lib/security-server'
import { createSecureResponse, createErrorResponse } from '@/lib/secure-api'
import { securityUtils } from '@/lib/secure-config'
import { logger } from '@/lib/logger'
import { getCachedData, setCachedData, CACHE_TTL } from '@/lib/database-optimization'

// Simple security functions
const logSecurityEvent = (action: string, userId?: string, details?: any) => {
  logger.log(`Security Event: ${action} by user ${userId}`, details)
}

const requireAdmin = (session: any) => {
  console.log('🔍 [DEBUG] requireAdmin: Checking session:', {
    hasSession: !!session,
    role: session?.role,
    profileIsAdmin: session?.profile?.is_admin,
    roleCheck: session?.role === 'admin',
    profileCheck: session?.profile?.is_admin === true
  })
  
  const isAdmin = session?.role === 'admin' || session?.profile?.is_admin === true
  console.log('🔍 [DEBUG] requireAdmin: Result:', isAdmin)
  
  return isAdmin
}

// GET - Fetch single product by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    
    // Validate and sanitize product ID
    if (!productId || isNaN(Number(productId))) {
      return createErrorResponse('Invalid product ID', 400)
    }

    // Sanitize product ID to prevent injection
    const sanitizedProductId = securityUtils.sanitizeInput(productId)
    if (sanitizedProductId !== productId) {
      return createErrorResponse('Invalid product ID format', 400)
    }

    // Rate limiting check for GET requests
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimitKey = `get_product:${clientIP}`
    
    // Log request for monitoring
    logger.log(`Product detail request: ID=${productId}, IP=${clientIP}, User-Agent=${request.headers.get('user-agent')}`)

    // Generate cache key
    const cacheKey = `product:${productId}`
    
    // Check cache first
    const cachedProduct = getCachedData(cacheKey)
    if (cachedProduct) {
      return createSecureResponse(cachedProduct, {
        cacheControl: 'public, s-maxage=1800, stale-while-revalidate=3600',
        headers: {
          'X-Cache': 'HIT',
          'X-Product-ID': productId
        }
      })
    }

    // Fetch product from database using public client for GET requests
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const publicClient = createClient(supabaseUrl, supabaseAnonKey)
    
    const { data: product, error } = await publicClient
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .eq('id', productId)
      .single()

    if (error) {
      return createErrorResponse('Product not found', 404)
    }

    if (!product) {
      return createErrorResponse('Product not found', 404)
    }

    // Transform data
    const transformedProduct = {
      id: product.id,
      name: product.name,
      originalPrice: product.original_price,
      price: product.price,
      rating: product.rating,
      reviews: product.reviews,
      image: product.image,
      category: product.category,
      brand: product.brand,
      description: product.description,
      specifications: product.specifications || {},
      gallery: product.gallery || [],
      sku: product.sku,
      model: product.model,
      views: product.views,
      video: product.video,
      view360: product.view360,
      inStock: product.in_stock,
      stockQuantity: product.stock_quantity,
      freeDelivery: product.free_delivery,
      sameDayDelivery: product.same_day_delivery,
      importChina: !!(product as any).import_china,
      variants: product.product_variants?.map((variant: any) => {
        const attributes = variant.attributes || {}
        const quantities = variant.stock_quantities || {}
        
        // Clean attributes by removing any remaining _quantity fields
        const cleanAttributes = { ...attributes }
        Object.keys(cleanAttributes).forEach(key => {
          if (key.endsWith('_quantity') || key === '_quantities') {
            delete cleanAttributes[key]
          }
        })
        
        // Keep arrays as arrays for product detail page - don't convert to comma-separated
        const displayAttributes = { ...cleanAttributes }

        return {
          id: variant.id,
          price: variant.price,
          image: variant.image,
          sku: variant.sku,
          model: variant.model,
          variantType: variant.variant_type,
          attributes: displayAttributes,
          quantities: quantities,
          primaryAttribute: variant.primary_attribute,
          dependencies: variant.dependencies || {},
          primaryValues: variant.primary_values || [],
          stockQuantity: typeof variant.stock_quantity === 'number' ? variant.stock_quantity : undefined,
          inStock: typeof variant.stock_quantity === 'number' ? variant.stock_quantity > 0 : true
        }
      }) || [],
      variantConfig: (() => {
        const config = product.variant_config || {}
        if (config.attributeOrder) {
          // Clean attributeOrder by removing technical fields
          config.attributeOrder = config.attributeOrder.filter((attr: string) => 
            !attr.endsWith('_quantity') && 
            attr !== '_quantities' && 
            attr !== 'quantities' &&
            !attr.startsWith('_')
          )
        }
        if (config.primaryAttributes) {
          // Clean primaryAttributes by removing technical fields
          config.primaryAttributes = config.primaryAttributes.filter((attr: string) => 
            !attr.endsWith('_quantity') && 
            attr !== '_quantities' && 
            attr !== 'quantities' &&
            !attr.startsWith('_')
          )
        }
        return config
      })(),
      variantImages: product.variant_images || []
    }

    // Cache the result with longer TTL for product details
    setCachedData(cacheKey, transformedProduct, CACHE_TTL.PRODUCT_DETAIL)

    return createSecureResponse(transformedProduct, {
      cacheControl: 'public, s-maxage=1800, stale-while-revalidate=3600',
      headers: {
        'X-Cache': 'MISS',
        'X-Product-ID': productId
      }
    })

  } catch (error) {
    console.error('Error fetching product:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// PUT - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('🚨 [CRITICAL DEBUG] PUT method called for products/[id]!')
  console.log('🚨 [CRITICAL DEBUG] Request URL:', request.url)
  console.log('🚨 [CRITICAL DEBUG] Request method:', request.method)
  
  try {
    const { id: productId } = await params
    console.log('🚨 [CRITICAL DEBUG] Product ID:', productId)
    
    // Validate product ID
    if (!productId || isNaN(Number(productId))) {
      return createErrorResponse('Invalid product ID', 400)
    }

    // Validate admin session
    console.log('🔍 [DEBUG] Starting session validation...')
    console.log('🔍 [DEBUG] Request headers:', {
      authorization: request.headers.get('authorization'),
      cookie: request.headers.get('cookie')?.substring(0, 100) + '...',
      userAgent: request.headers.get('user-agent')?.substring(0, 50)
    })
    
    const session = await validateServerSession(request)
    console.log('🔍 [DEBUG] Session validation result:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      role: session?.role,
      profileIsAdmin: session?.profile?.is_admin,
      profileId: session?.profile?.id
    })
    
    const isAdmin = requireAdmin(session)
    console.log('🔍 [DEBUG] Admin check result:', {
      isAdmin,
      roleCheck: session?.role === 'admin',
      profileCheck: session?.profile?.is_admin === true
    })
    
    if (!isAdmin) {
      console.log('❌ [DEBUG] Admin access denied!')
      logSecurityEvent('Unauthorized product update attempt', session?.id)
      return createErrorResponse('Unauthorized', 401)
    }
    
    console.log('✅ [DEBUG] Admin access granted!')

    const updates = await request.json()
    
    console.log('🚀 PUT Product [ID] method called!')
    console.log('🔍 RAW PUT Request Body:', JSON.stringify(updates, null, 2))
    
    logger.log('🔍 PUT Product [ID] Data Received:', {
      id: productId,
      stockQuantity: updates.stockQuantity,
      inStock: updates.inStock,
      variantsLength: updates.variants?.length || 0
    })
    
    // Validate request body
    if (!updates || typeof updates !== 'object') {
      return createErrorResponse('Invalid request body', 400)
    }
    
    // Sanitize input data
    const sanitizedUpdates = {
      ...updates,
      name: updates.name ? securityUtils.sanitizeInput(updates.name) : updates.name,
      description: updates.description ? securityUtils.sanitizeInput(updates.description) : updates.description,
      category: updates.category ? securityUtils.sanitizeInput(updates.category) : updates.category,
      brand: updates.brand ? securityUtils.sanitizeInput(updates.brand) : updates.brand,
    }

    // Transform updates for Supabase
    const supabaseUpdates: any = {}
    if (sanitizedUpdates.name !== undefined) supabaseUpdates.name = sanitizedUpdates.name
    if (sanitizedUpdates.originalPrice !== undefined) supabaseUpdates.original_price = sanitizedUpdates.originalPrice
    if (sanitizedUpdates.price !== undefined) supabaseUpdates.price = sanitizedUpdates.price
    if (sanitizedUpdates.rating !== undefined) supabaseUpdates.rating = sanitizedUpdates.rating
    if (sanitizedUpdates.reviews !== undefined) supabaseUpdates.reviews = sanitizedUpdates.reviews
    if (sanitizedUpdates.image !== undefined) supabaseUpdates.image = sanitizedUpdates.image
    if (sanitizedUpdates.category !== undefined) supabaseUpdates.category = sanitizedUpdates.category
    if (sanitizedUpdates.brand !== undefined) supabaseUpdates.brand = sanitizedUpdates.brand
    if (sanitizedUpdates.description !== undefined) supabaseUpdates.description = sanitizedUpdates.description
    if (sanitizedUpdates.specifications !== undefined) supabaseUpdates.specifications = sanitizedUpdates.specifications
    if (sanitizedUpdates.gallery !== undefined) supabaseUpdates.gallery = sanitizedUpdates.gallery
    if (sanitizedUpdates.sku !== undefined) supabaseUpdates.sku = sanitizedUpdates.sku
    if (sanitizedUpdates.model !== undefined) supabaseUpdates.model = sanitizedUpdates.model
    if (sanitizedUpdates.views !== undefined) supabaseUpdates.views = sanitizedUpdates.views
    if (sanitizedUpdates.video !== undefined) supabaseUpdates.video = sanitizedUpdates.video
    if (sanitizedUpdates.view360 !== undefined) supabaseUpdates.view360 = sanitizedUpdates.view360
    if (sanitizedUpdates.inStock !== undefined) supabaseUpdates.in_stock = sanitizedUpdates.inStock
    if (sanitizedUpdates.stockQuantity !== undefined) supabaseUpdates.stock_quantity = sanitizedUpdates.stockQuantity
    if (sanitizedUpdates.freeDelivery !== undefined) supabaseUpdates.free_delivery = sanitizedUpdates.freeDelivery
    if (sanitizedUpdates.sameDayDelivery !== undefined) supabaseUpdates.same_day_delivery = sanitizedUpdates.sameDayDelivery
    if (sanitizedUpdates.importChina !== undefined) supabaseUpdates.import_china = sanitizedUpdates.importChina
    if (sanitizedUpdates.variantConfig !== undefined) supabaseUpdates.variant_config = sanitizedUpdates.variantConfig
    if (sanitizedUpdates.variantImages !== undefined) supabaseUpdates.variant_images = sanitizedUpdates.variantImages

    console.log('🔍 [DEBUG] Supabase Updates Object:', JSON.stringify(supabaseUpdates, null, 2))
    console.log('🔍 [DEBUG] Stock quantity being sent:', supabaseUpdates.stock_quantity)
    console.log('🔍 [DEBUG] In stock being sent:', supabaseUpdates.in_stock)
    
    logger.log('📝 Updating product [ID] with stock:', {
      stock_quantity: supabaseUpdates.stock_quantity,
      in_stock: supabaseUpdates.in_stock
    })

    const adminClient = createAdminSupabaseClient()
    const { data: product, error } = await adminClient
      .from('products')
      .update(supabaseUpdates)
      .eq('id', productId)
      .select(`
        *,
        product_variants (*)
      `)
      .single()

    if (error) {
      console.error('❌ Error updating product in database:', error)
      logger.error('Database update failed:', {
        productId,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        updates: Object.keys(supabaseUpdates)
      })
      return createErrorResponse(`Failed to update product: ${error.message}`, 500)
    }

    if (!product) {
      return createErrorResponse('Product not found', 404)
    }

    console.log('✅ [DEBUG] Product updated successfully in database!')
    console.log('🔍 [DEBUG] Updated product stock_quantity:', product.stock_quantity)
    console.log('🔍 [DEBUG] Updated product in_stock:', product.in_stock)
    console.log('🔍 [DEBUG] Full updated product:', JSON.stringify({
      id: product.id,
      name: product.name,
      stock_quantity: product.stock_quantity,
      in_stock: product.in_stock
    }, null, 2))

    // Handle variants update if provided
    console.log('🔍 [DEBUG] Checking if variants update is needed:', {
      hasVariants: updates.variants !== undefined,
      variantsLength: Array.isArray(updates.variants) ? updates.variants.length : 'not array',
      variants: updates.variants
    })
    
    // Handle variants update if provided
    console.log('🔍 [DEBUG] Processing variants update...')
    
    if (updates.variants !== undefined) {
      console.log('🔍 [DEBUG] Processing variants update...')
      try {
        // Calculate total stock from all primaryValues and multiValues quantities
        let calculatedTotalStock = 0
        if (Array.isArray(updates.variants)) {
          updates.variants.forEach((variant: any, variantIndex: number) => {
            console.log(`🔍 [DEBUG] Processing variant ${variantIndex}:`, {
              id: variant.id,
              primaryValues: variant.primaryValues,
              multiValues: variant.multiValues,
              attributes: variant.attributes
            })
            
            // Check primaryValues quantities
            if (Array.isArray(variant.primaryValues)) {
              variant.primaryValues.forEach((pv: any, pvIndex: number) => {
                const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                console.log(`🔍 [DEBUG] PrimaryValue ${pvIndex} quantity:`, qty)
                calculatedTotalStock += qty
              })
            }
            
            // Check multiValues quantities
            if (variant.multiValues && typeof variant.multiValues === 'object') {
              console.log(`🔍 [DEBUG] Checking multiValues keys:`, Object.keys(variant.multiValues))
              Object.keys(variant.multiValues).forEach(key => {
                console.log(`🔍 [DEBUG] Checking key: ${key}, ends with _quantity: ${key.endsWith('_quantity')}`)
                if (key.endsWith('_quantity')) {
                  const qty = parseInt(variant.multiValues[key]) || 0
                  console.log(`🔍 [DEBUG] MultiValue ${key} quantity:`, qty)
                  calculatedTotalStock += qty
                }
              })
            }
            
            // Check stock_quantities object
            if (variant.quantities && typeof variant.quantities === 'object') {
              Object.keys(variant.quantities).forEach(key => {
                const qty = parseInt(variant.quantities[key]) || 0
                console.log(`🔍 [DEBUG] Stock Quantity ${key}:`, qty)
                calculatedTotalStock += qty
              })
            }
          })
        }
        
        console.log('🔍 [DEBUG] Calculated total stock from variants:', calculatedTotalStock)

        // Delete existing variants for this product
        console.log('🔍 [DEBUG] Deleting existing variants...')
        const { error: deleteError } = await adminClient
          .from('product_variants')
          .delete()
          .eq('product_id', productId)

        if (deleteError) {
          console.error('❌ [DEBUG] Error deleting variants:', deleteError)
        } else {
          console.log('✅ [DEBUG] Variants deleted successfully')
        }

        if (!deleteError && Array.isArray(updates.variants) && updates.variants.length > 0) {
          console.log('🔍 [DEBUG] Inserting new variants...')
          const variantsToInsert = updates.variants.map((variant: any) => {
            // If variant has primaryValues, derive primary_attribute and clear attributes
            let primaryAttribute = variant.primaryAttribute
            let attributes = variant.attributes || {}
            
            if (Array.isArray(variant.primaryValues) && variant.primaryValues.length > 0) {
              // Extract primary attribute from first primaryValue if not set
              if (!primaryAttribute && variant.primaryValues[0]?.attribute) {
                primaryAttribute = variant.primaryValues[0].attribute
              }
              // Clear attributes when using primaryValues
              attributes = {}
            }
            
            // Calculate stock quantity for this variant
            let variantStockQuantity = 0
            
            // Check primaryValues quantities
            if (Array.isArray(variant.primaryValues)) {
              variant.primaryValues.forEach((pv: any) => {
                const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                variantStockQuantity += qty
              })
            }
            
            // Check multiValues quantities
            if (variant.multiValues && typeof variant.multiValues === 'object') {
              Object.keys(variant.multiValues).forEach(key => {
                if (key.endsWith('_quantity')) {
                  const qty = parseInt(variant.multiValues[key]) || 0
                  variantStockQuantity += qty
                }
              })
            }
            
            // Check stock_quantities object
            if (variant.quantities && typeof variant.quantities === 'object') {
              Object.keys(variant.quantities).forEach(key => {
                const qty = parseInt(variant.quantities[key]) || 0
                variantStockQuantity += qty
              })
            }
            
            console.log(`🔍 [DEBUG] Variant calculated stock:`, variantStockQuantity)

            // Clean attributes by removing old _quantity fields
            const cleanAttributes = { ...attributes }
            Object.keys(cleanAttributes).forEach(key => {
              if (key.endsWith('_quantity')) {
                delete cleanAttributes[key]
              }
            })

            return {
              product_id: Number(productId),
              price: variant.price,
              image: variant.image,
              sku: variant.sku,
              model: variant.model,
              variant_type: variant.variantType || updates.variantConfig?.type || 'simple',
              attributes: cleanAttributes,
              primary_attribute: primaryAttribute,
              dependencies: variant.dependencies || {},
              primary_values: variant.primaryValues || [],
              stock_quantities: variant.quantities || {},
              stock_quantity: variantStockQuantity,
              in_stock: variantStockQuantity > 0
            }
          })

          const { data: insertResult, error: insertError } = await adminClient
            .from('product_variants')
            .insert(variantsToInsert)
            .select()
            
          if (insertError) {
            console.error('❌ [DEBUG] Error inserting variants:', insertError)
          } else {
            console.log('✅ [DEBUG] Variants inserted successfully:', insertResult)
          }
        }
        
        // NOW update the main products table with the calculated stock from variants
        if (Array.isArray(updates.variants) && updates.variants.length > 0) {
          console.log('🔍 [DEBUG] Updating main products table with calculated stock:', {
            productId,
            calculatedTotalStock,
            inStock: calculatedTotalStock > 0
          })
          
          const { data: updateResult, error: updateError } = await adminClient
            .from('products')
            .update({ 
              stock_quantity: calculatedTotalStock,
              in_stock: calculatedTotalStock > 0
            })
            .eq('id', productId)
            .select('stock_quantity, in_stock')
            .single()
            
          if (updateError) {
            console.error('❌ [DEBUG] Error updating main products table:', updateError)
            console.error('❌ [DEBUG] Update error details:', {
              message: updateError.message,
              code: updateError.code,
              details: updateError.details,
              hint: updateError.hint
            })
          } else {
            console.log('✅ [DEBUG] Main products table updated successfully:', updateResult)
          }
        }
      } catch (e) {
        console.error('Error updating product variants:', e)
        // Do not fail the whole request if variants update fails
      }
    }

    // Clear cache for this product
    const cacheKey = `product:${productId}`
    // Note: In a real app, you'd want to clear the cache here

    // Get the final updated product data to ensure we have the latest stock values
    console.log('🔍 [DEBUG] Fetching final product data for response...')
    
    // Add a small delay to ensure database has processed all updates
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Create a fresh admin client to avoid caching issues
    const freshAdminClient = createAdminSupabaseClient()
    const { data: finalProduct, error: finalError } = await freshAdminClient
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()
    
    if (finalError) {
      console.error('❌ [DEBUG] Error fetching final product data:', finalError)
    } else {
      console.log('✅ [DEBUG] Final product data:', {
        id: finalProduct.id,
        stock_quantity: finalProduct.stock_quantity,
        in_stock: finalProduct.in_stock
      })
    }
    
    // Use the final product data for the response
    const responseProduct = finalProduct || product

    // Transform back to expected format
    const transformedProduct = {
      id: responseProduct.id,
      name: responseProduct.name,
      originalPrice: responseProduct.original_price,
      price: responseProduct.price,
      rating: responseProduct.rating,
      reviews: responseProduct.reviews,
      image: responseProduct.image,
      category: responseProduct.category,
      brand: responseProduct.brand,
      description: responseProduct.description,
      specifications: responseProduct.specifications || {},
      gallery: responseProduct.gallery || [],
      sku: responseProduct.sku,
      model: responseProduct.model,
      views: responseProduct.views,
      video: responseProduct.video,
      view360: responseProduct.view360,
      inStock: responseProduct.in_stock,
      stockQuantity: responseProduct.stock_quantity,
      freeDelivery: responseProduct.free_delivery,
      sameDayDelivery: responseProduct.same_day_delivery,
      importChina: !!(responseProduct as any).import_china,
      variants: responseProduct.product_variants?.map((variant: any) => {
        const attributes = variant.attributes || {}
        const quantities = variant.stock_quantities || {}
        
        // Clean attributes by removing any remaining _quantity fields
        const cleanAttributes = { ...attributes }
        Object.keys(cleanAttributes).forEach(key => {
          if (key.endsWith('_quantity') || key === '_quantities') {
            delete cleanAttributes[key]
          }
        })
        
        // Keep arrays as arrays for product detail page - don't convert to comma-separated
        const displayAttributes = { ...cleanAttributes }

        return {
          id: variant.id,
          price: variant.price,
          image: variant.image,
          sku: variant.sku,
          model: variant.model,
          variantType: variant.variant_type,
          attributes: displayAttributes,
          quantities: quantities,
          primaryAttribute: variant.primary_attribute,
          dependencies: variant.dependencies || {},
          primaryValues: variant.primary_values || [],
        }
      }) || [],
      variantConfig: (() => {
        const config = responseProduct.variant_config || {}
        if (config.attributeOrder) {
          // Clean attributeOrder by removing technical fields
          config.attributeOrder = config.attributeOrder.filter((attr: string) => 
            !attr.endsWith('_quantity') && 
            attr !== '_quantities' && 
            attr !== 'quantities' &&
            !attr.startsWith('_')
          )
        }
        if (config.primaryAttributes) {
          // Clean primaryAttributes by removing technical fields
          config.primaryAttributes = config.primaryAttributes.filter((attr: string) => 
            !attr.endsWith('_quantity') && 
            attr !== '_quantities' && 
            attr !== 'quantities' &&
            !attr.startsWith('_')
          )
        }
        return config
      })(),
      variantImages: responseProduct.variant_images || []
    }

    console.log('🔍 Final response being sent:', JSON.stringify({
      importChina: transformedProduct.importChina,
      freeDelivery: transformedProduct.freeDelivery,
      sameDayDelivery: transformedProduct.sameDayDelivery,
      id: transformedProduct.id,
      name: transformedProduct.name,
      stockQuantity: transformedProduct.stockQuantity,
      inStock: transformedProduct.inStock
    }, null, 2))

    return createSecureResponse(transformedProduct)

  } catch (error) {
    console.error('Error updating product:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// DELETE - Delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    
    // Validate product ID
    if (!productId || isNaN(Number(productId))) {
      return createErrorResponse('Invalid product ID', 400)
    }

    // Validate admin session
    const session = await validateServerSession(request)
    if (!requireAdmin(session)) {
      logSecurityEvent('Unauthorized product deletion attempt', session?.id)
      return createErrorResponse('Unauthorized', 401)
    }

    const adminClient = createAdminSupabaseClient()
    
    // First delete variants
    const { error: variantError } = await adminClient
      .from('product_variants')
      .delete()
      .eq('product_id', productId)

    if (variantError) {
      console.error('Error deleting variants:', variantError)
    }

    // Then delete the product
    const { error } = await adminClient
      .from('products')
      .delete()
      .eq('id', productId)

    if (error) {
      console.error('Error deleting product:', error)
      return createErrorResponse('Failed to delete product', 500)
    }

    // Clear cache for this product
    const cacheKey = `product:${productId}`
    // Note: In a real app, you'd want to clear the cache here

    return createSecureResponse({ success: true })

  } catch (error) {
    console.error('Error deleting product:', error)
    return createErrorResponse('Internal server error', 500)
  }
} 