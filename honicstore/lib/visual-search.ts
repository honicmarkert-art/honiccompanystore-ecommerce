import { createClient } from '@supabase/supabase-js'
import { getCachedData, setCachedData } from '@/lib/database-optimization'

/**
 * Photo search ("Honic Lens").
 *
 *  1. Gemini looks at the photo and describes the product (name, brand, model numbers,
 *     printed text, category, synonyms) as structured JSON.
 *  2. Every visible product is scored against that description from an in-memory
 *     catalog index (names, brands, SKUs, model numbers, variant names, category,
 *     description), with typo-tolerant token matching and model-number boosts.
 *  3. Gemini re-ranks the top candidates by looking at the photo again next to their
 *     names, so "Arduino Uno board" beats "Arduino USB cable".
 *
 * Every step degrades gracefully: if the re-rank fails, the score order is used.
 */

const MODELS = [
  process.env.GEMINI_VISION_MODEL,
  process.env.GEMINI_MODEL,
  'gemini-3.5-flash-lite', // fastest in our tests (~1.8s per call)
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite-preview',
].filter((m, i, all): m is string => Boolean(m) && all.indexOf(m) === i)

export type ImageInput = { mimeType: string; data: string }

export type PhotoAnalysis = {
  isProduct: boolean
  name: string
  brand: string
  category: string
  modelNumbers: string[]
  visibleText: string[]
  keywords: string[]
  alternatives: string[]
  description: string
}

export type MatchLevel = 'exact' | 'similar' | 'related'

// ---------------------------------------------------------------- Gemini

export type CallOpts = { maxTokens: number; timeoutMs: number; lowRes?: boolean }

async function callGemini(model: string, key: string, parts: unknown[], { maxTokens, timeoutMs, lowRes }: CallOpts): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
          // low = ~280 image tokens instead of ~1100; fine when we only need to compare, not read small print
          ...(lowRes ? { mediaResolution: 'MEDIA_RESOLUTION_LOW' } : {}),
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  )
  if (!res.ok) throw new Error(`Gemini ${model} ${res.status}`)
  const body = (await res.json().catch(() => null)) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null
  return (body?.candidates || []).flatMap((c) => c.content?.parts || []).map((p) => p.text || '').join('').trim()
}

/** Try each configured model until one returns parseable JSON. */
export async function askJson<T>(parts: unknown[], opts: CallOpts): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  for (const model of MODELS) {
    try {
      const text = await callGemini(model, key, parts, opts)
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1)) as T
    } catch {
      // next model
    }
  }
  return null
}

const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const strList = (v: unknown, n = 8) => (Array.isArray(v) ? v.map((x) => str(x, 60)).filter(Boolean).slice(0, n) : [])

const ANALYZE_PROMPT = `You are the visual search engine of an online store in Tanzania that sells electronics components (Arduino, ESP32, Raspberry Pi, sensors, modules, resistors, capacitors, kits, tools, 3D printers), phones and accessories, computers, and general goods.

Identify the main product in the photo the way a shopper would search for it. Read any printed text, labels, chip markings and model numbers carefully.

Reply with JSON only:
{
  "is_product": true,
  "name": "short generic product name, e.g. 'Arduino Uno R3 board' or 'DHT11 temperature humidity sensor'",
  "brand": "brand if visible or obvious, else empty",
  "category": "store category, e.g. 'Development Boards', 'Sensors', 'Phone Accessories'",
  "model_numbers": ["exact model/part numbers seen or strongly implied, e.g. 'ESP32-WROOM-32', '1N4007', 'HC-SR04'"],
  "visible_text": ["important words printed on the item or box"],
  "keywords": ["5-8 single search words, most important first"],
  "alternatives": ["2-4 other ways people name this product, e.g. 'microcontroller board', 'dev board'"],
  "description": "one short sentence describing what you see (color, form, quantity)"
}
If there is no product (e.g. a selfie or landscape), set is_product to false and leave the other fields empty. Use English.`

