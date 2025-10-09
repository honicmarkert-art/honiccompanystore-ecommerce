import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from '@/lib/performance-monitor'
import { createSecureResponse } from '@/lib/secure-api'

/**
 * GET - Get performance metrics
 */
export async function GET(request: NextRequest) {
  try {
    const metrics = performanceMonitor.getMetrics()
    const summary = performanceMonitor.getSummary()
    const securityEvents = performanceMonitor.getSecurityEvents()

    return createSecureResponse({
      metrics,
      summary,
      securityEvents: securityEvents.slice(-10), // Last 10 security events
      timestamp: Date.now()
    }, {
      cacheControl: 'no-cache, no-store, must-revalidate',
      headers: {
        'X-Performance-Monitor': 'active'
      }
    })
  } catch (error) {
    console.error('Error getting performance metrics:', error)
    return NextResponse.json(
      { error: 'Failed to get performance metrics' },
      { status: 500 }
    )
  }
}

/**
 * POST - Clear performance metrics
 */
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    if (action === 'clear') {
      performanceMonitor.clear()
      return createSecureResponse(
        { message: 'Performance metrics cleared' },
        {
          cacheControl: 'no-cache, no-store, must-revalidate'
        }
      )
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error clearing performance metrics:', error)
    return NextResponse.json(
      { error: 'Failed to clear performance metrics' },
      { status: 500 }
    )
  }
}