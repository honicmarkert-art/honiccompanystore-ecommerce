import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch products by main category (includes all subcategories)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mainCategorySlug = searchParams.get('mainCategory')
    const subCategorySlug = searchParams.get('subCategory')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    if (!mainCategorySlug && !subCategorySlug) {
      return NextResponse.json({ error: 'mainCategory or subCategory parameter is required' }, { status: 400 })
    }

    let query = supabase
      .from('products')
      .select(`
        *,
        product_variants (*),
        categories!category_id (id, name, slug, parent_id)
      `)
      .eq('in_stock', true)

    if (subCategorySlug) {
      // Filter by specific subcategory
      query = query.eq('categories.slug', subCategorySlug)
    } else if (mainCategorySlug) {
      // Filter by main category (get all subcategories)
      const { data: mainCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', mainCategorySlug)
        .eq('parent_id', null)
        .single()

      if (!mainCategory) {
        return NextResponse.json({ error: 'Main category not found' }, { status: 404 })
      }

      // Get all subcategories of this main category
      const { data: subcategories } = await supabase
        .from('categories')
        .select('id')
        .eq('parent_id', mainCategory.id)

      if (!subcategories || subcategories.length === 0) {
        return NextResponse.json({ products: [], count: 0 })
      }

      const subcategoryIds = subcategories.map(sub => sub.id)
      query = query.in('category_id', subcategoryIds)
    }

    // Apply pagination
    if (limit) {
      const limitNum = parseInt(limit)
      if (!isNaN(limitNum) && limitNum > 0) {
        query = query.limit(limitNum)
      }
    }

    if (offset) {
      const offsetNum = parseInt(offset)
      if (!isNaN(offsetNum) && offsetNum >= 0) {
        query = query.range(offsetNum, offsetNum + (parseInt(limit || '20') - 1))
      }
    }

    const { data: products, error } = await query

    if (error) {
      console.error('Error fetching products by category:', error)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    // Transform products to include category information
    const transformedProducts = (products || []).map(product => ({
      ...product,
      category: product.categories?.name || product.category,
      category_id: product.category_id,
      category_slug: product.categories?.slug,
      category_parent_id: product.categories?.parent_id,
    }))

    return NextResponse.json({
      products: transformedProducts,
      count: transformedProducts.length
    })

  } catch (error) {
    console.error('Error in products by category API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

