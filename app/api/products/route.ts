import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateServerSession } from '@/lib/security-server'
import { getCachedData, setCachedData, CACHE_TTL, generateCacheKey } from '@/lib/database-optimization'
import { enhancedCache, performanceMonitor, performanceUtils } from '@/lib/performance-monitor'
import { createSecureApiHandler, createSecureResponse, createErrorResponse } from '@/lib/secure-api'
import { securityUtils } from '@/lib/secure-config'
import { logger } from '@/lib/logger'

// Simple security functions
const logSecurityEvent = (action: string, userId?: string, details?: any) => {
  logger.security(`${action} by user ${userId}`, userId, details)
}

const requireAdmin = (session: any) => {
  return session?.role === 'admin' || session?.profile?.is_admin === true
}

const validatePrice = (price: number) => price >= 0
const validateStock = (stock: number) => stock >= 0
const sanitizeInput = (input: string) => input.trim()

// GET - Fetch all products with optimized caching and minimal payload support
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const minimal = searchParams.get('minimal') === 'true'
    const enriched = searchParams.get('enriched') === 'true'
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')
    const category = searchParams.get('category')
    const brand = searchParams.get('brand')
    const search = searchParams.get('search')

    // Server-side filtering parameters
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const inStock = searchParams.get('inStock')
    const categories = searchParams.get('categories') // Comma-separated list
    
    // Sorting parameters
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Generate cache key based on parameters (including filters)
    const cacheKey = generateCacheKey('products', {
      minimal,
      enriched,
      limit,
      offset,
      category,
      brand,
      search,
      minPrice,
      maxPrice,
      inStock,
      categories,
      sortBy,
      sortOrder
    })

    // Check enhanced cache first
    const cachedData = enhancedCache.get(cacheKey) as any
    if (cachedData) {
      const apiTime = Date.now() - startTime
      performanceMonitor.recordMetrics({ apiTime, cacheHitRate: 100 })
      
      // Cached data should already have pagination info
      const productsCount = cachedData.products ? cachedData.products.length : (Array.isArray(cachedData) ? cachedData.length : 0)
      const totalCount = cachedData.pagination?.total || productsCount
      
      return createSecureResponse(cachedData, {
        cacheControl: 'public, s-maxage=1800, stale-while-revalidate=3600',
        headers: {
          'X-Cache': 'HIT',
          'X-Products-Count': productsCount.toString(),
          'X-Total-Count': totalCount.toString(),
          'X-API-Time': apiTime.toString(),
          'X-Cache-Hit-Rate': '100',
          'X-Data-Source': 'PRODUCTS_TABLE'
        }
      })
    }

    // Build optimized query with proper TypeScript handling
    let queryBuilder: any = supabase.from('products')
    
    // Select fields based on request type
    if (minimal) {
      queryBuilder = queryBuilder.select(`
        id, name, price, original_price, image, category, brand, 
        rating, reviews, in_stock, stock_quantity, free_delivery, same_day_delivery,
        variant_config, product_variants (*)
      `)
    } else if (enriched) {
      // Enriched data for list views - includes most fields needed for product cards
      queryBuilder = queryBuilder.select(`
        id, name, price, original_price, description, 
        image, category, brand, rating, reviews, 
        in_stock, stock_quantity, free_delivery, same_day_delivery,
        created_at, updated_at, variant_config,
        product_variants (*)
      `)
    } else {
      queryBuilder = queryBuilder.select(`
        *,
        product_variants (*)
      `)
    }

    // Apply filters
    if (category) {
      queryBuilder = queryBuilder.eq('category', category)
    }
    if (brand) {
      queryBuilder = queryBuilder.eq('brand', brand)
    }
    
    // Server-side price filtering (much faster than client-side!)
    if (minPrice) {
      const min = parseFloat(minPrice)
      if (!isNaN(min) && min >= 0) {
        queryBuilder = queryBuilder.gte('price', min)
      }
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice)
      if (!isNaN(max) && max >= 0) {
        queryBuilder = queryBuilder.lte('price', max)
      }
    }
    
    // Stock filtering
    if (inStock === 'true') {
      queryBuilder = queryBuilder.eq('in_stock', true)
    }
    
    // Multiple categories filtering (comma-separated)
    if (categories) {
      const categoryList = categories.split(',').map(c => c.trim()).filter(Boolean)
      if (categoryList.length > 0) {
        queryBuilder = queryBuilder.in('category', categoryList)
      }
    }
    // Search filtering (only when search term is provided)
    // NOTE: We don't filter at database level for search - we do fuzzy search in-memory
    // This allows for typo tolerance, synonym expansion, and better relevance scoring
    // Database indexes are still used for other filters (category, brand, price, etc.)
    const performSearch = search && search.trim().length > 0
    
    // If searching, fetch more products than requested to ensure we have enough after fuzzy filtering
    // If not searching, use normal pagination
    const effectiveLimit = performSearch ? 1000 : (limit ? parseInt(limit) : 1000)
    const effectiveOffset = performSearch ? 0 : (offset ? parseInt(offset) : 0)

    // Apply pagination (but fetch more if searching for fuzzy matching)
    if (limit && !performSearch) {
      const limitNum = parseInt(limit)
      const offsetNum = offset ? parseInt(offset) : 0
      queryBuilder = queryBuilder.range(offsetNum, offsetNum + limitNum - 1)
    } else {
      queryBuilder = queryBuilder.limit(effectiveLimit)
    }

    // Server-side sorting (database is much faster than JavaScript!)
    // Note: If searching, we'll re-sort by relevance score after fuzzy search
    const validSortFields = ['created_at', 'price', 'rating', 'name', 'reviews']
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at'
    const ascending = sortOrder.toLowerCase() === 'asc'
    
    if (!performSearch) {
      queryBuilder = queryBuilder.order(sortField, { ascending })
    } else {
      // When searching, order by created_at first (we'll re-sort by relevance)
    queryBuilder = queryBuilder.order('created_at', { ascending: false })
    }

    const { data: products, error } = await queryBuilder

    if (error) {
      console.error('Error fetching products:', error)
      return createErrorResponse('Failed to fetch products from database', 500)
    }

    // Get total count for pagination (with same filters, without pagination)
    let totalCount = 0
    const limitNum = limit ? parseInt(limit) : 1000
    const offsetNum = offset ? parseInt(offset) : 0
    
    // Build count query with same filters
    let countQuery = supabase.from('products').select('id', { count: 'exact', head: true })
    
    // Apply same filters as main query
    if (category) countQuery = countQuery.eq('category', category)
    if (brand) countQuery = countQuery.eq('brand', brand)
    if (minPrice) {
      const min = parseFloat(minPrice)
      if (!isNaN(min) && min >= 0) countQuery = countQuery.gte('price', min)
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice)
      if (!isNaN(max) && max >= 0) countQuery = countQuery.lte('price', max)
    }
    if (inStock === 'true') countQuery = countQuery.eq('in_stock', true)
    if (categories) {
      const categoryList = categories.split(',').map(c => c.trim()).filter(Boolean)
      if (categoryList.length > 0) countQuery = countQuery.in('category', categoryList)
    }
    // Don't filter count query by search - we do fuzzy search in-memory
    // Count will be adjusted after fuzzy search filtering
    
    const { count, error: countError } = await countQuery
    
    if (!countError && count !== null) {
      totalCount = count
    }

    // Always return what's actually in the database (even if empty)
    if (!products || products.length === 0) {
      logger.log('No products found in database - returning empty array')
      
      // Return with pagination info even when empty
      const paginationInfo = {
        limit: limitNum,
        offset: offsetNum,
        total: totalCount,
        hasMore: false,
        currentPage: Math.floor(offsetNum / limitNum) + 1,
        totalPages: Math.ceil(totalCount / limitNum) || 0
      }
      
      return createSecureResponse({
        products: [],
        pagination: paginationInfo
      }, {
        cacheControl: 'public, s-maxage=60, stale-while-revalidate=300',
        headers: {
          'X-Products-Count': '0',
          'X-Total-Count': totalCount.toString(),
          'X-Database-Status': 'EMPTY'
        }
      })
    }
    
    // Apply PostgreSQL full-text search if search term provided
    let filteredProducts = products
    if (performSearch && search) {
      const sanitized = securityUtils.sanitizeInput(search)
      
      try {
        // Use PostgreSQL full-text search with basic textSearch
        const { data: searchResults, error: searchError } = await supabase
          .from('products')
          .select(`
            id, name, description, category, brand, price, image,
            product_variants (
              sku, model, attributes, primary_values, multi_values
            )
          `)
          .textSearch('search_vector', sanitized, { type: 'websearch' })
          .limit(limit ? parseInt(limit) : 100)

        if (searchError) {
          logger.error('Full-text search error:', searchError)
          // Fallback to simple ILIKE search
          const { data: fallbackResults, error: fallbackError } = await supabase
            .from('products')
            .select('id')
            .or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%,category.ilike.%${sanitized}%,brand.ilike.%${sanitized}%,sku.ilike.%${sanitized}%`)
            .limit(limit ? parseInt(limit) : 100)

          if (fallbackError) {
            logger.error('Fallback search error:', fallbackError)
            filteredProducts = []
          } else {
            const fallbackIds = new Set(fallbackResults?.map(r => r.id) || [])
            filteredProducts = products.filter((p: any) => fallbackIds.has(p.id))
          }
        } else {
          // No full-text search results, search within variant data
          filteredProducts = []
        }
        
        // Always search within variant data for additional matches (regardless of full-text results)
        const searchResultIds = new Set((searchResults || []).map((r: any) => r.id))
        
        // Search within variant data for additional matches
        const variantMatches = products.filter((p: any) => {
          if (searchResultIds.has(p.id)) return false // Already matched by full-text search
          
          // Check if any variant contains the search term
          const variants = p.product_variants || []
          return variants.some((variant: any) => {
            // Extract all text from variant data
            const variantTexts = [
              variant.sku || '',
              variant.model || '',
              JSON.stringify(variant.attributes || {}),
              JSON.stringify(variant.primary_values || []),
              JSON.stringify(variant.multi_values || {})
            ]
            
            // Also extract individual values from primary_values and multi_values
            if (variant.primary_values && Array.isArray(variant.primary_values)) {
              variant.primary_values.forEach((pv: any) => {
                if (pv.value) variantTexts.push(pv.value)
                if (pv.attribute) variantTexts.push(pv.attribute)
              })
            }
            
            if (variant.multi_values && typeof variant.multi_values === 'object') {
              Object.values(variant.multi_values).forEach((values: any) => {
                if (Array.isArray(values)) {
                  values.forEach((value: any) => variantTexts.push(value))
                } else if (typeof values === 'string') {
                  variantTexts.push(values)
                }
              })
            }
            
            // Join all text and search
            const variantText = variantTexts.join(' ').toLowerCase()
            const searchLower = sanitized.toLowerCase()
            
            // Check for exact match or partial match
            return variantText.includes(searchLower) || 
                   searchLower.split(' ').some(word => variantText.includes(word))
          })
        })
        
        // Simple substring search across product core fields (fallback for short queries like "sal")
        const searchLowerSimple = sanitized.toLowerCase()
        const simpleMatches = products.filter((p: any) => {
          const text = `${p.name || ''} ${p.description || ''} ${p.category || ''} ${p.brand || ''}`.toLowerCase()
          return text.includes(searchLowerSimple)
        })

        // Combine full-text results with variant and simple matches, de-duplicated
        const fullTextMatches = searchResults ? products.filter((p: any) => searchResultIds.has(p.id)) : []
        const combined = [...fullTextMatches, ...variantMatches, ...simpleMatches]
        const seenIds = new Set<number>()
        filteredProducts = combined.filter((p: any) => {
          if (seenIds.has(p.id)) return false
          seenIds.add(p.id)
          return true
        })
        
        logger.log(`Full-text search: "${search}" matched ${filteredProducts.length}/${products.length} products`)
      } catch (error) {
        logger.error('Search execution error:', error)
        // Fallback to simple ILIKE search
        const { data: fallbackResults, error: fallbackError } = await supabase
          .from('products')
          .select('id')
          .or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%,category.ilike.%${sanitized}%,brand.ilike.%${sanitized}%,sku.ilike.%${sanitized}%`)
          .limit(limit ? parseInt(limit) : 100)

        if (fallbackError) {
          logger.error('Fallback search error:', fallbackError)
          filteredProducts = []
        } else {
          const fallbackIds = new Set(fallbackResults?.map(r => r.id) || [])
          filteredProducts = products.filter((p: any) => fallbackIds.has(p.id))
        }
      }
    }

    // If searching, prioritize results that start with the first word and ILIKE-style matches
    if (performSearch && search) {
      const queryLower = search.toLowerCase()
      const words = queryLower.split(/\s+/).filter(Boolean)
      const firstWord = words[0] || queryLower

      const wordBoundary = (text: string, word: string) => {
        try {
          const re = new RegExp(`(^|\\b)${word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(\\b|$)`, 'i')
          return re.test(text)
        } catch {
          return text.includes(word)
        }
      }

      const scoreProduct = (p: any): number => {
        const name = (p.name || '').toLowerCase()
        const description = (p.description || '').toLowerCase()
        const brand = (p.brand || '').toLowerCase()
        const categoryText = (p.category || '').toLowerCase()
        const sku = (p.sku || '').toLowerCase()
        const model = (p.model || '').toLowerCase()

        let score = 0
        // Strong boost: name starts with first word
        if (name.startsWith(firstWord)) score += 120
        // Boost: name has first word as a whole word
        if (wordBoundary(name, firstWord)) score += 80
        // General contains boosts
        if (name.includes(queryLower)) score += 60
        if (sku.startsWith(firstWord) || model.startsWith(firstWord)) score += 40
        if (brand.startsWith(firstWord) || categoryText.startsWith(firstWord)) score += 30
        if (brand.includes(queryLower) || categoryText.includes(queryLower)) score += 20
        if (description.includes(queryLower)) score += 10

        // Check variants
        const variants = Array.isArray(p.product_variants) ? p.product_variants : []
        for (const v of variants) {
          const vSku = (v.sku || '').toLowerCase()
          const vModel = (v.model || '').toLowerCase()
          const vText = `${vSku} ${vModel} ${JSON.stringify(v.attributes||{})} ${JSON.stringify(v.primary_values||[])} ${JSON.stringify(v.multi_values||{})}`.toLowerCase()
          if (vSku.startsWith(firstWord) || vModel.startsWith(firstWord)) score += 25
          if (vText.includes(queryLower)) { score += 10; break }
        }

        // Slight popularity boost
        const rating = Number(p.rating) || 0
        const reviews = Number(p.reviews) || 0
        score += Math.min(10, rating * 1.5)
        score += Math.min(10, Math.log10(reviews + 1) * 3)

        return score
      }

      filteredProducts = filteredProducts.sort((a: any, b: any) => scoreProduct(b) - scoreProduct(a))
    }

    // Transform data with optimized payload
    const transformedProducts = filteredProducts?.map((product: any) => {
      // Robust normalization for stock and numeric fields
      const rawQty: any = product.stock_quantity
      const normalizedQty: number | null =
        rawQty === null || rawQty === undefined || rawQty === ''
          ? null
          : typeof rawQty === 'number'
            ? rawQty
            : Number(rawQty)
      const stockQuantity = normalizedQty
      // Use database in_stock field (managed by trigger) with fallback for null values
      const effectiveInStock = product.in_stock ?? ((stockQuantity === null) || (Number.isFinite(stockQuantity) && stockQuantity > 0))
      
      const price = typeof product.price === 'number' ? product.price : Number(product.price) || 0
      const originalPrice = typeof product.original_price === 'number' ? product.original_price : Number(product.original_price) || price
      const reviews = typeof product.reviews === 'number' ? product.reviews : Number(product.reviews) || 0
      const rating = typeof product.rating === 'number' ? product.rating : Number(product.rating) || 0
      const specifications = typeof product.specifications === 'string'
        ? (() => { try { return JSON.parse(product.specifications) } catch { return {} } })()
        : (product.specifications || {})
      const gallery = Array.isArray(product.gallery) ? product.gallery : []
      const baseProduct = {
      id: product.id,
      name: product.name,
        originalPrice,
        price,
        rating,
        reviews,
      image: product.image,
      category: product.category,
      brand: product.brand,
        inStock: effectiveInStock,
        stockQuantity,
        freeDelivery: !!product.free_delivery,
        sameDayDelivery: !!product.same_day_delivery,
      }

      // Always include variant data for auto-selection functionality
      const variantData = {
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
        variantConfig: product.variant_config || null
      }

      // Only include heavy fields if not minimal
      if (!minimal) {
        return {
          ...baseProduct,
          ...variantData,
      description: product.description,
          specifications,
          gallery,
      sku: product.sku,
      model: product.model,
      views: product.views,
      video: product.video ? (product.video.startsWith('http') ? product.video : supabase.storage.from('product-videos').getPublicUrl(product.video).data.publicUrl) : null,
      view360: product.view360 ? (product.view360.startsWith('http') ? product.view360 : supabase.storage.from('product-models').getPublicUrl(product.view360).data.publicUrl) : null,
          stockQuantity,
      variantImages: product.variant_images || []
        }
      }

      // For minimal requests, include variant data but skip heavy fields
      return {
        ...baseProduct,
        ...variantData
      }
    }) || []

    // Calculate pagination metadata
    // If fuzzy search was performed, use filtered count; otherwise use database total
    const effectiveTotalCount = performSearch ? filteredProducts.length : totalCount
    
    const paginationInfo = {
      limit: limitNum,
      offset: offsetNum,
      total: effectiveTotalCount,
      hasMore: offsetNum + transformedProducts.length < effectiveTotalCount,
      currentPage: Math.floor(offsetNum / limitNum) + 1,
      totalPages: Math.ceil(effectiveTotalCount / limitNum) || 1,
      returned: transformedProducts.length,
      ...(performSearch && {
        searchMetadata: {
          originalQuery: search,
          matchedCount: filteredProducts.length,
          totalSearched: products.length
        }
      })
    }
    
    // Create response with products and pagination
    const responseData = {
      products: transformedProducts,
      pagination: paginationInfo
    }

    // Cache the result using enhanced cache
    enhancedCache.set(cacheKey, responseData, CACHE_TTL.PRODUCTS)
    
    const apiTime = Date.now() - startTime
    performanceMonitor.recordMetrics({ apiTime, cacheHitRate: 0 })

    return createSecureResponse(responseData, {
      cacheControl: 'public, s-maxage=1800, stale-while-revalidate=3600',
      headers: {
        'X-Cache': 'MISS',
        'X-Payload-Size': minimal ? 'minimal' : 'full',
        'X-Products-Count': transformedProducts.length.toString(),
        'X-Total-Count': effectiveTotalCount.toString(),
        'X-Has-More': paginationInfo.hasMore.toString(),
        'X-API-Time': apiTime.toString(),
        'X-Cache-Hit-Rate': '0',
        'X-Data-Source': 'PRODUCTS_TABLE',
        ...(performSearch && {
          'X-Search-Applied': 'true',
          'X-Search-Matched': filteredProducts.length.toString()
        })
      }
    })
  } catch (error) {
    console.error('Error reading products:', error)
    performanceMonitor.recordSecurityEvent({
      type: 'api_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: 'products'
    })
    
    const apiTime = Date.now() - startTime
    performanceMonitor.recordMetrics({ apiTime, errors: 1 })
    
    // Always return proper error response - no fallback to fake data
    return createErrorResponse('Failed to fetch products from database', 500)
  }
}

