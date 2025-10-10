import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Manual webhook trigger to test the webhook processing
export async function POST(request: NextRequest) {
  try {
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
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/clickpesa`
    
    logger.log('🔄 Forwarding to webhook:', webhookUrl)
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-clickpesa-signature': 'manual-test-signature'
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
    console.error('❌ Manual webhook trigger error:', error)
    return NextResponse.json(
      { error: 'Manual webhook trigger failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}



