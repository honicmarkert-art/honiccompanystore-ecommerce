import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import DOMPurify from 'isomorphic-dompurify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Security: Input validation constants (shared with route.ts)
const VALIDATION_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 255,
  DESCRIPTION_MAX: 5000,
  SKU_MAX: 100,
  BRAND_MAX: 100,
  CATEGORY_MAX: 100,
  MODEL_MAX: 100,
  PRICE_MIN: 0,
  PRICE_MAX: 999999999,
  URL_MAX: 2048,
  VARIANTS_MAX: 100,
  SPECIFICATION_IMAGES_MAX: 3
}

// Security: Validate product input data (for updates, some fields are optional)
function validateProductUpdateInput(body: any): { valid: boolean; error?: string } {
  // Name validation (if provided)
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      return { valid: false, error: 'Name must be a string' }
    }
    const name = body.name.trim()
    if (name.length < VALIDATION_LIMITS.NAME_MIN || name.length > VALIDATION_LIMITS.NAME_MAX) {
      return { valid: false, error: `Name must be between ${VALIDATION_LIMITS.NAME_MIN} and ${VALIDATION_LIMITS.NAME_MAX} characters` }
    }
  }

  // Price validation (if provided)
  if (body.price !== undefined && body.price !== null) {
    const price = parseFloat(String(body.price))
    if (isNaN(price) || !isFinite(price)) {
      return { valid: false, error: 'Price must be a valid number' }
    }
    if (price < VALIDATION_LIMITS.PRICE_MIN || price > VALIDATION_LIMITS.PRICE_MAX) {
      return { valid: false, error: `Price must be between ${VALIDATION_LIMITS.PRICE_MIN} and ${VALIDATION_LIMITS.PRICE_MAX}` }
    }
  }

  // Original price validation (if provided)
  if (body.originalPrice !== undefined && body.originalPrice !== null) {
    const originalPrice = parseFloat(String(body.originalPrice))
    if (isNaN(originalPrice) || !isFinite(originalPrice)) {
      return { valid: false, error: 'Original price must be a valid number' }
    }
    if (originalPrice < VALIDATION_LIMITS.PRICE_MIN || originalPrice > VALIDATION_LIMITS.PRICE_MAX) {
      return { valid: false, error: `Original price must be between ${VALIDATION_LIMITS.PRICE_MIN} and ${VALIDATION_LIMITS.PRICE_MAX}` }
    }
    // Check originalPrice >= price if both are provided
    if (body.price !== undefined && originalPrice < parseFloat(String(body.price))) {
      return { valid: false, error: 'Original price must be greater than or equal to price' }
    }
  }

  // Description validation (if provided)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      return { valid: false, error: 'Description must be a string' }
    }
    if (body.description.length > VALIDATION_LIMITS.DESCRIPTION_MAX) {
      return { valid: false, error: `Description must not exceed ${VALIDATION_LIMITS.DESCRIPTION_MAX} characters` }
    }
  }

  // SKU validation (if provided)
  if (body.sku !== undefined && body.sku !== null) {
    if (typeof body.sku !== 'string') {
      return { valid: false, error: 'SKU must be a string' }
    }
    if (body.sku.length > VALIDATION_LIMITS.SKU_MAX) {
      return { valid: false, error: `SKU must not exceed ${VALIDATION_LIMITS.SKU_MAX} characters` }
    }
  }

  // Brand validation (if provided)
  if (body.brand !== undefined && body.brand !== null) {
    if (typeof body.brand !== 'string') {
      return { valid: false, error: 'Brand must be a string' }
    }
    if (body.brand.length > VALIDATION_LIMITS.BRAND_MAX) {
      return { valid: false, error: `Brand must not exceed ${VALIDATION_LIMITS.BRAND_MAX} characters` }
    }
  }

  // Category validation (if provided)
  if (body.category !== undefined && body.category !== null) {
    if (typeof body.category !== 'string') {
      return { valid: false, error: 'Category must be a string' }
    }
    if (body.category.length > VALIDATION_LIMITS.CATEGORY_MAX) {
      return { valid: false, error: `Category must not exceed ${VALIDATION_LIMITS.CATEGORY_MAX} characters` }
    }
  }

  // Model validation (if provided)
  if (body.model !== undefined && body.model !== null) {
    if (typeof body.model !== 'string') {
      return { valid: false, error: 'Model must be a string' }
    }
    if (body.model.length > VALIDATION_LIMITS.MODEL_MAX) {
      return { valid: false, error: `Model must not exceed ${VALIDATION_LIMITS.MODEL_MAX} characters` }
    }
  }

  // URL validation (image, video, view360)
  const urlFields = ['image', 'video', 'view360']
  for (const field of urlFields) {
    if (body[field] !== undefined && body[field] !== null) {
      if (typeof body[field] !== 'string') {
        return { valid: false, error: `${field} must be a string` }
      }
      if (body[field].length > VALIDATION_LIMITS.URL_MAX) {
        return { valid: false, error: `${field} URL must not exceed ${VALIDATION_LIMITS.URL_MAX} characters` }
      }
      // Basic URL format validation (allow relative URLs too)
      if (body[field].startsWith('http://') || body[field].startsWith('https://')) {
        try {
          new URL(body[field])
        } catch {
          return { valid: false, error: `${field} must be a valid URL` }
        }
      }
    }
  }

  // Variants validation (if provided)
  if (body.variants !== undefined) {
    if (!Array.isArray(body.variants)) {
      return { valid: false, error: 'Variants must be an array' }
    }
    if (body.variants.length > VALIDATION_LIMITS.VARIANTS_MAX) {
      return { valid: false, error: `Maximum ${VALIDATION_LIMITS.VARIANTS_MAX} variants allowed` }
    }
    for (let i = 0; i < body.variants.length; i++) {
      const variant = body.variants[i]
      if (variant.price !== undefined) {
        const variantPrice = parseFloat(String(variant.price))
        if (isNaN(variantPrice) || !isFinite(variantPrice) || variantPrice < 0) {
          return { valid: false, error: `Variant ${i + 1} price must be a valid positive number` }
        }
      }
      if (variant.stock_quantity !== undefined || variant.stockQuantity !== undefined) {
        const qty = variant.stock_quantity || variant.stockQuantity
        const parsedQty = parseInt(String(qty))
        if (isNaN(parsedQty) || parsedQty < 0) {
          return { valid: false, error: `Variant ${i + 1} stock quantity must be a valid non-negative integer` }
        }
      }
    }
  }

  // Stock quantity validation (if provided)
  if (body.stockQuantity !== undefined && body.stockQuantity !== null) {
    const stockQty = parseInt(String(body.stockQuantity))
    if (isNaN(stockQty) || stockQty < 0) {
      return { valid: false, error: 'Stock quantity must be a valid non-negative integer' }
    }
  }

  // Specification images validation (if provided)
  if (body.specificationImages !== undefined) {
    if (!Array.isArray(body.specificationImages)) {
      return { valid: false, error: 'Specification images must be an array' }
    }
    if (body.specificationImages.length > VALIDATION_LIMITS.SPECIFICATION_IMAGES_MAX) {
      return { valid: false, error: `Maximum ${VALIDATION_LIMITS.SPECIFICATION_IMAGES_MAX} specification images allowed` }
    }
    // Validate each image URL
    for (let i = 0; i < body.specificationImages.length; i++) {
      const img = body.specificationImages[i]
      if (typeof img !== 'string') {
        return { valid: false, error: `Specification image ${i + 1} must be a valid URL string` }
      }
      if (img.length > VALIDATION_LIMITS.URL_MAX) {
        return { valid: false, error: `Specification image ${i + 1} URL must not exceed ${VALIDATION_LIMITS.URL_MAX} characters` }
      }
    }
  }

  return { valid: true }
}