// POST - Add new product
export async function POST(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateServerSession(request)
    if (!requireAdmin(session)) {
      logSecurityEvent('Unauthorized product creation attempt', session?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const productData = await request.json()
    
    logger.log('🔍 POST Product Data Received:', {
      stockQuantity: productData.stockQuantity,
      inStock: productData.inStock,
      variantsLength: productData.variants?.length || 0
    })
    
    // Validate and sanitize input
    if (!productData.name || !productData.price) {
      return createErrorResponse('Missing required fields', 400)
    }

    // Sanitize text inputs using secure utilities
    const sanitizedData = {
      ...productData,
      name: securityUtils.sanitizeInput(productData.name),
      description: productData.description ? securityUtils.sanitizeInput(productData.description) : '',
      category: productData.category ? securityUtils.sanitizeInput(productData.category) : '',
      brand: productData.brand ? securityUtils.sanitizeInput(productData.brand) : ''
    }

    // Validate price and stock
    if (!validatePrice(sanitizedData.price)) {
      logSecurityEvent('Invalid price attempt', session?.id, { price: sanitizedData.price })
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }

    if (sanitizedData.stockQuantity && !validateStock(sanitizedData.stockQuantity)) {
      logSecurityEvent('Invalid stock attempt', session?.id, { stock: sanitizedData.stockQuantity })
      return NextResponse.json({ error: 'Invalid stock quantity' }, { status: 400 })
    }
    
    // Transform the data for Supabase
    const supabaseProduct = {
      name: sanitizedData.name,
      original_price: sanitizedData.originalPrice,
      price: sanitizedData.price,
      rating: productData.rating || 0,
      reviews: productData.reviews || 0,
      image: productData.image,
      category: productData.category,
      brand: productData.brand,
      description: productData.description,
      specifications: productData.specifications || {},
      gallery: productData.gallery || [],
      sku: productData.sku,
      model: productData.model,
      views: productData.views || 0,
      video: productData.video,
      view360: productData.view360,
      in_stock: productData.inStock !== undefined ? productData.inStock : true,
      stock_quantity: productData.stockQuantity,
      free_delivery: productData.freeDelivery || false,
      same_day_delivery: productData.sameDayDelivery || false,
      variant_config: productData.variantConfig,
      variant_images: productData.variantImages || []
    }

    logger.log('📝 Inserting product with stock:', {
      stock_quantity: supabaseProduct.stock_quantity,
      in_stock: supabaseProduct.in_stock
    })

    const { data: product, error } = await supabase
      .from('products')
      .insert(supabaseProduct)
      .select()
      .single()

    if (error) {
      console.error('Error adding product:', error)
      return NextResponse.json({ error: 'Failed to add product' }, { status: 500 })
    }

    // Calculate total stock from all primaryValues quantities
    let calculatedTotalStock = 0
    if (productData.variants && productData.variants.length > 0) {
      productData.variants.forEach((variant: any) => {
        if (Array.isArray(variant.primaryValues)) {
          variant.primaryValues.forEach((pv: any) => {
            const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
            calculatedTotalStock += qty
          })
        }
      })
    }

    // Only update product stock from variants if there are variants with quantities
    // Otherwise, keep the manually set stock quantity from initial insert
    if (productData.variants && productData.variants.length > 0 && calculatedTotalStock > 0) {
      await supabase
        .from('products')
        .update({ 
          stock_quantity: calculatedTotalStock,
          in_stock: calculatedTotalStock > 0
        })
        .eq('id', product.id)
    }

    // Add variants if they exist
    if (productData.variants && productData.variants.length > 0) {
      logger.log('Creating variants for new product:', product.id)
      logger.log('Variants to save:', productData.variants)
      logger.log('Calculated total stock:', calculatedTotalStock)
      
      const variants = productData.variants.map((variant: any) => {
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
          product_id: product.id,
          price: variant.price,
          image: variant.image,
          sku: variant.sku,
          model: variant.model,
          variant_type: variant.variantType || productData.variantConfig?.type || 'simple',
          attributes,
          primary_attribute: primaryAttribute,
          dependencies: variant.dependencies || {},
          primary_values: variant.primaryValues || [],
          multi_values: variant.multiValues || {},
          stock_quantity: typeof variant.stockQuantity === 'number' ? variant.stockQuantity : null
        }
      })

      logger.log('Transformed variants for database:', variants)

      const { data: insertedVariants, error: variantError } = await supabase
        .from('product_variants')
        .insert(variants)
        .select()

      if (variantError) {
        console.error('Error adding variants:', variantError)
        // Don't fail the entire request if variants fail
      } else {
        logger.log('Successfully inserted variants:', insertedVariants)
      }
    } else {
      logger.log('No variants to save for new product')
    }

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
      variants: productData.variants || [],
      variantConfig: product.variant_config
    }

    return NextResponse.json(transformedProduct, { status: 201 })
  } catch (error) {
    console.error('Error adding product:', error)
    return NextResponse.json({ error: 'Failed to add product' }, { status: 500 })
  }
}

