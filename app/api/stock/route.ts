import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

// Cache for stock data
let stockCache: Map<number, { stock: any, timestamp: number }> = new Map()
const CACHE_DURATION = 30 * 1000 // 30 seconds cache

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
    const results: any[] = []
    const uncachedIds: number[] = []

    // Check cache first
    for (const id of ids) {
      const cached = stockCache.get(id)
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        results.push(cached.stock)
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
            id,
            primary_values,
            stock_quantity
          )
        `)
        .in('id', uncachedIds)

      if (error) {
        console.error('Error fetching stock data:', error)
        return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 })
      }

      // Process and cache results
      for (const product of products || []) {
        // Calculate stock from attribute quantities in variants
        let calculatedStock = 0
        if (product.product_variants && Array.isArray(product.product_variants)) {
          product.product_variants.forEach((variant: any) => {
            if (Array.isArray(variant.primary_values)) {
              variant.primary_values.forEach((pv: any) => {
                const qty = typeof pv.quantity === 'number' ? pv.quantity : parseInt(pv.quantity) || 0
                calculatedStock += qty
              })
            }
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
        results.push(stockData)
      }
    }

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
    console.error('Stock API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/stock - Update stock for products (admin only)
export async function POST(request: NextRequest) {
  try {
    const { productId, stockQuantity, inStock } = await request.json()
    
    if (!productId || stockQuantity === undefined || inStock === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Update stock in database
    const { error } = await supabase
      .from('products')
      .update({ 
        stock_quantity: stockQuantity,
        in_stock: inStock
      })
      .eq('id', productId)

    if (error) {
      console.error('Error updating stock:', error)
      return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 })
    }

    // Invalidate cache for this product
    stockCache.delete(productId)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Stock update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}















