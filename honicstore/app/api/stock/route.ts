import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Use regular client for public operations
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cache for stock data
let stockCache: Map<number, { stock: any, timestamp: number }> = new Map()
const CACHE_DURATION = 30 * 1000 // 30 seconds cache
const CACHE_CLEANUP_INTERVAL = 60 * 1000 // 1 minute
let lastCacheCleanupAt = 0

// GET /api/stock - Get stock information for products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productIds = searchParams.get('ids')
    const singleId = searchParams.get('id')
    
    if (!productIds && !singleId) {
      return NextResponse.json({ error: 'Product ID(s) required' }, { status: 400 })
    }

    const ids = singleId ? [singleId] : productIds?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    
    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid product IDs' }, { status: 400 })
    }

    const now = Date.now()
    if (now - lastCacheCleanupAt > CACHE_CLEANUP_INTERVAL) {
      for (const [key, entry] of stockCache.entries()) {
        if (now - entry.timestamp >= CACHE_DURATION) {
          stockCache.delete(key)
        }
      }
      lastCacheCleanupAt = now
    }
    const resultById = new Map<number, any>()
    const uncachedIds: number[] = []

    // Check cache first
    for (const id of ids) {
      const cached = stockCache.get(id)
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        resultById.set(id, cached.stock)
      } else {
        uncachedIds.push(id)
      }
    }

    // Fetch uncached items from database with variants for stock calculation
    if (uncachedIds.length > 0) {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id, 
          in_stock, 
          stock_quantity, 
          name,
          product_variants (
            stock_quantity
          )
        `)
        .in('id', uncachedIds)

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 })
      }

      // Process and cache results
      for (const product of products || []) {
        // Calculate stock from variant stock_quantity (simplified variant system)
        let calculatedStock = 0
        if (product.product_variants && Array.isArray(product.product_variants)) {
          product.product_variants.forEach((variant: any) => {
            const qty = typeof variant.stock_quantity === 'number' 
              ? variant.stock_quantity 
              : parseInt(variant.stock_quantity) || 0
            calculatedStock += qty
          })
        }
        
        // Use calculated stock if available, otherwise fall back to product stock
        const finalStock = calculatedStock > 0 ? calculatedStock : product.stock_quantity
        
        const stockData = {
          id: product.id,
          name: product.name,
          inStock: product.in_stock,
          stockQuantity: finalStock,
          availableStock: finalStock === null ? Infinity : (Number.isFinite(finalStock) ? finalStock : 0),
          // Use database in_stock field (managed by trigger) with fallback
          effectiveInStock: product.in_stock ?? ((finalStock === null) || (Number.isFinite(finalStock) && finalStock > 0))
        }
        
        // Cache the result
        stockCache.set(product.id, { stock: stockData, timestamp: now })
        resultById.set(product.id, stockData)
      }
    }

    // Keep output order aligned with requested ids.
    const results = ids
      .map((id) => resultById.get(id))
      .filter((item) => item !== undefined)

    return NextResponse.json({
      success: true,
      stock: results,
      cached: results.length - uncachedIds.length,
      fresh: uncachedIds.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'X-Cache-Status': uncachedIds.length === 0 ? 'HIT' : 'MISS'
      }
    })

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/stock - Update stock for products (admin functionality removed)
export async function POST(request: NextRequest) {
  // Admin functionality removed - this endpoint is disabled
  return NextResponse.json({ 
    error: 'Admin functionality has been removed. Stock updates are not available.' 
  }, { status: 403 })
}















