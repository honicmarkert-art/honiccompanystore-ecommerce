/**
 * Production-safe logging utility
 * 
 * Prevents console.log spam in production while maintaining debug capabilities
 * Usage: Replace console.log with logger.log
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

interface LogOptions {
  context?: string
  timestamp?: boolean
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isDebugEnabled = process.env.DEBUG === 'true'

  /**
   * General logging (only in development)
   */
  log(...args: any[]) {
    if (this.isDevelopment) {
      console.log(...args)
    }
  }

  /**
   * Debug logging (requires DEBUG=true)
   */
  debug(message: string, data?: any, options?: LogOptions) {
    if (this.isDevelopment || this.isDebugEnabled) {
      const prefix = this.formatPrefix('DEBUG', options)
      console.log(prefix, message, data || '')
    }
  }

  /**
   * Info logging (always shown)
   */
  info(message: string, data?: any, options?: LogOptions) {
    const prefix = this.formatPrefix('INFO', options)
    console.info(prefix, message, data || '')
  }

  /**
   * Warning logging (always shown)
   */
  warn(message: string, data?: any, options?: LogOptions) {
    const prefix = this.formatPrefix('WARN', options)
    console.warn(prefix, message, data || '')
  }

  /**
   * Error logging (always shown)
   */
  error(message: string, error?: any, options?: LogOptions) {
    const prefix = this.formatPrefix('ERROR', options)
    console.error(prefix, message, error || '')
    
    // In production, you could send to error tracking service
    if (!this.isDevelopment && typeof window !== 'undefined') {
      // TODO: Send to Sentry, LogRocket, etc.
    }
  }

  /**
   * Performance logging
   */
  perf(label: string, duration: number, options?: LogOptions) {
    if (this.isDevelopment || this.isDebugEnabled) {
      const prefix = this.formatPrefix('PERF', options)
      console.log(`${prefix} ${label}: ${duration.toFixed(2)}ms`)
    }
  }

  /**
   * API logging
   */
  api(method: string, url: string, status: number, duration: number) {
    if (this.isDevelopment || this.isDebugEnabled) {
      const statusColor = status >= 500 ? '🔴' : status >= 400 ? '🟡' : '🟢'
      console.log(`${statusColor} [API] ${method} ${url} - ${status} (${duration.toFixed(0)}ms)`)
    }
  }

  /**
   * Database query logging
   */
  query(table: string, operation: string, duration: number, rows?: number) {
    if (this.isDevelopment || this.isDebugEnabled) {
      console.log(`🗄️  [DB] ${operation} on ${table} - ${duration.toFixed(2)}ms${rows !== undefined ? ` (${rows} rows)` : ''}`)
    }
  }

  /**
   * Security event logging (always logged)
   */
  security(event: string, userId?: string, details?: any) {
    const prefix = this.formatPrefix('SECURITY', { context: 'Security' })
    console.warn(prefix, event, { userId, ...details })
    
    // In production, send to security monitoring service
    if (!this.isDevelopment) {
      // TODO: Send to security monitoring service
    }
  }

  /**
   * Format log prefix with timestamp and context
   */
  private formatPrefix(level: string, options?: LogOptions): string {
    const parts: string[] = []
    
    if (options?.timestamp !== false) {
      parts.push(`[${new Date().toISOString()}]`)
    }
    
    parts.push(`[${level}]`)
    
    if (options?.context) {
      parts.push(`[${options.context}]`)
    }
    
    return parts.join(' ')
  }

  /**
   * Measure and log execution time
   */
  async measure<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
    const start = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - start
      this.perf(label, duration)
      return result
    } catch (error) {
      const duration = Date.now() - start
      this.error(`${label} failed after ${duration}ms`, error)
      throw error
    }
  }

  /**
   * Create a child logger with context
   */
  withContext(context: string) {
    return {
      log: (...args: any[]) => this.log(...args),
      debug: (message: string, data?: any) => this.debug(message, data, { context }),
      info: (message: string, data?: any) => this.info(message, data, { context }),
      warn: (message: string, data?: any) => this.warn(message, data, { context }),
      error: (message: string, error?: any) => this.error(message, error, { context }),
      perf: (label: string, duration: number) => this.perf(label, duration, { context }),
    }
  }
}

// Export singleton instance
export const logger = new Logger()

// Export convenience methods
export const { log, debug, info, warn, error, perf, api, query, security, measure, withContext } = logger

// Export type
export type { LogOptions }

/**
 * Usage examples:
 * 
 * import { logger } from '@/lib/logger'
 * 
 * // Basic logging (only in dev)
 * logger.log('User clicked button')
 * 
 * // Debug with context
 * logger.debug('Fetching products', { category: 'electronics' })
 * 
 * // Always shown
 * logger.info('User logged in', { userId: '123' })
 * logger.warn('Low stock alert', { productId: '456', stock: 2 })
 * logger.error('Payment failed', error)
 * 
 * // Performance
 * logger.perf('Product query', 125.4)
 * 
 * // API calls
 * logger.api('GET', '/api/products', 200, 145.2)
 * 
 * // Database queries
 * logger.query('products', 'SELECT', 45.3, 100)
 * 
 * // Security events
 * logger.security('Failed login attempt', 'user@example.com', { ip: '1.2.3.4' })
 * 
 * // Measure execution time
 * const result = await logger.measure('Complex calculation', async () => {
 *   return await complexFunction()
 * })
 * 
 * // With context
 * const cartLogger = logger.withContext('Cart')
 * cartLogger.info('Item added', { productId: '123' })
 */


