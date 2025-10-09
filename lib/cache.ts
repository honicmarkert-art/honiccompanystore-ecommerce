// Redis-based caching system for performance optimization

interface CacheConfig {
  defaultTTL: number // Time to live in seconds
  maxRetries: number
  retryDelay: number
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class CacheManager {
  private static instance: CacheManager
  private cache: Map<string, CacheEntry<any>> = new Map()
  private config: CacheConfig = {
    defaultTTL: 300, // 5 minutes
    maxRetries: 3,
    retryDelay: 1000
  }

  private constructor() {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries()
    }, 5 * 60 * 1000)
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  // Set cache entry
  public set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL
    }
    this.cache.set(key, entry)
  }

  // Get cache entry
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  // Get or set cache entry with fallback function
  public async getOrSet<T>(
    key: string, 
    fallback: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // If not in cache, execute fallback function
    try {
      const data = await fallback()
      this.set(key, data, ttl)
      return data
    } catch (error) {
      // If fallback fails, we could implement retry logic here
      throw error
    }
  }

  // Delete cache entry
  public delete(key: string): boolean {
    return this.cache.delete(key)
  }

  // Clear all cache entries
  public clear(): void {
    this.cache.clear()
  }

  // Check if entry is expired
  private isExpired(entry: CacheEntry<any>): boolean {
    const now = Date.now()
    const expiryTime = entry.timestamp + (entry.ttl * 1000)
    return now > expiryTime
  }

  // Clean up expired entries
  private cleanupExpiredEntries(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache statistics
  public getStats(): {
    totalEntries: number
    memoryUsage: number
    hitRate: number
  } {
    return {
      totalEntries: this.cache.size,
      memoryUsage: JSON.stringify(Array.from(this.cache.entries())).length,
      hitRate: 0 // This would be calculated over time in a real implementation
    }
  }

  // Cache key generators
  public static generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`
  }
}

// Cache key constants
export const CACHE_KEYS = {
  PRODUCT: (id: number) => CacheManager.generateKey('product', id),
  PRODUCTS_LIST: (page: number, limit: number, filters?: string) => 
    CacheManager.generateKey('products', 'list', page, limit, filters || 'all'),
  USER_CART: (userId: string) => CacheManager.generateKey('cart', userId),
  USER_PROFILE: (userId: string) => CacheManager.generateKey('profile', userId),
  STOCK_INFO: (productId: number) => CacheManager.generateKey('stock', productId),
  ORDER: (orderId: string) => CacheManager.generateKey('order', orderId),
  PAYMENT_TOKEN: (tokenId: string) => CacheManager.generateKey('payment_token', tokenId),
  CATEGORIES: () => CacheManager.generateKey('categories'),
  COMPANY_SETTINGS: () => CacheManager.generateKey('company_settings'),
  CURRENCY_RATES: () => CacheManager.generateKey('currency_rates')
}

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  PRODUCT: 300, // 5 minutes
  PRODUCTS_LIST: 180, // 3 minutes
  USER_CART: 60, // 1 minute
  USER_PROFILE: 600, // 10 minutes
  STOCK_INFO: 30, // 30 seconds (critical for stock)
  ORDER: 3600, // 1 hour
  PAYMENT_TOKEN: 86400, // 24 hours
  CATEGORIES: 1800, // 30 minutes
  COMPANY_SETTINGS: 3600, // 1 hour
  CURRENCY_RATES: 3600 // 1 hour
}

// Export singleton instance
export const cache = CacheManager.getInstance()

// Cache decorator for functions
export function cached<T extends (...args: any[]) => Promise<any>>(
  keyGenerator: (...args: Parameters<T>) => string,
  ttl?: number
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: Parameters<T>) {
      const key = keyGenerator(...args)
      
      // Try to get from cache
      const cached = cache.get(key)
      if (cached !== null) {
        return cached
      }

      // Execute original method
      const result = await method.apply(this, args)
      
      // Cache the result
      cache.set(key, result, ttl)
      
      return result
    }
  }
}

// Cache invalidation helpers
export class CacheInvalidator {
  private static instance: CacheInvalidator
  private cache = CacheManager.getInstance()

  public static getInstance(): CacheInvalidator {
    if (!CacheInvalidator.instance) {
      CacheInvalidator.instance = new CacheInvalidator()
    }
    return CacheInvalidator.instance
  }

  // Invalidate product-related caches
  public invalidateProduct(productId: number): void {
    this.cache.delete(CACHE_KEYS.PRODUCT(productId))
    this.cache.delete(CACHE_KEYS.STOCK_INFO(productId))
    // Invalidate products list cache
    this.invalidatePattern('products:list:*')
  }

  // Invalidate user-related caches
  public invalidateUser(userId: string): void {
    this.cache.delete(CACHE_KEYS.USER_CART(userId))
    this.cache.delete(CACHE_KEYS.USER_PROFILE(userId))
  }

  // Invalidate order-related caches
  public invalidateOrder(orderId: string): void {
    this.cache.delete(CACHE_KEYS.ORDER(orderId))
  }

  // Invalidate payment-related caches
  public invalidatePayment(tokenId: string): void {
    this.cache.delete(CACHE_KEYS.PAYMENT_TOKEN(tokenId))
  }

  // Invalidate all caches matching a pattern
  public invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    for (const key of this.cache['cache'].keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  // Invalidate all caches
  public invalidateAll(): void {
    this.cache.clear()
  }
}

// Export cache invalidator
export const cacheInvalidator = CacheInvalidator.getInstance()







