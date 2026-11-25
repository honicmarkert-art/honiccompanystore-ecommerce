/**
 * Email validation utilities for client and server-side use
 * Detects common email domain typos and validates email format
 */

import { isDisposableDomain } from './disposable-email-domains'

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

// Valid email domains (common providers). Real domains that look like typos of others are listed
// too (ymail.com, email.com, me.com...) so they are never flagged.
export const VALID_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'ymail.com', 'rocketmail.com', 'yahoo.co.uk',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me',
  'aol.com', 'mail.com', 'email.com', 'yandex.com', 'zoho.com', 'gmx.com',
]

export interface EmailValidationResult {
  isValid: boolean
  suggestion?: string
  error?: string
  isTypo?: boolean
  isDisposable?: boolean
}

/**
 * Detect a misspelt provider domain (gmial.com, gmail.con, yahooo.com, hotmial.com...).
 * Uses the known-typo list, then an edit distance of 1 where swapping two neighbouring letters
 * counts as one edit, compared with the full domain (the old check only ran for 3-6 letter domains,
 * so it never caught real typos).
 */
function detectTypo(domain: string): string | null {
  const d = domain.toLowerCase().trim()
  if (EMAIL_DOMAIN_TYPOS[d]) return EMAIL_DOMAIN_TYPOS[d]
  if (VALID_EMAIL_DOMAINS.includes(d)) return null
  let best: string | null = null
  for (const valid of VALID_EMAIL_DOMAINS) {
    if (Math.abs(d.length - valid.length) > 1) continue
    if (editDistance(d, valid) <= 1) { best = valid; break }
  }
  if (best) return best
  // right provider name, wrong ending: gmail.con, gmail.co, yahoo.cm
  const [name, ...rest] = d.split('.')
  const tld = rest.join('.')
  const provider = VALID_EMAIL_DOMAINS.find((v) => v.split('.')[0] === name)
  if (provider && tld !== provider.slice(name.length + 1) && ['con', 'co', 'cm', 'om', 'comm', 'cpm', 'vom', 'xom'].includes(tld)) return provider
  return null
}

/** Optimal-string-alignment distance (Levenshtein + adjacent transposition counts as 1). */
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1)
    }
  }
  return dp[m][n]
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
      error: `Did you mean ${localPart}@${correctedDomain}? Please check your email address.`
    }
  }

  // Throwaway inboxes (mailinator, yopmail, temp-mail…)
  if (isDisposableDomain(normalizedDomain)) {
    return {
      isValid: false,
      isDisposable: true,
      error: 'Temporary email addresses can’t be used. Please use your own email address.'
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

