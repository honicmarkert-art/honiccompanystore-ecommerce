import { NextRequest, NextResponse } from 'next/server'
import { clearCache, getCacheStats } from '@/lib/database-optimization'

// POST - Clear the API cache
export async function POST(request: NextRequest) {
  try {
    // Clear the cache (all entries)
    clearCache()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to clear cache' 
    }, { status: 500 })
  }
}

// GET - Get cache stats
export async function GET() {
  try {
    const stats = getCacheStats()
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to get cache stats' 
    }, { status: 500 })
  }
}

