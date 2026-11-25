import { NextRequest, NextResponse } from 'next/server'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { logger } from '@/lib/logger'
import { parseDataUrl, searchByPhoto, warmCatalog, type ImageInput, type PhotoAnalysis } from '@/lib/visual-search'

/**
 * Photo search ("Honic Lens"), powered by Gemini — see lib/visual-search.ts.
 *
 * POST accepts either:
 *   - JSON  { image: "data:image/jpeg;base64,..." }   (new UI; images are resized in the browser)
 *   - multipart form with an `image` file              (older callers)
 *
 * Response keeps the old fields (success, products, keywords, searchType, totalCount)
 * and adds: query, analysis, products[].match ('exact' | 'similar' | 'related').
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BYTES = 6 * 1024 * 1024
const ALLOWED = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i

export async function GET(request: NextRequest) {
  // ?warm=1 — the photo dialog calls this when it opens, so the product index is
  // already in memory by the time the shopper picks a photo.
  if (request.nextUrl.searchParams.get('warm')) {
    await warmCatalog().catch(() => {})
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  }
  // Health check, incl. how many product images have a fingerprint (no-AI matching)
  let fingerprints: { images: number; hashed: number } | null = null
  try {
    const [{ loadCatalog }, { fingerprintCoverage }] = await Promise.all([import('@/lib/visual-search'), import('@/lib/image-match')])
    fingerprints = fingerprintCoverage(await loadCatalog())
  } catch { /* report without it */ }
  return NextResponse.json(
    { message: 'Image search API is working', aiEnabled: !!process.env.GEMINI_API_KEY, fingerprints, status: 'ready' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

const keywordsOf = (a: PhotoAnalysis) => [...new Set([a.name, a.brand, ...a.modelNumbers, ...a.keywords].filter(Boolean))].slice(0, 10)

const ERRORS = {
  ai_unavailable: { status: 503, error: 'Photo search is busy right now. Please try again in a moment.' },
  no_product: { status: 422, error: "We couldn't spot a product in that photo. Try a closer shot of the item." },
} as const

/**
 * Streaming mode (Accept: application/x-ndjson): one JSON object per line —
 *   {"type":"partial", ...}  results as soon as the photo is understood
 *   {"type":"final", ...}    re-ranked results with exact/similar/related labels
 *   {"type":"error", ...}
 */
function streamSearch(image: ImageInput) {
  const enc = new TextEncoder()
  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'))
        try {
          const r = await searchByPhoto(image, {
            onPartial: (p) => send({ type: 'partial', query: p.query, analysis: p.analysis, keywords: keywordsOf(p.analysis), products: p.products }),
          })
          if (r.status !== 'ok') {
            send({ type: 'error', ...ERRORS[r.status], analysis: 'analysis' in r ? r.analysis : undefined })
          } else {
            logger.log('[image-search]', { method: r.method, detail: r.detail, query: r.query, matches: r.products.length, reranked: r.reranked, ms: r.tookMs, ...r.timings })
            send({ type: 'final', method: r.method, query: r.query, analysis: r.analysis, keywords: keywordsOf(r.analysis), products: r.products, tookMs: r.tookMs, timings: r.timings })
          }
        } catch (error) {
          logger.error('[image-search] failed', error)
          send({ type: 'error', status: 500, error: 'Photo search failed. Please try again.' })
        }
        controller.close()
      },
    }),
    { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } },
  )
}

async function readImage(request: NextRequest): Promise<ImageInput | { error: string }> {
  const type = request.headers.get('content-type') || ''
  if (type.includes('application/json')) {
    const body = await request.json().catch(() => null)
    const img = parseDataUrl(String(body?.image || ''))
    return img || { error: 'Please add a JPG, PNG, WEBP or GIF photo.' }
  }
  const form = await request.formData().catch(() => null)
  const file = form?.get('image')
  if (!(file instanceof File) || file.size === 0) return { error: 'No image provided' }
  if (!ALLOWED.test(file.type)) return { error: 'Please add a JPG, PNG, WEBP or GIF photo.' }
  if (file.size > MAX_BYTES) return { error: 'That photo is too large (max 6 MB).' }
  const data = Buffer.from(await file.arrayBuffer()).toString('base64')
  return { mimeType: file.type.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.type.toLowerCase(), data }
}

export async function POST(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many photo searches. Please wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } },
    )
  }
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ error: 'Photo search is not configured yet.' }, { status: 503 })
  }

  try {
    const image = await readImage(request)
    if ('error' in image) return NextResponse.json({ error: image.error }, { status: 400 })

    if ((request.headers.get('accept') || '').includes('application/x-ndjson')) return streamSearch(image)

    const result = await searchByPhoto(image)

    if (result.status !== 'ok') {
      const e = ERRORS[result.status]
      return NextResponse.json({ error: e.error, analysis: 'analysis' in result ? result.analysis : undefined }, { status: e.status })
    }

    const a = result.analysis
    const keywords = keywordsOf(a)
    logger.log('[image-search]', { method: result.method, detail: result.detail, query: result.query, matches: result.products.length, reranked: result.reranked, ms: result.tookMs, ...result.timings })

    return NextResponse.json(
      {
        success: true,
        searchType: 'image',
        method: result.method,
        query: result.query,
        keywords,
        analysis: a,
        products: result.products,
        totalCount: result.products.length,
        tookMs: result.tookMs,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    logger.error('[image-search] failed', error)
    return NextResponse.json({ error: 'Photo search failed. Please try again.' }, { status: 500 })
  }
}
