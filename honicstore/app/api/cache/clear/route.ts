import { NextRequest, NextResponse } from 'next/server'
import { clearCache, getCacheStats } from '@/lib/database-optimization'
import { requireInternal } from '@/lib/internal-auth'

// POST - Clear the API cache
export async function POST(request: NextRequest) {
  const blocked = requireInternal(request)
  if (blocked) return blocked
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
export async function GET(request: NextRequest) {
  const blocked = requireInternal(request)
  if (blocked) return blocked
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

