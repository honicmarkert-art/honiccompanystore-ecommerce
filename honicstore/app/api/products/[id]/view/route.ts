import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// POST - Track product view
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    
    // Validate product ID
    if (!productId || isNaN(Number(productId))) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Increment view count atomically
    const { data, error } = await supabase.rpc('increment_product_views', {
      product_id: parseInt(productId)
    })

    if (error) {
      // If RPC function doesn't exist, fall back to UPDATE
      console.log('RPC function not found, using UPDATE:', error.message)
      
      // Get current views
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('views')
        .eq('id', productId)
        .single()

      if (fetchError) {
        console.error('Error fetching product:', fetchError)
        return NextResponse.json(
          { success: false, error: 'Product not found' },
          { status: 404 }
        )
      }

      // Increment views
      const { error: updateError } = await supabase
        .from('products')
        .update({ 
          views: (product?.views || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)

      if (updateError) {
        console.error('Error updating views:', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update views' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        views: (product?.views || 0) + 1
      })
    }

    return NextResponse.json({
      success: true,
      views: data || 0
    })
  } catch (error: any) {
    console.error('Error tracking product view:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}






