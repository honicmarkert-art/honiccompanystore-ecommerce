import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    
    if (!idsParam) {
      return NextResponse.json(
        { error: 'Missing ids parameter. Use ?ids=1,2,3,4' },
        { status: 400 }
      )
    }

    // Parse comma-separated IDs
    const ids = idsParam.split(',').map(id => {
      const parsed = parseInt(id.trim())
      if (isNaN(parsed)) {
        throw new Error(`Invalid ID: ${id}`)
      }
      return parsed
    })

    if (ids.length === 0) {
      return NextResponse.json({ products: [] })
    }

    // Limit batch size to prevent abuse
    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 products per batch request' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Single database query with IN clause
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        price,
        original_price,
        description,
        image,
        category,
        brand,
        in_stock,
        stock_quantity,
        rating,
        reviews,
        free_delivery,
        same_day_delivery,
        created_at,
        updated_at,
        product_variants (*)
      `)
      .in('id', ids)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Batch products fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch products', details: error.message },
        { status: 500 }
      )
    }

    // Return products in the same order as requested IDs
    const orderedProducts = ids.map(id => 
      products?.find(product => product.id === id)
    ).filter(Boolean)

    return NextResponse.json({
      products: orderedProducts,
      count: orderedProducts.length,
      requested: ids.length,
      cached: false
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Data-Source': 'PRODUCTS_BATCH_TABLE'
      }
    })

  } catch (error) {
    console.error('Batch products API error:', error)
    return NextResponse.json(
      { 
        error: 'Invalid request', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 400 }
    )
  }
}
