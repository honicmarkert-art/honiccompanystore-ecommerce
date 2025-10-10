import { NextRequest, NextResponse } from 'next/server'
import { enhancedCache } from '@/lib/performance-monitor'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// POST - Clear the API cache
export async function POST(request: NextRequest) {
  try {
    // Clear the enhanced cache
    enhancedCache.clear()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error clearing cache:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to clear cache' 
    }, { status: 500 })
  }
}

// GET - Get cache stats
export async function GET() {
  try {
    const stats = enhancedCache.getStats()
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error getting cache stats:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to get cache stats' 
    }, { status: 500 })
  }
}

