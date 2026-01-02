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

    // Track which search methods were used (for test page display)
    const searchMethodsUsed = new Set<string>()

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
    // Variables for search normalization (declared at higher scope to avoid duplicates)
    let normalized: string = ''
    let sanitizedForQuery: string = ''
    
    // Full-text search using search_vector (PostgreSQL full-text search)
    // Note: search_vector doesn't handle typos - exact word matching only
    // For typo tolerance, we'll add fuzzy matching in JavaScript after fetching
    if (search && search.trim().length > 0) {
      // Normalize search query to handle variations like "loadcell", "load-cell", "5 kg", etc.
      // Also preserve original query for model numbers like "CZL-616-C"
      const { normalizeSearchQuery, generateSearchVariations } = await import('@/lib/search-normalize')
      normalized = normalizeSearchQuery(search.trim())
      const searchVariations = generateSearchVariations(search.trim())
      sanitizedForQuery = securityUtils.sanitizeInput(normalized)
      // Also try original query (useful for model numbers stored exactly as entered)
      const originalSanitized = securityUtils.sanitizeInput(search.trim().toLowerCase())
      try {
        // Use PostgreSQL full-text search with search_vector column
        // Try normalized query first, then original query if different
        // Combine both using OR for better model number matching (e.g., "CZL-616-C" vs "CZL616C")
        const searchQuery = sanitizedForQuery !== originalSanitized 
          ? `${sanitizedForQuery} | ${originalSanitized}` // OR operator in PostgreSQL text search
          : sanitizedForQuery
        queryBuilder = queryBuilder.textSearch('search_vector', searchQuery, { type: 'websearch' })
      } catch (searchError: any) {
        // Fallback to ILIKE if search_vector doesn't exist or has issues
        logger.log(`Search vector error, falling back to ILIKE: ${searchError.message}`)
        // Use normalized search terms for fallback too
        const searchTerms = sanitizedForQuery.split(/\s+/).filter(Boolean)
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
      // Normalize search query for count query too
      const { normalizeSearchQuery } = await import('@/lib/search-normalize')
      const normalized = normalizeSearchQuery(search.trim())
      const sanitized = securityUtils.sanitizeInput(normalized)
      const originalSanitized = securityUtils.sanitizeInput(search.trim().toLowerCase())
      try {
        // Try both normalized and original query for better model number matching
        const searchQuery = sanitized !== originalSanitized 
          ? `${sanitized} | ${originalSanitized}` // OR operator in PostgreSQL text search
          : sanitized
        countQuery = countQuery.textSearch('search_vector', searchQuery, { type: 'websearch' })
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

    // Products are already filtered by search at database level
    let filteredProducts = products || []

    // If searching, always try fuzzy search even if initial query returned 0 results
    // This allows us to catch typos and find products that don't match exactly
    // Minimum 3 characters required for search
    if (search && search.trim().length >= 3) {
      // Use already normalized query from PostgreSQL search above
      // normalized and sanitizedForQuery are already defined above
      const sanitized = sanitizedForQuery.toLowerCase()
      const queryWords = sanitized.split(/\s+/).filter(w => w.length > 0)
      
      // Sort initial PostgreSQL results by relevance BEFORE fuzzy search
      // This ensures best matches are prioritized even before fuzzy search runs
      
      const countMatchingWords = (name: string, words: string[]): number => {
        return words.filter(word => name.includes(word)).length
      }
      
      filteredProducts = filteredProducts.sort((a: any, b: any) => {
        const aName = (a.name || '').toLowerCase()
        const bName = (b.name || '').toLowerCase()
        
        // Products that match ALL words come first
        const aMatchesAll = queryWords.length > 0 && queryWords.every(word => aName.includes(word))
        const bMatchesAll = queryWords.length > 0 && queryWords.every(word => bName.includes(word))
        if (aMatchesAll && !bMatchesAll) return -1
        if (!aMatchesAll && bMatchesAll) return 1
        
        // Among products matching all words, prioritize those matching more words
        if (aMatchesAll && bMatchesAll) {
          const aWordCount = countMatchingWords(aName, queryWords)
          const bWordCount = countMatchingWords(bName, queryWords)
          if (aWordCount !== bWordCount) return bWordCount - aWordCount
        }
        
        // Exact name match
        const aExactName = aName === sanitized
        const bExactName = bName === sanitized
        if (aExactName && !bExactName) return -1
        if (!aExactName && bExactName) return 1
        
        // Name contains query
        const aNameContains = aName.includes(sanitized)
        const bNameContains = bName.includes(sanitized)
        if (aNameContains && !bNameContains) return -1
        if (!aNameContains && bNameContains) return 1
        
        return 0
      })
      // Initialize search methods tracking (always used for search)
      searchMethodsUsed.add('postgresql')
      searchMethodsUsed.add('normalization')
      
      // sanitized and queryWords are already defined above for sorting
      // Reuse them here instead of redeclaring
      const searchWords = queryWords
      
      // ROBUST FUZZY SEARCH: Always use comprehensive matching for all searches
      // Combines: Levenshtein distance + Fuse.js + Custom matching + Synonyms + All fields
      // Runs all methods simultaneously to catch typos and variations
      // Always run fuzzy search to catch typos and improve search quality
      
      // Mark fuzzy search methods as used (they will always run)
      // comprehensiveSearch uses all methods: Fuse.js, Levenshtein, Synonyms, Custom scoring
      searchMethodsUsed.add('fuse')
      searchMethodsUsed.add('levenshtein') // Always runs in comprehensiveSearch
      searchMethodsUsed.add('custom')
      searchMethodsUsed.add('synonym')
      searchMethodsUsed.add('cache')
      
      try {
        // Import robust fuzzy search utilities and metrics
        const { comprehensiveSearch, extractSearchableText } = await import('@/lib/robust-fuzzy-search')
        const { measureSearchPerformance } = await import('@/lib/search-metrics')
        
        // Fetch more products for comprehensive fuzzy matching (without search filter)
        // Use a broader search to get candidates for fuzzy matching
        const fuzzyQuery = publicClient
          .from('products')
          .select('id, name, description, category, brand, price, image, rating, reviews, in_stock, stock_quantity, free_delivery, same_day_delivery, import_china, is_new, updated_at, variant_config, sold_count, supplier_verified, model, sku, specifications, product_variants (*)')
          .eq('is_hidden', false)
          .limit(2000) // Increased limit for better fuzzy matching coverage
        
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
        
        const { data: fuzzyProducts, error: fuzzyError } = await fuzzyQuery
        
        if (fuzzyError) {
          logger.log(`Fuzzy query error: ${fuzzyError.message || JSON.stringify(fuzzyError)}`)
        }
        
        // Use fuzzyProducts if available, otherwise fall back to initial products array
        // This ensures fuzzy search always runs even if the database query returns empty
        const productsForFuzzySearch = (fuzzyProducts && fuzzyProducts.length > 0) 
          ? fuzzyProducts 
          : (products && products.length > 0 ? products : [])
        
        logger.log(`Fuzzy search: ${productsForFuzzySearch.length} products available for matching (fuzzyProducts: ${fuzzyProducts?.length || 0}, initial products: ${products?.length || 0})`)
        
        if (productsForFuzzySearch.length > 0) {
          // Prepare products for robust fuzzy search (include all fields)
          const searchableProducts = productsForFuzzySearch.map((p: any) => ({
            id: p.id,
            name: p.name || '',
            description: p.description || '',
            category: p.category || '',
            brand: p.brand || '',
            price: p.price || 0,
            model: p.model || '',
            sku: p.sku || '',
            specifications: p.specifications || {},
            variants: (p.product_variants || []).map((v: any) => ({
              variant_name: v.variant_name || '',
              sku: v.sku || '',
              model: v.model || ''
            }))
          }))
          
          // Use comprehensive fuzzy search with all methods (with performance tracking)
          // Always use lower threshold to catch typos - be more lenient for better typo detection
          // Very low threshold to catch typos like "lodicell" -> "load cell"
          const minScoreThreshold = filteredProducts.length === 0 ? 0.01 : filteredProducts.length < 5 ? 0.1 : 0.2
          const { result: fuzzyResults, executionTime } = measureSearchPerformance(
            sanitized,
            'fuzzy',
            () => comprehensiveSearch(searchableProducts, sanitized, {
              maxResults: limitNum || 100,
              combineMethods: true,
              useCache: true, // Enable caching
              minScore: minScoreThreshold // Lower threshold when no exact matches
            })
          )
          
          // Log fuzzy search attempt (always runs for all searches to catch typos)
          logger.log(`Fuzzy search executed for "${sanitized}": ${fuzzyResults.length} fuzzy results found (${filteredProducts.length} exact matches, threshold: ${minScoreThreshold})`)
          
          // Levenshtein is already marked as used above (always runs in comprehensiveSearch)
          // Log if any Levenshtein matches were found
          const hasLevenshtein = fuzzyResults.some((r: any) => r.matchType === 'levenshtein')
          if (hasLevenshtein) {
            logger.log(`Levenshtein distance found ${fuzzyResults.filter((r: any) => r.matchType === 'levenshtein').length} matches for "${sanitized}"`)
          }
          
          // Log performance for monitoring
          if (executionTime > 1000) { // Log slow searches (> 1 second)
            logger.log(`Slow fuzzy search detected: "${sanitized}" took ${executionTime}ms`)
          }
          
          // Combine exact matches with fuzzy matches (exact matches prioritized)
          // Preserve matchType and searchScore from fuzzy results
          const exactMatchIds = new Set(filteredProducts.map((p: any) => p.id))
          const fuzzyMatches = fuzzyResults
            .filter((result: any) => !exactMatchIds.has(result.id))
            .map((result: any) => {
              // Find original product data
              const originalProduct = productsForFuzzySearch.find((p: any) => p.id === result.id)
              // Preserve matchType and searchScore from fuzzy search
              return {
                ...(originalProduct || result.product || result),
                matchType: result.matchType || 'fuzzy',
                searchScore: result.searchScore || 0
              }
            })
          
          // Mark exact matches with matchType
          filteredProducts = filteredProducts.map((p: any) => ({
            ...p,
            matchType: p.matchType || 'exact-postgresql',
            searchScore: p.searchScore || 1
          }))
          
          // Prioritize exact matches, then add fuzzy matches
          // Merge results: exact matches first, then fuzzy matches sorted by quality
          const allProducts = [...filteredProducts, ...fuzzyMatches]
          
          // Sort by match quality: best matches first
          filteredProducts = allProducts.sort((a: any, b: any) => {
            const aName = (a.name || '').toLowerCase()
            const bName = (b.name || '').toLowerCase()
            const queryLower = sanitized.toLowerCase()
            const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0)
            
            // Helper function to count how many query words appear in a name
            const countMatchingWords = (name: string, words: string[]): number => {
              return words.filter(word => name.includes(word)).length
            }
            
            // PRIORITY 1: Products that match ALL words in query come FIRST
            const aMatchesAll = queryWords.every(word => aName.includes(word))
            const bMatchesAll = queryWords.every(word => bName.includes(word))
            if (aMatchesAll && !bMatchesAll) return -1
            if (!aMatchesAll && bMatchesAll) return 1
            
            // PRIORITY 2: Products that match MORE words come before those matching fewer
            if (aMatchesAll && bMatchesAll) {
              const aWordCount = countMatchingWords(aName, queryWords)
              const bWordCount = countMatchingWords(bName, queryWords)
              if (aWordCount !== bWordCount) return bWordCount - aWordCount
            } else if (!aMatchesAll && !bMatchesAll) {
              const aWordCount = countMatchingWords(aName, queryWords)
              const bWordCount = countMatchingWords(bName, queryWords)
              if (aWordCount !== bWordCount) return bWordCount - aWordCount
            }
            
            // PRIORITY 3: Exact name match (name equals query) beats name contains
            const aExactName = aName === queryLower
            const bExactName = bName === queryLower
            if (aExactName && !bExactName) return -1
            if (!aExactName && bExactName) return 1
            
            // PRIORITY 4: Products with search term in name come before those without
            const aNameContains = aName.includes(queryLower)
            const bNameContains = bName.includes(queryLower)
            if (aNameContains && !bNameContains) return -1
            if (!aNameContains && bNameContains) return 1
            
            // PRIORITY 5: Name starts with query beats name contains
            if (aNameContains && bNameContains) {
              const aStartsWith = aName.startsWith(queryLower)
              const bStartsWith = bName.startsWith(queryLower)
              if (aStartsWith && !bStartsWith) return -1
              if (!aStartsWith && bStartsWith) return 1
            }
            
            // PRIORITY 4: Exact matches always come before fuzzy matches
            const aIsExact = a.matchType?.startsWith('exact') || false
            const bIsExact = b.matchType?.startsWith('exact') || false
            if (aIsExact && !bIsExact) return -1
            if (!aIsExact && bIsExact) return 1
            
            // PRIORITY 5: Within exact matches, prioritize by match type
            if (aIsExact && bIsExact) {
              const typeOrder: Record<string, number> = {
                'exact-name': 5,
                'exact-brand': 4,
                'exact-model': 3,
                'exact-sku': 2,
                'exact-postgresql': 1
              }
              const aOrder = typeOrder[a.matchType] || 0
              const bOrder = typeOrder[b.matchType] || 0
              if (aOrder !== bOrder) return bOrder - aOrder
            }
            
            // PRIORITY 6: Fuse matches are better than Levenshtein
            if (!aIsExact && !bIsExact) {
              if (a.matchType === 'fuse' && b.matchType === 'levenshtein') return -1
              if (a.matchType === 'levenshtein' && b.matchType === 'fuse') return 1
            }
            
            // PRIORITY 7: Sort by search score (higher is better)
            const scoreDiff = (b.searchScore || 0) - (a.searchScore || 0)
            if (Math.abs(scoreDiff) > 0.01) return scoreDiff // Significant difference
            
            // PRIORITY 8: Final tiebreaker - prefer shorter names (more specific)
            return aName.length - bName.length
          })
        } else {
          // No products available for fuzzy search (database might be empty or filters too restrictive)
          logger.log(`Fuzzy search attempted for "${sanitized}" but no products available for matching`)
        }
      } catch (fuzzyError: any) {
        // Log error but don't fail the request - fuzzy search is optional enhancement
        logger.log(`Fuzzy search error for "${sanitized}": ${fuzzyError.message || JSON.stringify(fuzzyError)}`)
      }
      
      // FALLBACK: Always try substring match using ILIKE as a supplement to catch products that might be missed
      // This ensures we show products containing the search term even if fuzzy search didn't match well
      // Use original search query (not normalized) for substring matching to catch exact character matches
      const originalSearchQuery = search.trim().toLowerCase()
      
      // Check if any existing results actually contain the query string (in name, description, or specs)
      const hasGoodMatch = filteredProducts.length > 0 && filteredProducts.some((p: any) => {
        const nameLower = (p.name || '').toLowerCase()
        const descLower = (p.description || '').toLowerCase()
        const specsText = p.specifications && typeof p.specifications === 'object'
          ? Object.entries(p.specifications).map(([k, v]) => `${k} ${v}`).join(' ').toLowerCase()
          : ''
        return nameLower.includes(originalSearchQuery) || descLower.includes(originalSearchQuery) || specsText.includes(originalSearchQuery)
      })
      
      logger.log(`Checking substring fallback: filteredProducts.length=${filteredProducts.length}, hasGoodMatch=${hasGoodMatch}, originalSearchQuery="${originalSearchQuery}", length=${originalSearchQuery.length}`)
      
      // Run substring fallback if: no results OR existing results don't contain the query
      // This ensures we always try to find products that contain the search term
      if ((filteredProducts.length === 0 || !hasGoodMatch) && originalSearchQuery.length >= 3) {
        logger.log(`Running ILIKE substring fallback for "${originalSearchQuery}" (${filteredProducts.length} existing results, hasGoodMatch: ${hasGoodMatch})`)
        
        try {
          // Escape special characters for ILIKE (%, _)
          const escapedQuery = escapeSqlWildcards(originalSearchQuery)
          
          // Use PostgreSQL ILIKE for efficient substring matching with original query
          // Check ALL fields: name, description, brand, category, model, SKU, and specifications
          // This ensures we find products even if the search term appears in description or specs
          const fallbackQuery = publicClient
            .from('products')
            .select('id, name, description, category, brand, price, image, rating, reviews, in_stock, stock_quantity, free_delivery, same_day_delivery, import_china, is_new, updated_at, variant_config, sold_count, supplier_verified, model, sku, specifications, product_variants (*)')
            .eq('is_hidden', false)
            .or(`name.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%,brand.ilike.%${escapedQuery}%,category.ilike.%${escapedQuery}%,model.ilike.%${escapedQuery}%,sku.ilike.%${escapedQuery}%`)
            .limit(limitNum || 200) // Increased limit to check more products
          
          // Apply same filters as main query
          if (category) fallbackQuery.eq('category_id', category)
          if (brand) fallbackQuery.eq('brand', brand)
          if (minPrice) {
            const min = parseFloat(minPrice)
            if (!isNaN(min) && min >= 0) fallbackQuery.gte('price', min)
          }
          if (maxPrice) {
            const max = parseFloat(maxPrice)
            if (!isNaN(max) && max >= 0) fallbackQuery.lte('price', max)
          }
          if (inStock === 'true') fallbackQuery.eq('in_stock', true)
          if (isChina === 'true') fallbackQuery.eq('import_china', true)
          if (supplier) fallbackQuery.or(`supplier_id.eq.${supplier},user_id.eq.${supplier}`)
          
          if (categories !== undefined && categories !== null) {
            const categoryList = categories.split(',').map(c => c.trim()).filter(Boolean)
            if (categoryList.length > 0) {
              fallbackQuery.in('category_id', categoryList)
            }
          }
          
          const { data: fallbackProducts, error: fallbackError } = await fallbackQuery
          
          logger.log(`Substring fallback query executed for "${originalSearchQuery}": found ${fallbackProducts?.length || 0} products, error: ${fallbackError ? fallbackError.message : 'none'}`)

        if (fallbackError) {
            logger.log(`Substring fallback query error: ${fallbackError.message || JSON.stringify(fallbackError)}`)
          } else if (fallbackProducts && fallbackProducts.length > 0) {
            // Score and sort substring matches (PostgreSQL already filtered, but we score for ranking)
            // Check ALL fields: name, description, brand, category, model, SKU, and specifications
            const scored = fallbackProducts.map((p: any) => {
              const nameLower = (p.name || '').toLowerCase()
              const descLower = (p.description || '').toLowerCase()
              const brandLower = (p.brand || '').toLowerCase()
              const categoryLower = (p.category || '').toLowerCase()
              const modelLower = ((p.model || '').toString()).toLowerCase()
              const skuLower = ((p.sku || '').toString()).toLowerCase()
              
              // Extract specifications text for matching (check all spec keys and values)
              let specsText = ''
              if (p.specifications && typeof p.specifications === 'object') {
                specsText = Object.entries(p.specifications)
                  .map(([key, value]) => `${key} ${value}`)
                  .join(' ')
          .toLowerCase()
              }
              
              let score = 0
              
              // Name contains gets highest score
              if (nameLower.includes(originalSearchQuery)) score += 100
              // Description contains gets high score (important for terms like "strain")
              if (descLower.includes(originalSearchQuery)) score += 80
              // Brand contains gets medium score
              if (brandLower.includes(originalSearchQuery)) score += 50
              // Category contains gets lower score
              if (categoryLower.includes(originalSearchQuery)) score += 25
              // Model contains gets medium-high score
              if (modelLower.includes(originalSearchQuery)) score += 60
              // SKU contains gets medium-high score
              if (skuLower.includes(originalSearchQuery)) score += 60
              // Specifications contain gets medium score (checks all spec keys and values)
              if (specsText.includes(originalSearchQuery)) score += 40
              
              return { ...p, score, matchType: 'substring', searchScore: score / 100 }
            })
            
            // Sort by score (highest first), then by name
            scored.sort((a, b) => {
              if (b.score !== a.score) return b.score - a.score
              return (a.name || '').localeCompare(b.name || '')
            })
            
            // Patch in_stock and inStock for all substring fallback products
            // CRITICAL: Ensure these fields are always set correctly to prevent frontend filtering
            // Also ensure all required fields are present for transformation
            const scoredWithStock = scored.map(prod => {
              // Determine stock status from multiple sources
              const stockQuantity = typeof prod.stock_quantity === 'number' ? prod.stock_quantity : (typeof prod.stockQuantity === 'number' ? prod.stockQuantity : (prod.stock_quantity || 0))
              const dbInStock = typeof prod.in_stock === 'boolean' ? prod.in_stock : (stockQuantity > 0)
              const frontendInStock = typeof prod.inStock === 'boolean' ? prod.inStock : dbInStock
              
              // Ensure all required fields exist (some might be missing from substring query)
              return {
                ...prod,
                // Always set both fields explicitly to ensure frontend doesn't filter them out
                in_stock: dbInStock,
                inStock: frontendInStock,
                stock_quantity: stockQuantity,
                stockQuantity: stockQuantity,
                // Ensure required fields have defaults if missing
                price: prod.price || 0,
                original_price: prod.original_price || prod.price || 0,
                rating: prod.rating || 0,
                reviews: prod.reviews || 0,
                image: prod.image || null,
                category: prod.category || '',
                brand: prod.brand || '',
                description: prod.description || '',
                // Ensure product_variants is an array
                product_variants: Array.isArray(prod.product_variants) ? prod.product_variants : []
              }
            })
            
            // If we had no results or no good matches, use substring results
            // Otherwise, merge substring results with existing (avoid duplicates)
            if (filteredProducts.length === 0 || !hasGoodMatch) {
              // Replace with substring results (they're better matches)
              filteredProducts = scoredWithStock
              logger.log(`Substring fallback replaced results: ${filteredProducts.length} products containing "${originalSearchQuery}"`)
            } else {
              // Merge: add substring results that aren't already in filteredProducts
              const existingIds = new Set(filteredProducts.map((p: any) => p.id))
              const newSubstringResults = scoredWithStock.filter((p: any) => !existingIds.has(p.id))
              filteredProducts = [...filteredProducts, ...newSubstringResults]
              logger.log(`Substring fallback merged ${newSubstringResults.length} new products (${filteredProducts.length} total)`)
            }
            
            // Mark substring method as used
            searchMethodsUsed.add('substring')
          } else {
            logger.log(`Substring fallback found no products containing "${originalSearchQuery}"`)
          }
        } catch (fallbackError: any) {
          logger.log(`Substring fallback error: ${fallbackError.message || JSON.stringify(fallbackError)}`)
        }
      }
      
      // Enhanced relevance scoring with typo tolerance
      // Uses both custom scoring AND robust fuzzy search results
      // PRIORITY: Products with search term in name get highest priority
      // Then exact brand matches get high priority
      // Includes: name, brand, model, SKU, category, description, specs, variants
      const scoredProducts = filteredProducts.map((p: any) => {
        const nameLower = (p.name || '').toLowerCase()
        const brandLower = (p.brand || '').toLowerCase()
        const categoryLower = (p.category || '').toLowerCase()
        const descLower = (p.description || '').toLowerCase()
        const modelLower = ((p.model || '').toString()).toLowerCase()
        const skuLower = ((p.sku || '').toString()).toLowerCase()
        
        // Include specifications and variants in searchable text
        let specsText = ''
        if (p.specifications && typeof p.specifications === 'object') {
          specsText = Object.entries(p.specifications)
            .map(([key, value]) => `${key} ${value}`)
            .join(' ')
            .toLowerCase()
        }
        
        let variantsText = ''
        if (p.product_variants && Array.isArray(p.product_variants)) {
          variantsText = p.product_variants
            .map((v: any) => `${v.variant_name || ''} ${v.sku || ''} ${v.model || ''}`)
            .join(' ')
            .toLowerCase()
        }
        
        const fullText = `${nameLower} ${brandLower} ${categoryLower} ${descLower} ${modelLower} ${skuLower} ${specsText} ${variantsText}`
        
        let score = 0
        
        // Check if product matches ALL words in query (for multi-word queries)
        const queryWords = sanitized.split(/\s+/).filter(w => w.length > 0)
        const matchesAllWords = queryWords.length > 1 && queryWords.every(word => nameLower.includes(word))
        
        // PRIORITY 1: Exact name match gets highest score
        if (nameLower === sanitized) score += 2000
        
        // PRIORITY 1.5: Name matches ALL words in query (for multi-word queries like "arduino uno")
        if (matchesAllWords) score += 1800 // Very high score for matching all words
        
        // PRIORITY 2: Name contains full query (exact phrase in name)
        if (nameLower.includes(sanitized)) score += 1500
        
        // PRIORITY 3: Exact brand match gets very high score
        if (brandLower === sanitized) score += 1200
        
        // PRIORITY 4: Exact model match gets very high score
        if (modelLower === sanitized) score += 1100
        
        // PRIORITY 5: Exact SKU match gets very high score
        if (skuLower === sanitized) score += 1100
        
        // PRIORITY 6: Name starts with query gets high score
        if (nameLower.startsWith(sanitized)) score += 1000
        
        // PRIORITY 7: Brand starts with query gets high score
        if (brandLower.startsWith(sanitized)) score += 800
        
        // PRIORITY 8: Model starts with query gets high score
        if (modelLower.startsWith(sanitized)) score += 700
        
        // PRIORITY 9: Brand contains exact query gets high score
        if (brandLower.includes(sanitized)) score += 600
        
        // PRIORITY 10: Model contains exact query gets high score
        if (modelLower.includes(sanitized)) score += 550
        
        // PRIORITY 11: SKU contains exact query gets high score
        if (skuLower.includes(sanitized)) score += 500
        
        // Lower priority: Name contains query (but not exact phrase)
        if (nameLower.includes(sanitized) && nameLower !== sanitized && !nameLower.startsWith(sanitized)) {
          score += 400
        }
        
        // Specifications match
        if (specsText.includes(sanitized)) score += 300
        
        // Variants match
        if (variantsText.includes(sanitized)) score += 350
        
        // Check individual words with typo tolerance
        // PRIORITY: Word in name > Word in brand > Word in category > Word in description
        searchWords.forEach(word => {
          // PRIORITY: Word in name gets highest score
          if (nameLower === word) score += 800
          if (nameLower.startsWith(word)) score += 500
          if (nameLower.includes(word)) score += 300
          
          // PRIORITY: Word in brand gets high score
          if (brandLower === word) score += 600
          if (brandLower.startsWith(word)) score += 400
          if (brandLower.includes(word)) score += 250
          
          // PRIORITY: Word in model gets high score
          if (modelLower === word) score += 550
          if (modelLower.startsWith(word)) score += 350
          if (modelLower.includes(word)) score += 200
          
          // PRIORITY: Word in SKU gets high score
          if (skuLower === word) score += 500
          if (skuLower.includes(word)) score += 200
          
          // Lower priority: Category, description, specs, variants
          if (categoryLower.includes(word)) score += 50
          if (descLower.includes(word)) score += 25
          if (specsText.includes(word)) score += 100
          if (variantsText.includes(word)) score += 150
          
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
                  // Typo match in name - give good score (higher priority)
                  score += 250 - (diff * 40)  // Increased from 150-30
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
                  // Typo match in brand - give good score (increased weight)
                  score += 200 - (diff * 30)  // Increased from 100-20
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
                  const similarityScore = similarity * 80 // Increased base score for typos (from 60)
                  
                  // PRIORITY: Higher score if match is in name (highest), then brand
                  if (nameLower.includes(productWord)) {
                    score += similarityScore * 2.5  // Increased from 1.5 - name gets highest priority
                  } else if (brandLower.includes(productWord)) {
                    score += similarityScore * 2.0  // Increased from 1.2 - brand gets high priority
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
      // PRIORITY: Products with search term in name get highest priority
      // Then products with exact brand matches
      // Include products with score > 0 (some match found, including fuzzy matches)
      // Lower threshold for fuzzy matches to include typo-tolerant results
      const minScore = 10 // Lower threshold for relevance scoring (fuzzy search always runs)
      
      // Sort by score, but prioritize products where search term appears in name
      // Enhanced to prioritize products matching ALL words in multi-word queries
          filteredProducts = scoredProducts
        .filter(({ score }) => score > minScore)
        .sort((a, b) => {
          const aName = (a.product.name || '').toLowerCase()
          const bName = (b.product.name || '').toLowerCase()
          const searchLower = sanitized.toLowerCase()
          const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0)
          
          // Helper function to count how many query words appear in a name
          const countMatchingWords = (name: string, words: string[]): number => {
            return words.filter(word => name.includes(word)).length
          }
          
          // PRIORITY 1: Products that match ALL words in query come FIRST
          const aMatchesAll = searchWords.length > 0 && searchWords.every(word => aName.includes(word))
          const bMatchesAll = searchWords.length > 0 && searchWords.every(word => bName.includes(word))
          if (aMatchesAll && !bMatchesAll) return -1
          if (!aMatchesAll && bMatchesAll) return 1
          
          // PRIORITY 2: Among products matching all words, prioritize those matching MORE words
          if (aMatchesAll && bMatchesAll) {
            const aWordCount = countMatchingWords(aName, searchWords)
            const bWordCount = countMatchingWords(bName, searchWords)
            if (aWordCount !== bWordCount) return bWordCount - aWordCount
          } else if (!aMatchesAll && !bMatchesAll) {
            const aWordCount = countMatchingWords(aName, searchWords)
            const bWordCount = countMatchingWords(bName, searchWords)
            if (aWordCount !== bWordCount) return bWordCount - aWordCount
          }
          
          // PRIORITY 3: Exact name match (name equals query) beats name contains
          const aExactName = aName === searchLower
          const bExactName = bName === searchLower
          if (aExactName && !bExactName) return -1
          if (!aExactName && bExactName) return 1
          
          // PRIORITY 4: If one has search term in name and other doesn't, prioritize the one with name match
          const aHasInName = aName.includes(searchLower)
          const bHasInName = bName.includes(searchLower)
          
          if (aHasInName && !bHasInName) return -1  // a comes first
          if (!aHasInName && bHasInName) return 1   // b comes first
          
          // PRIORITY 5: If both or neither have in name, check exact brand match
          const aBrand = (a.product.brand || '').toLowerCase()
          const bBrand = (b.product.brand || '').toLowerCase()
          const aExactBrand = aBrand === searchLower
          const bExactBrand = bBrand === searchLower
          
          if (aExactBrand && !bExactBrand) return -1  // a comes first
          if (!aExactBrand && bExactBrand) return 1   // b comes first
          
          // PRIORITY 6: If both or neither have exact brand match, sort by score
          return b.score - a.score
        })
        .slice(0, limitNum || 100) // Limit results to prevent too many fuzzy matches
        .map(({ product }) => product)
      
      // Update total count for fuzzy matches
      if (filteredProducts.length > 0 && totalCount === 0) {
        totalCount = filteredProducts.length
      }
      
      // Log for debugging (remove in production)
      // Fuzzy search always runs, so log when we have results
      if (filteredProducts.length > 0) {
        const exactCount = filteredProducts.filter((p: any) => p.matchType?.startsWith('exact')).length
        const fuzzyCount = filteredProducts.length - exactCount
        if (fuzzyCount > 0) {
          logger.log(`Search completed for "${sanitized}": ${exactCount} exact matches, ${fuzzyCount} fuzzy matches`)
        }
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

    // Build search methods header (only if search was performed)
    const searchMethodsHeader = search && search.trim().length > 0 
      ? Array.from(searchMethodsUsed).join(',')
      : undefined
    
    const responseHeaders: Record<string, string> = {
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
    
    // Add search methods header if search was performed
    if (searchMethodsHeader) {
      responseHeaders['X-Search-Methods-Used'] = searchMethodsHeader
    }
    
    return createSecureResponse(responseData, {
      cacheControl,
      headers: responseHeaders
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