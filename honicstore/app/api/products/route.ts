import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { validateServerSession } from '@/lib/security-server'
import { getCachedData, setCachedData, CACHE_TTL, generateCacheKey } from '@/lib/database-optimization'
import { enhancedCache, performanceMonitor, performanceUtils } from '@/lib/performance-monitor'
import { createSecureApiHandler, createSecureResponse, createErrorResponse } from '@/lib/secure-api'
import { securityUtils } from '@/lib/secure-config'
import { logger } from '@/lib/logger'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'

// Simple security functions
const logSecurityEvent = (action: string, userId?: string, details?: any) => {
  logger.security(`${action} by user ${userId}`, userId, details)
}

// Rate limit logging helper
const logRateLimitEvent = (endpoint: string, reason: string | undefined, request: NextRequest) => {
  const clientIP = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('cf-connecting-ip') || 
                   'unknown'
  logger.security(`Rate limit exceeded on ${endpoint}`, undefined, {
    ip: clientIP,
    reason,
    path: request.nextUrl.pathname
  })
}

const requireAdmin = (session: any) => {
  return session?.role === 'admin' || session?.profile?.is_admin === true
}

const validatePrice = (price: number) => price >= 0
const validateStock = (stock: number) => stock >= 0
const sanitizeInput = (input: string) => input.trim()

// Escape SQL wildcard characters for LIKE/ILIKE queries to prevent injection
const escapeSqlWildcards = (input: string): string => {
  return input.replace(/[%_]/g, (char) => `\\${char}`)
}

