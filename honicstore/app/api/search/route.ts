import { NextRequest, NextResponse } from 'next/server'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { chinaProducts, findSellers, isSellerId, searchProducts, sellerProducts, type SortBy } from '@/lib/product-search'
import { getFreightSettings } from '@/lib/import-freight-server'

/** Adds the air travel time (e.g. "7–14 days") to China items, for the import stamp on cards. */
async function withImportDays<T extends { products: unknown[] }>(r: T): Promise<T> {
  if (!(r.products as { import_china?: boolean }[]).some((p) => p.import_china)) return r
  const s = await getFreightSettings().catch(() => null)
  if (!s) return r
  const days = `${s.air.daysMin}–${s.air.daysMax} days`
  return { ...r, products: (r.products as { import_china?: boolean }[]).map((p) => (p.import_china ? { ...p, importDays: days } : p)) }
}

/**
 * GET /api/search — typed product search (Marketplace page).
 *   q, category (main or sub slug), minPrice, maxPrice, inStock=1, sort, limit, offset, seller (id)
 * Backed by the database function search_products_v2 (typo-tolerant, ranked).
 *  - seller=<id>: only that seller's products (q then searches within them)
 *  - otherwise, on the first page, `sellers` lists sellers whose business name matches q
 *  - china=only: items imported from China; china=exclude: leave them out (the feed mixes a few in itself)
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
    if (sp.get('china') === 'only') return NextResponse.json(await withImportDays(await chinaProducts(Number(sp.get('limit')) || 60)), { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
    const seller = sp.get('seller')
    if (seller && !isSellerId(seller)) return NextResponse.json({ error: 'Unknown seller', products: [], total: 0, hasMore: false }, { status: 400 })
    // china=exclude (marketplace feed): keep reading until the page is full of regular items, and say
    // where the next page starts (China items can fill whole pages of the ranking)
    if (sp.get('china') === 'exclude' && !seller) {
      const want = Math.min(Math.max(params.limit, 1), 60)
      const got: Awaited<ReturnType<typeof searchProducts>>['products'] = []
      let next = Math.max(params.offset, 0), total = 0, more = true
      for (let round = 0; round < 8 && got.length < want && more; round++) {
        const r = await searchProducts({ ...params, offset: next, limit: 60 })
        total = r.total
        if (!r.products.length) { more = false; break }
        for (const p of r.products) {
          next++
          const item = p as { import_china?: boolean; importChina?: boolean }
          if (!(item.import_china || item.importChina)) got.push(p)
          if (got.length >= want) break
        }
        more = next < total
      }
      return NextResponse.json({ products: got, total, hasMore: more, nextOffset: next, exact: true }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
    }
    const result = seller
      ? await sellerProducts({ ...params, sellerId: seller })
      : await Promise.all([searchProducts(params), params.offset === 0 && params.q.trim().length >= 3 ? findSellers(params.q) : Promise.resolve([])])
          .then(([r, sellers]) => ({ ...r, sellers }))
    return NextResponse.json(await withImportDays(result), { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch {
    return NextResponse.json({ error: 'Search failed', products: [], total: 0, hasMore: false }, { status: 500 })
  }
}
