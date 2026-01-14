/**
 * Cache Monitoring & Analytics
 * Production-grade cache performance tracking
 */

import { logger } from '@/lib/logger'
import { performanceMonitor } from '@/lib/performance-monitor'

interface CacheMetrics {
  hits: number
  misses: number
  errors: number
  avgResponseTime: number
  hitRate: number
  totalRequests: number
}

class CacheMonitor {
  private metrics: Map<string, CacheMetrics> = new Map()

  /**
   * Record cache hit
   */
  recordHit(cacheType: string, responseTime: number): void {
    const metrics = this.getOrCreateMetrics(cacheType)
    metrics.hits++
    metrics.totalRequests++
    this.updateHitRate(cacheType)
    this.updateAvgResponseTime(cacheType, responseTime)
    
    performanceMonitor.recordMetric(`cache_${cacheType}_hit`, responseTime, { cacheType })
  }

  /**
   * Record cache miss
   */
  recordMiss(cacheType: string, responseTime: number): void {
    const metrics = this.getOrCreateMetrics(cacheType)
    metrics.misses++
    metrics.totalRequests++
    this.updateHitRate(cacheType)
    this.updateAvgResponseTime(cacheType, responseTime)
    
    performanceMonitor.recordMetric(`cache_${cacheType}_miss`, responseTime, { cacheType })
  }

  /**
   * Record cache error
   */
  recordError(cacheType: string, error: Error): void {
    const metrics = this.getOrCreateMetrics(cacheType)
    metrics.errors++
    
    performanceMonitor.recordMetric(`cache_${cacheType}_error`, 0, {
      cacheType,
      error: error.message
    })
    
    logger.error(`[Cache Monitor] ${cacheType} error:`, error)
  }

  /**
   * Get or create metrics for cache type
   */
  private getOrCreateMetrics(cacheType: string): CacheMetrics {
    if (!this.metrics.has(cacheType)) {
      this.metrics.set(cacheType, {
        hits: 0,
        misses: 0,
        errors: 0,
        avgResponseTime: 0,
        hitRate: 0,
        totalRequests: 0
      })
    }
    return this.metrics.get(cacheType)!
  }

  /**
   * Update hit rate
   */
  private updateHitRate(cacheType: string): void {
    const metrics = this.getOrCreateMetrics(cacheType)
    if (metrics.totalRequests > 0) {
      metrics.hitRate = (metrics.hits / metrics.totalRequests) * 100
    }
  }

  /**
   * Update average response time
   */
  private updateAvgResponseTime(cacheType: string, responseTime: number): void {
    const metrics = this.getOrCreateMetrics(cacheType)
    const totalTime = metrics.avgResponseTime * (metrics.totalRequests - 1) + responseTime
    metrics.avgResponseTime = totalTime / metrics.totalRequests
  }

  /**
   * Get metrics for cache type
   */
  getMetrics(cacheType: string): CacheMetrics | null {
    return this.metrics.get(cacheType) || null
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, CacheMetrics> {
    const result: Record<string, CacheMetrics> = {}
    for (const [type, metrics] of this.metrics.entries()) {
      result[type] = { ...metrics }
    }
    return result
  }

  /**
   * Reset metrics
   */
  resetMetrics(cacheType?: string): void {
    if (cacheType) {
      this.metrics.delete(cacheType)
    } else {
      this.metrics.clear()
    }
  }

  /**
   * Get cache health status
   */
  getHealthStatus(): {
    healthy: boolean
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []

    for (const [type, metrics] of this.metrics.entries()) {
      // Check hit rate
      if (metrics.hitRate < 50 && metrics.totalRequests > 100) {
        issues.push(`${type}: Low hit rate (${metrics.hitRate.toFixed(1)}%)`)
        recommendations.push(`Consider increasing TTL for ${type} cache`)
      }

      // Check error rate
      const errorRate = (metrics.errors / metrics.totalRequests) * 100
      if (errorRate > 5) {
        issues.push(`${type}: High error rate (${errorRate.toFixed(1)}%)`)
        recommendations.push(`Investigate cache errors for ${type}`)
      }

      // Check response time
      if (metrics.avgResponseTime > 100) {
        issues.push(`${type}: Slow cache response (${metrics.avgResponseTime.toFixed(1)}ms)`)
        recommendations.push(`Optimize cache implementation for ${type}`)
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations
    }
  }
}

// Singleton instance
export const cacheMonitor = new CacheMonitor()

// Periodic metrics logging (every 15 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const allMetrics = cacheMonitor.getAllMetrics()
    if (Object.keys(allMetrics).length > 0) {
      logger.log('[Cache Monitor] Metrics:', allMetrics)
      
      const health = cacheMonitor.getHealthStatus()
      if (!health.healthy) {
        logger.warn('[Cache Monitor] Health issues detected:', health.issues)
        logger.log('[Cache Monitor] Recommendations:', health.recommendations)
      }
    }
  }, 15 * 60 * 1000) // 15 minutes
}
