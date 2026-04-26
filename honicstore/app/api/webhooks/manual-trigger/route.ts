import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { buildUrl } from '@/lib/url-utils'
import { validateAuth, getUserAndRole } from '@/lib/auth-server'
import { enhancedRateLimitDistributed, logSecurityEvent } from '@/lib/enhanced-rate-limit'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
// Manual webhook trigger to test the webhook processing
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await enhancedRateLimitDistributed(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/webhooks/manual-trigger',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      )
    }

    // Never expose this endpoint publicly in production.
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { user, error: authError } = await validateAuth(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { role } = await getUserAndRole(user.id)
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { orderReference, transactionId, amount, currency = 'TZS' } = await request.json()
    
    if (!orderReference) {
      return NextResponse.json({ error: 'orderReference is required' }, { status: 400 })
    }
    
    logger.log('🔧 MANUAL WEBHOOK TRIGGER:', {
      orderReference,
      transactionId,
      amount,
      currency,
      timestamp: new Date().toISOString()
    })
    
    // Create a mock webhook payload
    const mockWebhookPayload = {
      event: 'PAYMENT RECEIVED',
      data: {
        orderReference: orderReference,
        paymentId: transactionId || 'MANUAL-TEST-' + Date.now(),
        collectedAmount: amount || '500.00',
        collectedCurrency: currency,
        customer: {
          name: 'Test Customer',
          email: 'test@example.com'
        },
        updatedAt: new Date().toISOString()
      }
    }
    
    // Forward to the actual webhook handler
    const webhookUrl = buildUrl('/api/webhooks/clickpesa')
    
    logger.log('🔄 Forwarding to webhook:', webhookUrl)
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockWebhookPayload)
    })
    
    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      message: 'Manual webhook triggered',
      webhookResponse: result,
      webhookStatus: response.status
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Manual webhook trigger failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}



