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
      supplier
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

    const { data: products, error } = await queryBuilder

    if (error) {
      console.error('Error fetching products:', error)
      // Check if error is due to missing is_featured column
      if (error.message && (error.message.includes('is_featured') || error.message.includes('column') && error.message.includes('does not exist'))) {
        console.error('Database schema error detected. Please ensure migration 20250127_add_is_featured_to_products.sql has been run.')
        return createErrorResponse('Database schema mismatch. Please contact administrator.', 500)
      }
      return createErrorResponse('Failed to fetch products from database', 500)
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
    if (categories !== undefined && categories !== null) {
      const categoryList = categories.split(',').map(c => c.trim()).filter(Boolean)
      
      if (categoryList.length > 0) {
        countQuery = countQuery.in('category_id', categoryList)
      } else {
        // If categories parameter exists but is empty, return no products
        countQuery = countQuery.eq('category_id', '00000000-0000-0000-0000-000000000000')
      }
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
    
    // Apply keyword-based search if search term provided
    let filteredProducts = products
    if (performSearch && search) {
      const sanitized = securityUtils.sanitizeInput(search)
      const escapedSearch = escapeSqlWildcards(sanitized)
      
      // Extract keywords from search query (remove common stop words and short words)
      const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'ya', 'inch', 'inches'])
      const keywords = sanitized
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length >= 2 && !stopWords.has(word))
        .map(word => word.replace(/[^\w]/g, '')) // Remove special characters
        .filter(word => word.length >= 2)
      
      // If no meaningful keywords found, use the original search
      const searchKeywords = keywords.length > 0 ? keywords : [sanitized.toLowerCase()]
      
      try {
        // First, search for matching suppliers by name
        const supplierNameConditions = searchKeywords.map(keyword => {
          const escapedKeyword = escapeSqlWildcards(keyword)
          return `company_name.ilike.%${escapedKeyword}%,full_name.ilike.%${escapedKeyword}%`
        }).join(',')

        let matchingSupplierIds: string[] = []
        if (supplierNameConditions) {
          const { data: matchingSuppliers, error: supplierError } = await publicClient
            .from('profiles')
            .select('id')
            .eq('is_supplier', true)
            .or(supplierNameConditions)
            .limit(100)

          if (!supplierError && matchingSuppliers) {
            matchingSupplierIds = matchingSuppliers.map((s: any) => s.id)
          }
        }

        // Build OR query for keyword matching (including supplier IDs if found)
        const keywordConditions = searchKeywords.map(keyword => {
          const escapedKeyword = escapeSqlWildcards(keyword)
          return `name.ilike.%${escapedKeyword}%,description.ilike.%${escapedKeyword}%,category.ilike.%${escapedKeyword}%,brand.ilike.%${escapedKeyword}%`
        }).join(',')

        // Build query with supplier ID matching
        let productQuery = publicClient
          .from('products')
          .select('id, name, description, category, brand, supplier_id, user_id')
          .limit(limit ? parseInt(limit) : 500)

        // If we found matching suppliers, include their products
        if (matchingSupplierIds.length > 0) {
          const supplierIdConditions = matchingSupplierIds.map(id => `supplier_id.eq.${id},user_id.eq.${id}`).join(',')
          productQuery = productQuery.or(`${keywordConditions},${supplierIdConditions}`)
        } else {
          productQuery = productQuery.or(keywordConditions)
        }

        // Search products using keyword OR logic (including supplier matches)
        const { data: keywordResults, error: keywordError } = await productQuery

        if (keywordError) {
          logger.error('Keyword search error:', keywordError)
        }

        // Also try full-text search as a secondary method
        let fullTextResults: any[] = []
        try {
        const { data: searchResults, error: searchError } = await publicClient
          .from('products')
          .select(`
            id, name, description, category, brand, price, image,
            product_variants (
              sku, model, attributes, primary_values, variant_name
            )
          `)
          .textSearch('search_vector', sanitized, { type: 'websearch' })
          .limit(limit ? parseInt(limit) : 100)

          if (!searchError && searchResults) {
            fullTextResults = searchResults
          }
        } catch (ftError) {
          logger.error('Full-text search error:', ftError)
        }
        
        // Combine keyword and full-text results
        const keywordIds = new Set((keywordResults || []).map((r: any) => r.id))
        const fullTextIds = new Set(fullTextResults.map((r: any) => r.id))
        const allMatchedIds = new Set([...keywordIds, ...fullTextIds])
        
        // Search within variant data for additional matches
        const variantMatches = products.filter((p: any) => {
          if (allMatchedIds.has(p.id)) return false // Already matched
          
          const variants = p.product_variants || []
          return variants.some((variant: any) => {
            const variantTexts = [
              variant.variant_name || '', // Include variant_name in search
              variant.sku || '',
              variant.model || '',
              JSON.stringify(variant.attributes || {}),
              JSON.stringify(variant.primary_values || []),
            ]
            
            if (variant.primary_values && Array.isArray(variant.primary_values)) {
              variant.primary_values.forEach((pv: any) => {
                if (pv.value) variantTexts.push(pv.value)
                if (pv.attribute) variantTexts.push(pv.attribute)
              })
            }
            
            const variantText = variantTexts.join(' ').toLowerCase()
            
            // Check if any keyword matches
            return searchKeywords.some(keyword => variantText.includes(keyword))
          })
        })
        
        // Simple substring search across product core fields (including supplier matching)
        // Fetch supplier names for products that weren't matched yet
        const unmatchedProducts = products.filter((p: any) => !allMatchedIds.has(p.id))
        const supplierIdsToCheck = [...new Set(unmatchedProducts.map((p: any) => p.supplier_id || p.user_id).filter(Boolean))]
        
        let supplierNamesMap: Map<string, string> = new Map()
        if (supplierIdsToCheck.length > 0) {
          const { data: suppliersData } = await publicClient
            .from('profiles')
            .select('id, company_name, full_name')
            .in('id', supplierIdsToCheck)
          
          if (suppliersData) {
            suppliersData.forEach((s: any) => {
              const supplierName = (s.company_name || s.full_name || '').toLowerCase()
              supplierNamesMap.set(s.id, supplierName)
            })
          }
        }

        const simpleMatches = products.filter((p: any) => {
          if (allMatchedIds.has(p.id)) return false // Already matched
          
          const text = `${p.name || ''} ${p.description || ''} ${p.category || ''} ${p.brand || ''}`.toLowerCase()
          
          // Check product fields
          if (searchKeywords.some(keyword => text.includes(keyword))) {
            return true
          }
          
          // Check supplier name
          const supplierId = p.supplier_id || p.user_id
          if (supplierId && supplierNamesMap.has(supplierId)) {
            const supplierName = supplierNamesMap.get(supplierId) || ''
            if (searchKeywords.some(keyword => supplierName.includes(keyword))) {
              return true
            }
          }
          
          return false
        })

        // Combine all matches and score by relevance (more keyword matches = higher score)
        const allMatches = [
          ...products.filter((p: any) => allMatchedIds.has(p.id)),
          ...variantMatches,
          ...simpleMatches
        ]
        
        // Score products by number of keyword matches (including supplier name matches)
        const scoredProducts = allMatches.map((p: any) => {
          const productText = `${p.name || ''} ${p.description || ''} ${p.category || ''} ${p.brand || ''}`.toLowerCase()
          let matchCount = searchKeywords.filter(keyword => productText.includes(keyword)).length
          
          // Boost score if supplier name matches
          const supplierId = p.supplier_id || p.user_id
          if (supplierId && supplierNamesMap.has(supplierId)) {
            const supplierName = supplierNamesMap.get(supplierId) || ''
            const supplierMatches = searchKeywords.filter(keyword => supplierName.includes(keyword)).length
            if (supplierMatches > 0) {
              matchCount += supplierMatches // Add supplier matches to score
            }
          }
          
          return { product: p, score: matchCount }
        })
        
        // Sort by score (more matches first) and remove duplicates
        const seenIds = new Set<number>()
        filteredProducts = scoredProducts
          .sort((a, b) => b.score - a.score) // Higher score first
          .filter(({ product }) => {
            if (seenIds.has(product.id)) return false
            seenIds.add(product.id)
          return true
        })
          .map(({ product }) => product)
        
        logger.log(`Keyword search: "${search}" (keywords: ${searchKeywords.join(', ')}) matched ${filteredProducts.length}/${products.length} products`)
      } catch (error) {
        logger.error('Search execution error:', error)
        // Fallback to keyword-based ILIKE search
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'ya', 'inch', 'inches'])
        const keywords = sanitized
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length >= 2 && !stopWords.has(word))
          .map(word => word.replace(/[^\w]/g, ''))
          .filter(word => word.length >= 2)
        
        const searchKeywords = keywords.length > 0 ? keywords : [sanitized.toLowerCase()]
        
        // First, search for matching suppliers by name
        const supplierNameConditions = searchKeywords.map(keyword => {
          const escapedKeyword = escapeSqlWildcards(keyword)
          return `company_name.ilike.%${escapedKeyword}%,full_name.ilike.%${escapedKeyword}%`
        }).join(',')

        let matchingSupplierIds: string[] = []
        if (supplierNameConditions) {
          const { data: matchingSuppliers, error: supplierError } = await publicClient
            .from('profiles')
            .select('id')
            .eq('is_supplier', true)
            .or(supplierNameConditions)
            .limit(100)

          if (!supplierError && matchingSuppliers) {
            matchingSupplierIds = matchingSuppliers.map((s: any) => s.id)
          }
        }

        // Build keyword-based OR query (including supplier IDs if found)
        const keywordConditions = searchKeywords.map(keyword => {
          const escapedKeyword = escapeSqlWildcards(keyword)
          return `name.ilike.%${escapedKeyword}%,description.ilike.%${escapedKeyword}%,category.ilike.%${escapedKeyword}%,brand.ilike.%${escapedKeyword}%`
        }).join(',')

        let fallbackQuery = publicClient
          .from('products')
          .select('id')
          .limit(limit ? parseInt(limit) : 500)

        // If we found matching suppliers, include their products
        if (matchingSupplierIds.length > 0) {
          const supplierIdConditions = matchingSupplierIds.map(id => `supplier_id.eq.${id},user_id.eq.${id}`).join(',')
          fallbackQuery = fallbackQuery.or(`${keywordConditions},${supplierIdConditions}`)
        } else {
          fallbackQuery = fallbackQuery.or(keywordConditions)
        }

        const { data: fallbackResults, error: fallbackError } = await fallbackQuery

        if (fallbackError) {
          logger.error('Fallback search error:', fallbackError)
          filteredProducts = []
        } else {
          const fallbackIds = new Set(fallbackResults?.map(r => r.id) || [])
          
          // Score and sort by keyword matches
          interface ScoredProduct {
            product: any
            score: number
          }
          // Fetch supplier names for fallback products
          const fallbackProducts = products.filter((p: any) => fallbackIds.has(p.id))
          const fallbackSupplierIds = [...new Set(fallbackProducts.map((p: any) => p.supplier_id || p.user_id).filter(Boolean))]
          
          let fallbackSupplierNamesMap: Map<string, string> = new Map()
          if (fallbackSupplierIds.length > 0) {
            const { data: fallbackSuppliersData } = await publicClient
              .from('profiles')
              .select('id, company_name, full_name')
              .in('id', fallbackSupplierIds)
            
            if (fallbackSuppliersData) {
              fallbackSuppliersData.forEach((s: any) => {
                const supplierName = (s.company_name || s.full_name || '').toLowerCase()
                fallbackSupplierNamesMap.set(s.id, supplierName)
              })
            }
          }

          const scoredProducts: any[] = products
            .filter((p: any) => fallbackIds.has(p.id))
            .map((p: any): ScoredProduct => {
              const productText = `${p.name || ''} ${p.description || ''} ${p.category || ''} ${p.brand || ''}`.toLowerCase()
              let matchCount = searchKeywords.filter(keyword => productText.includes(keyword)).length
              
              // Boost score if supplier name matches
              const supplierId = p.supplier_id || p.user_id
              if (supplierId && fallbackSupplierNamesMap.has(supplierId)) {
                const supplierName = fallbackSupplierNamesMap.get(supplierId) || ''
                const supplierMatches = searchKeywords.filter(keyword => supplierName.includes(keyword)).length
                if (supplierMatches > 0) {
                  matchCount += supplierMatches // Add supplier matches to score
                }
              }
              
              return { product: p, score: matchCount }
            })
            .sort((a: ScoredProduct, b: ScoredProduct) => b.score - a.score)
            .map((item: ScoredProduct) => item.product)
          
          filteredProducts = scoredProducts
        }
      }
    }

    // If searching, prioritize results that start with the first word and ILIKE-style matches
    if (performSearch && search) {
      const queryLower = search.toLowerCase()
      const words = queryLower.split(/\s+/).filter(Boolean)
      const firstWord = words[0] || queryLower

      // Fetch supplier names for all products being scored
      const supplierIdsForScoring = [...new Set(filteredProducts.map((p: any) => p.supplier_id || p.user_id).filter(Boolean))]
      let supplierNamesForScoring: Map<string, string> = new Map()
      if (supplierIdsForScoring.length > 0) {
        const { data: suppliersForScoring } = await publicClient
          .from('profiles')
          .select('id, company_name, full_name')
          .in('id', supplierIdsForScoring)
        
        if (suppliersForScoring) {
          suppliersForScoring.forEach((s: any) => {
            const supplierName = (s.company_name || s.full_name || '').toLowerCase()
            supplierNamesForScoring.set(s.id, supplierName)
          })
        }
      }

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

        // Check supplier name matches
        const supplierId = p.supplier_id || p.user_id
        if (supplierId && supplierNamesForScoring.has(supplierId)) {
          const supplierName = supplierNamesForScoring.get(supplierId) || ''
          if (supplierName.startsWith(firstWord)) score += 50 // Boost for supplier name starting with search term
          if (wordBoundary(supplierName, firstWord)) score += 35 // Boost for supplier name containing whole word
          if (supplierName.includes(queryLower)) score += 25 // Boost for supplier name containing search term
        }

        // Check variants
        const variants = Array.isArray(p.product_variants) ? p.product_variants : []
        for (const v of variants) {
          const vSku = (v.sku || '').toLowerCase()
          const vModel = (v.model || '').toLowerCase()
          const vText = `${vSku} ${vModel} ${JSON.stringify(v.attributes||{})} ${JSON.stringify(v.primary_values||[])}`.toLowerCase()
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
      variant_images: productData.variantImages || []
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