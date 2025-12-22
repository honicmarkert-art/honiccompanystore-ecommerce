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
      .eq('is_hidden', false)
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
      category_id: (product as any).category_id,
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

        // Parse primary_values if it's a JSON string
        let primaryValues = variant.primary_values || variant.primaryValues || []
        if (typeof primaryValues === 'string') {
          try {
            primaryValues = JSON.parse(primaryValues)
          } catch (e) {
            console.error('Error parsing primary_values:', e)
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
      })()
    }

    // Cache the result with longer TTL for product details
    setCachedData(cacheKey, transformedProduct, CACHE_TTL.PRODUCT_DETAIL)

    // Check if this is a fresh request (has cache-busting parameter)
    const url = new URL(request.url)
    const isFreshRequest = url.searchParams.has('t') || url.searchParams.has('fresh')
    
    // Use shorter cache for fresh requests to ensure immediate updates
    const cacheControl = isFreshRequest 
      ? 'no-cache, no-store, must-revalidate' 
      : 'public, s-maxage=1800, stale-while-revalidate=3600'

    return createSecureResponse(transformedProduct, {
      cacheControl,
      headers: {
        'X-Cache': 'MISS',
        'X-Product-ID': productId,
        'Cache-Control': cacheControl
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
      userId: session?.id,
      userEmail: session?.email,
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
    if (sanitizedUpdates.variantConfig !== undefined) supabaseUpdates.variant_config = sanitizedUpdates.variantConfig
    // Ignore variantImages on update to prevent unintended additions; handled at upload time

    console.log('🔍 [DEBUG] Supabase Updates Object:', JSON.stringify(supabaseUpdates, null, 2))
    console.log('🔍 [DEBUG] Stock quantity being sent:', supabaseUpdates.stock_quantity)
    console.log('🔍 [DEBUG] In stock being sent:', supabaseUpdates.in_stock)
    
    logger.log('📝 Updating product [ID] with stock:', {
      stock_quantity: supabaseUpdates.stock_quantity,
      in_stock: supabaseUpdates.in_stock
    })

    console.log('🔍 [DEBUG] About to update database with:', JSON.stringify(supabaseUpdates, null, 2))
    
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

    console.log('🔍 [DEBUG] Database update response:', {
      hasProduct: !!product,
      hasError: !!error,
      productId: product?.id,
      productImage: product?.image,
      productName: product?.name
    })

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
    console.log('🔍 [DEBUG] Updated product image:', product.image)
    console.log('🔍 [DEBUG] Updated product stock_quantity:', product.stock_quantity)
    console.log('🔍 [DEBUG] Updated product in_stock:', product.in_stock)
    console.log('🔍 [DEBUG] Full updated product:', JSON.stringify({
      id: product.id,
      name: product.name,
      image: product.image,
      stock_quantity: product.stock_quantity,
      in_stock: product.in_stock
    }, null, 2))

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
          console.error('❌ [DEBUG] Error deleting variants:', deleteError)
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
            console.error('❌ [DEBUG] Error inserting variants:', insertError)
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
            console.error('❌ [DEBUG] Error updating main products table:', updateError)
            console.error('❌ [DEBUG] Update error details:', {
              message: updateError.message,
              code: updateError.code,
              details: updateError.details,
              hint: updateError.hint
            })
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

    console.log('🔍 Final response being sent:', JSON.stringify({
      importChina: transformedProduct.importChina,
      freeDelivery: transformedProduct.freeDelivery,
      sameDayDelivery: transformedProduct.sameDayDelivery,
      id: transformedProduct.id,
      name: transformedProduct.name,
      image: transformedProduct.image,
      stockQuantity: transformedProduct.stockQuantity,
      inStock: transformedProduct.inStock,
      variantsCount: transformedProduct.variants?.length || 0,
      variants: transformedProduct.variants
    }, null, 2))

    console.log('🔍 [DEBUG] About to send response. Image value:', transformedProduct.image)
    
    const response = createSecureResponse(transformedProduct)
    
    console.log('🔍 [DEBUG] Response created. Status:', response.status)
    
    return response

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
    
    console.log('🗑️ [DEBUG] Starting product deletion for ID:', productId)
    
    // First, get the product to delete its images
    const { data: productToDelete, error: fetchError } = await adminClient
      .from('products')
      .select('image, gallery')
      .eq('id', productId)
      .single()
    
    if (productToDelete) {
      console.log('🔍 [DEBUG] Product found, preparing to delete images...')
      
      // Delete main image from storage
      if (productToDelete.image) {
        console.log('🗑️ [DEBUG] Deleting main image:', productToDelete.image)
        const imageFileName = productToDelete.image.split('/').pop()
        if (imageFileName) {
          const { error: imageDeleteError } = await adminClient.storage
            .from('product-images')
            .remove([imageFileName])
          
          if (imageDeleteError) {
            console.error('⚠️ [DEBUG] Failed to delete main image:', imageDeleteError)
          } else {
            console.log('✅ [DEBUG] Main image deleted successfully')
          }
        }
      }
      
      // Delete gallery images from storage
      if (productToDelete.gallery && Array.isArray(productToDelete.gallery) && productToDelete.gallery.length > 0) {
        console.log('🗑️ [DEBUG] Deleting gallery images:', productToDelete.gallery.length, 'images')
        const galleryFileNames = productToDelete.gallery.map((url: string) => url.split('/').pop()).filter((name): name is string => Boolean(name))
        
        if (galleryFileNames.length > 0) {
          const { error: galleryDeleteError } = await adminClient.storage
            .from('product-images')
            .remove(galleryFileNames)
          
          if (galleryDeleteError) {
            console.error('⚠️ [DEBUG] Failed to delete gallery images:', galleryDeleteError)
          } else {
            console.log('✅ [DEBUG] Gallery images deleted successfully:', galleryFileNames.length, 'images')
          }
        }
      }
    }
    
    // Delete variants
    console.log('🗑️ [DEBUG] Deleting product variants...')
    const { error: variantError } = await adminClient
      .from('product_variants')
      .delete()
      .eq('product_id', productId)

    if (variantError) {
      console.error('⚠️ [DEBUG] Error deleting variants:', variantError)
    } else {
      console.log('✅ [DEBUG] Variants deleted successfully')
    }

    // Delete the product
    console.log('🗑️ [DEBUG] Deleting product from database...')
    const { error } = await adminClient
      .from('products')
      .delete()
      .eq('id', productId)

    if (error) {
      console.error('❌ [DEBUG] Error deleting product:', error)
      return createErrorResponse('Failed to delete product', 500)
    }
    
    console.log('✅ [DEBUG] Product deleted successfully from database')

    // Clear cache for this product
    const cacheKey = `product:${productId}`
    console.log('🗑️ [DEBUG] Cache cleared for product:', productId)

    return createSecureResponse({ success: true })

  } catch (error) {
    console.error('Error deleting product:', error)
    return createErrorResponse('Internal server error', 500)
  }
} 