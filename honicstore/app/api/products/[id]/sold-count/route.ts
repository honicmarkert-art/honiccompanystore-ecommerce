import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSecureResponse, createErrorResponse } from '@/lib/secure-api'

// GET - Get sold count for a product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    
    if (!productId || isNaN(Number(productId))) {
      return createErrorResponse('Invalid product ID', 400)
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Fetch sold_count and buyers_count directly from products table
    // These columns are maintained by database triggers and won't decrease when orders are deleted
    const { data: product, error } = await supabase
      .from('products')
      .select('sold_count, buyers_count')
      .eq('id', productId)
      .single()

    if (error) {
      console.error('Error fetching product sold count:', error)
      return createErrorResponse('Failed to fetch sold count', 500)
    }

    const soldCount = product?.sold_count || 0
    const buyersCount = product?.buyers_count || 0

    return createSecureResponse({
      soldCount,
      buyersCount
    }, {
      cacheControl: 'public, s-maxage=300, stale-while-revalidate=600'
    })
  } catch (error: any) {
    console.error('Error in GET /api/products/[id]/sold-count:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

