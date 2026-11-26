import { NextRequest } from 'next/server'
import { createSecureResponse, createErrorResponse } from '@/lib/secure-api'
import { logger } from '@/lib/logger'
import { getProductDetail } from '@/lib/product-detail'

/**
 * GET /api/products/[id] -> one product (public, cached).
 * Read-only on purpose: product changes go through /api/admin/products/[id] (two-step sign-in).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d{1,12}$/.test(id || '')) return createErrorResponse('Invalid product ID', 400)
  try {
    // shared loader (also used by the server-rendered product page); uses the in-memory cache
    const product = await getProductDetail(id)
    if (!product) return createErrorResponse('Product not found', 404)
    const url = new URL(request.url)
    const fresh = url.searchParams.has('t') || url.searchParams.has('fresh')
    return createSecureResponse(product, { cdnCache: !fresh, browserCache: !fresh, headers: { 'X-Product-ID': id } })
  } catch (error) {
    logger.error(`[Product Detail API] ${id}:`, error instanceof Error ? error.message : error)
    return createErrorResponse('Internal server error', 500)
  }
}
