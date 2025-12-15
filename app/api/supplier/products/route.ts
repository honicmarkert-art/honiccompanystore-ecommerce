import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET - Fetch products for the authenticated supplier
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')

    // Build query - suppliers can only see their own products
    // Check both supplier_id and user_id for compatibility
    // Use a filter that matches either supplier_id or user_id
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
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
      console.error('Error fetching supplier products:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch products' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      products: products || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    })

  } catch (error) {
    console.error('Supplier products GET error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST - Create a new product for the authenticated supplier
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
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
    const {
      name,
      description,
      category,
      brand,
      price,
      originalPrice,
      image,
      sku,
      inStock,
      stockQuantity,
      specifications,
      variants,
      video,
      view360,
      importChina,
      variantConfig
    } = body

    // Validate required fields
    if (!name || !price) {
      return NextResponse.json(
        { success: false, error: 'Name and price are required' },
        { status: 400 }
      )
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
        if (variant.stockQuantity) {
          return sum + (typeof variant.stockQuantity === 'number' ? variant.stockQuantity : parseInt(variant.stockQuantity) || 0)
        }
        if (variant.quantities) {
          return sum + Object.values(variant.quantities).reduce((qtySum: number, qty: any) => 
            qtySum + (typeof qty === 'number' ? qty : parseInt(qty) || 0), 0
          )
        }
        if (Array.isArray(variant.primaryValues)) {
          return sum + variant.primaryValues.reduce((pvSum: number, pv: any) => 
            pvSum + (typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0), 0
          )
        }
        return sum
      }, 0)
    }

    // Create product with supplier_id and user_id (without variants column)
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name: name.trim(),
        slug: productSlug,
        description: description?.trim() || '',
        category: category?.trim() || '',
        category_id: categoryId,
        brand: brand?.trim() || '',
        price: parseFloat(price),
        original_price: originalPrice ? parseFloat(originalPrice) : null,
        image: image?.trim() || '',
        sku: sku?.trim() || '',
        in_stock: inStock !== false,
        stock_quantity: calculatedStock || stockQuantity ? parseInt(String(stockQuantity || calculatedStock)) : null,
        specifications: specifications || {},
        variant_config: variantConfig || null,
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
      console.error('Error creating product:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create product: ' + error.message },
        { status: 500 }
      )
    }

    // Add variants to product_variants table if they exist
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantRecords = variants.map((variant: any) => {
        // Extract primary attribute from primaryValues if present
        let primaryAttribute = variant.primaryAttribute
        let attributes = variant.attributes || {}
        
        if (Array.isArray(variant.primaryValues) && variant.primaryValues.length > 0) {
          // For the single primary_attribute column (backward compatibility)
          // Use the first attribute from variantConfig.primaryAttributes if available,
          // otherwise use the first one found in primaryValues
          if (!primaryAttribute) {
            // First, try to get from variantConfig.primaryAttributes (ordered list)
            if (variantConfig?.primaryAttributes && Array.isArray(variantConfig.primaryAttributes) && variantConfig.primaryAttributes.length > 0) {
              primaryAttribute = variantConfig.primaryAttributes[0]
            } else {
              // Fallback: find the first primary attribute from primaryValues
              const firstPrimaryValue = variant.primaryValues.find((pv: any) => pv.attribute)
              if (firstPrimaryValue?.attribute) {
                primaryAttribute = firstPrimaryValue.attribute
              }
            }
          }
          attributes = {}
        }

        return {
          product_id: product.id,
          price: variant.price ? parseFloat(variant.price) : parseFloat(price),
          image: variant.image?.trim() || '',
          sku: variant.sku?.trim() || '',
          model: variant.model?.trim() || '',
          variant_type: variant.variantType || variantConfig?.type || 'simple',
          attributes: attributes,
          primary_attribute: primaryAttribute || null,
          dependencies: variant.dependencies || {},
          primary_values: variant.primaryValues || [],
          stock_quantity: variant.stockQuantity ? (typeof variant.stockQuantity === 'number' ? variant.stockQuantity : parseInt(variant.stockQuantity)) : null
        }
      })

      const { error: variantError } = await supabase
        .from('product_variants')
        .insert(variantRecords)

      if (variantError) {
        console.error('Error creating variants:', variantError)
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

    // Transform variants to match expected format
    const finalProduct = completeProduct || product
    const transformedProduct = {
      ...finalProduct,
      variants: finalProduct.product_variants?.map((v: any) => ({
        id: v.id,
        price: v.price,
        image: v.image,
        sku: v.sku,
        model: v.model,
        variantType: v.variant_type,
        attributes: v.attributes || {},
        primaryAttribute: v.primary_attribute,
        dependencies: v.dependencies || {},
        primaryValues: v.primary_values || [],
        stockQuantity: v.stock_quantity
      })) || []
    }

    // Remove the raw product_variants array
    delete transformedProduct.product_variants

    return NextResponse.json({
      success: true,
      product: transformedProduct
    }, { status: 201 })

  } catch (error) {
    console.error('Supplier products POST error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

