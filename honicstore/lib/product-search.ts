import { createClient } from '@supabase/supabase-js'
import { getCachedData, setCachedData } from '@/lib/database-optimization'
import { askJson, toListItem } from '@/lib/visual-search'
import { getSupabaseClient } from '@/lib/supabase-server'

/**
 * Product search for the Marketplace page.
 *  - searchProducts(): typed search -> database function public.search_products_v2
 *    (typo-tolerant, ranked, filters, total count) — see database/2026-11-22-search-v2.sql
 *  - interpretQuery(): AI search -> Gemini turns a natural-language request into keywords,
 *    a real category, a price range, stock and sort, which then run through searchProducts().
 */

export type SortBy = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating' | 'popular'
export const SORTS: SortBy[] = ['relevance', 'price_asc', 'price_desc', 'newest', 'rating', 'popular']

export type SearchParams = {
  q?: string
  categorySlug?: string | null // main or sub category slug; a main category includes its subcategories
  minPrice?: number | null
  maxPrice?: number | null
  inStock?: boolean
  sort?: SortBy
  limit?: number
  offset?: number
}

type Category = { id: string; name: string; slug: string; parent_id: string | null; is_main?: boolean }

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function getCategories(): Promise<Category[]> {
  const cached = getCachedData('search:categories') as Category[] | null
  if (cached) return cached
  // NOTE: categories has no is_main column (the /api/categories route derives it) — a main category has no parent
  const { data, error } = await db().from('categories').select('id, name, slug, parent_id')
  if (error || !data) return [] // don't cache failures
  const list = (data as Category[]).map((c) => ({ ...c, is_main: !c.parent_id }))
  setCachedData('search:categories', list, 10 * 60 * 1000)
  return list
}

/** slug -> [its id, + all subcategory ids] */
async function categoryIds(slug?: string | null): Promise<string[] | null> {
  if (!slug) return null
  const cats = await getCategories()
  const root = cats.find((c) => c.slug === slug)
  if (!root) return null
  const ids = new Set([root.id])
  let grew = true
  while (grew) {
    grew = false
    for (const c of cats) if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) { ids.add(c.id); grew = true }
  }
  return [...ids]
}

const num = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

export async function searchProducts(p: SearchParams) {
  const limit = Math.min(Math.max(Number(p.limit) || 24, 1), 60)
  const offset = Math.max(Number(p.offset) || 0, 0)
  const ids = await categoryIds(p.categorySlug)
  const client = db()

  const { data: hits, error } = await client.rpc('search_products_v2', {
    q: (p.q || '').slice(0, 100),
    category_ids: ids,
    min_price: num(p.minPrice),
    max_price: num(p.maxPrice),
    in_stock_only: !!p.inStock,
    sort_by: SORTS.includes(p.sort as SortBy) ? p.sort : 'relevance',
    lim: limit,
    off: offset,
  })
  if (error) throw new Error(error.message)

  const rows = (hits || []) as Array<{ id: number; score: number; total_count: number; is_strong: boolean }>
  const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0
  // exact=false: nothing matched by name/brand/category — results are only loosely related (show a notice)
  const exact = !(p.q || '').trim() || rows.some((r) => r.is_strong)
  if (!rows.length) return { products: [], total, hasMore: false, exact: true }

  const { data: products } = await client
    .from('products')
    .select('*, product_variants (*)')
    .in('id', rows.map((r) => r.id))
  const byId = new Map((products || []).map((r: any) => [Number(r.id), r]))
  const list = rows
    .map((r) => byId.get(Number(r.id)))
    .filter(Boolean)
    .map((row) => {
      const { match: _m, ...item } = toListItem(row as any, 'related')
      return item
    })
  return { products: list, total, hasMore: offset + rows.length < total, exact }
}

// ---------------------------------------------------------------- AI search

export type Interpretation = {
  /** What the shopper needs, as 1-4 specific product searches (e.g. ["load cell", "hx711"]) */
  parts: { term: string; alternatives: string[]; why: string }[]
  keywords: string
  categorySlug: string | null
  categoryName: string | null
  minPrice: number | null
  maxPrice: number | null
  inStock: boolean
  sort: SortBy
  summary: string
}

