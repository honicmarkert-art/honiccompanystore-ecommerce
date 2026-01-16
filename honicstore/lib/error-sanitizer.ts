/**
 * Error Sanitization Utility
 * Ensures no sensitive information is exposed to clients
 */

/**
 * Sanitize error message for client display
 * Always returns generic "Failed" to prevent information leakage
 */
export function sanitizeError(error: unknown): string {
  // Always return generic message - never expose error details
  return 'Failed'
}

/**
 * Sanitize error object for logging (server-side only)
 * Preserves full error details for server logging
 */
export function getErrorForLogging(error: unknown): {
  message: string
  stack?: string
  name?: string
  code?: string
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: (error as any).code
    }
  }
  
  return {
    message: String(error)
  }
}

/**
 * Check if error message contains sensitive information
 */
export function containsSensitiveInfo(message: string): boolean {
  const sensitivePatterns = [
    'api-key',
    'api key',
    'access token',
    'secret',
    'password',
    'credential',
    'authentication',
    'authorization',
    'token',
    'key',
    'invalid or expired',
    'unauthorized',
    'forbidden',
    'database',
    'sql',
    'query',
    'connection',
    'timeout',
    'network',
    'server error',
    'internal error',
    'stack trace',
    'error code',
    'status code'
  ]
  
  const lowerMessage = message.toLowerCase()
  return sensitivePatterns.some(pattern => lowerMessage.includes(pattern))
}
