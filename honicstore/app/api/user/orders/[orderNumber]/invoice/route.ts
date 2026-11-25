import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { validateAuth } from '@/lib/auth-server'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { sanitizeOrderNumber } from '@/lib/auth-utils'
import { buildInvoicePdf, invoiceFileName, loadInvoiceOrder, pdfResponse } from '@/lib/invoice-pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/user/orders/[orderNumber]/invoice  -> PDF (signed-in owner only). ?inline=1 opens it in the browser. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', { endpoint: '/api/user/orders/[orderNumber]/invoice', reason: limit.reason }, request)
    return NextResponse.json({ error: 'Too many requests. Please wait and try again.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }

  const orderNumber = sanitizeOrderNumber((await params).orderNumber)
  if (!orderNumber) return NextResponse.json({ error: 'Invalid order number' }, { status: 400 })

  const { user } = await validateAuth(request)
  if (!user) return NextResponse.json({ error: 'Please sign in to download this invoice.' }, { status: 401 })

  const order = await loadInvoiceOrder(getSupabaseClient(), { orderNumber })
  // same answer for "not found" and "not yours", so order numbers can't be probed
  if (!order || order.userId !== user.id) {
    if (order) logSecurityEvent('UNAUTHORIZED_INVOICE_ACCESS', { endpoint: '/api/user/orders/[orderNumber]/invoice', orderNumber }, request)
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const bytes = await buildInvoicePdf(order)
  return pdfResponse(bytes, invoiceFileName(order), request.nextUrl.searchParams.get('inline') === '1')
}
