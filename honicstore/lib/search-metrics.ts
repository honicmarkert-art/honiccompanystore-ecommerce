/**
 * Search Metrics and Logging
 * 
 * Tracks search performance and success rates
 * Helps identify failed searches and tune weights
 */

export interface SearchMetrics {
  query: string
  timestamp: number
  resultCount: number
  method: 'exact' | 'fuzzy' | 'combined'
  executionTime: number
  success: boolean
  matchTypes: string[]
}

class SearchMetricsCollector {
  private metrics: SearchMetrics[] = []
  private readonly MAX_METRICS = 1000 // Keep last 1000 searches

  /**
   * Record a search metric
   */
  record(metric: SearchMetrics): void {
    this.metrics.push(metric)
    
    // Keep only last MAX_METRICS entries
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift()
    }
  }

  /**
   * Get search success rate
   */
  getSuccessRate(timeWindow?: number): number {
    const now = Date.now()
    const window = timeWindow || 24 * 60 * 60 * 1000 // 24 hours default
    
    const recentMetrics = this.metrics.filter(
      m => now - m.timestamp < window
    )
    
    if (recentMetrics.length === 0) return 0
    
    const successful = recentMetrics.filter(m => m.success).length
    return successful / recentMetrics.length
  }

  /**
   * Get failed searches (no results)
   */
  getFailedSearches(timeWindow?: number): SearchMetrics[] {
    const now = Date.now()
    const window = timeWindow || 24 * 60 * 60 * 1000
    
    return this.metrics.filter(
      m => now - m.timestamp < window && !m.success
    )
  }

  /**
   * Get average execution time
   */
  getAverageExecutionTime(timeWindow?: number): number {
    const now = Date.now()
    const window = timeWindow || 24 * 60 * 60 * 1000
    
    const recentMetrics = this.metrics.filter(
      m => now - m.timestamp < window
    )
    
    if (recentMetrics.length === 0) return 0
    
    const totalTime = recentMetrics.reduce((sum, m) => sum + m.executionTime, 0)
    return totalTime / recentMetrics.length
  }

  /**
   * Get most common failed queries
   */
  getTopFailedQueries(limit: number = 10): Array<{ query: string; count: number }> {
    const failed = this.getFailedSearches()
    const queryCounts = new Map<string, number>()
    
    failed.forEach(metric => {
      const count = queryCounts.get(metric.query) || 0
      queryCounts.set(metric.query, count + 1)
    })
    
    return Array.from(queryCounts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /**
   * Get all metrics (for analysis)
   */
  getAllMetrics(): SearchMetrics[] {
    return [...this.metrics]
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = []
  }
}

// Singleton instance
export const searchMetrics = new SearchMetricsCollector()

/**
 * Helper function to measure search execution time
 */
export function measureSearchPerformance<T>(
  query: string,
  method: 'exact' | 'fuzzy' | 'combined',
  searchFn: () => T
): { result: T; executionTime: number } {
  const startTime = Date.now()
  const result = searchFn()
  const executionTime = Date.now() - startTime
  
  // Record metric (if result has length property)
  const resultCount = Array.isArray(result) ? result.length : 0
  const success = resultCount > 0
  
  searchMetrics.record({
    query,
    timestamp: Date.now(),
    resultCount,
    method,
    executionTime,
    success,
    matchTypes: [] // Will be populated by search function
  })
  
  return { result, executionTime }
}


