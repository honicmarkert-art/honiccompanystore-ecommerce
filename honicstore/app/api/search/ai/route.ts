import { NextRequest, NextResponse } from 'next/server'
import { enhancedRateLimit } from '@/lib/enhanced-rate-limit'
import { aiSearch } from '@/lib/product-search'

/**
 * GET /api/search/ai?q=<natural language request>
 * Gemini interprets the request (keywords, category, price range, stock, sort) and the
 * typed search runs it, relaxing filters if nothing matches. Rate-limited (paid API).
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many AI searches. Please wait a minute.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }
  const q = (request.nextUrl.searchParams.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json({ error: 'Tell us what you are looking for.' }, { status: 400 })
  if (!process.env.GEMINI_API_KEY?.trim()) return NextResponse.json({ error: 'AI search is not configured.' }, { status: 503 })
  try {
    const result = await aiSearch(q, Math.min(Number(request.nextUrl.searchParams.get('limit')) || 24, 60))
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'AI search failed. Please try again.' }, { status: 500 })
  }
}
