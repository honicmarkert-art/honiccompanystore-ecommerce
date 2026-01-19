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
  const isAdmin = session?.role === 'admin' || session?.profile?.is_admin === true
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
    
    // Fetch product from database - use maybeSingle to handle 0 results gracefully
    const { data: product, error } = await publicClient
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .eq('id', productId)
      .eq('is_hidden', false)
      .maybeSingle() // Use maybeSingle instead of single to handle 0 results gracefully

    console.log(`🔍 [API] Product ${productId} fetched from DB:`, {
      found: !!product,
      error: error?.message,
      errorCode: error?.code,
      errorDetails: error?.details,
      errorHint: error?.hint,
      hasDescription: !!product?.description,
      descriptionLength: product?.description?.length || 0,
      hasSpecifications: !!product?.specifications,
      specificationsType: typeof product?.specifications,
      specificationsValue: product?.specifications ? (typeof product.specifications === 'string' ? product.specifications.substring(0, 100) : 'object') : 'null',
      isHidden: product?.is_hidden
    })

    if (error) {
      console.log(`❌ [API] Product ${productId} DB error:`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return createErrorResponse('Product not found', 404)
    }

    if (!product) {
      console.log(`❌ [API] Product ${productId} not found in DB`)
      return createErrorResponse('Product not found', 404)
    }

    // Check if product is hidden (optional - you might want to allow hidden products for admins)
    if (product.is_hidden) {
      console.log(`⚠️ [API] Product ${productId} is hidden`)
      // Uncomment if you want to block hidden products:
      // return createErrorResponse('Product not found', 404)
    }

    // Transform data
    // Parse specifications if it's a JSON string
    let parsedSpecifications = {}
    if (product.specifications) {
      if (typeof product.specifications === 'string') {
        try {
          parsedSpecifications = JSON.parse(product.specifications)
          console.log(`✅ [API] Product ${productId} parsed specifications from string:`, {
            keysCount: Object.keys(parsedSpecifications).length,
            sampleKeys: Object.keys(parsedSpecifications).slice(0, 3)
          })
        } catch (e) {
          console.log(`⚠️ [API] Product ${productId} failed to parse specifications:`, e)
          // If parsing fails, try to use as-is or set to empty object
          parsedSpecifications = {}
        }
      } else if (typeof product.specifications === 'object' && product.specifications !== null) {
        parsedSpecifications = product.specifications
        console.log(`✅ [API] Product ${productId} specifications already object:`, {
          keysCount: Object.keys(parsedSpecifications).length
        })
      }
    } else {
      console.log(`⚠️ [API] Product ${productId} has no specifications field`)
    }
    
    const transformedProduct = {
      id: product.id,
      name: product.name,
      originalPrice: product.original_price,
      price: product.price,
      rating: product.rating,
      reviews: product.reviews,
      image: product.image,
      category_id: (product as any).category_id,
      category: product.category,
      brand: product.brand,
      description: product.description,
      specifications: parsedSpecifications,
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

        // Parse primary_values if it's a JSON string
        let primaryValues = variant.primary_values || variant.primaryValues || []
        if (typeof primaryValues === 'string') {
          try {
            primaryValues = JSON.parse(primaryValues)
          } catch (e) {
            primaryValues = []
          }
        }
        // Ensure it's an array
        if (!Array.isArray(primaryValues)) {
          primaryValues = []
        }

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
          primaryValues: primaryValues,
          // Also preserve snake_case for compatibility
          primary_values: primaryValues,
          stockQuantity: typeof variant.stock_quantity === 'number' ? variant.stock_quantity : undefined,
          stock_quantity: typeof variant.stock_quantity === 'number' ? variant.stock_quantity : undefined,
          inStock: typeof variant.stock_quantity === 'number' ? variant.stock_quantity > 0 : true,
          in_stock: typeof variant.stock_quantity === 'number' ? variant.stock_quantity > 0 : true,
          // Include simplified variant fields
          variant_name: variant.variant_name || null
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
      variantImages: (() => {
        const images = product.variant_images || []
        
        
        // Normalize to ensure consistent format
        const normalized = images.map((img: any): { imageUrl: string } => {
          if (typeof img === 'string') {
            return { imageUrl: img }
          } else if (img && typeof img === 'object' && img.imageUrl) {
            return { imageUrl: img.imageUrl }
          }
          return { imageUrl: String(img || '') }
        }).filter((img: { imageUrl: string }) => img.imageUrl)
        
        return normalized
      })(),
      specificationImages: (() => {
        const images = product.specification_images || []
        // Handle JSONB array - ensure it's always an array
        if (typeof images === 'string') {
          try {
            return JSON.parse(images)
          } catch {
            return []
          }
        }
        return Array.isArray(images) ? images : []
      })()
    }

    console.log(`📤 [API] Product ${productId} transformed response:`, {
      hasDescription: !!transformedProduct.description,
      descriptionLength: transformedProduct.description?.length || 0,
      hasSpecifications: !!transformedProduct.specifications,
      specificationsKeysCount: Object.keys(transformedProduct.specifications).length,
      specificationsSample: Object.keys(transformedProduct.specifications).slice(0, 3)
    })

    // Cache the result with longer TTL for product details
    setCachedData(cacheKey, transformedProduct, CACHE_TTL.PRODUCT_DETAIL)

    // Check if this is a fresh request (has cache-busting parameter)
    const url = new URL(request.url)
    const isFreshRequest = url.searchParams.has('t') || url.searchParams.has('fresh')
    
    // CDN caching: 30 min CDN, 15 min browser, 1 hour stale-while-revalidate
    // This enables fast CDN delivery for product details
    return createSecureResponse(transformedProduct, {
      cdnCache: !isFreshRequest, // Enable CDN cache unless fresh request
      browserCache: !isFreshRequest, // Enable browser cache unless fresh request
      headers: {
        'X-Cache': 'MISS',
        'X-Product-ID': productId
      }
    })

  } catch (error: any) {
    // Log error for monitoring and debugging
    logger.error(`[Product Detail API] Error fetching product ${productId}:`, {
      error: error.message,
      stack: error.stack,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    })
    
    // Return generic error message to prevent information disclosure
    return createErrorResponse('Internal server error', 500)
  }
}

