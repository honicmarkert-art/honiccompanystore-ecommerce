import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
  const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const brand = searchParams.get('brand')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') || 'DESC'

    // Validate parameters
    if (limit > 100) {
      return NextResponse.json(
        { error: 'Maximum limit is 100' },
        { status: 400 }
      )
    }

    if (offset < 0) {
      return NextResponse.json(
        { error: 'Offset must be non-negative' },
        { status: 400 }
      )
    }

    const validSortFields = ['name', 'price', 'rating', 'created_at']
    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json(
        { error: `Invalid sort field. Must be one of: ${validSortFields.join(', ')}` },
        { status: 400 }
      )
    }

    const validSortOrders = ['ASC', 'DESC']
    if (!validSortOrders.includes(sortOrder.toUpperCase())) {
      return NextResponse.json(
        { error: 'Invalid sort order. Must be ASC or DESC' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // For now, use regular products table until materialized view is set up
    let queryBuilder = supabase.from('products')
      .select(`
        id, name, price, original_price, description, 
        image, category, brand, rating, reviews, 
        in_stock, stock_quantity, free_delivery, same_day_delivery,
        created_at, updated_at,
        product_variants (*)
      `)
      .range(offset, offset + limit - 1)

    // Apply filters
    if (category) {
      queryBuilder = queryBuilder.eq('category', category)
    }
    if (brand) {
      queryBuilder = queryBuilder.eq('brand', brand)
    }
    if (search) {
      queryBuilder = queryBuilder.or(`name.ilike.%${search}%,description.ilike.%${search}%,brand.ilike.%${search}%`)
    }

    // Apply sorting
    if (sortBy === 'price') {
      queryBuilder = queryBuilder.order('price', { ascending: sortOrder.toUpperCase() === 'ASC' })
    } else if (sortBy === 'rating') {
      queryBuilder = queryBuilder.order('rating', { ascending: sortOrder.toUpperCase() === 'ASC' })
    } else {
      queryBuilder = queryBuilder.order('created_at', { ascending: sortOrder.toUpperCase() === 'ASC' })
    }

    const { data: products, error } = await queryBuilder

    if (error) {
      console.error('Optimized products fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch products', details: error.message },
        { status: 500 }
      )
    }

    // Get total count for pagination
    let totalCount = 0
    if (products && products.length > 0) {
      let countQuery = supabase.from('products').select('*', { count: 'exact', head: true })
      
      if (category) {
        countQuery = countQuery.eq('category', category)
      }
      if (brand) {
        countQuery = countQuery.eq('brand', brand)
      }
      if (search) {
        countQuery = countQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%,brand.ilike.%${search}%`)
      }

      const { count, error: countError } = await countQuery

      if (!countError) {
        totalCount = count || 0
      }
    }

  return NextResponse.json({
      products: products || [],
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      },
      filters: {
        category,
        brand,
        search,
        sortBy,
        sortOrder: sortOrder.toUpperCase()
      },
      cached: false,
      source: 'materialized_view'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Data-Source': 'PRODUCTS_MATERIALIZED_VIEW'
      }
    })

  } catch (error) {
    console.error('Optimized products API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    )
  }
}