// PUT - Update product
export async function PUT(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateServerSession(request)
    if (!requireAdmin(session)) {
      logSecurityEvent('Unauthorized product update attempt', session?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, ...updates } = await request.json()
    
    logger.log('🔍 PUT Product Data Received:', {
      id,
      stockQuantity: updates.stockQuantity,
      inStock: updates.inStock,
      variantsLength: updates.variants?.length || 0
    })
    
    // Transform the updates for Supabase
    const supabaseUpdates: any = {}
    if (updates.name !== undefined) supabaseUpdates.name = updates.name
    if (updates.originalPrice !== undefined) supabaseUpdates.original_price = updates.originalPrice
    if (updates.price !== undefined) supabaseUpdates.price = updates.price
    if (updates.rating !== undefined) supabaseUpdates.rating = updates.rating
    if (updates.reviews !== undefined) supabaseUpdates.reviews = updates.reviews
    if (updates.image !== undefined) supabaseUpdates.image = updates.image
    if (updates.category !== undefined) supabaseUpdates.category = updates.category
    if (updates.brand !== undefined) supabaseUpdates.brand = updates.brand
    if (updates.description !== undefined) supabaseUpdates.description = updates.description
    if (updates.specifications !== undefined) supabaseUpdates.specifications = updates.specifications
    if (updates.gallery !== undefined) supabaseUpdates.gallery = updates.gallery
    if (updates.sku !== undefined) supabaseUpdates.sku = updates.sku
    if (updates.model !== undefined) supabaseUpdates.model = updates.model
    if (updates.views !== undefined) supabaseUpdates.views = updates.views
    if (updates.video !== undefined) supabaseUpdates.video = updates.video
    if (updates.view360 !== undefined) supabaseUpdates.view360 = updates.view360
    if (updates.inStock !== undefined) supabaseUpdates.in_stock = updates.inStock
    if (updates.stockQuantity !== undefined) supabaseUpdates.stock_quantity = updates.stockQuantity
    if (updates.freeDelivery !== undefined) supabaseUpdates.free_delivery = updates.freeDelivery
    if (updates.sameDayDelivery !== undefined) supabaseUpdates.same_day_delivery = updates.sameDayDelivery
    if (updates.variantConfig !== undefined) supabaseUpdates.variant_config = updates.variantConfig
    if (updates.variantImages !== undefined) supabaseUpdates.variant_images = updates.variantImages

    logger.log('📝 Updating product with stock:', {
      stock_quantity: supabaseUpdates.stock_quantity,
      in_stock: supabaseUpdates.in_stock
    })

    const { data: product, error } = await supabase
      .from('products')
      .update(supabaseUpdates)
      .eq('id', id)
      .select(`
        *,
        product_variants (*)
      `)
      .single()

    if (error) {
      console.error('Error updating product:', error)
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
    }

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Handle variants update
    if (updates.variants !== undefined) {
      logger.log('Updating variants for product:', id)
      logger.log('Variants to save:', updates.variants)
      
      // Calculate total stock from all primaryValues quantities
      let calculatedTotalStock = 0
      if (updates.variants && updates.variants.length > 0) {
        updates.variants.forEach((variant: any) => {
          if (Array.isArray(variant.primaryValues)) {
            variant.primaryValues.forEach((pv: any) => {
              const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
              calculatedTotalStock += qty
            })
          }
        })
      }
      logger.log('Calculated total stock:', calculatedTotalStock)

      // Only update product stock from variants if there are actually variants
      // Otherwise, keep the manually set stock quantity
      if (updates.variants && updates.variants.length > 0) {
        await supabase
          .from('products')
          .update({ 
            stock_quantity: calculatedTotalStock,
            in_stock: calculatedTotalStock > 0
          })
          .eq('id', id)
      }
      
      // First, delete existing variants
      const { error: deleteError } = await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', id)

      if (deleteError) {
        console.error('Error deleting existing variants:', deleteError)
      } else {
        logger.log('Successfully deleted existing variants')
      }

      // Then, add new variants if they exist
      if (updates.variants && updates.variants.length > 0) {
        const variants = updates.variants.map((variant: any) => {
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
            product_id: id,
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

        logger.log('Transformed variants for database:', variants)

        const { data: insertedVariants, error: variantError } = await supabase
          .from('product_variants')
          .insert(variants)
          .select()

        if (variantError) {
          console.error('Error adding variants:', variantError)
          // Don't fail the entire request if variants fail
        } else {
          logger.log('Successfully inserted variants:', insertedVariants)
        }
      } else {
        logger.log('No variants to save')
      }
    }

    // Get fresh variants after update
    let freshVariants = []
    if (updates.variants !== undefined) {
      const { data: variantData } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', id)
      
      freshVariants = variantData?.map((variant: any) => ({
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
      })) || []
    } else {
      // Use existing variants if not updated
      freshVariants = product.product_variants?.map((variant: any) => ({
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
      })) || []
    }

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
      variants: freshVariants,
      variantConfig: product.variant_config
    }

    return NextResponse.json(transformedProduct)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

// DELETE - Delete product
export async function DELETE(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateServerSession(request)
    if (!requireAdmin(session)) {
      logSecurityEvent('Unauthorized product deletion attempt', session?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = parseInt(searchParams.get('id') || '0')
    
    // First delete variants
    const { error: variantError } = await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', id)

    if (variantError) {
      console.error('Error deleting variants:', variantError)
    }

    // Then delete the product
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting product:', error)
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}

// PATCH endpoint removed - was only for development/testing 