// PUT - Update product
export async function PUT(
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
    const isAdmin = requireAdmin(session)
    
    if (!isAdmin) {
      logSecurityEvent('Unauthorized product update attempt', session?.id)
      return createErrorResponse('Unauthorized', 401)
    }

    const updates = await request.json()
    
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
    // Accept category_id (UUID) for relational linkage
    if ((updates as any).category_id !== undefined) (supabaseUpdates as any).category_id = (updates as any).category_id
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
    if (sanitizedUpdates.specificationImages !== undefined) supabaseUpdates.specification_images = sanitizedUpdates.specificationImages
    if ((updates as any).specificationImages !== undefined) supabaseUpdates.specification_images = (updates as any).specificationImages
    if (sanitizedUpdates.variantConfig !== undefined) supabaseUpdates.variant_config = sanitizedUpdates.variantConfig
    // Ignore variantImages on update to prevent unintended additions; handled at upload time

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

    // Handle variants update if provided
    
    if (updates.variants !== undefined) {
      try {
        // Calculate total stock from simplified variants (variant_name, price, stock_quantity)
        let calculatedTotalStock = 0
        if (Array.isArray(updates.variants)) {
          updates.variants.forEach((variant: any) => {
            const qty = typeof variant.stock_quantity === 'number' ? variant.stock_quantity : 
                        (typeof variant.stockQuantity === 'number' ? variant.stockQuantity : 0)
            calculatedTotalStock += qty
          })
        }

        // Fetch existing variants BEFORE delete so we can preserve images
        const { data: existingVariantsBeforeDelete } = await adminClient
          .from('product_variants')
          .select('id, sku, image')
          .eq('product_id', productId)

        // Delete existing variants for this product
        const { error: deleteError } = await adminClient
          .from('product_variants')
          .delete()
          .eq('product_id', productId)

        if (deleteError) {
          // Error deleting variants - continue anyway
        }

        if (!deleteError && Array.isArray(updates.variants) && updates.variants.length > 0) {
          // Preserve existing variant images when client didn't send an image
          const existingById = new Map<string | number, any>()
          const existingBySku = new Map<string, any>()
          ;(existingVariantsBeforeDelete || []).forEach((v: any) => {
            if (v.id !== undefined && v.id !== null) existingById.set(v.id, v)
            if (v.sku) existingBySku.set(String(v.sku), v)
          })

          // Simplified variant system: variant_name, price, stock_quantity
          const variantsToInsert = updates.variants.map((variant: any) => {
            // Get stock quantity from simplified variant
            const variantStockQuantity = typeof variant.stock_quantity === 'number' ? variant.stock_quantity : 
                                        (typeof variant.stockQuantity === 'number' ? variant.stockQuantity : 0)

            // Preserve image if not provided in payload
            const preservedImage = variant.image 
              || (variant.id !== undefined && existingById.get(variant.id)?.image) 
              || (variant.sku ? existingBySku.get(String(variant.sku))?.image : undefined)

            return {
              product_id: Number(productId),
              variant_name: variant.variant_name || null, // Simplified: just variant name
              price: variant.price || updates.price || 0,
              image: preservedImage || null,
              sku: variant.sku || null,
              stock_quantity: variantStockQuantity,
              in_stock: variantStockQuantity > 0
            }
          })

          const { data: insertResult, error: insertError } = await adminClient
            .from('product_variants')
            .insert(variantsToInsert)
            .select()
            
          if (insertError) {
            // Error inserting variants - continue anyway
          }
        }
        
        // NOW update the main products table with the calculated stock from variants
        if (Array.isArray(updates.variants) && updates.variants.length > 0) {
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
            // Error updating main products table - continue anyway
          }
        }
      } catch (e) {
        // Do not fail the whole request if variants update fails
      }
    }

    // Clear cache for this product
    const cacheKey = `product:${productId}`
    // Note: In a real app, you'd want to clear the cache here

    // Get the final updated product data to ensure we have the latest stock values
    // Add a small delay to ensure database has processed all updates
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Create a fresh admin client to avoid caching issues
    const freshAdminClient = createAdminSupabaseClient()
    const { data: finalProduct, error: finalError } = await freshAdminClient
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()
    
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

        const variantData = {
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
        return variantData
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
      variantImages: (() => {
        const images = responseProduct.variant_images || []
        
        
        // Normalize to ensure consistent format
        const normalized = images.map((img: any): { imageUrl: string } => {
          if (typeof img === 'string') {
            return { imageUrl: img }
          } else if (img && typeof img === 'object' && img.imageUrl) {
            return { imageUrl: img.imageUrl }
          }
          return { imageUrl: String(img || '') }
        }).filter((img: { imageUrl: string }) => img.imageUrl)
        
        return normalized
      })()
    }

    const response = createSecureResponse(transformedProduct)
    return response

  } catch (error: any) {
    // Log error for monitoring and debugging
    logger.error(`[Product Detail API] Error updating product ${productId}:`, {
      error: error.message,
      stack: error.stack,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    })
    
    // Return generic error message to prevent information disclosure
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
    
    // First, get the product to delete its images
    const { data: productToDelete, error: fetchError } = await adminClient
      .from('products')
      .select('image, gallery')
      .eq('id', productId)
      .single()
    
    if (productToDelete) {
      // Delete main image from storage
      if (productToDelete.image) {
        const imageFileName = productToDelete.image.split('/').pop()
        if (imageFileName) {
          await adminClient.storage
            .from('product-images')
            .remove([imageFileName])
        }
      }
      
      // Delete gallery images from storage
      if (productToDelete.gallery && Array.isArray(productToDelete.gallery) && productToDelete.gallery.length > 0) {
        const galleryFileNames = productToDelete.gallery.map((url: string) => url.split('/').pop()).filter((name): name is string => Boolean(name))
        
        if (galleryFileNames.length > 0) {
          await adminClient.storage
            .from('product-images')
            .remove(galleryFileNames)
        }
      }
    }
    
    // Delete variants
    await adminClient
      .from('product_variants')
      .delete()
      .eq('product_id', productId)

    // Delete the product
    const { error } = await adminClient
      .from('products')
      .delete()
      .eq('id', productId)

    if (error) {
      return createErrorResponse('Failed to delete product', 500)
    }

    // Clear cache for this product
    const cacheKey = `product:${productId}`

    return createSecureResponse({ success: true })

  } catch (error: any) {
    // Log error for monitoring and debugging
    logger.error(`[Product Detail API] Error updating product ${productId}:`, {
      error: error.message,
      stack: error.stack,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    })
    
    // Return generic error message to prevent information disclosure
    return createErrorResponse('Internal server error', 500)
  }
} 