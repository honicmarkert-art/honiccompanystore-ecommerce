import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { clearCache } from '@/lib/database-optimization'
import { internalCallAllowed } from '@/lib/internal-auth'
import { z } from '@/lib/zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/internal/revalidate { paths: ['/products', '/products/12'] }  (admin app only, shared secret)
 * Refreshes shop pages after the admin changes products, categories, banners or reviews, and drops
 * this server's in-memory API cache so the next request reads fresh data.
 */
const Body = z.object({ paths: z.array(z.string().max(200).regex(/^\/[A-Za-z0-9/_\-.%]*$/)).min(1).max(20) })

export async function POST(request: NextRequest) {
  if (!internalCallAllowed(request)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid paths' }, { status: 400 })
  for (const p of new Set(parsed.data.paths)) revalidatePath(p)
  clearCache()
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
