import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
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
      variantConfig,
      variantImages,
      specificationImages
    } = body

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
    if (description !== undefined) updateData.description = description?.trim() || ''
    if (category !== undefined) updateData.category = category?.trim() || ''
    if (categoryId !== undefined) updateData.category_id = categoryId
    if (brand !== undefined) updateData.brand = brand?.trim() || ''
    if (price !== undefined) updateData.price = parseFloat(price)
    if (originalPrice !== undefined) updateData.original_price = originalPrice ? parseFloat(originalPrice) : null
    if (image !== undefined) updateData.image = image?.trim() || ''
    if (sku !== undefined) updateData.sku = sku?.trim() || ''
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

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .or(`supplier_id.eq.${user.id},user_id.eq.${user.id}`) // Double check ownership
      .select()
      .single()

    if (error) {
      console.error('Error updating product:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update product' },
        { status: 500 }
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
    })

  } catch (error) {
    console.error('Supplier product PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
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
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

