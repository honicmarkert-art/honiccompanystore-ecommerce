// Centralized error handling and logging system
import { logger } from '@/lib/logger'

export interface ErrorContext {
  userId?: string
  orderId?: string
  paymentId?: string
  action?: string
  userAgent?: string
  ip?: string
  timestamp?: string
  [key: string]: any
}

export interface ErrorLog {
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  error?: Error
  context?: ErrorContext
  stack?: string
  timestamp: string
}

// Error types for better categorization
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  PAYMENT_ERROR = 'PAYMENT_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  STOCK_ERROR = 'STOCK_ERROR',
  ORDER_ERROR = 'ORDER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class AppError extends Error {
  public readonly type: ErrorType
  public readonly statusCode: number
  public readonly context?: ErrorContext
  public readonly isOperational: boolean

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN_ERROR,
    statusCode: number = 500,
    context?: ErrorContext,
    isOperational: boolean = true
  ) {
    super(message)
    this.type = type
    this.statusCode = statusCode
    this.context = context
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

// Logger class for structured logging
export class Logger {
  private static instance: Logger
  private logs: ErrorLog[] = []
  private maxLogs: number = 1000

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private addLog(log: ErrorLog): void {
    this.logs.push(log)
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // In production, you would send logs to an external service
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService(log)
    } else {
      logger.log(`[${log.level.toUpperCase()}] ${log.timestamp}: ${log.message}`, {
        context: log.context,
        stack: log.stack
      })
    }
  }

  private async sendToExternalService(log: ErrorLog): Promise<void> {
    // In production, integrate with services like:
    // - Sentry for error tracking
    // - LogRocket for session replay
    // - DataDog for monitoring
    // - CloudWatch for AWS environments
    
    try {
      // Example: Send to external logging service
      if (process.env.SENTRY_DSN) {
        // await Sentry.captureException(log.error, { extra: log.context })
      }
      
      if (process.env.LOG_ENDPOINT) {
        // await fetch(process.env.LOG_ENDPOINT, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(log)
        // })
      }
    } catch (error) {
      console.error('Failed to send log to external service:', error)
    }
  }

  public error(message: string, error?: Error, context?: ErrorContext): void {
    this.addLog({
      level: 'error',
      message,
      error,
      context,
      stack: error?.stack,
      timestamp: new Date().toISOString()
    })
  }

  public warn(message: string, context?: ErrorContext): void {
    this.addLog({
      level: 'warn',
      message,
      context,
      timestamp: new Date().toISOString()
    })
  }

  public info(message: string, context?: ErrorContext): void {
    this.addLog({
      level: 'info',
      message,
      context,
      timestamp: new Date().toISOString()
    })
  }

  public debug(message: string, context?: ErrorContext): void {
    this.addLog({
      level: 'debug',
      message,
      context,
      timestamp: new Date().toISOString()
    })
  }

  public getLogs(level?: string, limit?: number): ErrorLog[] {
    let filteredLogs = this.logs
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level)
    }
    
    if (limit) {
      filteredLogs = filteredLogs.slice(-limit)
    }
    
    return filteredLogs
  }

  public clearLogs(): void {
    this.logs = []
  }
}

// Error handler for API routes
export function handleApiError(error: unknown, context?: ErrorContext): {
  statusCode: number
  message: string
  details?: any
} {
  const logger = Logger.getInstance()
  
  if (error instanceof AppError) {
    logger.error(error.message, error, context)
    
    return {
      statusCode: error.statusCode,
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        type: error.type,
        context: error.context,
        stack: error.stack
      } : undefined
    }
  }
  
  if (error instanceof Error) {
    logger.error('Unexpected error occurred', error, context)
    
    return {
      statusCode: 500,
      message: 'An unexpected error occurred. Please try again.',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        context
      } : undefined
    }
  }
  
  logger.error('Unknown error occurred', undefined, context)
  
  return {
    statusCode: 500,
    message: 'An unknown error occurred. Please try again.',
    details: process.env.NODE_ENV === 'development' ? { context } : undefined
  }
}

// Validation error helper
export function createValidationError(message: string, field?: string, context?: ErrorContext): AppError {
  return new AppError(
    message,
    ErrorType.VALIDATION_ERROR,
    400,
    { ...context, field }
  )
}

// Authentication error helper
export function createAuthError(message: string = 'Authentication required', context?: ErrorContext): AppError {
  return new AppError(
    message,
    ErrorType.AUTHENTICATION_ERROR,
    401,
    context
  )
}

// Authorization error helper
export function createAuthzError(message: string = 'Insufficient permissions', context?: ErrorContext): AppError {
  return new AppError(
    message,
    ErrorType.AUTHORIZATION_ERROR,
    403,
    context
  )
}

// Payment error helper
export function createPaymentError(message: string, context?: ErrorContext): AppError {
  return new AppError(
    message,
    ErrorType.PAYMENT_ERROR,
    402,
    context
  )
}

// Database error helper
export function createDatabaseError(message: string, context?: ErrorContext): AppError {
  return new AppError(
    message,
    ErrorType.DATABASE_ERROR,
    500,
    context
  )
}

// Rate limit error helper
export function createRateLimitError(message: string = 'Too many requests', context?: ErrorContext): AppError {
  return new AppError(
    message,
    ErrorType.RATE_LIMIT_ERROR,
    429,
    context
  )
}

// Stock error helper
export function createStockError(message: string, context?: ErrorContext): AppError {
  return new AppError(
    message,
    ErrorType.STOCK_ERROR,
    400,
    context
  )
}

// Order error helper
export function createOrderError(message: string, context?: ErrorContext): AppError {
  return new AppError(
    message,
    ErrorType.ORDER_ERROR,
    400,
    context
  )
}

// Async error wrapper for API routes
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      const logger = Logger.getInstance()
      logger.error('Async handler error', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }
}

// Performance monitoring helper
export function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>,
  context?: ErrorContext
): Promise<T> {
  const logger = Logger.getInstance()
  const startTime = Date.now()
  
  return fn().then(
    (result) => {
      const duration = Date.now() - startTime
      logger.info(`Performance: ${name} completed in ${duration}ms`, context)
      return result
    },
    (error) => {
      const duration = Date.now() - startTime
      logger.error(`Performance: ${name} failed after ${duration}ms`, error, context)
      throw error
    }
  )
}








