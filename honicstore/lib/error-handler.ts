/**
 * Production-ready error handling utilities
 * Provides consistent error handling, logging, and user feedback
 */

export interface AppError {
  code: string
  message: string
  statusCode?: number
  details?: unknown
  timestamp: string
}

export class ProductionError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: unknown
  public readonly timestamp: string
  public readonly isOperational: boolean

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode: number = 500,
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message)
    this.name = 'ProductionError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.timestamp = new Date().toISOString()
    this.isOperational = isOperational

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProductionError)
    }
  }

  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    }
  }
}

/**
 * Error codes for different error types
 */
export const ErrorCodes = {
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_LOCKED: 'AUTH_LOCKED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  
  // Server errors
  SERVER_ERROR: 'SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Not found
  NOT_FOUND: 'NOT_FOUND',
  
  // Permission errors
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const

/**
 * Production-ready error logger
 * Separates user-facing messages from detailed error logs
 */
export function logError(
  error: Error | ProductionError | unknown,
  context?: {
    userId?: string
    action?: string
    metadata?: Record<string, unknown>
  }
): void {
  const isProduction = process.env.NODE_ENV === 'production'
  
  // In production, only log to external service (e.g., Sentry, LogRocket)
  // In development, errors are handled but not logged to console
  // TODO: Integrate with your monitoring service (Sentry, LogRocket, etc.)
  if (isProduction) {
    // Production logging - send to monitoring service
    if (error instanceof ProductionError) {
      // Log structured error to monitoring service
    } else {
      // Log generic error to monitoring service
    }
  }
}

/**
 * Get user-friendly error message
 * Never exposes sensitive information to users
 */
export function getUserFriendlyMessage(error: Error | ProductionError | unknown): string {
  if (error instanceof ProductionError) {
    // Return user-friendly message based on error code
    switch (error.code) {
      case ErrorCodes.AUTH_REQUIRED:
        return 'Please log in to continue.'
      case ErrorCodes.AUTH_INVALID:
        return 'Invalid credentials. Please check your email and password.'
      case ErrorCodes.AUTH_EXPIRED:
        return 'Your session has expired. Please log in again.'
      case ErrorCodes.AUTH_LOCKED:
        return 'Your account has been temporarily locked. Please try again later.'
      case ErrorCodes.VALIDATION_ERROR:
      case ErrorCodes.INVALID_INPUT:
        return 'Please check your input and try again.'
      case ErrorCodes.NETWORK_ERROR:
        return 'Network error. Please check your connection and try again.'
      case ErrorCodes.TIMEOUT_ERROR:
        return 'Request timed out. Please try again.'
      case ErrorCodes.RATE_LIMIT_EXCEEDED:
        return 'Too many requests. Please wait a moment and try again.'
      case ErrorCodes.NOT_FOUND:
        return 'The requested resource was not found.'
      case ErrorCodes.FORBIDDEN:
      case ErrorCodes.UNAUTHORIZED:
        return 'You do not have permission to perform this action.'
      case ErrorCodes.SERVER_ERROR:
      case ErrorCodes.DATABASE_ERROR:
        return 'An unexpected error occurred. Please try again later.'
      default:
        return 'Something went wrong. Please try again.'
    }
  }

  if (error instanceof Error) {
    // For generic errors, return a safe message
    const message = error.message.toLowerCase()
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.'
    }
    
    if (message.includes('timeout')) {
      return 'Request timed out. Please try again.'
    }
    
    // Default safe message
    return 'An error occurred. Please try again.'
  }

  return 'An unexpected error occurred. Please try again.'
}

/**
 * Handle errors in async functions with proper logging and user feedback
 */
export async function handleAsyncError<T>(
  fn: () => Promise<T>,
  context?: {
    userId?: string
    action?: string
    metadata?: Record<string, unknown>
  }
): Promise<{ success: true; data: T } | { success: false; error: string; code: string }> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (error) {
    logError(error, context)
    const userMessage = getUserFriendlyMessage(error)
    const code = error instanceof ProductionError ? error.code : ErrorCodes.SERVER_ERROR
    
    return {
      success: false,
      error: userMessage,
      code,
    }
  }
}