// GET - Fetch all products with optimized caching and minimal payload support
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = enhancedRateLimit(request)
  if (!rateLimitResult.allowed) {
    logRateLimitEvent('/api/products', rateLimitResult.reason, request)
    
    return NextResponse.json(
      { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
        }
      }
    )
  }

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
    const isChina = searchParams.get('isChina') // Filter by import_china
    const supplier = searchParams.get('supplier') // Filter by supplier_id or user_id
    const supplierByProduct = searchParams.get('supplierByProduct') // Filter by supplier using product ID (secure)
    
    // Sorting parameters
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    // Batch IDs parameter for prefetching
    const idsParam = searchParams.get('ids')

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
      sortOrder,
      isChina,
      supplier,
      supplierByProduct
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
    // Use regular client for public GET operations, admin client only for admin operations
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const publicClient = createClient(supabaseUrl, supabaseAnonKey)
    
    let queryBuilder: any = publicClient.from('products')
    
    // Select fields based on request type first
    // Note: is_featured may not exist if migration hasn't run yet - handle gracefully
    if (minimal) {
      queryBuilder = queryBuilder.select(`
        id, name, price, original_price, image, category, brand, 
        rating, reviews, in_stock, stock_quantity, free_delivery, same_day_delivery, import_china,
        is_new, updated_at, variant_config, sold_count, supplier_verified, product_variants (*)
      `)
    } else if (enriched) {
      // Enriched data for list views - includes most fields needed for product cards
      // IMPORTANT: include is_new so frontend badge logic can respect DB flag
      queryBuilder = queryBuilder.select(`
        id, name, price, original_price, description, 
        image, category, brand, rating, reviews, 
        in_stock, stock_quantity, free_delivery, same_day_delivery, import_china,
        is_new, created_at, updated_at, variant_config, sold_count, supplier_verified,
        product_variants (*)
      `)
    } else {
      queryBuilder = queryBuilder.select(`
        *,
        product_variants (*),
        categories!category_id (id, name, slug, parent_id)
      `)
    }
    
    // Filter out hidden products (from deactivated suppliers) - after select
    queryBuilder = queryBuilder.eq('is_hidden', false)

    // Apply filters
    // Handle batch IDs for prefetching
    if (idsParam) {
      const idList = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      if (idList.length > 0) {
        queryBuilder = queryBuilder.in('id', idList)
      }
    }
    
    if (category) {
      // Filter by category_id (foreign key) instead of category string
      queryBuilder = queryBuilder.eq('category_id', category)
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
    
    // China import filtering
    if (isChina === 'true') {
      queryBuilder = queryBuilder.eq('import_china', true)
    }
    
    // Supplier filtering (by supplier_id or user_id)
    if (supplier) {
      queryBuilder = queryBuilder.or(`supplier_id.eq.${supplier},user_id.eq.${supplier}`)
    }
    
    // Secure supplier filtering by product ID (resolves supplier_id server-side)
    if (supplierByProduct) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
      
      // Fetch product to get supplier_id
      const { data: productData } = await supabaseClient
        .from('products')
        .select('supplier_id, user_id')
        .eq('id', supplierByProduct)
        .single()
      
      if (productData) {
        const resolvedSupplierId = productData.supplier_id || productData.user_id
        if (resolvedSupplierId) {
          queryBuilder = queryBuilder.or(`supplier_id.eq.${resolvedSupplierId},user_id.eq.${resolvedSupplierId}`)
        }
      }
    }
    
    // Multiple categories filtering (comma-separated)
    if (categories !== undefined && categories !== null) {
      const categoryList = categories.split(',').map(c => c.trim()).filter(Boolean)
      
      if (categoryList.length > 0) {
        queryBuilder = queryBuilder.in('category_id', categoryList)
      } else {
        // If categories parameter exists but is empty, return no products
        queryBuilder = queryBuilder.eq('category_id', '00000000-0000-0000-0000-000000000000')
      }
    } else {
    }
    // Full-text search using search_vector (PostgreSQL full-text search)
    // Note: search_vector doesn't handle typos - exact word matching only
    // For typo tolerance, we'll add fuzzy matching in JavaScript after fetching
    if (search && search.trim().length > 0) {
      const sanitized = securityUtils.sanitizeInput(search.trim())
      try {
        // Use PostgreSQL full-text search with search_vector column
        // This will find products with exact word matches
        queryBuilder = queryBuilder.textSearch('search_vector', sanitized, { type: 'websearch' })
      } catch (searchError: any) {
        // Fallback to ILIKE if search_vector doesn't exist or has issues
        logger.log(`Search vector error, falling back to ILIKE: ${searchError.message}`)
        const searchTerms = sanitized.split(/\s+/).filter(Boolean)
        if (searchTerms.length > 0) {
          queryBuilder = queryBuilder.or(
            searchTerms.map(term => `name.ilike.%${term}%,description.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`).join(',')
          )
        }
      }
    }
    
    // Apply pagination
    if (limit) {
      const limitNum = parseInt(limit)
      const offsetNum = offset ? parseInt(offset) : 0
      queryBuilder = queryBuilder.range(offsetNum, offsetNum + limitNum - 1)
    } else {
      queryBuilder = queryBuilder.limit(1000)
    }

    // Server-side sorting (database is much faster than JavaScript!)
    // When searching, we'll sort by relevance in JavaScript after fetching
    // When not searching, use the selected sort order
    const validSortFields = ['created_at', 'price', 'rating', 'name', 'reviews']
    
    if (!search || !search.trim()) {
      // Only apply database sorting when NOT searching (search results sorted by relevance in JS)
      // Handle featured sort option (only if is_featured column exists)
      // For now, treat 'featured' sort same as 'created_at' to avoid errors if column doesn't exist
      if (sortBy === 'featured') {
        // When sorting by featured, sort by created_at (featured will be handled in transformation if column exists)
        queryBuilder = queryBuilder.order('created_at', { ascending: false })
      } else {
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at'
        const ascending = sortOrder.toLowerCase() === 'asc'
        
        // Sort by selected field (featured prioritization handled in transformation if column exists)
        queryBuilder = queryBuilder.order(sortField, { ascending })
      }
    }
    // When searching, we don't apply database sorting - relevance sorting happens in JavaScript below

    const { data: products, error } = await queryBuilder

    if (error) {
      logger.log(`Error fetching products: ${error.message || JSON.stringify(error)}`)
      // Check if error is due to missing search_vector column
      if (error.message && (error.message.includes('search_vector') || (error.message.includes('column') && error.message.includes('does not exist')))) {
        logger.log('Search vector column missing - products table may need migration')
        return createErrorResponse('Database schema mismatch. Please run migrations to add search_vector column.', 500)
      }
      // Check if error is due to missing is_featured column
      if (error.message && (error.message.includes('is_featured') || error.message.includes('column') && error.message.includes('does not exist'))) {
        logger.log('Database schema error detected. Please ensure migration 20250127_add_is_featured_to_products.sql has been run.')
        return createErrorResponse('Database schema mismatch. Please contact administrator.', 500)
      }
      logger.log(`Database query error: ${error.message || JSON.stringify(error)}`)
      return createErrorResponse(`Failed to fetch products: ${error.message || 'Unknown error'}`, 500)
    }
    
    // Log if no products found (for debugging)
    if (!products || products.length === 0) {
      logger.log(`No products found with filters: search=${search}, category=${category}, brand=${brand}, limit=${limit}`)
    } else {
      logger.log(`Found ${products.length} products`)
    }

    // Get total count for pagination (with same filters, without pagination)
    let totalCount = 0
    const limitNum = limit ? parseInt(limit) : 1000
    const offsetNum = offset ? parseInt(offset) : 0
    
    // Build count query with same filters
    let countQuery = publicClient.from('products').select('id', { count: 'exact', head: true })
    
    // Filter out hidden products (from deactivated suppliers)
    countQuery = countQuery.eq('is_hidden', false)
    
    // Apply same filters as main query
    if (category) countQuery = countQuery.eq('category_id', category)
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
    if (isChina === 'true') countQuery = countQuery.eq('import_china', true)
    if (supplier) countQuery = countQuery.or(`supplier_id.eq.${supplier},user_id.eq.${supplier}`)
    
    // Secure supplier filtering by product ID for count query
    if (supplierByProduct) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
      
      const { data: productData } = await supabaseClient
        .from('products')
        .select('supplier_id, user_id')
        .eq('id', supplierByProduct)
        .single()
      
      if (productData) {
        const resolvedSupplierId = productData.supplier_id || productData.user_id
        if (resolvedSupplierId) {
          countQuery = countQuery.or(`supplier_id.eq.${resolvedSupplierId},user_id.eq.${resolvedSupplierId}`)
        }
      }
    }
    
    if (categories !== undefined && categories !== null) {
      const categoryList = categories.split(',').map(c => c.trim()).filter(Boolean)
      
      if (categoryList.length > 0) {
        countQuery = countQuery.in('category_id', categoryList)
      } else {
        // If categories parameter exists but is empty, return no products
        countQuery = countQuery.eq('category_id', '00000000-0000-0000-0000-000000000000')
      }
    }
    // Apply search filter to count query using search_vector
    if (search && search.trim().length > 0) {
      const sanitized = securityUtils.sanitizeInput(search.trim())
      try {
        countQuery = countQuery.textSearch('search_vector', sanitized, { type: 'websearch' })
      } catch (searchError: any) {
        // Fallback to ILIKE if search_vector doesn't exist
        logger.log(`Count query search vector error, falling back to ILIKE: ${searchError.message}`)
        const searchTerms = sanitized.split(/\s+/).filter(Boolean)
        if (searchTerms.length > 0) {
          countQuery = countQuery.or(
            searchTerms.map(term => `name.ilike.%${term}%,description.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`).join(',')
          )
        }
      }
    }
    
    const { count, error: countError } = await countQuery
    
    if (countError) {
      logger.log(`Count query error: ${countError.message || JSON.stringify(countError)}`)
      // Don't fail the whole request if count fails, just use 0
      totalCount = 0
    }
    
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
    
    // Products are already filtered by search at database level
    let filteredProducts = products

    // If searching, add typo tolerance and sort by relevance
    if (search && search.trim().length > 0) {
      const sanitized = securityUtils.sanitizeInput(search.trim()).toLowerCase()
      const searchWords = sanitized.split(/\s+/).filter(Boolean)
      
      // If few or no results from exact search, try fuzzy matching for typos
      // This helps when user makes typos like "adruino" instead of "arduino"
      const needsFuzzyMatch = filteredProducts.length < 5
      if (needsFuzzyMatch) {
        // Fetch more products for fuzzy matching (without search filter)
        // Use a broader search to get candidates for fuzzy matching
        const fuzzyQuery = publicClient
          .from('products')
          .select('id, name, description, category, brand, price, image, rating, reviews, in_stock, stock_quantity, free_delivery, same_day_delivery, import_china, is_new, updated_at, variant_config, sold_count, supplier_verified, product_variants (*)')
          .eq('is_hidden', false)
          .limit(1000) // Get more products for fuzzy matching
        
        // Apply other filters (same as main query)
        if (category) fuzzyQuery.eq('category_id', category)
        if (brand) fuzzyQuery.eq('brand', brand)
        if (minPrice) {
          const min = parseFloat(minPrice)
          if (!isNaN(min) && min >= 0) fuzzyQuery.gte('price', min)
        }
        if (maxPrice) {
          const max = parseFloat(maxPrice)
          if (!isNaN(max) && max >= 0) fuzzyQuery.lte('price', max)
        }
        if (inStock === 'true') fuzzyQuery.eq('in_stock', true)
        if (isChina === 'true') fuzzyQuery.eq('import_china', true)
        if (supplier) fuzzyQuery.or(`supplier_id.eq.${supplier},user_id.eq.${supplier}`)
        
        // Secure supplier filtering by product ID for fuzzy query
        if (supplierByProduct) {
          const { createClient } = await import('@supabase/supabase-js')
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
          
          const { data: productData } = await supabaseClient
            .from('products')
            .select('supplier_id, user_id')
            .eq('id', supplierByProduct)
            .single()
          
          if (productData) {
            const resolvedSupplierId = productData.supplier_id || productData.user_id
            if (resolvedSupplierId) {
              fuzzyQuery.or(`supplier_id.eq.${resolvedSupplierId},user_id.eq.${resolvedSupplierId}`)
            }
          }
        }
        
        if (categories !== undefined && categories !== null) {
          const categoryList = categories.split(',').map(c => c.trim()).filter(Boolean)
          if (categoryList.length > 0) {
            fuzzyQuery.in('category_id', categoryList)
          } else {
            fuzzyQuery.eq('category_id', '00000000-0000-0000-0000-000000000000')
          }
        }
        
        const { data: fuzzyProducts } = await fuzzyQuery
        if (fuzzyProducts && fuzzyProducts.length > 0) {
          // Combine exact matches with fuzzy matches (exact matches prioritized)
          const exactMatchIds = new Set(filteredProducts.map((p: any) => p.id))
          const fuzzyMatches = fuzzyProducts.filter((p: any) => !exactMatchIds.has(p.id))
          filteredProducts = [...filteredProducts, ...fuzzyMatches]
        }
      }
      
      // Calculate relevance score with typo tolerance
      const scoredProducts = filteredProducts.map((p: any) => {
        const nameLower = (p.name || '').toLowerCase()
        const brandLower = (p.brand || '').toLowerCase()
        const categoryLower = (p.category || '').toLowerCase()
        const descLower = (p.description || '').toLowerCase()
        const fullText = `${nameLower} ${brandLower} ${categoryLower} ${descLower}`
        
        let score = 0
        
        // Exact match gets highest score
        if (nameLower === sanitized) score += 1000
        if (brandLower === sanitized) score += 800
        
        // Name starts with query gets high score
        if (nameLower.startsWith(sanitized)) score += 500
        if (brandLower.startsWith(sanitized)) score += 400
        
        // Name contains exact query gets high score
        if (nameLower.includes(sanitized)) score += 300
        if (brandLower.includes(sanitized)) score += 200
        
        // Check individual words with typo tolerance
        searchWords.forEach(word => {
          // Exact word matches (highest priority)
          if (nameLower === word) score += 400
          if (nameLower.startsWith(word)) score += 200
          if (nameLower.includes(word)) score += 100
          
          if (brandLower === word) score += 300
          if (brandLower.startsWith(word)) score += 150
          if (brandLower.includes(word)) score += 75
          
          if (categoryLower.includes(word)) score += 50
          if (descLower.includes(word)) score += 25
          
          // Quick typo check: if search word is similar to name/brand (for cases like "adruino" → "arduino")
          if (word.length >= 4) {
            // Check if word is similar to name (allows 1-2 char difference)
            const nameWords = nameLower.split(/\s+/)
            for (const nw of nameWords) {
              if (nw.length >= 3 && Math.abs(nw.length - word.length) <= 2) {
                let diff = 0
                const minLen = Math.min(nw.length, word.length)
                for (let i = 0; i < minLen; i++) {
                  if (nw[i] !== word[i]) diff++
                }
                diff += Math.abs(nw.length - word.length)
                if (diff <= 2 && diff > 0) {
                  // Typo match in name - give good score
                  score += 150 - (diff * 30)
                }
              }
            }
            
            // Check if word is similar to brand
            const brandWords = brandLower.split(/\s+/)
            for (const bw of brandWords) {
              if (bw.length >= 3 && Math.abs(bw.length - word.length) <= 2) {
                let diff = 0
                const minLen = Math.min(bw.length, word.length)
                for (let i = 0; i < minLen; i++) {
                  if (bw[i] !== word[i]) diff++
                }
                diff += Math.abs(bw.length - word.length)
                if (diff <= 2 && diff > 0) {
                  // Typo match in brand - give good score
                  score += 100 - (diff * 20)
                }
              }
            }
          }
          
          // Typo tolerance: Check if word is similar to any word in product text
          // More aggressive fuzzy matching for common typos
          const productWords = fullText.split(/\s+/).filter(w => w.length >= 2)
          productWords.forEach(productWord => {
            // Skip if already exact match
            if (productWord === word) return
            
            // Check for similarity (allows 1-2 character differences)
            if (productWord.length >= 2 && word.length >= 2) {
              const diff = Math.abs(productWord.length - word.length)
              
              // Allow up to 2 character difference for longer words
              const maxDiff = Math.max(1, Math.floor(Math.min(productWord.length, word.length) / 3))
              
              if (diff <= maxDiff) {
                // Calculate character differences (Levenshtein-like)
                let charDiff = 0
                const minLen = Math.min(productWord.length, word.length)
                
                // Check character-by-character
                for (let i = 0; i < minLen; i++) {
                  if (productWord[i] !== word[i]) charDiff++
                }
                charDiff += diff
                
                // If similar (within maxDiff), give score
                if (charDiff <= maxDiff) {
                  const similarity = 1 - (charDiff / Math.max(productWord.length, word.length))
                  const similarityScore = similarity * 60 // Higher base score for typos
                  
                  // Higher score if match is in name or brand
                  if (nameLower.includes(productWord)) {
                    score += similarityScore * 1.5
                  } else if (brandLower.includes(productWord)) {
                    score += similarityScore * 1.2
                  } else if (categoryLower.includes(productWord)) {
                    score += similarityScore * 0.8
                  } else {
                    score += similarityScore * 0.5
                  }
                }
              }
            }
          })
        })
        
        return { product: p, score }
      })
      
      // Sort by score (highest first) and extract products
      // Include products with score > 0 (some match found, including fuzzy matches)
      // Lower threshold for fuzzy matches to include typo-tolerant results
      const minScore = needsFuzzyMatch ? 10 : 0 // Lower threshold when using fuzzy matching
      filteredProducts = scoredProducts
        .filter(({ score }) => score > minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limitNum || 100) // Limit results to prevent too many fuzzy matches
        .map(({ product }) => product)
      
      // Update total count for fuzzy matches
      if (filteredProducts.length > 0 && totalCount === 0) {
        totalCount = filteredProducts.length
      }
      
      // Log for debugging (remove in production)
      if (needsFuzzyMatch && filteredProducts.length > 0) {
        logger.log(`Fuzzy matching found ${filteredProducts.length} products for query: "${sanitized}"`)
      }
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
        original_price: product.original_price, // Keep raw original_price for badge calculation
        price,
        rating,
        reviews,
      image: product.image,
      category: product.categories?.name || product.category,
      category_id: product.category_id,
      category_slug: product.categories?.slug,
      category_parent_id: product.categories?.parent_id,
      brand: product.brand,
        inStock: effectiveInStock,
        stockQuantity,
        // Include snake_case fields for stock validation compatibility
        in_stock: effectiveInStock,
        stock_quantity: stockQuantity,
        freeDelivery: !!product.free_delivery,
        sameDayDelivery: !!product.same_day_delivery,
        free_delivery: product.free_delivery, // Keep raw field for badge calculation
        same_day_delivery: product.same_day_delivery, // Keep raw field for badge calculation
        importChina: !!(product as any).import_china,
        is_new: product.is_new, // For "New" badge calculation
        is_featured: product.is_featured || false, // For "Featured" badge (may not exist if migration hasn't run)
        updated_at: product.updated_at, // For "New" badge calculation
        // Use real database sold_count (fallback to 0 if null/undefined)
        sold_count: typeof (product as any).sold_count === 'number'
          ? (product as any).sold_count
          : Number((product as any).sold_count) || 0,
        supplier_verified: !!(product as any).supplier_verified, // For verified seller badge
      }

      // Always include variant data for auto-selection functionality
      const variantData = {
        variants: product.product_variants?.map((variant: any) => {
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
            attributes: (() => {
              const attrs = variant.attributes || {}
              const displayAttrs = { ...attrs }
              Object.keys(displayAttrs).forEach(key => {
                if (Array.isArray(displayAttrs[key])) {
                  displayAttrs[key] = displayAttrs[key].map(item => 
                    typeof item === 'object' && item.value ? item.value : item
                  ).join(', ')
                }
              })
              return displayAttrs
            })(),
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
      video: product.video ? (product.video.startsWith('http') ? product.video : publicClient.storage.from('product-videos').getPublicUrl(product.video).data.publicUrl) : null,
      view360: product.view360 ? (product.view360.startsWith('http') ? product.view360 : publicClient.storage.from('product-models').getPublicUrl(product.view360).data.publicUrl) : null,
          stockQuantity,
      variantImages: product.variant_images || [],
      specificationImages: product.specification_images || []
        }
      }

      // For minimal requests, include variant data but skip heavy fields
      return {
        ...baseProduct,
        ...variantData
      }
    }) || []

    // Calculate pagination metadata
    const effectiveTotalCount = search && search.trim().length > 0 ? filteredProducts.length : totalCount
    
    const paginationInfo = {
      limit: limitNum,
      offset: offsetNum,
      total: effectiveTotalCount,
      hasMore: offsetNum + transformedProducts.length < effectiveTotalCount,
      currentPage: Math.floor(offsetNum / limitNum) + 1,
      totalPages: Math.ceil(effectiveTotalCount / limitNum) || 1,
      returned: transformedProducts.length,
    }
    
    // Create response with products and pagination
    const responseData = {
      products: transformedProducts,
      pagination: paginationInfo
    }

    // Check if this is a fresh request (has cache-busting parameter)
    const url = new URL(request.url)
    const isFreshRequest = url.searchParams.has('t') || url.searchParams.has('fresh')

    // Cache the result using enhanced cache
    enhancedCache.set(cacheKey, responseData, CACHE_TTL.PRODUCTS)
    
    const apiTime = Date.now() - startTime
    performanceMonitor.recordMetrics({ apiTime, cacheHitRate: 0 })
    
    // Use no-cache for fresh requests to ensure immediate updates
    const cacheControl = isFreshRequest 
      ? 'no-cache, no-store, must-revalidate' 
      : 'public, s-maxage=1800, stale-while-revalidate=3600'

    return createSecureResponse(responseData, {
      cacheControl,
      headers: {
        'X-Cache': 'MISS',
        'X-Payload-Size': minimal ? 'minimal' : 'full',
        'X-Products-Count': transformedProducts.length.toString(),
        'X-Total-Count': effectiveTotalCount.toString(),
        'X-Has-More': paginationInfo.hasMore.toString(),
        'X-API-Time': apiTime.toString(),
        'X-Cache-Hit-Rate': '0',
        'X-Data-Source': 'PRODUCTS_TABLE',
        'Cache-Control': cacheControl,
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

    // Never trust client-provided id during create
    const { id: _ignoreId, ...productData } = await request.json()
    
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
      category_id: productData.category_id,
      brand: productData.brand ? securityUtils.sanitizeInput(productData.brand) : ''
    }

    // If category_id missing but category provided, try to resolve UUID from categories table by name or slug
    if (!sanitizedData.category_id && (productData.category || productData.category_slug)) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const publicClient = createClient(supabaseUrl, supabaseAnonKey)

      const categoryName = (productData.category || '').trim()
      const categorySlug = (productData.category_slug || (categoryName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))

      const { data: cat, error: catError } = await publicClient
        .from('categories')
        .select('id, name, slug')
        .or(`name.eq.${categoryName},slug.eq.${categorySlug}`)
        .maybeSingle()

      if (!catError && cat?.id) {
        sanitizedData.category_id = cat.id
      }
    }

    // Final guard: require category_id for creation if categories exist in system
    if (!sanitizedData.category_id) {
      return createErrorResponse('Please select a valid sub category', 400)
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
      category_id: productData.category_id,
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
      import_china: productData.importChina || false,
      variant_config: productData.variantConfig,
      variant_images: productData.variantImages || [],
      specification_images: productData.specificationImages || []
    }

    // Use resolved/validated category_id
    ;(supabaseProduct as any).category_id = sanitizedData.category_id

    logger.log('📝 Inserting product with stock:', {
      stock_quantity: supabaseProduct.stock_quantity,
      in_stock: supabaseProduct.in_stock
    })

    const adminClient = createAdminSupabaseClient()
    const { data: product, error } = await adminClient
      .from('products')
      .insert(supabaseProduct)
      .select()
      .single()

    if (error) {
      console.error('Error adding product:', error)
      // Return clearer error details to help diagnose 500s during creation (safe enough for dev)
      return NextResponse.json({ error: 'Failed to add product', details: error.message }, { status: 500 })
    }

    // Calculate total stock from simplified variants (variant_name, price, stock_quantity)
    let calculatedTotalStock = 0
    if (productData.variants && productData.variants.length > 0) {
      productData.variants.forEach((variant: any) => {
        const qty = typeof variant.stock_quantity === 'number' 
          ? variant.stock_quantity 
          : (typeof variant.stockQuantity === 'number' ? variant.stockQuantity : parseInt(String(variant.stock_quantity || 0)) || 0)
        calculatedTotalStock += qty
      })
    }

    // Only update product stock from variants if there are variants with quantities
    // Otherwise, keep the manually set stock quantity from initial insert
    if (productData.variants && productData.variants.length > 0 && calculatedTotalStock > 0) {
      await adminClient
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
      
      // Simplified variant system: variant_name, price, stock_quantity
      const variants = productData.variants.map((variant: any) => {
        return {
          product_id: product.id,
          variant_name: variant.variant_name || null, // Simplified: just variant name
          price: variant.price || productData.price || 0,
          image: variant.image || null,
          sku: variant.sku || null,
          stock_quantity: typeof variant.stock_quantity === 'number' ? variant.stock_quantity : 
                        (typeof variant.stockQuantity === 'number' ? variant.stockQuantity : null)
        }
      })

      logger.log('Transformed variants for database:', variants)

      const { data: insertedVariants, error: variantError } = await adminClient
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

    // Fetch complete product with variants and variant images
    const { data: completeProduct, error: fetchError } = await adminClient
      .from('products')
      .select(`
        *,
        product_variants (*),
        categories!category_id (id, name, slug, parent_id)
      `)
      .eq('id', product.id)
      .single()

    const finalProduct = completeProduct || product

    // Transform back to expected format
    const transformedProduct = {
      id: finalProduct.id,
      name: finalProduct.name,
      originalPrice: finalProduct.original_price,
      price: finalProduct.price,
      rating: finalProduct.rating,
      reviews: finalProduct.reviews,
      image: finalProduct.image,
      category: finalProduct.categories?.name || finalProduct.category,
      category_id: finalProduct.category_id,
      category_slug: finalProduct.categories?.slug,
      category_parent_id: finalProduct.categories?.parent_id,
      brand: finalProduct.brand,
      description: finalProduct.description,
      specifications: finalProduct.specifications || {},
      gallery: finalProduct.gallery || [],
      sku: finalProduct.sku,
      model: finalProduct.model,
      views: finalProduct.views,
      video: finalProduct.video,
      view360: finalProduct.view360,
      inStock: finalProduct.in_stock,
      stockQuantity: finalProduct.stock_quantity,
      freeDelivery: finalProduct.free_delivery,
      sameDayDelivery: finalProduct.same_day_delivery,
      importChina: !!(finalProduct as any).import_china,
      variants: finalProduct.product_variants?.map((v: any) => ({
        id: v.id,
        variant_name: v.variant_name || '',
        price: v.price,
        stock_quantity: v.stock_quantity || 0,
        sku: v.sku || null,
        image: v.image || null
      })) || [],
      variantConfig: finalProduct.variant_config,
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
      })()
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
      variantsLength: updates.variants?.length || 0,
      importChina: updates.importChina,
      freeDelivery: updates.freeDelivery,
      sameDayDelivery: updates.sameDayDelivery
    })
    
    // Transform the updates for Supabase
    const supabaseUpdates: any = {}
    if (updates.name !== undefined) supabaseUpdates.name = updates.name
    if (updates.originalPrice !== undefined) supabaseUpdates.original_price = updates.originalPrice
    if (updates.price !== undefined) supabaseUpdates.price = updates.price
    if (updates.rating !== undefined) supabaseUpdates.rating = updates.rating
    if (updates.reviews !== undefined) supabaseUpdates.reviews = updates.reviews
    if (updates.image !== undefined) supabaseUpdates.image = updates.image
    if (updates.category_id !== undefined) supabaseUpdates.category_id = updates.category_id
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
    if (updates.importChina !== undefined) supabaseUpdates.import_china = updates.importChina
    if (updates.variantConfig !== undefined) supabaseUpdates.variant_config = updates.variantConfig
    if (updates.variantImages !== undefined) supabaseUpdates.variant_images = updates.variantImages
    if (updates.specificationImages !== undefined) supabaseUpdates.specification_images = updates.specificationImages


    logger.log('📝 Updating product with stock:', {
      stock_quantity: supabaseUpdates.stock_quantity,
      in_stock: supabaseUpdates.in_stock,
      import_china: supabaseUpdates.import_china,
      free_delivery: supabaseUpdates.free_delivery,
      same_day_delivery: supabaseUpdates.same_day_delivery
    })

    const adminClient = createAdminSupabaseClient()
    const { data: product, error } = await adminClient
      .from('products')
      .update(supabaseUpdates)
      .eq('id', id)
      .select(`
        *,
        product_variants (*),
        categories!category_id (id, name, slug, parent_id)
      `)
      .single()

    if (error) {
      console.error('Error updating product:', error)
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
    }

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    logger.log('✅ Product updated successfully:', {
      id: product.id,
      name: product.name,
      import_china: product.import_china,
      free_delivery: product.free_delivery,
      same_day_delivery: product.same_day_delivery
    })


    // Handle variants update
    if (updates.variants !== undefined) {
      logger.log('Updating variants for product:', id)
      logger.log('Variants to save:', updates.variants)
      
      // Calculate total stock from simplified variants (variant_name, price, stock_quantity)
      let calculatedTotalStock = 0
      if (updates.variants && updates.variants.length > 0) {
        updates.variants.forEach((variant: any) => {
          const qty = typeof variant.stock_quantity === 'number' ? variant.stock_quantity : 
                      (typeof variant.stockQuantity === 'number' ? variant.stockQuantity : 0)
          calculatedTotalStock += qty
        })
      }
      logger.log('Calculated total stock from simplified variants:', calculatedTotalStock)

      // Only update product stock from variants if there are actually variants
      // Otherwise, keep the manually set stock quantity
      if (updates.variants && updates.variants.length > 0) {
        await adminClient
          .from('products')
          .update({ 
            stock_quantity: calculatedTotalStock,
            in_stock: calculatedTotalStock > 0
          })
          .eq('id', id)
      }
      
      // First, delete existing variants
      const { error: deleteError } = await adminClient
        .from('product_variants')
        .delete()
        .eq('product_id', id)

      if (deleteError) {
        console.error('Error deleting existing variants:', deleteError)
      } else {
        logger.log('Successfully deleted existing variants')
      }

      // Then, add new variants if they exist (simplified variant system)
      if (updates.variants && updates.variants.length > 0) {
        // Calculate total stock from simplified variants
        let calculatedTotalStock = 0
        updates.variants.forEach((variant: any) => {
          const qty = typeof variant.stock_quantity === 'number' ? variant.stock_quantity : 
                      (typeof variant.stockQuantity === 'number' ? variant.stockQuantity : 0)
          calculatedTotalStock += qty
        })
        
        const variants = updates.variants.map((variant: any) => {
          // Simplified variant system: variant_name, price, stock_quantity
          return {
            product_id: id,
            variant_name: variant.variant_name || null, // Simplified: just variant name
            price: variant.price || updates.price || 0,
            image: variant.image || null,
            sku: variant.sku || null,
            stock_quantity: typeof variant.stock_quantity === 'number' ? variant.stock_quantity : 
                          (typeof variant.stockQuantity === 'number' ? variant.stockQuantity : null)
          }
        })
        
        // Update product stock from simplified variants
        await adminClient
          .from('products')
          .update({ 
            stock_quantity: calculatedTotalStock,
            in_stock: calculatedTotalStock > 0
          })
          .eq('id', id)

        logger.log('Transformed variants for database:', variants)

        const { data: insertedVariants, error: variantError } = await adminClient
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
      const { data: variantData } = await adminClient
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
        attributes: (() => {
          const attrs = variant.attributes || {}
          const displayAttrs = { ...attrs }
          Object.keys(displayAttrs).forEach(key => {
            if (Array.isArray(displayAttrs[key])) {
              displayAttrs[key] = displayAttrs[key].map(item => 
                typeof item === 'object' && item.value ? item.value : item
              ).join(', ')
            }
          })
          return displayAttrs
        })(),
        primaryAttribute: variant.primary_attribute,
        dependencies: variant.dependencies || {},
        primaryValues: variant.primary_values || [],
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
        attributes: (() => {
          const attrs = variant.attributes || {}
          const displayAttrs = { ...attrs }
          Object.keys(displayAttrs).forEach(key => {
            if (Array.isArray(displayAttrs[key])) {
              displayAttrs[key] = displayAttrs[key].map(item => 
                typeof item === 'object' && item.value ? item.value : item
              ).join(', ')
            }
          })
          return displayAttrs
        })(),
        primaryAttribute: variant.primary_attribute,
        dependencies: variant.dependencies || {},
        primaryValues: variant.primary_values || [],
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
      category: product.categories?.name || product.category,
      category_id: product.category_id,
      category_slug: product.categories?.slug,
      category_parent_id: product.categories?.parent_id,
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
      variants: freshVariants,
      variantConfig: product.variant_config,
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
    
    const adminClient = createAdminSupabaseClient()
    
    // First delete variants
    const { error: variantError } = await adminClient
      .from('product_variants')
      .delete()
      .eq('product_id', id)

    if (variantError) {
      console.error('Error deleting variants:', variantError)
    }

    // Then delete the product
    const { error } = await adminClient
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