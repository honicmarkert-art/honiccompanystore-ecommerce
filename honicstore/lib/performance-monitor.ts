/**
 * Production-ready performance monitoring utilities
 * Tracks performance metrics, API response times, and user interactions
 */

interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  metadata?: Record<string, unknown>
}

interface ApiMetric {
  endpoint: string
  method: string
  duration: number
  statusCode: number
  timestamp: number
  error?: string
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private apiMetrics: ApiMetric[] = []
  private readonly maxMetrics = 100 // Limit stored metrics to prevent memory issues

  /**
   * Measure execution time of a function
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const start = performance.now()
    try {
      const result = await fn()
      const duration = performance.now() - start
      this.recordMetric(name, duration, metadata)
      return result
    } catch (error) {
      const duration = performance.now() - start
      this.recordMetric(name, duration, { ...metadata, error: String(error) })
      throw error
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, metadata?: Record<string, unknown>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata,
    }

    this.metrics.push(metric)

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to your monitoring service (e.g., DataDog, New Relic)
      this.sendToMonitoringService(metric)
    } else {
      // In development, slow operations are tracked but not logged
      // TODO: Add proper logging service integration
    }
  }

  /**
   * Record API call metrics
   */
  recordApiCall(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number,
    error?: string
  ): void {
    const metric: ApiMetric = {
      endpoint,
      method,
      duration,
      statusCode,
      timestamp: Date.now(),
      error,
    }

    this.apiMetrics.push(metric)

    // Keep only the most recent metrics
    if (this.apiMetrics.length > this.maxMetrics) {
      this.apiMetrics.shift()
    }

    // Slow API calls are tracked but not logged
    // TODO: Add proper logging service integration

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendApiMetricToMonitoringService(metric)
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    averageResponseTime: number
    slowestOperations: PerformanceMetric[]
    apiStats: {
      averageDuration: number
      errorRate: number
      slowestEndpoints: ApiMetric[]
    }
  } {
    const avgResponseTime =
      this.metrics.length > 0
        ? this.metrics.reduce((sum, m) => sum + m.value, 0) / this.metrics.length
        : 0

    const slowestOperations = [...this.metrics]
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    const apiAvgDuration =
      this.apiMetrics.length > 0
        ? this.apiMetrics.reduce((sum, m) => sum + m.duration, 0) / this.apiMetrics.length
        : 0

    const errorRate =
      this.apiMetrics.length > 0
        ? this.apiMetrics.filter((m) => m.statusCode >= 400).length / this.apiMetrics.length
        : 0

    const slowestEndpoints = [...this.apiMetrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)

    return {
      averageResponseTime: avgResponseTime,
      slowestOperations,
      apiStats: {
        averageDuration: apiAvgDuration,
        errorRate,
        slowestEndpoints,
      },
    }
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clear(): void {
    this.metrics = []
    this.apiMetrics = []
  }

  /**
   * Send metric to monitoring service (implement based on your service)
   */
  private sendToMonitoringService(metric: PerformanceMetric): void {
    // TODO: Implement integration with your monitoring service
    // Example: Sentry, DataDog, New Relic, etc.
    if (typeof window !== 'undefined' && (window as any).__MONITORING_SERVICE__) {
      ;(window as any).__MONITORING_SERVICE__.trackMetric(metric)
    }
  }

  /**
   * Send API metric to monitoring service
   */
  private sendApiMetricToMonitoringService(metric: ApiMetric): void {
    // TODO: Implement integration with your monitoring service
    if (typeof window !== 'undefined' && (window as any).__MONITORING_SERVICE__) {
      ;(window as any).__MONITORING_SERVICE__.trackApiCall(metric)
    }
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * Higher-order function to measure API call performance
 */
export function withPerformanceMonitoring<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name: string
): T {
  return (async (...args: Parameters<T>) => {
    return performanceMonitor.measure(name, () => fn(...args), {
      args: args.length,
    })
  }) as T
}

/**
 * React hook for measuring component render performance
 * Note: Import useEffect from 'react' when using this hook
 */
export function createPerformanceMeasureHook() {
  // This is a factory function to avoid requiring React import in this utility file
  // Usage in components:
  // const usePerformanceMeasure = createPerformanceMeasureHook()
  // useEffect(() => {
  //   const start = performance.now()
  //   return () => {
  //     const duration = performance.now() - start
  //     performanceMonitor.recordMetric('component_render', duration)
  //   }
  // }, [])
  return null
}
