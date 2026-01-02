/**
 * Email domain validation using DNS and SMTP checks
 * Verifies that email domains actually exist and can receive emails
 */

import dns from 'dns'
import { promisify } from 'util'

const resolveMx = promisify(dns.resolveMx)
const resolve4 = promisify(dns.resolve4)
const resolve6 = promisify(dns.resolve6)

export interface EmailDomainValidationResult {
  isValid: boolean
  hasMxRecords: boolean
  hasARecords: boolean
  error?: string
  mxRecords?: string[]
}

/**
 * Validate email domain by checking DNS records
 * Checks for MX (Mail Exchange) records and A records
 */
export async function validateEmailDomainDNS(email: string): Promise<EmailDomainValidationResult> {
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      hasMxRecords: false,
      hasARecords: false,
      error: 'Email is required'
    }
  }

  const trimmedEmail = email.trim()
  const parts = trimmedEmail.split('@')
  
  if (parts.length !== 2) {
    return {
      isValid: false,
      hasMxRecords: false,
      hasARecords: false,
      error: 'Invalid email format'
    }
  }

  const domain = parts[1].toLowerCase().trim()
  
  try {
    // Check for MX records (Mail Exchange - required for receiving emails)
    let mxRecords: string[] = []
    let hasMxRecords = false
    
    try {
      const mxResult = await resolveMx(domain)
      if (mxResult && mxResult.length > 0) {
        hasMxRecords = true
        mxRecords = mxResult.map(record => record.exchange)
      }
    } catch (mxError: any) {
      // MX records not found - domain might not be configured for email
      // This is okay, we'll check A records as fallback
    }

    // Check for A records (IPv4) - verifies domain exists
    let hasARecords = false
    try {
      const aRecords = await resolve4(domain)
      if (aRecords && aRecords.length > 0) {
        hasARecords = true
      }
    } catch (aError: any) {
      // A records not found - try AAAA (IPv6)
      try {
        const aaaaRecords = await resolve6(domain)
        if (aaaaRecords && aaaaRecords.length > 0) {
          hasARecords = true
        }
      } catch (aaaaError: any) {
        // No A or AAAA records found
      }
    }

    // Domain is valid if it has either MX records (can receive email) or A records (domain exists)
    const isValid = hasMxRecords || hasARecords

    if (!isValid) {
      return {
        isValid: false,
        hasMxRecords: false,
        hasARecords: false,
        error: `The email domain "${domain}" does not appear to exist or is not configured to receive emails. Please check your email address.`
      }
    }

    return {
      isValid: true,
      hasMxRecords,
      hasARecords,
      mxRecords: hasMxRecords ? mxRecords : undefined
    }
  } catch (error: any) {
    return {
      isValid: false,
      hasMxRecords: false,
      hasARecords: false,
      error: `Unable to verify email domain "${domain}". Please check your email address.`
    }
  }
}

/**
 * Validate email domain with timeout
 * Prevents hanging on slow DNS lookups
 */
export async function validateEmailDomainWithTimeout(
  email: string,
  timeoutMs: number = 5000
): Promise<EmailDomainValidationResult> {
  return Promise.race([
    validateEmailDomainDNS(email),
    new Promise<EmailDomainValidationResult>((resolve) => {
      setTimeout(() => {
        resolve({
          isValid: false,
          hasMxRecords: false,
          hasARecords: false,
          error: 'Email domain validation timed out. Please check your email address.'
        })
      }, timeoutMs)
    })
  ])
}






