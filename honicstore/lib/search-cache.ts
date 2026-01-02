/**
 * Query Result Cache for Fuzzy Search
 * 
 * Caches search results to avoid redundant computations
 * Uses in-memory cache with TTL (Time To Live)
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class SearchCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes default

  /**
   * Generate cache key from query and options
   */
  private generateKey(query: string, options: any): string {
    const optionsStr = JSON.stringify(options)
    return `${query.toLowerCase().trim()}:${optionsStr}`
  }

  /**
   * Get cached result if available and not expired
   */
  get<T>(query: string, options: any = {}): T | null {
    const key = this.generateKey(query, options)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cache entry with optional TTL
   */
  set<T>(query: string, data: T, options: any = {}, ttl: number = this.DEFAULT_TTL): void {
    const key = this.generateKey(query, options)
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })

    // Clean up expired entries periodically (every 100 entries)
    if (this.cache.size > 100) {
      this.cleanup()
    }
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// Singleton instance
export const searchCache = new SearchCache()


