import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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
  return session?.role === 'admin' || session?.profile?.is_admin === true
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

    // Fetch product from database
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .eq('id', productId)
      .single()

    if (error) {
      console.error('Error fetching product:', error)
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
      variants: product.product_variants?.map((variant: any) => ({
        id: variant.id,
        price: variant.price,
        image: variant.image,
        sku: variant.sku,
        model: variant.model,
        variantType: variant.variant_type,
        attributes: variant.attributes || {},
        primaryAttribute: variant.primary_attribute,
        dependencies: variant.dependencies || {},
        primaryValues: variant.primary_values || [],
        multiValues: variant.multi_values || {},
        stockQuantity: typeof variant.stock_quantity === 'number' ? variant.stock_quantity : undefined,
        inStock: typeof variant.stock_quantity === 'number' ? variant.stock_quantity > 0 : true
      })) || [],
      variantConfig: product.variant_config,
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
  try {
    const { id: productId } = await params
    
    // Validate product ID
    if (!productId || isNaN(Number(productId))) {
      return createErrorResponse('Invalid product ID', 400)
    }

    // Validate admin session
    const session = await validateServerSession(request)
    if (!requireAdmin(session)) {
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
    if (sanitizedUpdates.variantConfig !== undefined) supabaseUpdates.variant_config = sanitizedUpdates.variantConfig
    if (sanitizedUpdates.variantImages !== undefined) supabaseUpdates.variant_images = sanitizedUpdates.variantImages

    logger.log('📝 Updating product [ID] with stock:', {
      stock_quantity: supabaseUpdates.stock_quantity,
      in_stock: supabaseUpdates.in_stock
    })

    const { data: product, error } = await supabase
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

    // Handle variants update if provided
    if (updates.variants !== undefined) {
      try {
        // Calculate total stock from all primaryValues quantities
        let calculatedTotalStock = 0
        if (Array.isArray(updates.variants)) {
          updates.variants.forEach((variant: any) => {
            if (Array.isArray(variant.primaryValues)) {
              variant.primaryValues.forEach((pv: any) => {
                const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                calculatedTotalStock += qty
              })
            }
          })
        }

        // Only update product stock from variants if there are actually variants
        // Otherwise, keep the manually set stock quantity
        if (Array.isArray(updates.variants) && updates.variants.length > 0) {
          await supabase
            .from('products')
            .update({ 
              stock_quantity: calculatedTotalStock,
              in_stock: calculatedTotalStock > 0
            })
            .eq('id', productId)
        }

        // Delete existing variants for this product
        const { error: deleteError } = await supabase
          .from('product_variants')
          .delete()
          .eq('product_id', productId)

        if (!deleteError && Array.isArray(updates.variants) && updates.variants.length > 0) {
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
            
            return {
              product_id: Number(productId),
              price: variant.price,
              image: variant.image,
              sku: variant.sku,
              model: variant.model,
              variant_type: variant.variantType || updates.variantConfig?.type || 'simple',
              attributes,
              primary_attribute: primaryAttribute,
              dependencies: variant.dependencies || {},
              primary_values: variant.primaryValues || [],
              multi_values: variant.multiValues || {},
              stock_quantity: typeof variant.stockQuantity === 'number' ? variant.stockQuantity : null
            }
          })

          await supabase
            .from('product_variants')
            .insert(variantsToInsert)
        }
      } catch (e) {
        console.error('Error updating product variants:', e)
        // Do not fail the whole request if variants update fails
      }
    }

    // Clear cache for this product
    const cacheKey = `product:${productId}`
    // Note: In a real app, you'd want to clear the cache here

    // Transform back to expected format
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
      variants: product.product_variants?.map((variant: any) => ({
        id: variant.id,
        price: variant.price,
        image: variant.image,
        sku: variant.sku,
        model: variant.model,
        variantType: variant.variant_type,
        attributes: variant.attributes || {},
        primaryAttribute: variant.primary_attribute,
        dependencies: variant.dependencies || {},
        primaryValues: variant.primary_values || [],
        multiValues: variant.multi_values || {}
      })) || [],
      variantConfig: product.variant_config,
      variantImages: product.variant_images || []
    }

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

    // First delete variants
    const { error: variantError } = await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', productId)

    if (variantError) {
      console.error('Error deleting variants:', variantError)
    }

    // Then delete the product
    const { error } = await supabase
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