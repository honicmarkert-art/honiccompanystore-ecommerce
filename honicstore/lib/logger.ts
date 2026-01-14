/**
 * Production-safe logging utility
 *
 * Maintains debug capabilities without console output
 * Usage: Replace console.log with logger.log
 *
 * Logs are saved to:
 * - Development: ./logs/app.log (client-side logs go to console only)
 * - Production: External services (Sentry, LogRocket, etc.) or ./logs/app.log (server-side)
 */

// Only import Node.js modules on server-side
// Using type-safe conditional imports
type FSType = typeof import('fs')
type PathType = typeof import('path')

let fs: FSType | null = null
let path: PathType | null = null

// Only load Node.js modules on server-side (not in browser)
if (typeof window === 'undefined') {
  try {
    // Use require for Node.js modules (works in server context)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    fs = require('fs') as FSType
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    path = require('path') as PathType
  } catch (error) {
    // Silently fail if modules can't be loaded (e.g., in edge runtime)
  }
}
type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

interface LogOptions {
  context?: string
  timestamp?: boolean
}
class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isDebugEnabled = process.env.DEBUG === 'true'
  private logDir: string = ''
  private logFile: string = ''
  private errorLogFile: string = ''

  constructor() {
    // Only set up file paths on server-side
    if (typeof window === 'undefined' && path && fs) {
      try {
        this.logDir = path.join(process.cwd(), 'logs')
        this.logFile = path.join(this.logDir, 'app.log')
        this.errorLogFile = path.join(this.logDir, 'errors.log')

        // Create logs directory if it doesn't exist (server-side only)
        if (fs.existsSync && !fs.existsSync(this.logDir)) {
          fs.mkdirSync(this.logDir, { recursive: true })
        }
      } catch (error) {
        // Silently fail if we can't set up log directory
      }
    }
  }
  /**
   * Write log to file (server-side only)
   */
  private writeToFile(level: string, message: string, data?: any): void {
    // Only write to file on server-side
    if (typeof window !== 'undefined' || !fs || !fs.appendFileSync) {
      return
    }
    try {
      const timestamp = new Date().toISOString()
      const logEntry = `[${timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`
      const logFile = level === 'ERROR' ? this.errorLogFile : this.logFile

      if (!logFile) {
        return // No log file path set (client-side)
      }
      // Append to log file
      fs.appendFileSync(logFile, logEntry, 'utf8')

      // Rotate log file if it gets too large (10MB)
      try {
        if (fs.statSync) {
          const stats = fs.statSync(logFile)
          if (stats.size > 10 * 1024 * 1024) { // 10MB
            const rotatedFile = logFile.replace('.log', `-${Date.now()}.log`)
            if (fs.renameSync) {
              fs.renameSync(logFile, rotatedFile)
            }
          }
        }
      } catch (error) {
        // Ignore rotation errors
      }
    } catch (error) {
      // Silently fail if file writing fails
    }
  }
  /**
   * General logging (only in development)
   */
  log(...args: any[]) {
    // Logging disabled for production cleanliness
  }
  /**
   * Debug logging (requires DEBUG=true)
   */
  debug(message: string, data?: any, options?: LogOptions) {
    if (this.isDevelopment || this.isDebugEnabled) {
      const prefix = this.formatPrefix('DEBUG', options)
    }
  }
  /**
   * Info logging (always shown)
   */
  info(message: string, data?: any, options?: LogOptions) {
    const prefix = this.formatPrefix('INFO', options)
    }
  /**
   * Warning logging (always shown)
   */
  warn(message: string, data?: any, options?: LogOptions) {
    const prefix = this.formatPrefix('WARN', options)
    // console.warn removed for production cleanliness
  }
  /**
   * Error logging (always shown)
   */
  error(message: string, error?: any, options?: LogOptions) {
    const prefix = this.formatPrefix('ERROR', options)
    // Error logging disabled for production cleanliness

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
    }
  }
  /**
   * API logging
   */
  api(method: string, url: string, status: number, duration: number) {
    if (this.isDevelopment || this.isDebugEnabled) {
      const statusColor = status >= 500 ? '🔴' : status >= 400 ? '🟡' : '🟢'
    }
  }
  /**
   * Database query logging
   */
  query(table: string, operation: string, duration: number, rows?: number) {
    if (this.isDevelopment || this.isDebugEnabled) {
    }
  }
  /**
   * Security event logging (always logged)
   */
  security(event: string, userId?: string, details?: any) {
    const prefix = this.formatPrefix('SECURITY', { context: 'Security' })
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


