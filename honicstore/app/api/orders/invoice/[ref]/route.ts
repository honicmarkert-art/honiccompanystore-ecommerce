import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { buildInvoicePdf, invoiceFileName, loadInvoiceOrder, normalizeReference, pdfResponse } from '@/lib/invoice-pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/orders/invoice/[ref] -> invoice / order summary PDF for anyone holding the order link.
 * SECURITY: the reference is 32 random hex characters (128 bits) that only the buyer receives
 * (result page, order email, or after proving their phone/email on order tracking). Order numbers
 * are NOT accepted here because they are guessable. Rate-limited.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const limit = await enhancedRateLimit(request)
  if (!limit.allowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', { endpoint: '/api/orders/invoice/[ref]', reason: limit.reason }, request)
    return NextResponse.json({ error: 'Too many requests. Please wait and try again.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }
  const ref = normalizeReference((await params).ref)
  if (!ref) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const order = await loadInvoiceOrder(getSupabaseClient(), { referenceId: ref })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const bytes = await buildInvoicePdf(order)
  return pdfResponse(bytes, invoiceFileName(order), request.nextUrl.searchParams.get('inline') === '1')
}
