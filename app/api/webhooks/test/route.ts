import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Test webhook endpoint to verify if ClickPesa is sending webhooks
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headers = Object.fromEntries(request.headers.entries())
    
    logger.log('🧪 TEST WEBHOOK RECEIVED:', {
      timestamp: new Date().toISOString(),
      headers: headers,
      body: body,
      bodyLength: body.length
    })
    
    // Try to parse JSON body
    let parsedBody = null
    try {
      parsedBody = JSON.parse(body)
    } catch (e) {
      logger.log('⚠️ Body is not valid JSON:', e)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Test webhook received successfully',
      timestamp: new Date().toISOString(),
      receivedData: {
        headers: headers,
        body: parsedBody || body,
        bodyLength: body.length
      }
    })
    
  } catch (error) {
    console.error('❌ Test webhook error:', error)
    return NextResponse.json(
      { error: 'Test webhook failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Test webhook endpoint is active',
    timestamp: new Date().toISOString(),
    url: request.url
  })
}