// GET - Get a single product (only if it belongs to the supplier)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params before using
    const { id } = await params
    
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/supplier/products/[id]',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { success: false, error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_supplier, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_supplier && !profile?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Fetch product with variants
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .eq('id', id)
      .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`) // Ensure product belongs to supplier/user
      .single()

    if (error || !product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Transform variants to match expected format (simplified structure)
    const transformedProduct = {
      ...product,
      variants: product.product_variants?.map((v: any) => ({
        id: v.id,
        variant_name: v.variant_name || '',
        price: v.price,
        stock_quantity: v.stock_quantity || 0,
        stockQuantity: v.stock_quantity || 0, // Backward compatibility
        sku: v.sku || null,
        image: v.image || null
      })) || [],
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
      specificationImages: product.specification_images || []
    }

    // Remove the raw product_variants array
    delete transformedProduct.product_variants

    return NextResponse.json({
      success: true,
      product: transformedProduct
    })

  } catch (error) {
    console.error('Supplier product GET error:', error)
    // Security: Sanitize error messages in production
    const isProduction = process.env.NODE_ENV === 'production'
    const errorMessage = isProduction 
      ? 'An unexpected error occurred' 
      : (error instanceof Error ? error.message : 'An unexpected error occurred')
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// PUT - Update a product (only if it belongs to the supplier)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params before using
    const { id } = await params
    
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/supplier/products/[id]',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { success: false, error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_supplier, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_supplier && !profile?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Verify product belongs to supplier/user
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id, supplier_id, user_id')
      .eq('id', id)
      .single()

    if (!existingProduct || (existingProduct.supplier_id !== user.id && existingProduct.user_id !== user.id)) {
      return NextResponse.json(
        { success: false, error: 'Product not found or access denied' },
        { status: 404 }
      )
    }

    const body = await request.json()
    
    // Security: Comprehensive input validation
    const validation = validateProductUpdateInput(body)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    // Extract only the fields we need
    const {
      name,
      description,
      category,
      brand,
      price,
      originalPrice,
      image,
      sku,
      model,
      inStock,
      stockQuantity,
      specifications,
      variants,
      video,
      view360,
      importChina,
      variantConfig,
      variantImages,
      specificationImages,
      ...rest // Ignore any other unexpected fields
    } = body

    // Security: Sanitize HTML in description to prevent XSS
    let sanitizedDescription = description
    if (description !== undefined && description !== null && typeof description === 'string') {
      sanitizedDescription = DOMPurify.sanitize(description, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: []
      })
    }

    // Generate slug from product name if name is being updated
    let productSlug: string | undefined = undefined
    if (name !== undefined) {
      const generateSlug = (text: string): string => {
        return text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
          .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      }
      productSlug = generateSlug(name.trim())
    }

    // Resolve category_id from category name if category is being updated
    let categoryId: string | null | undefined = body.category_id
    if (category !== undefined && !categoryId) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const publicClient = createClient(supabaseUrl, supabaseAnonKey)

      const categoryName = category.trim()
      const categorySlug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

      const { data: cat, error: catError } = await publicClient
        .from('categories')
        .select('id, name, slug')
        .or(`name.eq.${categoryName},slug.eq.${categorySlug}`)
        .maybeSingle()

      if (!catError && cat?.id) {
        categoryId = cat.id
      }
    }

    // Calculate total stock from variants if they exist
    let calculatedStock = stockQuantity ? parseInt(String(stockQuantity)) : null
    if (variants && Array.isArray(variants) && variants.length > 0) {
      calculatedStock = variants.reduce((sum: number, variant: any) => {
        // Simplified variant structure: use stock_quantity or stockQuantity
        const qty = variant.stock_quantity || variant.stockQuantity || 0
        return sum + (typeof qty === 'number' ? qty : parseInt(String(qty)) || 0)
      }, 0)
    }

    // Update product (without variants column)
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) {
      updateData.name = name.trim()
      if (productSlug) updateData.slug = productSlug
    }
    if (sanitizedDescription !== undefined) updateData.description = sanitizedDescription?.trim() || ''
    if (category !== undefined) updateData.category = category?.trim() || ''
    if (categoryId !== undefined) updateData.category_id = categoryId
    if (brand !== undefined) updateData.brand = brand?.trim() || ''
    if (price !== undefined) updateData.price = parseFloat(price)
    if (originalPrice !== undefined) updateData.original_price = originalPrice ? parseFloat(originalPrice) : null
    if (image !== undefined) updateData.image = image?.trim() || ''
    if (sku !== undefined) updateData.sku = sku?.trim() || ''
    // Only include model if it's provided and has a non-empty value
    // Skip model entirely if empty/undefined to avoid errors if column doesn't exist
    if (model !== undefined && model !== null && String(model).trim().length > 0) {
      updateData.model = String(model).trim()
    }
    if (inStock !== undefined) updateData.in_stock = inStock
    if (calculatedStock !== null || stockQuantity !== undefined) {
      updateData.stock_quantity = calculatedStock !== null ? calculatedStock : (stockQuantity ? parseInt(String(stockQuantity)) : null)
    }
    if (specifications !== undefined) updateData.specifications = specifications
    if (variantConfig !== undefined) updateData.variant_config = variantConfig
    if (variantImages !== undefined) updateData.variant_images = variantImages
    if (specificationImages !== undefined) updateData.specification_images = specificationImages
    if (video !== undefined) updateData.video = video?.trim() || ''
    if (view360 !== undefined) updateData.view360 = view360?.trim() || ''
    if (importChina !== undefined) updateData.import_china = importChina
    updateData.user_id = user.id // Ensure user_id is set

    // Update product - use .eq() only since we already verified ownership
    // RLS will handle permission check
    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating product:', error)
      
      // If the error is about a missing column, try updating without that column
      if (error.code === '42703' && error.message?.includes('model')) {
        console.warn('Model column does not exist, retrying update without model field')
        delete updateData.model
        
        const { data: retryProduct, error: retryError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', id)
          .select()
          .maybeSingle()
        
        if (retryError) {
          console.error('Error updating product (retry):', retryError)
          return NextResponse.json(
            { success: false, error: 'Failed to update product: ' + retryError.message },
            { status: 500 }
          )
        }
        
        if (!retryProduct) {
          // Update might have succeeded but RLS blocked the select - fetch separately
          const { data: fetchedProduct } = await supabase
            .from('products')
            .select(`
              *,
              product_variants (*)
            `)
            .eq('id', id)
            .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`)
            .maybeSingle()
          
          if (fetchedProduct) {
            // Update succeeded, use fetched product
            const transformedProduct = {
              ...fetchedProduct,
              variants: fetchedProduct.product_variants?.map((v: any) => ({
                id: v.id,
                variant_name: v.variant_name || '',
                price: v.price,
                stock_quantity: v.stock_quantity || 0,
                stockQuantity: v.stock_quantity || 0,
                sku: v.sku || null,
                image: v.image || null
              })) || [],
              variantImages: fetchedProduct.variant_images || [],
              specificationImages: fetchedProduct.specification_images || []
            }
            
            delete transformedProduct.product_variants
            
            return NextResponse.json({
              success: true,
              product: transformedProduct
            })
          }
          
          return NextResponse.json(
            { success: false, error: 'Product not found or update failed' },
            { status: 404 }
          )
        }
        
        // Fetch complete product with variants
        const { data: finalProduct, error: fetchError } = await supabase
          .from('products')
          .select(`
            *,
            product_variants (*)
          `)
          .eq('id', id)
          .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`)
          .maybeSingle()
        
        if (fetchError || !finalProduct) {
          return NextResponse.json(
            { success: false, error: 'Failed to fetch updated product' },
            { status: 500 }
          )
        }
        
        const transformedProduct = {
          ...finalProduct,
          variants: finalProduct.product_variants?.map((v: any) => ({
            id: v.id,
            variant_name: v.variant_name || '',
            price: v.price,
            stock_quantity: v.stock_quantity || 0,
            stockQuantity: v.stock_quantity || 0,
            sku: v.sku || null,
            image: v.image || null
          })) || [],
          variantImages: finalProduct.variant_images || [],
          specificationImages: finalProduct.specification_images || []
        }
        
        delete transformedProduct.product_variants
        
        return NextResponse.json({
          success: true,
          product: transformedProduct
        })
      } else {
        return NextResponse.json(
          { success: false, error: 'Failed to update product: ' + error.message },
          { status: 500 }
        )
      }
    }

    // If update returned null, check if update actually succeeded by fetching the product
    if (!product) {
      // Update might have succeeded but RLS blocked the select - fetch separately
      const { data: fetchedProduct } = await supabase
        .from('products')
        .select(`
          *,
          product_variants (*)
        `)
        .eq('id', id)
        .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`)
        .maybeSingle()
      
      if (fetchedProduct) {
        // Update succeeded, use fetched product
        const transformedProduct = {
          ...fetchedProduct,
          variants: fetchedProduct.product_variants?.map((v: any) => ({
            id: v.id,
            variant_name: v.variant_name || '',
            price: v.price,
            stock_quantity: v.stock_quantity || 0,
            stockQuantity: v.stock_quantity || 0,
            sku: v.sku || null,
            image: v.image || null
          })) || [],
          variantImages: fetchedProduct.variant_images || [],
          specificationImages: fetchedProduct.specification_images || []
        }
        
        delete transformedProduct.product_variants
        
        return NextResponse.json({
          success: true,
          product: transformedProduct
        })
      }
      
      // Product not found or update failed
      return NextResponse.json(
        { success: false, error: 'Product not found or update failed' },
        { status: 404 }
      )
    }

    // Handle variants if provided
    if (variants !== undefined) {
      // Delete existing variants
      await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', id)

      // Insert new variants if any
      if (Array.isArray(variants) && variants.length > 0) {
        // Simplified variant structure for suppliers: variant_name, price, stock_quantity only
        const variantRecords = variants.map((variant: any) => {
          const stockQty = variant.stock_quantity || variant.stockQuantity || 0
          const parsedStockQty = typeof stockQty === 'number' ? stockQty : parseInt(String(stockQty)) || 0
          
          return {
            product_id: parseInt(id),
            variant_name: variant.variant_name?.trim() || '',
            price: variant.price ? parseFloat(variant.price) : parseFloat(price || product.price),
            stock_quantity: parsedStockQty,
            in_stock: parsedStockQty > 0
          }
        })

        const { error: variantError } = await supabase
          .from('product_variants')
          .insert(variantRecords)

        if (variantError) {
          console.error('Error updating variants:', variantError)
          // Don't fail the entire request
        }
      }
    }

    // Fetch complete product with variants
    const { data: completeProduct, error: fetchError } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .eq('id', id)
      .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

    if (fetchError || !completeProduct) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch updated product' },
        { status: 500 }
      )
    }

    // Transform variants to match expected format (simplified structure)
    const finalProduct = completeProduct
    const transformedProduct = {
      ...finalProduct,
      variants: finalProduct.product_variants?.map((v: any) => ({
        id: v.id,
        variant_name: v.variant_name || '',
        price: v.price,
        stock_quantity: v.stock_quantity || 0,
        stockQuantity: v.stock_quantity || 0, // Backward compatibility
        sku: v.sku || null,
        image: v.image || null
      })) || [],
      variantImages: (() => {
        const images = finalProduct.variant_images || []
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
      specificationImages: finalProduct.specification_images || []
    }

    // Remove the raw product_variants array
    delete transformedProduct.product_variants

    return NextResponse.json({
      success: true,
      product: transformedProduct
    })

  } catch (error) {
    console.error('Supplier product PUT error:', error)
    // Security: Sanitize error messages in production
    const isProduction = process.env.NODE_ENV === 'production'
    let errorMessage = 'An unexpected error occurred'
    
    if (!isProduction && error instanceof Error) {
      errorMessage = error.message
    } else if (isProduction && error instanceof Error) {
      // Map common database errors to user-friendly messages
      if (error.message.includes('23505')) {
        errorMessage = 'A product with this information already exists'
      } else if (error.message.includes('42703')) {
        errorMessage = 'Invalid field specified'
      } else if (error.message.includes('23502')) {
        errorMessage = 'Required field is missing'
      }
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// DELETE - Delete a product (only if it belongs to the supplier)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params before using
    const { id } = await params
    
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/supplier/products/[id]',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { success: false, error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_supplier, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_supplier && !profile?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Verify product belongs to supplier/user and delete
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`)

    if (error) {
      console.error('Error deleting product:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete product' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully'
    })

  } catch (error) {
    console.error('Supplier product DELETE error:', error)
    // Security: Sanitize error messages in production
    const isProduction = process.env.NODE_ENV === 'production'
    const errorMessage = isProduction 
      ? 'An unexpected error occurred' 
      : (error instanceof Error ? error.message : 'An unexpected error occurred')
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

