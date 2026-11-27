import { NextRequest, NextResponse } from 'next/server'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { findSellers, isSellerId, searchProducts, sellerProducts, type SortBy } from '@/lib/product-search'

/**
 * GET /api/search — typed product search (Marketplace page).
 *   q, category (main or sub slug), minPrice, maxPrice, inStock=1, sort, limit, offset, seller (id)
 * Backed by the database function search_products_v2 (typo-tolerant, ranked).
 *  - seller=<id>: only that seller's products (q then searches within them)
 *  - otherwise, on the first page, `sellers` lists sellers whose business name matches q
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }
  const sp = request.nextUrl.searchParams
  const params = {
    q: sp.get('q') || '',
    categorySlug: sp.get('category'),
    minPrice: sp.get('minPrice') ? Number(sp.get('minPrice')) : null,
    maxPrice: sp.get('maxPrice') ? Number(sp.get('maxPrice')) : null,
    inStock: sp.get('inStock') === '1' || sp.get('inStock') === 'true',
    sort: (sp.get('sort') as SortBy) || 'relevance',
    limit: Number(sp.get('limit')) || 24,
    offset: Number(sp.get('offset')) || 0,
  }
  try {
    const seller = sp.get('seller')
    if (seller && !isSellerId(seller)) return NextResponse.json({ error: 'Unknown seller', products: [], total: 0, hasMore: false }, { status: 400 })
    const result = seller
      ? await sellerProducts({ ...params, sellerId: seller })
      : await Promise.all([searchProducts(params), params.offset === 0 && params.q.trim().length >= 3 ? findSellers(params.q) : Promise.resolve([])])
          .then(([r, sellers]) => ({ ...r, sellers }))
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch {
    return NextResponse.json({ error: 'Search failed', products: [], total: 0, hasMore: false }, { status: 500 })
  }
}
