/**
 * Performance-optimized fetch utilities
 * Includes retry logic, timeout handling, and request deduplication
 */

interface FetchOptions extends RequestInit {
  timeout?: number
  retries?: number
  retryDelay?: number
  signal?: AbortSignal
}

interface FetchWithRetryOptions extends FetchOptions {
  retries?: number
  retryDelay?: number
  exponentialBackoff?: boolean
}

/**
 * Fetch with timeout
 * Automatically cancels request after specified timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = 10000, signal, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  // Combine signals if both provided
  let combinedSignal: AbortSignal | undefined
  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
    combinedSignal = signal
  } else {
    combinedSignal = controller.signal
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: combinedSignal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`)
    }
    throw error
  }
}

/**
 * Calculate exponential backoff delay with jitter
 * Prevents thundering herd problem when multiple clients retry simultaneously
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  exponentialBackoff: boolean,
  maxDelay: number = 30000
): number {
  let delay: number
  
  if (exponentialBackoff) {
    // Exponential backoff: baseDelay * 2^attempt
    delay = baseDelay * Math.pow(2, attempt)
  } else {
    // Linear backoff
    delay = baseDelay * (attempt + 1)
  }
  
  // Add jitter (random 0-25% of delay) to prevent synchronized retries
  const jitter = Math.random() * delay * 0.25
  delay = delay + jitter
  
  // Cap at max delay
  return Math.min(delay, maxDelay)
}

/**
 * Fetch with retry logic and exponential backoff
 * Automatically retries failed requests with increasing delays
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options including retry configuration
 * @returns Promise<Response> - The fetch response
 * 
 * @example
 * ```typescript
 * const response = await fetchWithRetry('/api/products', {
 *   retries: 3,
 *   retryDelay: 1000,
 *   exponentialBackoff: true
 * })
 * ```
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    retries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    timeout = 10000,
    signal,
    ...fetchOptions
  } = options

  let lastError: Error | null = null
  let actualRetryCount = 0

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Calculate delay for this attempt (exponential backoff with jitter)
      const delay = calculateBackoffDelay(attempt, retryDelay, exponentialBackoff)

      // Wait before retry (except first attempt)
      if (attempt > 0) {
        actualRetryCount++
        await new Promise(resolve => setTimeout(resolve, Math.floor(delay)))
      }

      // Check if request was aborted
      if (signal?.aborted) {
        throw new Error('Request aborted')
      }

      // Fetch with timeout
      const response = await fetchWithTimeout(url, {
        ...fetchOptions,
        timeout,
        signal
      })

      // Retry on 5xx errors (server errors) - transient failures
      if (response.status >= 500 && response.status < 600 && attempt < retries) {
        lastError = new Error(`Server error ${response.status}`)
        continue
      }

      // Retry on 429 rate limit with longer delay
      if (response.status === 429 && attempt < retries) {
        // Use longer delay for rate limits (2x normal delay)
        const rateLimitDelay = delay * 2
        await new Promise(resolve => setTimeout(resolve, Math.floor(rateLimitDelay)))
        lastError = new Error('Rate limited')
        continue
      }

      // Retry on 408 timeout
      if (response.status === 408 && attempt < retries) {
        lastError = new Error('Request timeout')
        continue
      }

      // Success or non-retryable error - return response
      return response
    } catch (error: any) {
      lastError = error

      // Don't retry on abort errors (user cancelled or component unmounted)
      if (error.name === 'AbortError' || signal?.aborted) {
        throw error
      }

      // Don't retry on network errors that indicate client issues
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        // Only retry network errors if not last attempt
        if (attempt < retries) {
          continue
        }
      }

      // Don't retry on 4xx errors (client errors) - these won't succeed on retry
      if (error.message?.includes('4') && !error.message?.includes('429') && !error.message?.includes('408')) {
        throw error
      }

      // If this was the last attempt, throw the error
      if (attempt === retries) {
        throw error
      }
    }
  }

  throw lastError || new Error(`Failed to fetch after ${retries} retries`)
}

/**
 * Request deduplication map
 * Prevents duplicate requests for the same URL
 */
const requestCache = new Map<string, Promise<Response>>()

/**
 * Fetch with deduplication
 * Prevents multiple simultaneous requests to the same URL
 */
export async function fetchWithDeduplication(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const cacheKey = `${url}:${JSON.stringify(options)}`

  // Check if request is already in flight
  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey)!
  }

  // Create new request
  const requestPromise = fetchWithRetry(url, options)
    .finally(() => {
      // Clean up cache after request completes
      setTimeout(() => {
        requestCache.delete(cacheKey)
      }, 1000) // Keep in cache for 1 second
    })

  requestCache.set(cacheKey, requestPromise)
  return requestPromise
}

/**
 * Safe JSON fetch with validation
 * Fetches and validates JSON response
 */
export async function fetchJSON<T>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  const response = await fetchWithDeduplication(url, options)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  try {
    const data = await response.json()
    return data as T
  } catch (error) {
    throw new Error(`Invalid JSON response from ${url}`)
  }
}

/**
 * Performance monitoring wrapper with retry tracking
 * Tracks fetch performance metrics including retry attempts
 */
export async function fetchWithMetrics(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<{ response: Response; metrics: FetchMetrics }> {
  const startTime = performance.now()
  let retryCount = 0
  const maxRetries = options.retries || 3

  // Track retry attempts
  const originalRetryDelay = options.retryDelay || 1000
  let lastAttemptTime = startTime

  try {
    // Wrap fetchWithRetry to track retries
    const response = await fetchWithRetry(url, {
      ...options,
      retries: maxRetries,
      retryDelay: originalRetryDelay,
      exponentialBackoff: options.exponentialBackoff !== false
    })

    const endTime = performance.now()
    const duration = endTime - startTime

    // Calculate retry count from duration and delays
    // This is approximate but gives us a good estimate
    let estimatedRetries = 0
    if (duration > originalRetryDelay * 2) {
      let cumulativeDelay = 0
      for (let i = 0; i < maxRetries; i++) {
        const delay = originalRetryDelay * Math.pow(2, i)
        cumulativeDelay += delay
        if (duration > cumulativeDelay + originalRetryDelay) {
          estimatedRetries = i + 1
        }
      }
    }

    const metrics: FetchMetrics = {
      url,
      duration,
      status: response.status,
      retryCount: estimatedRetries,
      cached: response.headers.get('X-Cache') === 'HIT',
      size: parseInt(response.headers.get('Content-Length') || '0', 10)
    }

    return { response, metrics }
  } catch (error: any) {
    const endTime = performance.now()
    const duration = endTime - startTime

    // Estimate retry count from error and duration
    let estimatedRetries = 0
    if (duration > originalRetryDelay) {
      let cumulativeDelay = 0
      for (let i = 0; i < maxRetries; i++) {
        const delay = originalRetryDelay * Math.pow(2, i)
        cumulativeDelay += delay
        if (duration > cumulativeDelay) {
          estimatedRetries = i + 1
        }
      }
    }

    const metrics: FetchMetrics = {
      url,
      duration,
      status: 0,
      retryCount: estimatedRetries,
      cached: false,
      size: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }

    throw { error, metrics }
  }
}

export interface FetchMetrics {
  url: string
  duration: number
  status: number
  retryCount: number
  cached: boolean
  size: number
  error?: string
}
