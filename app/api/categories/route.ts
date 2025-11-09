import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
// GET - Fetch categories from categories table
export async function GET(request: NextRequest) {
  try {
    // Read categories from dedicated table with hierarchy and product counts
    const { data, error } = await supabase
      .from('categories')
      .select(`
        id, 
        name, 
        slug, 
        image_url,
        is_active, 
        display_order,
        parent_id,
        parent:parent_id(name, slug),
        products!category_id(count)
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      // If Supabase is unreachable or DNS fails, serve safe defaults
      const message = String(error?.message || '')
      const isNetworkFailure =
        message.includes('ENOTFOUND') ||
        message.includes('fetch failed') ||
        message.includes('getaddrinfo')

      if (isNetworkFailure) {
        const fallbackCategories = [
          { id: 'all', name: 'All', slug: 'all', product_count: 0 },
          { id: 'sensors', name: 'Sensors', slug: 'sensors', product_count: 0 },
          { id: 'modules', name: 'Modules', slug: 'modules', product_count: 0 },
          { id: 'components', name: 'Components', slug: 'components', product_count: 0 },
          { id: 'tools', name: 'Tools', slug: 'tools', product_count: 0 },
          { id: 'accessories', name: 'Accessories', slug: 'accessories', product_count: 0 },
        ]
        return NextResponse.json({
          success: true,
          categories: fallbackCategories,
          names: fallbackCategories.map(c => c.name),
          count: fallbackCategories.length,
          fallback: true
        })
      }

      return NextResponse.json(
        { error: 'Failed to fetch categories' }, 
        { status: 500 }
      )
    }

    const categories = (data || []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug || (c.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      image_url: (c as any).image_url || null,
      parent_id: c.parent_id,
      parent_name: Array.isArray(c.parent) ? c.parent[0]?.name : (c.parent as any)?.name,
      parent_slug: Array.isArray(c.parent) ? c.parent[0]?.slug : (c.parent as any)?.slug,
      is_main: !c.parent_id,
      is_sub: !!c.parent_id,
      product_count: c.products?.[0]?.count || 0,
    }))

    return NextResponse.json({
      success: true,
      categories,
      names: categories.map(c => c.name),
      count: categories.length
    })

  } catch (error) {
    console.error('Categories API error:', error)
    const message = String((error as any)?.message || '')
    const isNetworkFailure =
      message.includes('ENOTFOUND') ||
      message.includes('fetch failed') ||
      message.includes('getaddrinfo')

    if (isNetworkFailure) {
      const fallbackCategories = [
        { id: 'all', name: 'All', slug: 'all', product_count: 0 },
        { id: 'sensors', name: 'Sensors', slug: 'sensors', product_count: 0 },
        { id: 'modules', name: 'Modules', slug: 'modules', product_count: 0 },
        { id: 'components', name: 'Components', slug: 'components', product_count: 0 },
        { id: 'tools', name: 'Tools', slug: 'tools', product_count: 0 },
        { id: 'accessories', name: 'Accessories', slug: 'accessories', product_count: 0 },
      ]
      return NextResponse.json({
        success: true,
        categories: fallbackCategories,
        names: fallbackCategories.map(c => c.name),
        count: fallbackCategories.length,
        fallback: true
      })
    }

    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