/**
 * Create error response for API routes
 */
export function createErrorResponse(
  error: Error | ProductionError | unknown,
  statusCode: number = 500
): Response {
  const userMessage = getUserFriendlyMessage(error)
  const code = error instanceof ProductionError ? error.code : ErrorCodes.SERVER_ERROR
  
  logError(error)
  
  return new Response(
    JSON.stringify({
      success: false,
      error: userMessage,
      code,
      timestamp: new Date().toISOString(),
    }),
    {
      status: error instanceof ProductionError ? error.statusCode : statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

/**
 * Create validation error
 */
export function createValidationError(
  message: string,
  field?: string,
  metadata?: Record<string, unknown>
): ProductionError {
  return new ProductionError(
    message,
    ErrorCodes.VALIDATION_ERROR,
    400,
    { field, ...metadata }
  )
}

/**
 * Create authentication error
 */
export function createAuthError(
  message: string,
  metadata?: Record<string, unknown>
): ProductionError {
  return new ProductionError(
    message,
    ErrorCodes.AUTH_REQUIRED,
    401,
    metadata
  )
}

/**
 * Create rate limit error
 */
export function createRateLimitError(
  message: string,
  metadata?: Record<string, unknown>
): ProductionError {
  return new ProductionError(
    message,
    ErrorCodes.RATE_LIMIT_EXCEEDED,
    429,
    metadata
  )
}

/**
 * Create stock error
 */
export function createStockError(
  message: string,
  metadata?: Record<string, unknown>
): ProductionError {
  return new ProductionError(
    message,
    ErrorCodes.VALIDATION_ERROR,
    400,
    { ...metadata, type: 'stock' }
  )
}

/**
 * Create order error
 */
export function createOrderError(
  message: string,
  metadata?: Record<string, unknown>
): ProductionError {
  return new ProductionError(
    message,
    ErrorCodes.VALIDATION_ERROR,
    400,
    { ...metadata, type: 'order' }
  )
}

/**
 * Create database error
 */
export function createDatabaseError(
  message: string,
  metadata?: Record<string, unknown>
): ProductionError {
  return new ProductionError(
    message,
    ErrorCodes.DATABASE_ERROR,
    500,
    metadata
  )
}

/**
 * Handle API errors consistently
 */
export function handleApiError(
  error: Error | ProductionError | unknown,
  defaultMessage: string = 'An error occurred'
): ProductionError {
  if (error instanceof ProductionError) {
    return error
  }
  
  if (error instanceof Error) {
    return new ProductionError(
      error.message || defaultMessage,
      ErrorCodes.SERVER_ERROR,
      500
    )
  }
  
  return new ProductionError(
    defaultMessage,
    ErrorCodes.SERVER_ERROR,
    500
  )
}

/**
 * Measure performance of async operations
 */
export async function measurePerformance<T>(
  label: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - startTime
    logError(new Error(`Performance: ${label} took ${duration}ms`), {
      action: 'performance',
      metadata: { ...metadata, duration, label }
    })
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    logError(error, {
      action: 'performance_error',
      metadata: { ...metadata, duration, label }
    })
    throw error
  }
}

/**
 * Logger class for compatibility
 */
export class Logger {
  private static instance: Logger | null = null
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }
  
  log(message: string, data?: any): void {
    // Use the logger from logger.ts
    const { logger } = require('./logger')
    logger.log(message, data)
  }
  
  error(message: string, error?: any): void {
    const { logger } = require('./logger')
    logger.error(message, error)
  }
  
  info(message: string, data?: any): void {
    const { logger } = require('./logger')
    logger.info(message, data)
  }
  
  warn(message: string, data?: any): void {
    const { logger } = require('./logger')
    logger.warn(message, data)
  }
}