export async function analyzePhoto(image: ImageInput): Promise<PhotoAnalysis | null> {
  const raw = await askJson<Record<string, unknown>>(
    [{ text: ANALYZE_PROMPT }, { inline_data: { mime_type: image.mimeType, data: image.data } }],
    { maxTokens: 600, timeoutMs: 20000 },
  )
  if (!raw) return null
  return {
    isProduct: raw.is_product !== false,
    name: str(raw.name),
    brand: str(raw.brand, 60),
    category: str(raw.category, 60),
    modelNumbers: strList(raw.model_numbers, 6),
    visibleText: strList(raw.visible_text, 8),
    keywords: strList(raw.keywords, 10),
    alternatives: strList(raw.alternatives, 5),
    description: str(raw.description, 200),
  }
}

// ---------------------------------------------------------------- catalog index

export type IndexedProduct = {
  row: Record<string, any>
  nameTokens: string[]
  tokens: Set<string>
  compact: string // all identifiers without spaces/dashes, for model-number matching
  category: string
}

const CATALOG_KEY = 'visual-search:catalog'
const CATALOG_TTL = 10 * 60 * 1000

const STOP = new Set(['the', 'and', 'for', 'with', 'of', 'a', 'an', 'in', 'on', 'to', 'pcs', 'pc', 'set', 'kit', 'new', 'module', 'board', 'type'])

export const normalize = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
export const tokenize = (s: string) =>
  normalize(s).split(/[\s/]+/).map((t) => t.replace(/^[.-]+|[.-]+$/g, '')).filter((t) => t.length >= 2)
export const compactOf = (s: string) => normalize(s).replace(/[\s.\-_/]+/g, '')

export async function loadCatalog(): Promise<IndexedProduct[]> {
  const cached = getCachedData(CATALOG_KEY) as IndexedProduct[] | null
  if (cached) return cached

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await client
    .from('products')
    .select('*, product_variants (*)')
    .eq('is_hidden', false)
    .limit(5000)
  if (error || !data) throw new Error('Could not load products')

  const index = data.map((row: Record<string, any>) => {
    const variants: any[] = row.product_variants || []
    const variantText = variants.flatMap((v) => [v.name, v.sku, ...(v.attributes ? Object.values(v.attributes) : [])]).filter((x) => typeof x === 'string')
    const ids = [row.sku, row.model, ...variants.map((v) => v.sku)].filter((x) => typeof x === 'string')
    const nameTokens = tokenize(row.name || '')
    const all = [row.name, row.brand, row.category, row.model, row.sku, ...variantText, String(row.description || '').slice(0, 600)].filter(Boolean).join(' ')
    return {
      row,
      nameTokens,
      tokens: new Set(tokenize(all)),
      compact: compactOf([row.name, row.model, ...ids].filter(Boolean).join(' ')),
      category: normalize(row.category || ''),
    }
  })
  setCachedData(CATALOG_KEY, index, CATALOG_TTL)
  return index
}

// ---------------------------------------------------------------- scoring

function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** 1 = exact token, 0.7 = prefix / one typo, 0 = none */
function tokenHit(term: string, p: IndexedProduct): number {
  if (p.tokens.has(term)) return 1
  if (term.length < 4) return 0
  for (const t of p.tokens) {
    if (t.length >= 4 && (t.startsWith(term) || term.startsWith(t))) return 0.7
    if (term.length >= 5 && editDistanceAtMost1(term, t)) return 0.7
  }
  return 0
}

type Weighted = { term: string; w: number }

export function buildTerms(a: PhotoAnalysis): { terms: Weighted[]; models: string[] } {
  const terms = new Map<string, number>()
  const add = (text: string, w: number) => {
    for (const t of tokenize(text)) if (!STOP.has(t)) terms.set(t, Math.max(terms.get(t) || 0, w))
  }
  add(a.name, 3)
  a.keywords.forEach((k, i) => add(k, Math.max(1, 2.2 - i * 0.2)))
  add(a.brand, 2)
  a.visibleText.forEach((t) => add(t, 1.2))
  a.alternatives.forEach((t) => add(t, 1))
  add(a.category, 0.8)
  const models = [...a.modelNumbers, ...a.visibleText.filter((t) => /\d/.test(t) && /[a-z]/i.test(t))]
    .map(compactOf)
    .filter((m) => m.length >= 3)
  return { terms: [...terms].map(([term, w]) => ({ term, w })), models: [...new Set(models)] }
}

