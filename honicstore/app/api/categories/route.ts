import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { logger } from '@/lib/logger'

// Rate limit logging helper
const logRateLimitEvent = (endpoint: string, reason: string | undefined, request: NextRequest) => {
  const clientIP = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('cf-connecting-ip') || 
                   'unknown'
  logger.security(`Rate limit exceeded on ${endpoint}`, undefined, {
    ip: clientIP,
    reason,
    path: request.nextUrl.pathname
  })
}

// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
// GET - Fetch categories from categories table
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await enhancedRateLimit(request)
  if (!rateLimitResult.allowed) {
    logRateLimitEvent('/api/categories', rateLimitResult.reason, request)
    
    return NextResponse.json(
      { error: rateLimitResult.reason || 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
        }
      }
    )
  }

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
          { id: 'diy-electronic-components', name: 'DIY Electronic Components', slug: 'diy-electronic-components', product_count: 0, is_main: true },
          { id: 'home-electronic-devices', name: 'Home Electronic Devices', slug: 'home-electronic-devices', product_count: 0, is_main: true },
          { id: 'home-office-furnitures', name: 'Home & Office furnitures', slug: 'home-office-furnitures', product_count: 0, is_main: true },
          { id: 'training-kits-school-items', name: 'Training kits & School Items', slug: 'training-kits-school-items', product_count: 0, is_main: true },
          { id: 'phones-telecom-devices', name: 'Phones & Telecom Devices', slug: 'phones-telecom-devices', product_count: 0, is_main: true },
          { id: 'fashion-jewelry', name: 'Fashion and Jewelry', slug: 'fashion-jewelry', product_count: 0, is_main: true },
          { id: 'computer-accessories', name: 'Computer & Accessories', slug: 'computer-accessories', product_count: 0, is_main: true },
          { id: 'automotive-parts', name: 'Automotive Parts', slug: 'automotive-parts', product_count: 0, is_main: true },
          { id: 'sports-outdoors', name: 'Sports & Outdoors', slug: 'sports-outdoors', product_count: 0, is_main: true },
          { id: 'beauty-health', name: 'Beauty & Health', slug: 'beauty-health', product_count: 0, is_main: true },
          { id: 'toys-games', name: 'Toys & Games', slug: 'toys-games', product_count: 0, is_main: true },
          { id: 'home-appliances', name: 'Home Appliances', slug: 'home-appliances', product_count: 0, is_main: true },
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
      display_order: c.display_order ?? 999, // Include display_order from database
    }))

    return NextResponse.json({
      success: true,
      categories,
      names: categories.map(c => c.name),
      count: categories.length
    })

  } catch (error) {
    const message = String((error as any)?.message || '')
    const isNetworkFailure =
      message.includes('ENOTFOUND') ||
      message.includes('fetch failed') ||
      message.includes('getaddrinfo')

    if (isNetworkFailure) {
      const fallbackCategories = [
        { id: 'diy-electronic-components', name: 'DIY Electronic Components', slug: 'diy-electronic-components', product_count: 0, is_main: true },
        { id: 'home-electronic-devices', name: 'Home Electronic Devices', slug: 'home-electronic-devices', product_count: 0, is_main: true },
        { id: 'home-office-furnitures', name: 'Home & Office furnitures', slug: 'home-office-furnitures', product_count: 0, is_main: true },
        { id: 'training-kits-school-items', name: 'Training kits & School Items', slug: 'training-kits-school-items', product_count: 0, is_main: true },
        { id: 'phones-telecom-devices', name: 'Phones & Telecom Devices', slug: 'phones-telecom-devices', product_count: 0, is_main: true },
        { id: 'fashion-jewelry', name: 'Fashion and Jewelry', slug: 'fashion-jewelry', product_count: 0, is_main: true },
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
