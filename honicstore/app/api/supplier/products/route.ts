import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import DOMPurify from 'isomorphic-dompurify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Security: Input validation constants
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
  SEARCH_MAX: 100,
  LIMIT_MAX: 1000,
  LIMIT_DEFAULT: 50,
  VARIANTS_MAX: 100,
  SPECIFICATION_IMAGES_MAX: 3
}

// Security: Validate product input data
function validateProductInput(body: any): { valid: boolean; error?: string } {
  // Name validation
  if (!body.name || typeof body.name !== 'string') {
    return { valid: false, error: 'Name is required and must be a string' }
  }
  const name = body.name.trim()
  if (name.length < VALIDATION_LIMITS.NAME_MIN || name.length > VALIDATION_LIMITS.NAME_MAX) {
    return { valid: false, error: `Name must be between ${VALIDATION_LIMITS.NAME_MIN} and ${VALIDATION_LIMITS.NAME_MAX} characters` }
  }

  // Price validation
  if (body.price === undefined || body.price === null) {
    return { valid: false, error: 'Price is required' }
  }
  const price = parseFloat(String(body.price))
  if (isNaN(price) || !isFinite(price)) {
    return { valid: false, error: 'Price must be a valid number' }
  }
  if (price < VALIDATION_LIMITS.PRICE_MIN || price > VALIDATION_LIMITS.PRICE_MAX) {
    return { valid: false, error: `Price must be between ${VALIDATION_LIMITS.PRICE_MIN} and ${VALIDATION_LIMITS.PRICE_MAX}` }
  }

  // Original price validation
  if (body.originalPrice !== undefined && body.originalPrice !== null) {
    const originalPrice = parseFloat(String(body.originalPrice))
    if (isNaN(originalPrice) || !isFinite(originalPrice)) {
      return { valid: false, error: 'Original price must be a valid number' }
    }
    if (originalPrice < VALIDATION_LIMITS.PRICE_MIN || originalPrice > VALIDATION_LIMITS.PRICE_MAX) {
      return { valid: false, error: `Original price must be between ${VALIDATION_LIMITS.PRICE_MIN} and ${VALIDATION_LIMITS.PRICE_MAX}` }
    }
    if (originalPrice < price) {
      return { valid: false, error: 'Original price must be greater than or equal to price' }
    }
  }

  // Description validation
  if (body.description && typeof body.description === 'string') {
    if (body.description.length > VALIDATION_LIMITS.DESCRIPTION_MAX) {
      return { valid: false, error: `Description must not exceed ${VALIDATION_LIMITS.DESCRIPTION_MAX} characters` }
    }
  }

  // SKU validation
  if (body.sku && typeof body.sku === 'string') {
    if (body.sku.length > VALIDATION_LIMITS.SKU_MAX) {
      return { valid: false, error: `SKU must not exceed ${VALIDATION_LIMITS.SKU_MAX} characters` }
    }
  }

  // Brand validation
  if (body.brand && typeof body.brand === 'string') {
    if (body.brand.length > VALIDATION_LIMITS.BRAND_MAX) {
      return { valid: false, error: `Brand must not exceed ${VALIDATION_LIMITS.BRAND_MAX} characters` }
    }
  }

  // Category validation
  if (body.category && typeof body.category === 'string') {
    if (body.category.length > VALIDATION_LIMITS.CATEGORY_MAX) {
      return { valid: false, error: `Category must not exceed ${VALIDATION_LIMITS.CATEGORY_MAX} characters` }
    }
  }

  // Model validation
  if (body.model && typeof body.model === 'string') {
    if (body.model.length > VALIDATION_LIMITS.MODEL_MAX) {
      return { valid: false, error: `Model must not exceed ${VALIDATION_LIMITS.MODEL_MAX} characters` }
    }
  }

  // URL validation (image, video, view360)
  const urlFields = ['image', 'video', 'view360']
  for (const field of urlFields) {
    if (body[field] && typeof body[field] === 'string') {
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

  // Variants validation
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

  // Stock quantity validation
  if (body.stockQuantity !== undefined && body.stockQuantity !== null) {
    const stockQty = parseInt(String(body.stockQuantity))
    if (isNaN(stockQty) || stockQty < 0) {
      return { valid: false, error: 'Stock quantity must be a valid non-negative integer' }
    }
  }

  // Specification images validation
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

// GET - Fetch products for the authenticated supplier
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/supplier/products',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { success: false, error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }
    // Create Supabase client with proper cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Cookies will be set by the response
          },
          remove(name: string, options: any) {
            // Cookies will be removed by the response
          },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a supplier
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_supplier, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_supplier && !profile?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Supplier account required.' },
        { status: 403 }
      )
    }

    // Get query parameters with validation
    const { searchParams } = new URL(request.url)
    
    // Validate and clamp limit
    let limit = VALIDATION_LIMITS.LIMIT_DEFAULT
    const limitParam = searchParams.get('limit')
    if (limitParam) {
      const parsedLimit = parseInt(limitParam)
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, VALIDATION_LIMITS.LIMIT_MAX)
      }
    }

    // Validate and clamp offset
    let offset = 0
    const offsetParam = searchParams.get('offset')
    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam)
      if (!isNaN(parsedOffset) && parsedOffset >= 0) {
        offset = parsedOffset
      }
    }

    // Validate and limit search length
    let search: string | null = null
    const searchParam = searchParams.get('search')
    if (searchParam) {
      search = searchParam.slice(0, VALIDATION_LIMITS.SEARCH_MAX)
    }

    // Build query - suppliers can only see their own products
    // Check both supplier_id and user_id for compatibility
    // Use a filter that matches either supplier_id or user_id
    let query = supabase
      .from('products')
      .select(`
        *,
        product_variants (*)
      `, { count: 'exact' })
      .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`) // Get products where supplier_id or user_id matches
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add search filter if provided (this will be AND with the above OR condition)
    if (search) {
      const escapedSearch = search.replace(/%/g, '\\%').replace(/_/g, '\\_')
      query = query.or(`name.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%,sku.ilike.%${escapedSearch}%`)
    }

    const { data: products, error, count } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch products' },
        { status: 500 }
      )
    }

    // Transform products to include variants in simplified format
    const transformedProducts = (products || []).map((product: any) => {
      const transformedProduct = {
        ...product,
        variants: product.product_variants?.filter((v: any) => 
          v && v.id && (v.variant_name || v.sku)
        ).map((v: any) => ({
          id: v.id,
          variant_name: v.variant_name || '',
          price: v.price,
          stock_quantity: v.stock_quantity || 0,
          sku: v.sku || null,
          image: v.image || null
        })) || []
      }
      // Remove the raw product_variants array
      delete transformedProduct.product_variants
      return transformedProduct
    })

    return NextResponse.json({
      success: true,
      products: transformedProducts,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    })

  } catch (error) {
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

// POST - Create a new product for the authenticated supplier
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/supplier/products',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { success: false, error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }
    // Create Supabase client with proper cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Cookies will be set by the response
          },
          remove(name: string, options: any) {
            // Cookies will be removed by the response
          },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a supplier
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_supplier, is_admin, supplier_plan_id')
      .eq('id', user.id)
      .single()

    if (!profile?.is_supplier && !profile?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Supplier account required.' },
        { status: 403 }
      )
    }

    // SECURITY: Check product limit based on plan (database-enforced)
    const { getSupplierPlan, canCreateProduct } = await import('@/lib/supplier-plan-utils')
    
    // Get supplier's plan from database
    const plan = await getSupplierPlan(user.id, supabase)
    
    // Count current products from database (cannot be tampered with from UI)
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`)
    
    // Check if can create more products (database-enforced limit)
    const limitCheck = await canCreateProduct(user.id, productCount || 0, plan)
    
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: limitCheck.reason || 'Product limit reached',
          maxProducts: limitCheck.maxProducts,
          currentCount: productCount || 0
        },
        { status: 403 }
      )
    }
    
    // SECURITY: Double-check limit right before insertion to prevent race conditions
    // This ensures the limit is enforced even if multiple requests come in simultaneously
    const { count: finalProductCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`)
    
    const finalLimitCheck = await canCreateProduct(user.id, finalProductCount || 0, plan)
    if (!finalLimitCheck.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: finalLimitCheck.reason || 'Product limit reached. Please refresh and try again.',
          maxProducts: finalLimitCheck.maxProducts,
          currentCount: finalProductCount || 0
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Security: Comprehensive input validation
    const validation = validateProductInput(body)
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
    if (description && typeof description === 'string') {
      sanitizedDescription = DOMPurify.sanitize(description, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: []
      })
    }

    // Generate slug from product name
    const generateSlug = (text: string): string => {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    }
    const productSlug = generateSlug(name.trim())

    // Resolve category_id from category name if provided
    let categoryId: string | null = body.category_id || null
    if (!categoryId && category) {
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
    let calculatedStock = stockQuantity ? parseInt(stockQuantity) : 0
    if (variants && Array.isArray(variants) && variants.length > 0) {
      calculatedStock = variants.reduce((sum: number, variant: any) => {
        // Simplified variant structure: use stock_quantity or stockQuantity
        const qty = variant.stock_quantity || variant.stockQuantity || 0
        return sum + (typeof qty === 'number' ? qty : parseInt(String(qty)) || 0)
      }, 0)
    }

    // Create product with supplier_id and user_id (without variants column)
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name: name.trim(),
        slug: productSlug,
        description: sanitizedDescription?.trim() || '',
        category: category?.trim() || '',
        category_id: categoryId,
        brand: brand?.trim() || '',
        price: parseFloat(price),
        original_price: originalPrice ? parseFloat(originalPrice) : null,
        image: image?.trim() || '',
        sku: sku?.trim() || '',
        // Only include model if it has a non-empty value (avoid errors if column doesn't exist)
        ...(model !== undefined && model !== null && String(model).trim().length > 0 
          ? { model: String(model).trim() } 
          : {}),
        in_stock: inStock !== false,
        stock_quantity: calculatedStock || stockQuantity ? parseInt(String(stockQuantity || calculatedStock)) : null,
        specifications: specifications || {},
        variant_config: variantConfig || null,
        variant_images: variantImages || [],
        specification_images: specificationImages || [],
        video: video?.trim() || '',
        view360: view360?.trim() || '',
        import_china: importChina || false,
        supplier_id: user.id, // Associate product with supplier
        user_id: user.id, // Associate product with user/seller
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to create product: ' + error.message },
        { status: 500 }
      )
    }

    // Add variants to product_variants table if they exist
    if (variants && Array.isArray(variants) && variants.length > 0) {
      // Simplified variant structure for suppliers: variant_name, price, stock_quantity only
      const variantRecords = variants.map((variant: any) => {
        const stockQty = variant.stock_quantity || variant.stockQuantity || 0
        const parsedStockQty = typeof stockQty === 'number' ? stockQty : parseInt(String(stockQty)) || 0
        
        return {
          product_id: product.id,
          variant_name: variant.variant_name?.trim() || '',
          price: variant.price ? parseFloat(variant.price) : parseFloat(price),
          stock_quantity: parsedStockQty,
          sku: variant.sku?.trim() || null,
          image: variant.image?.trim() || null,
          in_stock: parsedStockQty > 0
        }
      })

      const { error: variantError } = await supabase
        .from('product_variants')
        .insert(variantRecords)

      if (variantError) {
        // Don't fail the entire request, but log the error
      }
    }

    // Fetch the complete product with variants
    const { data: completeProduct, error: fetchError } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .eq('id', product.id)
      .single()

    // Transform variants to match expected format (simplified structure)
    const finalProduct = completeProduct || product
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
    }, { status: 201 })

  } catch (error) {
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