export function scoreProduct(p: IndexedProduct, terms: Weighted[], models: string[], a: PhotoAnalysis): number {
  let score = 0
  for (const { term, w } of terms) {
    const hit = tokenHit(term, p)
    if (!hit) continue
    // words in the product name count more than words buried in the description
    score += w * hit * (p.nameTokens.includes(term) ? 1.6 : 1)
  }
  for (const m of models) if (p.compact.includes(m)) score += 10
  if (a.category && p.category && (p.category.includes(normalize(a.category)) || normalize(a.category).includes(p.category))) score += 1.5
  // gently prefer purchasable items
  if (p.row.in_stock === false || Number(p.row.stock_quantity) === 0) score *= 0.85
  return score
}

// ---------------------------------------------------------------- re-rank

async function rerank(image: ImageInput, candidates: IndexedProduct[]): Promise<Map<number, MatchLevel> | null> {
  const list = candidates.map((c) => `${c.row.id}: ${String(c.row.name).slice(0, 90)}`).join('\n')
  // Compact answer format (three id lists) keeps output short — output length dominates latency
  const raw = await askJson<{ e?: unknown[]; s?: unknown[]; r?: unknown[] }>(
    [
      {
        text: `A shopper photographed a product. Store products (id: name):
${list}

Sort the relevant ids into: "e" = the SAME product as the photo, "s" = same kind of product in another size/variant/brand, "r" = useful related items (accessories, kits containing it). Best first within each list. Leave out unrelated ids. Reply JSON only: {"e":[],"s":[],"r":[]}`,
      },
      { inline_data: { mime_type: image.mimeType, data: image.data } },
    ],
    { maxTokens: 200, timeoutMs: 12000, lowRes: true },
  )
  if (!raw) return null
  const allowed = new Set(candidates.map((c) => Number(c.row.id)))
  const out = new Map<number, MatchLevel>()
  const take = (ids: unknown[] | undefined, level: MatchLevel) => {
    for (const v of ids || []) { const id = Number(v); if (allowed.has(id) && !out.has(id)) out.set(id, level) }
  }
  take(raw.e, "exact")
  take(raw.s, "similar")
  take(raw.r, "related")
  return out.size ? out : null
}

// ---------------------------------------------------------------- public API

/** Same shape as /api/products list items, so existing product cards render them. */
export function toListItem(row: Record<string, any>, match: MatchLevel) {
  const variants = (row.product_variants || []).map((v: any) => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    price: v.price,
    image: v.image,
    stock_quantity: v.stock_quantity,
    stockQuantity: v.stock_quantity,
    in_stock: v.in_stock,
    inStock: v.in_stock,
  }))
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: Number(row.price) || 0,
    originalPrice: row.original_price,
    original_price: row.original_price,
    image: row.image,
    rating: row.rating,
    reviews: row.reviews,
    category: row.category,
    category_id: row.category_id,
    brand: row.brand,
    sku: row.sku,
    model: row.model,
    inStock: row.in_stock,
    in_stock: row.in_stock,
    stockQuantity: row.stock_quantity,
    stock_quantity: row.stock_quantity,
    freeDelivery: row.free_delivery,
    free_delivery: row.free_delivery,
    sameDayDelivery: row.same_day_delivery,
    same_day_delivery: row.same_day_delivery,
    importChina: row.import_china,
    import_china: row.import_china,
    is_new: row.is_new,
    sold_count: row.sold_count,
    supplier_verified: row.supplier_verified,
    gallery: row.gallery || [],
    variants,
    match,
  }
}

/** Load the catalog index ahead of time (called when the photo dialog opens). */
export async function warmCatalog() {
  const catalog = await loadCatalog()
  // Also get the no-AI matchers ready: hash product images, start the OCR engine
  const m = await import("@/lib/image-match")
  void m.ensureFingerprints(catalog).catch(() => {})
  m.warmOcr()
}

