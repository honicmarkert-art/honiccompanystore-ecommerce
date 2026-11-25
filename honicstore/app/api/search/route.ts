import { NextRequest, NextResponse } from 'next/server'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { searchProducts, type SortBy } from '@/lib/product-search'

/**
 * GET /api/search — typed product search (Marketplace page).
 *   q, category (main or sub slug), minPrice, maxPrice, inStock=1, sort, limit, offset
 * Backed by the database function search_products_v2 (typo-tolerant, ranked).
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }
  const sp = request.nextUrl.searchParams
  try {
    const result = await searchProducts({
      q: sp.get('q') || '',
      categorySlug: sp.get('category'),
      minPrice: sp.get('minPrice') ? Number(sp.get('minPrice')) : null,
      maxPrice: sp.get('maxPrice') ? Number(sp.get('maxPrice')) : null,
      inStock: sp.get('inStock') === '1' || sp.get('inStock') === 'true',
      sort: (sp.get('sort') as SortBy) || 'relevance',
      limit: Number(sp.get('limit')) || 24,
      offset: Number(sp.get('offset')) || 0,
    })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch {
    return NextResponse.json({ error: 'Search failed', products: [], total: 0, hasMore: false }, { status: 500 })
  }
}
