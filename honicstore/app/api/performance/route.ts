import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from '@/lib/performance-monitor'
import { createSecureResponse } from '@/lib/secure-api'
import { requireInternal } from '@/lib/internal-auth'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * GET - Get performance metrics
 */
export async function GET(request: NextRequest) {
  const blocked = requireInternal(request)
  if (blocked) return blocked
  try {
    // getMetrics/getSummary/getSecurityEvents never existed (this endpoint always failed); getStats() is the real API
    return createSecureResponse({
      summary: performanceMonitor.getStats(),
      timestamp: Date.now()
    }, {
      cacheControl: 'no-cache, no-store, must-revalidate',
      headers: {
        'X-Performance-Monitor': 'active'
      }
    })
  } catch (error) {
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
  const blocked = requireInternal(request)
  if (blocked) return blocked
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
    return NextResponse.json(
      { error: 'Failed to clear performance metrics' },
      { status: 500 }
    )
  }
}