export type SearchMethod = "fingerprint" | "text" | "ai"

type Partial = { analysis: PhotoAnalysis; query: string; products: ReturnType<typeof toListItem>[] }

/**
 * onPartial fires as soon as the photo is understood and products are scored (~2-3s),
 * so the UI can show results while Gemini re-ranks them (~1-2s more).
 */
export async function searchByPhoto(image: ImageInput, { limit = 24, onPartial }: { limit?: number; onPartial?: (p: Partial) => void } = {}) {
  const started = Date.now()
  const timings: Record<string, number> = {}
  const timed = async <T,>(name: string, p: Promise<T>) => { const t = Date.now(); try { return await p } finally { timings[name] = Date.now() - t } }

  const catalog = await timed("catalog", loadCatalog())

  // ---- 1 + 2: no-AI matchers (free). Only answer when confident.
  const m = await import("@/lib/image-match")
  const fp = await timed("fingerprint", m.matchFingerprint(image, catalog, limit).catch(() => null))
  const free = fp ? { method: "fingerprint" as const, hit: fp } : null
  const tx = free ? null : await timed("ocr", m.matchPrintedText(image, catalog, { limit }))
  const hit = free || (tx ? { method: "text" as const, hit: tx } : null)
  if (hit) {
    return {
      status: "ok" as const,
      method: hit.method as SearchMethod,
      detail: hit.hit.detail,
      analysis: hit.hit.analysis,
      query: hit.hit.query,
      reranked: false,
      products: hit.hit.products,
      tookMs: Date.now() - started,
      timings,
    }
  }

  // ---- 3: Gemini
  const analysis = await timed("analyze", analyzePhoto(image))
  if (!analysis) return { status: "ai_unavailable" as const }
  if (!analysis.isProduct || (!analysis.name && !analysis.keywords.length)) return { status: "no_product" as const, analysis }

  const { terms, models } = buildTerms(analysis)
  const scored = catalog
    .map((p) => ({ p, s: scoreProduct(p, terms, models, analysis) }))
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s)

  const query = [analysis.brand && !analysis.name.toLowerCase().includes(analysis.brand.toLowerCase()) ? analysis.brand : "", analysis.name]
    .filter(Boolean).join(" ").trim() || analysis.keywords.slice(0, 3).join(" ")

  // Score-only order, used for the early result and as the fallback
  const best = scored[0]?.s || 1
  const byScore = scored.map((x) => ({ p: x.p, level: (x.s >= best * 0.8 ? "similar" : "related") as MatchLevel }))
  onPartial?.({ analysis, query, products: byScore.slice(0, limit).map(({ p, level }) => toListItem(p.row, level)) })

  const top = scored.slice(0, 20).map((x) => x.p)
  const levels = top.length ? await timed("rerank", rerank(image, top).catch(() => null)) : null

  let ordered = byScore
  if (levels) {
    const byId = new Map(top.map((p) => [Number(p.row.id), p]))
    const picked = [...levels].map(([id, level]) => ({ p: byId.get(id)!, level }))
    // Keep strong text matches Gemini skipped, after its picks
    const rest = scored.filter((x) => !levels.has(Number(x.p.row.id)) && x.s >= 5).map((x) => ({ p: x.p, level: "related" as MatchLevel }))
    ordered = [...picked, ...rest]
  }

  return {
    status: "ok" as const,
    method: "ai" as SearchMethod,
    detail: "",
    analysis,
    query,
    reranked: !!levels,
    products: ordered.slice(0, limit).map(({ p, level }) => toListItem(p.row, level)),
    tookMs: Date.now() - started,
    timings,
  }
}

/** Accepts "data:image/...;base64,..." */
export function parseDataUrl(value: string): ImageInput | null {
  const m = value.match(/^data:(image\/(?:jpeg|jpg|png|webp|gif|heic|heif));base64,([A-Za-z0-9+/=\s]+)$/i)
  if (!m) return null
  const data = m[2].replace(/\s/g, '')
  if (data.length < 80 || data.length > 9_000_000) return null
  const mimeType = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase()
  return { mimeType, data }
}