/** Simple, deterministic language check (Swahili has distinctive common words). Defaults to English. */
const SW_MARKERS = /\b(nataka|nitafute|nitafutie|natafuta|tafuta|nahitaji|kupima|kutengeneza|mradi|yangu|wangu|kwa|ya|wa|za|vya|cha|na|ni|bei|nafuu|mtoto|joto|uzito|kifaa|vifaa|kwenye|ambayo|inayo|nini|gani|nzuri|rahisi)\b/gi
export function detectLanguage(text: string): 'Swahili' | 'English' {
  return (text.match(SW_MARKERS) || []).length >= 2 ? 'Swahili' : 'English'
}

export async function interpretQuery(request: string): Promise<Interpretation | null> {
  const language = detectLanguage(request)
  const cats = await getCategories()
  const catalog = cats.map((c) => `${c.slug}: ${c.name}`).join('\n')
  const raw = await askJson<Record<string, unknown>>(
    [{
      text: `You are an expert shop assistant for an online electronics and general store in Tanzania (prices in TZS).
It sells electronics components (Arduino, ESP32, Raspberry Pi, sensors, modules, load cells, drivers, displays, kits, tools,
3D printers), phones and accessories, computers, home electronics, school items, furniture and more.

The shopper may write in ANY language (often Swahili or English) and may describe a PROJECT or PROBLEM instead of a product.
Work out which actual products they need and name them the way a store lists them.
LANGUAGE RULE: write "summary" and every "why" in ${language}. Product terms are always English.
If the request is already a product name or model (e.g. "esp32", "arduino uno", "hc-sr04", "16gb sd card"), use the shopper's
words as the single term — do not make it longer or more specific.
Examples:
- "kupima uzito wa mtoto" / "measure a child's weight" -> load cell, hx711
- "measure distance for my robot" -> ultrasonic sensor
- "control a motor with arduino" -> motor driver
- "temperature for my incubator" -> temperature sensor, relay module
- "smart door lock with fingerprint" -> fingerprint sensor, solenoid lock, relay module, esp32
The store mostly sells COMPONENTS: if the request is a complete device that is a typical DIY electronics project
(smart lock, weighing scale, alarm, robot, incubator), list the components needed to build it instead of the finished device.
For non-DIY items (e.g. a computer monitor, a chair, a phone) just search for that item.

Store categories (slug: name):
${catalog}

Shopper request: """${request.slice(0, 300)}"""

Reply with JSON only:
{
  "parts": [ { "term": "1-3 English words naming ONE product, as a store would list it", "alternatives": ["0-2 other names for the SAME kind of product, more generic, e.g. 'fingerprint sensor' for 'fingerprint door lock'"], "why": "very short reason, in the shopper's language" } ],
  "category": "one slug from the list above if clearly implied, else null",
  "min_price": number or null,
  "max_price": number or null (convert '10k' to 10000; 'cheap'/'affordable' without a number -> null and sort price_asc),
  "in_stock": true ONLY if they say they need it now/today/urgently, else false,
  "sort": "relevance" | "price_asc" | "price_desc" | "newest" | "rating" | "popular",
  "summary": "one short sentence, IN THE SHOPPER'S LANGUAGE, saying what you are LOOKING FOR (e.g. 'Looking for parts to build a weighing scale'). Never claim anything was found — you have not searched yet."
}
Give 1 part for a simple product request, up to 4 for a project. Most important part first. Do not add generic words like 'project', 'robot', 'for arduino' to terms.`,
    }],
    { maxTokens: 400, timeoutMs: 15000 },
  )
  if (!raw) return null
  const clean = (v: unknown, n = 80) => (typeof v === 'string' ? v.replace(/[^\p{L}\p{N}\s\-.]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '')
  const parts = (Array.isArray(raw.parts) ? raw.parts : [])
    .map((p: any) => ({
      term: clean(p?.term, 40),
      alternatives: (Array.isArray(p?.alternatives) ? p.alternatives : []).map((a: unknown) => clean(a, 40)).filter((a: string) => a.length >= 2).slice(0, 2),
      why: typeof p?.why === 'string' ? p.why.slice(0, 120) : '',
    }))
    .filter((p) => p.term.length >= 2)
    .filter((p, i, all) => all.findIndex((x) => x.term.toLowerCase() === p.term.toLowerCase()) === i)
    .slice(0, 4)
  const slug = typeof raw.category === 'string' ? raw.category.trim() : ''
  const cat = cats.find((c) => c.slug === slug) || null
  return {
    parts,
    keywords: parts.map((p) => p.term).join(', '),
    categorySlug: cat?.slug || null,
    categoryName: cat?.name || null,
    minPrice: num(raw.min_price),
    maxPrice: num(raw.max_price),
    inStock: raw.in_stock === true,
    sort: SORTS.includes(raw.sort as SortBy) ? (raw.sort as SortBy) : 'relevance',
    summary: typeof raw.summary === 'string' ? raw.summary.slice(0, 200) : '',
  }
}

type ListItem = Awaited<ReturnType<typeof searchProducts>>['products'][number]

/**
 * AI search: the AI names the parts needed, each part is searched (best matches first), and results
 * are merged in part order. Filters are relaxed per part if a part finds nothing.
 */
export async function aiSearch(request: string, limit = 24) {
  const it = await interpretQuery(request)
  if (!it || !it.parts.length) {
    const r = await searchProducts({ q: request, limit })
    return { ...r, interpretation: it, groups: [], relaxed: false }
  }

  const perPart = Math.max(3, Math.ceil(limit / it.parts.length))
  let relaxed = false
  const results = await Promise.all(it.parts.map(async (part) => {
    const attempts: SearchParams[] = [
      { q: part.term, categorySlug: it.categorySlug, minPrice: it.minPrice, maxPrice: it.maxPrice, inStock: it.inStock, sort: it.sort },
      { q: part.term, minPrice: it.minPrice, maxPrice: it.maxPrice, sort: it.sort },
      { q: part.term, sort: it.sort },
      // same kind of product under a more generic name (e.g. "fingerprint sensor" for "fingerprint door lock")
      ...part.alternatives.map((alt) => ({ q: alt, minPrice: it.minPrice, maxPrice: it.maxPrice, sort: it.sort })),
    ]
    for (let i = 0; i < attempts.length; i++) {
      const r = await searchProducts({ ...attempts[i], limit: perPart })
      if (r.total > 0) {
        if (i > 0) relaxed = true
        // a part with only loose (description) matches is shown after parts with real matches
        return { part, products: r.products, exact: r.exact, total: r.total, matchedTerm: String(attempts[i].q) }
      }
    }
    return { part, products: [] as ListItem[], exact: true, total: 0, matchedTerm: part.term }
  }))

  // merge: parts in AI order, exact parts first; no duplicates
  const ordered = [...results].sort((a, b) => Number(b.exact) - Number(a.exact))
  const seen = new Set<number>()
  const products: ListItem[] = []
  const groups = ordered.map(({ part, products: list, exact, total, matchedTerm }) => {
    const ids: number[] = []
    for (const p of list) if (!seen.has(p.id)) { seen.add(p.id); products.push(p); ids.push(p.id) }
    return { term: part.term, matchedTerm, why: part.why, count: total, exact, productIds: ids }
  })

  return {
    products: products.slice(0, limit),
    total: products.length,
    hasMore: false,
    exact: groups.some((g) => g.exact && g.count > 0),
    interpretation: it,
    groups,
    relaxed,
  }
}

// ---------------------------------------------------------------- sellers

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isSellerId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
export type SellerHit = { id: string; name: string; verified: boolean; products: number }

/** Only what a shopper may see about a seller: business name, verified badge, number of products. */
async function sellerCards(ids: string[]): Promise<SellerHit[]> {
  if (!ids.length) return []
  const admin = getSupabaseClient() // profiles are not public: read on the server, return public fields only
  const [{ data: people }, { data: prods }] = await Promise.all([
    admin.from('profiles').select('id, company_name, is_verified').in('id', ids).eq('is_supplier', true).or('is_active.is.null,is_active.eq.true'),
    db().from('products').select('supplier_id').in('supplier_id', ids).or('is_hidden.is.null,is_hidden.eq.false').limit(5000),
  ])
  const count = new Map<string, number>()
  for (const p of prods || []) count.set(p.supplier_id as string, (count.get(p.supplier_id as string) || 0) + 1)
  return (people || [])
    .filter((p) => String(p.company_name || '').trim() && count.get(p.id as string))
    .map((p) => ({ id: p.id as string, name: String(p.company_name).trim(), verified: !!p.is_verified, products: count.get(p.id as string) || 0 }))
}

/** Sellers whose business name matches what the shopper typed (3+ letters). */
export async function findSellers(q: string): Promise<SellerHit[]> {
  const term = q.replace(/[%_,()*:"'\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  if (term.length < 3) return []
  const cacheKey = `search:sellers:${term.toLowerCase()}`
  const cached = getCachedData(cacheKey) as SellerHit[] | null
  if (cached) return cached
  const { data } = await getSupabaseClient().from('profiles').select('id').eq('is_supplier', true).or('is_active.is.null,is_active.eq.true').ilike('company_name', `%${term}%`).limit(5)
  const hits = (await sellerCards((data || []).map((p) => p.id as string))).sort((a, b) => b.products - a.products).slice(0, 4)
  setCachedData(cacheKey, hits, 5 * 60 * 1000)
  return hits
}

/** One seller's products, with the same filters as search (and an optional word to search within them). */
export async function sellerProducts(p: SearchParams & { sellerId: string }) {
  const limit = Math.min(Math.max(Number(p.limit) || 24, 1), 60)
  const offset = Math.max(Number(p.offset) || 0, 0)
  const [seller] = await sellerCards([p.sellerId])
  if (!seller) return { products: [], total: 0, hasMore: false, exact: true, seller: null }
  const ids = await categoryIds(p.categorySlug)
  let q = db().from('products').select('*, product_variants (*)', { count: 'exact' }).eq('supplier_id', p.sellerId).or('is_hidden.is.null,is_hidden.eq.false')
  const words = (p.q || '').replace(/[%_,()*:"'\\]/g, ' ').trim().slice(0, 60)
  if (words) q = q.ilike('name', `%${words}%`)
  if (ids) q = q.in('category_id', ids)
  if (num(p.minPrice) != null) q = q.gte('price', num(p.minPrice)!)
  if (num(p.maxPrice) != null) q = q.lte('price', num(p.maxPrice)!)
  if (p.inStock) q = q.eq('in_stock', true)
  const order: Record<SortBy, [string, boolean]> = { relevance: ['sold_count', false], popular: ['sold_count', false], newest: ['created_at', false], rating: ['rating', false], price_asc: ['price', true], price_desc: ['price', false] }
  const [col, asc] = order[SORTS.includes(p.sort as SortBy) ? (p.sort as SortBy) : 'relevance']
  const { data, count, error } = await q.order(col, { ascending: asc, nullsFirst: false }).order('id', { ascending: false }).range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  const products = (data || []).map((row) => { const { match: _m, ...item } = toListItem(row as Parameters<typeof toListItem>[0], 'related'); return item })
  return { products, total: count || 0, hasMore: offset + products.length < (count || 0), exact: true, seller }
}

/** Items imported to order from China (for mixing a few into the marketplace feed). */
export async function chinaProducts(limit = 60) {
  const { data, error } = await db()
    .from('products')
    .select('*, product_variants (*)')
    .eq('import_china', true)
    .or('is_hidden.is.null,is_hidden.eq.false')
    .limit(Math.min(Math.max(limit, 1), 100))
  if (error) throw new Error(error.message)
  const products = (data || []).map((row) => { const { match: _m, ...item } = toListItem(row as Parameters<typeof toListItem>[0], 'related'); return item })
  return { products, total: products.length, hasMore: false, exact: true }
}
