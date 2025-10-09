import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch all unique brands from products
export async function GET(request: NextRequest) {
  try {
    // Use the imported supabase client
    
    // Get unique brands from products table
    const { data: brands, error } = await supabase
      .from('products')
      .select('brand')
      .not('brand', 'is', null)
      .not('brand', 'eq', '')
      .order('brand')

    if (error) {
      console.error('Error fetching brands:', error)
      return NextResponse.json(
        { error: 'Failed to fetch brands' }, 
        { status: 500 }
      )
    }

    // Extract unique brands and sort them
    const uniqueBrands = [...new Set(brands.map(item => item.brand))]
      .filter(brand => brand && brand.trim() !== '')
      .sort()

    return NextResponse.json({
      success: true,
      brands: uniqueBrands,
      count: uniqueBrands.length
    })

  } catch (error) {
    console.error('Brands API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
