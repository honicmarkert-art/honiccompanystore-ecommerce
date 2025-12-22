/**
 * Email validation utilities for client and server-side use
 * Detects common email domain typos and validates email format
 */

// Common email domain typos mapping
export const EMAIL_DOMAIN_TYPOS: Record<string, string> = {
  'gail.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmaiil.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outllook.com': 'outlook.com',
  'hotmai.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmali.com': 'hotmail.com',
}

// Valid email domains (common providers)
export const VALID_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'protonmail.com',
  'proton.me',
  'aol.com',
  'mail.com',
  'yandex.com',
  'zoho.com',
  'gmx.com',
  'live.com',
  'msn.com',
]

export interface EmailValidationResult {
  isValid: boolean
  suggestion?: string
  error?: string
  isTypo?: boolean
}

/**
 * Fuzzy match domain to detect typos
 * Checks if domain is similar to common email domains
 */
function detectTypo(domain: string): string | null {
  const normalizedDomain = domain.toLowerCase().trim()
  
  // Check exact typo matches first
  if (EMAIL_DOMAIN_TYPOS[normalizedDomain]) {
    return EMAIL_DOMAIN_TYPOS[normalizedDomain]
  }

  // Fuzzy matching for common typos
  // Check if domain is similar to common domains (1-2 character difference)
  for (const validDomain of VALID_EMAIL_DOMAINS) {
    // Check if domain is very similar (likely typo)
    const similarity = calculateSimilarity(normalizedDomain, validDomain)
    
    // If similarity is high (> 0.7) and domain length is similar, likely a typo
    if (similarity > 0.7 && Math.abs(normalizedDomain.length - validDomain.length) <= 2) {
      // Additional check: if domain is 3-6 chars and similar, it's likely a typo
      if (normalizedDomain.length >= 3 && normalizedDomain.length <= 6) {
        return validDomain
      }
    }
  }

  return null
}

/**
 * Calculate similarity between two strings (Levenshtein distance based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const distance = levenshteinDistance(longer, shorter)
  return (longer.length - distance) / longer.length
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

/**
 * Validate email domain and suggest corrections for common typos
 * Works on both client and server side
 */
export function validateEmailDomain(email: string): EmailValidationResult {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' }
  }

  const trimmedEmail = email.trim()
  const parts = trimmedEmail.split('@')
  
  if (parts.length !== 2) {
    return { isValid: false, error: 'Invalid email format' }
  }

  const [localPart, domain] = parts
  const normalizedDomain = domain.toLowerCase().trim()
  
  // Check if local part is empty
  if (!localPart || localPart.length === 0) {
    return { isValid: false, error: 'Email address is incomplete' }
  }

  // Check for typos (exact matches and fuzzy matching)
  const correctedDomain = detectTypo(normalizedDomain)
  if (correctedDomain) {
    return {
      isValid: false,
      isTypo: true,
      suggestion: `${localPart}@${correctedDomain}`,
      error: `Invalid email domain. Please check your email address.`
    }
  }

  // Check if domain looks suspicious (very short or unusual)
  if (normalizedDomain.length < 4) {
    return {
      isValid: false,
      error: 'Email domain appears to be invalid. Please check your email address.'
    }
  }

  // Check for double dots or invalid characters
  if (normalizedDomain.includes('..') || normalizedDomain.startsWith('.') || normalizedDomain.endsWith('.')) {
    return {
      isValid: false,
      error: 'Invalid email domain format. Please check your email address.'
    }
  }

  // Basic domain format validation (must have at least one dot)
  if (!normalizedDomain.includes('.')) {
    return {
      isValid: false,
      error: 'Email domain must include a domain extension (e.g., .com, .org)'
    }
  }

  // If domain format is valid, allow it (DNS check will verify if it exists)
  return { isValid: true }
}

/**
 * Validate complete email format (including basic regex check)
 */
export function validateEmailFormat(email: string): EmailValidationResult {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' }
  }

  const trimmedEmail = email.trim()
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!emailRegex.test(trimmedEmail)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address'
    }
  }

  // Check domain validation
  return validateEmailDomain(trimmedEmail)
}

