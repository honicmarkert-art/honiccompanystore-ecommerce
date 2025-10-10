/**
 * Performance Monitoring and Optimization
 * 
 * This module provides utilities for monitoring and optimizing application performance
 */

interface PerformanceMetrics {
  loadTime: number
  apiTime: number
  cacheHitRate: number
  errors: number
  securityEvents: number
  timestamp: number
}

interface CacheMetrics {
  hits: number
  misses: number
  total: number
  hitRate: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private cacheMetrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    total: 0,
    hitRate: 0
  }
  private securityEvents: any[] = []

  /**
   * Record performance metrics
   */
  recordMetrics(metrics: Partial<PerformanceMetrics>) {
    const fullMetrics: PerformanceMetrics = {
      loadTime: 0,
      apiTime: 0,
      cacheHitRate: 0,
      errors: 0,
      securityEvents: 0,
      timestamp: Date.now(),
      ...metrics
    }
    
    this.metrics.push(fullMetrics)
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100)
    }
  }

  /**
   * Record cache hit
   */
  recordCacheHit() {
    this.cacheMetrics.hits++
    this.cacheMetrics.total++
    this.cacheMetrics.hitRate = (this.cacheMetrics.hits / this.cacheMetrics.total) * 100
  }

  /**
   * Record cache miss
   */
  recordCacheMiss() {
    this.cacheMetrics.misses++
    this.cacheMetrics.total++
    this.cacheMetrics.hitRate = (this.cacheMetrics.hits / this.cacheMetrics.total) * 100
  }

  /**
   * Record security event
   */
  recordSecurityEvent(event: any) {
    this.securityEvents.push({
      ...event,
      timestamp: Date.now()
    })
    
    // Keep only last 50 security events
    if (this.securityEvents.length > 50) {
      this.securityEvents = this.securityEvents.slice(-50)
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics & { cacheMetrics: CacheMetrics } {
    const latest = this.metrics[this.metrics.length - 1] || {
      loadTime: 0,
      apiTime: 0,
      cacheHitRate: 0,
      errors: 0,
      securityEvents: 0,
      timestamp: Date.now()
    }

    return {
      ...latest,
      cacheHitRate: this.cacheMetrics.hitRate,
      cacheMetrics: this.cacheMetrics
    }
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const recent = this.metrics.slice(-10) // Last 10 metrics
    
    return {
      averageLoadTime: recent.reduce((sum, m) => sum + m.loadTime, 0) / recent.length || 0,
      averageApiTime: recent.reduce((sum, m) => sum + m.apiTime, 0) / recent.length || 0,
      totalErrors: recent.reduce((sum, m) => sum + m.errors, 0),
      totalSecurityEvents: recent.reduce((sum, m) => sum + m.securityEvents, 0),
      cacheHitRate: this.cacheMetrics.hitRate,
      cacheStats: this.cacheMetrics
    }
  }

  /**
   * Get security events
   */
  getSecurityEvents() {
    return this.securityEvents
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = []
    this.cacheMetrics = { hits: 0, misses: 0, total: 0, hitRate: 0 }
    this.securityEvents = []
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * Enhanced caching with performance monitoring
 */
export class EnhancedCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private readonly maxSize = 1000 // Maximum cache entries

  /**
   * Get cached data with performance monitoring
   */
  get<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) {
      performanceMonitor.recordCacheMiss()
      return null
    }
    
    const now = Date.now()
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      performanceMonitor.recordCacheMiss()
      return null
    }
    
    performanceMonitor.recordCacheHit()
    return cached.data as T
  }

  /**
   * Set cached data with performance monitoring
   */
  set<T>(key: string, data: T, ttl: number = 10 * 60 * 1000): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize) * 100
    }
  }
}

// Global enhanced cache instance
export const enhancedCache = new EnhancedCache()

/**
 * Performance optimization utilities
 */
export const performanceUtils = {
  /**
   * Debounce function calls
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  },

  /**
   * Throttle function calls
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  },

  /**
   * Measure execution time
   */
  async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
    const start = Date.now()
    const result = await fn()
    const time = Date.now() - start
    return { result, time }
  },

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        if (i === maxRetries - 1) {
          throw lastError
        }
        
        const delay = baseDelay * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError!
  }
}

/**
 * API response optimization
 */
export const apiOptimization = {
  /**
   * Compress response data
   */
  compressResponse(data: any): any {
    // Remove unnecessary fields for minimal responses
    if (Array.isArray(data)) {
      return data.map(item => {
        const { id, name, price, image, category, stock_quantity } = item
        return { id, name, price, image, category, stock_quantity }
      })
    }
    return data
  },

  /**
   * Add performance headers
   */
  addPerformanceHeaders(response: Response, metrics: Partial<PerformanceMetrics>): Response {
    const headers = new Headers(response.headers)
    
    if (metrics.loadTime) {
      headers.set('X-Load-Time', metrics.loadTime.toString())
    }
    
    if (metrics.apiTime) {
      headers.set('X-API-Time', metrics.apiTime.toString())
    }
    
    if (metrics.cacheHitRate !== undefined) {
      headers.set('X-Cache-Hit-Rate', metrics.cacheHitRate.toString())
    }
    
    headers.set('X-Timestamp', Date.now().toString())
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  }
}

