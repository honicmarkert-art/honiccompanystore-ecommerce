// Database optimization utilities for better performance

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { cache, CACHE_KEYS, CACHE_TTL, cacheInvalidator } from './cache'
import { Logger } from './error-handler'

interface QueryOptions {
  useCache?: boolean
  cacheTTL?: number
  retries?: number
  timeout?: number
}

interface BatchQueryOptions {
  batchSize?: number
  concurrency?: number
  useCache?: boolean
}

class DatabaseOptimizer {
  private static instance: DatabaseOptimizer
  private supabase: SupabaseClient
  private logger: Logger

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
    this.logger = Logger.getInstance()
  }

  public static getInstance(): DatabaseOptimizer {
    if (!DatabaseOptimizer.instance) {
      DatabaseOptimizer.instance = new DatabaseOptimizer()
    }
    return DatabaseOptimizer.instance
  }

  // Optimized product queries
  async getProduct(id: number, options: QueryOptions = {}): Promise<any> {
    const cacheKey = CACHE_KEYS.PRODUCT(id)
    const ttl = options.cacheTTL || CACHE_TTL.PRODUCT

    if (options.useCache !== false) {
      const cached = cache.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    try {
      const { data, error } = await this.supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          price,
          currency,
          stock_quantity,
          in_stock,
          category_id,
          images,
          created_at,
          updated_at,
          categories (
            id,
            name,
            slug
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        throw error
      }

      if (options.useCache !== false) {
        cache.set(cacheKey, data, ttl)
      }

      return data
    } catch (error) {
      this.logger.error('Failed to fetch product', error instanceof Error ? error : new Error(String(error)), { productId: id })
      throw error
    }
  }

  // Optimized products list query with pagination and filtering
  async getProducts(
    page: number = 1,
    limit: number = 20,
    filters: any = {},
    options: QueryOptions = {}
  ): Promise<{ data: any[], total: number, page: number, limit: number }> {
    const filterKey = JSON.stringify(filters)
    const cacheKey = CACHE_KEYS.PRODUCTS_LIST(page, limit, filterKey)
    const ttl = options.cacheTTL || CACHE_TTL.PRODUCTS_LIST

    if (options.useCache !== false) {
      const cached = cache.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    try {
      let query = this.supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          price,
          currency,
          stock_quantity,
          in_stock,
          category_id,
          images,
          created_at,
          categories (
            id,
            name,
            slug
          )
        `, { count: 'exact' })

      // Apply filters
      if (filters.category) {
        query = query.eq('category_id', filters.category)
      }
      if (filters.inStock) {
        query = query.eq('in_stock', true)
      }
      if (filters.minPrice) {
        query = query.gte('price', filters.minPrice)
      }
      if (filters.maxPrice) {
        query = query.lte('price', filters.maxPrice)
      }
      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`)
      }

      // Apply pagination
      const offset = (page - 1) * limit
      query = query.range(offset, offset + limit - 1)

      // Apply ordering
      query = query.order('created_at', { ascending: false })

      const { data, error, count } = await query

      if (error) {
        throw error
      }

      const result = {
        data: data || [],
        total: count || 0,
        page,
        limit
      }

      if (options.useCache !== false) {
        cache.set(cacheKey, result, ttl)
      }

      return result
    } catch (error) {
      this.logger.error('Failed to fetch products', error instanceof Error ? error : new Error(String(error)), { page, limit, filters })
      throw error
    }
  }

  // Optimized cart query
  async getUserCart(userId: string, options: QueryOptions = {}): Promise<any[]> {
    const cacheKey = CACHE_KEYS.USER_CART(userId)
    const ttl = options.cacheTTL || CACHE_TTL.USER_CART

    if (options.useCache !== false) {
      const cached = cache.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    try {
      const { data, error } = await this.supabase
        .from('cart_items')
        .select(`
          id,
          product_id,
          variant_id,
          quantity,
          price,
          currency,
          applied_discount,
          products (
            id,
            name,
            price,
            stock_quantity,
            in_stock,
            images
          )
        `)
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      if (options.useCache !== false) {
        cache.set(cacheKey, data || [], ttl)
      }

      return data || []
    } catch (error) {
      this.logger.error('Failed to fetch user cart', error instanceof Error ? error : new Error(String(error)), { userId })
      throw error
    }
  }

  // Optimized stock validation with batch processing
  async validateStockBatch(
    items: Array<{ product_id: number; quantity: number }>,
    options: BatchQueryOptions = {}
  ): Promise<Array<{ product_id: number; valid: boolean; available: number; requested: number }>> {
    const batchSize = options.batchSize || 10
    const concurrency = options.concurrency || 3
    const results: Array<{ product_id: number; valid: boolean; available: number; requested: number }> = []

    // Process items in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchResults = await this.processBatch(batch, concurrency, options)
      results.push(...batchResults)
    }

    return results
  }

  private async processBatch(
    batch: Array<{ product_id: number; quantity: number }>,
    concurrency: number,
    options: BatchQueryOptions
  ): Promise<Array<{ product_id: number; valid: boolean; available: number; requested: number }>> {
    const results: Array<{ product_id: number; valid: boolean; available: number; requested: number }> = []
    
    // Process batch with controlled concurrency
    const promises = batch.map(async (item) => {
      const cacheKey = CACHE_KEYS.STOCK_INFO(item.product_id)
      const ttl = CACHE_TTL.STOCK_INFO

      if (options.useCache !== false) {
        const cached = cache.get(cacheKey)
        if (cached) {
          return {
            product_id: item.product_id,
            valid: cached.stock_quantity >= item.quantity && cached.in_stock,
            available: cached.stock_quantity,
            requested: item.quantity
          }
        }
      }

      try {
        const { data, error } = await this.supabase
          .from('products')
          .select('stock_quantity, in_stock')
          .eq('id', item.product_id)
          .single()

        if (error) {
          throw error
        }

        const result = {
          product_id: item.product_id,
          valid: data.stock_quantity >= item.quantity && data.in_stock,
          available: data.stock_quantity,
          requested: item.quantity
        }

        if (options.useCache !== false) {
          cache.set(cacheKey, data, ttl)
        }

        return result
      } catch (error) {
        this.logger.error('Failed to validate stock for product', error instanceof Error ? error : new Error(String(error)), { productId: item.product_id })
        return {
          product_id: item.product_id,
          valid: false,
          available: 0,
          requested: item.quantity
        }
      }
    })

    // Wait for all promises to resolve
    const batchResults = await Promise.all(promises)
    results.push(...batchResults)

    return results
  }

  // Optimized order query
  async getOrder(orderId: string, options: QueryOptions = {}): Promise<any> {
    const cacheKey = CACHE_KEYS.ORDER(orderId)
    const ttl = options.cacheTTL || CACHE_TTL.ORDER

    if (options.useCache !== false) {
      const cached = cache.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select(`
          id,
          user_id,
          total_amount,
          currency,
          status,
          payment_method,
          shipping_address,
          created_at,
          updated_at,
          order_items (
            id,
            product_id,
            variant_id,
            quantity,
            price,
            currency,
            applied_discount,
            products (
              id,
              name,
              price,
              images
            )
          )
        `)
        .eq('id', orderId)
        .single()

      if (error) {
        throw error
      }

      if (options.useCache !== false) {
        cache.set(cacheKey, data, ttl)
      }

      return data
    } catch (error) {
      this.logger.error('Failed to fetch order', error instanceof Error ? error : new Error(String(error)), { orderId })
      throw error
    }
  }

  // Optimized user profile query
  async getUserProfile(userId: string, options: QueryOptions = {}): Promise<any> {
    const cacheKey = CACHE_KEYS.USER_PROFILE(userId)
    const ttl = options.cacheTTL || CACHE_TTL.USER_PROFILE

    if (options.useCache !== false) {
      const cached = cache.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        throw error
      }

      if (options.useCache !== false) {
        cache.set(cacheKey, data, ttl)
      }

      return data
    } catch (error) {
      this.logger.error('Failed to fetch user profile', error instanceof Error ? error : new Error(String(error)), { userId })
      throw error
    }
  }

  // Batch update operations
  async batchUpdate(table: string, updates: Array<{ id: any; data: any }>): Promise<void> {
    const batchSize = 50 // Process 50 updates at a time
    const batches = []

    for (let i = 0; i < updates.length; i += batchSize) {
      batches.push(updates.slice(i, i + batchSize))
    }

    for (const batch of batches) {
      const promises = batch.map(update => 
        this.supabase
          .from(table)
          .update(update.data)
          .eq('id', update.id)
      )

      await Promise.all(promises)
    }
  }

  // Cache invalidation helpers
  invalidateProductCache(productId: number): void {
    cacheInvalidator.invalidateProduct(productId)
  }

  invalidateUserCache(userId: string): void {
    cacheInvalidator.invalidateUser(userId)
  }

  invalidateOrderCache(orderId: string): void {
    cacheInvalidator.invalidateOrder(orderId)
  }

  // Get database statistics
  async getDatabaseStats(): Promise<{
    products: number
    orders: number
    users: number
    cartItems: number
  }> {
    try {
      const [productsResult, ordersResult, usersResult, cartResult] = await Promise.all([
        this.supabase.from('products').select('id', { count: 'exact', head: true }),
        this.supabase.from('orders').select('id', { count: 'exact', head: true }),
        this.supabase.from('profiles').select('id', { count: 'exact', head: true }),
        this.supabase.from('cart_items').select('id', { count: 'exact', head: true })
      ])

      return {
        products: productsResult.count || 0,
        orders: ordersResult.count || 0,
        users: usersResult.count || 0,
        cartItems: cartResult.count || 0
      }
    } catch (error) {
      this.logger.error('Failed to get database stats', error instanceof Error ? error : new Error(String(error)))
      return {
        products: 0,
        orders: 0,
        users: 0,
        cartItems: 0
      }
    }
  }
}

// Export singleton instance
export const dbOptimizer = DatabaseOptimizer.getInstance()








