/**
 * Cache Health Check Endpoint
 * Production-grade cache monitoring and diagnostics
 * 
 * GET /api/health/cache
 * Returns cache health status, metrics, and recommendations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCacheStats } from '@/lib/database-optimization'
import { getPopularProductsCacheStats } from '@/lib/popular-products-cache'
import { cacheMonitor } from '@/lib/cache-monitoring'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Get cache statistics (async for popular cache stats)
    const serverCacheStats = getCacheStats()
    const popularCacheStats = await getPopularProductsCacheStats()
    const monitorMetrics = cacheMonitor.getAllMetrics()
    const healthStatus = cacheMonitor.getHealthStatus()

    // Calculate overall health
    const overallHealthy = healthStatus.healthy && 
                          serverCacheStats.utilizationPercent < 90 &&
                          (popularCacheStats?.validEntries || 0) > 0

    return NextResponse.json({
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      serverCache: {
        ...serverCacheStats,
        healthy: serverCacheStats.utilizationPercent < 90
      },
      popularProductsCache: popularCacheStats,
      monitoring: {
        metrics: monitorMetrics,
        health: healthStatus
      },
      recommendations: healthStatus.recommendations,
      issues: healthStatus.issues
    }, {
      status: overallHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    })
  } catch (error: any) {
    logger.error('[Health Check] Cache health check error:', error)
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve cache health status',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}
