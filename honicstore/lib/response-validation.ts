/**
 * Response validation utilities
 * Prevents XSS attacks by validating and sanitizing API responses
 */

/**
 * Validate product response structure
 */
export function validateProductResponse(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false
  }

  // Required fields
  if (typeof data.id !== 'number' || data.id <= 0) {
    return false
  }

  if (typeof data.name !== 'string' || data.name.length === 0) {
    return false
  }

  if (typeof data.price !== 'number' || data.price < 0) {
    return false
  }

  // Optional fields validation
  if (data.description && typeof data.description !== 'string') {
    return false
  }

  if (data.image && typeof data.image !== 'string') {
    return false
  }

  if (data.rating !== undefined && (typeof data.rating !== 'number' || data.rating < 0 || data.rating > 5)) {
    return false
  }

  return true
}

/**
 * Sanitize product data to prevent XSS
 */
export function sanitizeProductData(product: any): any {
  if (!product || typeof product !== 'object') {
    return null
  }

  return {
    ...product,
    name: typeof product.name === 'string' ? product.name.replace(/[<>]/g, '') : product.name,
    description: typeof product.description === 'string' 
      ? product.description.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      : product.description,
    // Keep other fields as-is (they should be validated separately)
  }
}

/**
 * Validate review response structure
 */
export function validateReviewResponse(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false
  }

  // Check if it's an array of reviews
  if (Array.isArray(data)) {
    return data.every(review => validateSingleReview(review))
  }

  // Check if it's a single review
  if (data.reviews && Array.isArray(data.reviews)) {
    return data.reviews.every((review: any) => validateSingleReview(review))
  }

  return false
}

/**
 * Validate single review object
 */
function validateSingleReview(review: any): boolean {
  if (!review || typeof review !== 'object') {
    return false
  }

  // Required fields
  if (typeof review.id !== 'number' || review.id <= 0) {
    return false
  }

  if (typeof review.rating !== 'number' || review.rating < 1 || review.rating > 5) {
    return false
  }

  // Optional fields
  if (review.comment && typeof review.comment !== 'string') {
    return false
  }

  if (review.userName && typeof review.userName !== 'string') {
    return false
  }

  return true
}

/**
 * Sanitize review data to prevent XSS
 */
export function sanitizeReviewData(review: any): any {
  if (!review || typeof review !== 'object') {
    return null
  }

  return {
    ...review,
    comment: typeof review.comment === 'string' 
      ? review.comment.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '')
      : review.comment,
    userName: typeof review.userName === 'string'
      ? review.userName.replace(/[<>]/g, '')
      : review.userName
  }
}

/**
 * Validate API response structure
 */
export function validateApiResponse<T = any>(response: any, schema?: (data: any) => boolean): T | null {
  if (!response || typeof response !== 'object') {
    return null
  }

  // If schema validator provided, use it
  if (schema && !schema(response)) {
    return null
  }

  // Basic structure validation
  if (response.error && typeof response.error === 'string') {
    // Error response - still valid structure
    return response as T
  }

  return response as T
}
