/**
 * User-facing error messages only. Never show exact server/HTTP errors (e.g. "500", stack, API details).
 */

const FRIENDLY = {
  network: 'Network error. Please check your connection and try again.',
  timeout: 'Request timed out. Please try again.',
  rateLimit: 'Too many requests. Please wait a moment and try again.',
  server: 'Something went wrong. Please try again.',
  notFound: 'The requested item was not found.',
} as const

/**
 * Returns a safe, friendly message for the client. Never exposes status codes, server errors, or technical details.
 */
export function getFriendlyErrorMessage(error: unknown, defaultMessage: string): string {
  const message = typeof error === 'string' ? error : (error instanceof Error ? error.message : '')
  const lower = String(message).toLowerCase()
  const trimmed = String(message).trim()

  // Server / HTTP status - never show exact status to user (avoid matching "400" in "Minimum 400 TZS")
  if (lower.includes('server error') || lower.includes('internal server error') ||
      (lower.includes('status') && /\b[45]\d{2}\b/.test(message)) ||
      /^[45]\d{2}$/.test(trimmed)) {
    return defaultMessage
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return FRIENDLY.network
  }
  if (lower.includes('timeout')) {
    return FRIENDLY.timeout
  }
  if (lower.includes('rate limit') || lower.includes('429')) {
    return FRIENDLY.rateLimit
  }
  if (lower.includes('not found') || lower.includes('404')) {
    return FRIENDLY.notFound
  }

  return defaultMessage
}

export { FRIENDLY }
