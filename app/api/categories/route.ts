import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
// GET - Fetch categories from categories table
export async function GET(request: NextRequest) {
  try {
    // Read categories from dedicated table
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, is_active, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching categories:', error)
      // If Supabase is unreachable or DNS fails, serve safe defaults
      const message = String(error?.message || '')
      const isNetworkFailure =
        message.includes('ENOTFOUND') ||
        message.includes('fetch failed') ||
        message.includes('getaddrinfo')

      if (isNetworkFailure) {
        const fallbackCategories = [
          { id: 'all', name: 'All', slug: 'all' },
          { id: 'sensors', name: 'Sensors', slug: 'sensors' },
          { id: 'modules', name: 'Modules', slug: 'modules' },
          { id: 'components', name: 'Components', slug: 'components' },
          { id: 'tools', name: 'Tools', slug: 'tools' },
          { id: 'accessories', name: 'Accessories', slug: 'accessories' },
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
        { id: 'all', name: 'All', slug: 'all' },
        { id: 'sensors', name: 'Sensors', slug: 'sensors' },
        { id: 'modules', name: 'Modules', slug: 'modules' },
        { id: 'components', name: 'Components', slug: 'components' },
        { id: 'tools', name: 'Tools', slug: 'tools' },
        { id: 'accessories', name: 'Accessories', slug: 'accessories' },
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
