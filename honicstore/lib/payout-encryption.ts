/**
 * Encryption utility for sensitive payout account information
 * Similar to how PayPal encrypts bank account details
 * 
 * SECURITY: Sensitive payout account data (account numbers, bank names, mobile numbers, PayPal emails)
 * is encrypted at rest using AES-256-GCM encryption before storing in the database.
 * 
 * This ensures that even if the database is compromised, sensitive financial information
 * cannot be read without the encryption key.
 */

import crypto from 'crypto'

// Encryption key - should be stored in environment variable
// Generate a secure key: openssl rand -base64 32
const ENCRYPTION_KEY = process.env.PAYOUT_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || ''
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // For AES, this is always 16
const TAG_LENGTH = 16

/**
 * Get encryption key - must be 32 bytes (256 bits) for AES-256
 */
function getKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    // In production, throw error if key is missing
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PAYOUT_ENCRYPTION_KEY environment variable is required for production')
    }
    // For development, use a default key (not secure, but allows development)
    return crypto.createHash('sha256').update('dev-key-change-in-production').digest()
  }
  
  // Derive a 32-byte key from the environment variable
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
}

/**
 * Encrypt sensitive payout account data
 * @param text - Plain text to encrypt
 * @returns Encrypted string (base64 encoded)
 */
export function encryptPayoutData(text: string): string {
  if (!text || text.trim() === '') {
    return text
  }

  try {
    const key = getKey()
    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    
    const tag = cipher.getAuthTag()
    
    // Combine: iv + tag + encrypted data (all base64)
    const combined = Buffer.concat([
      iv,
      tag,
      Buffer.from(encrypted, 'base64')
    ])

    return combined.toString('base64')
  } catch (error) {
    throw new Error('Failed to encrypt payout data')
  }
}

/**
 * Decrypt sensitive payout account data
 * @param encryptedText - Encrypted string (base64 encoded)
 * @returns Decrypted plain text
 */
export function decryptPayoutData(encryptedText: string): string {
  if (!encryptedText || encryptedText.trim() === '') {
    return encryptedText
  }

  try {
    const key = getKey()
    const combined = Buffer.from(encryptedText, 'base64')
    
    // Extract components
    const iv = combined.slice(0, IV_LENGTH)
    const tag = combined.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = combined.slice(IV_LENGTH + TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, undefined, 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    // Return original if decryption fails (might be plain text for existing data)
    throw new Error('Failed to decrypt payout data')
  }
}

/**
 * Encrypt payout account object - encrypts all sensitive fields
 */
export function encryptPayoutAccount(account: {
  account_number?: string | null
  bank_name?: string | null
  mobile_number?: string | null
  paypal_email?: string | null
  [key: string]: any
}): {
  account_number?: string | null
  bank_name?: string | null
  mobile_number?: string | null
  paypal_email?: string | null
  [key: string]: any
} {
  const encrypted: any = { ...account }

  if (account.account_number) {
    encrypted.account_number = encryptPayoutData(account.account_number)
  }
  if (account.bank_name) {
    encrypted.bank_name = encryptPayoutData(account.bank_name)
  }
  if (account.mobile_number) {
    encrypted.mobile_number = encryptPayoutData(account.mobile_number)
  }
  if (account.paypal_email) {
    encrypted.paypal_email = encryptPayoutData(account.paypal_email)
  }

  return encrypted
}

/**
 * Check if a string appears to be encrypted (base64 format with specific structure)
 */
function isEncrypted(text: string): boolean {
  if (!text || text.length < 32) return false // Encrypted data is at least 32 chars
  try {
    // Encrypted data is base64 encoded and has specific minimum length
    Buffer.from(text, 'base64')
    return true
  } catch {
    return false
  }
}

/**
 * Decrypt payout account object - decrypts all sensitive fields
 * Gracefully handles both encrypted and unencrypted data (for migration)
 */
export function decryptPayoutAccount(account: {
  account_number?: string | null
  bank_name?: string | null
  mobile_number?: string | null
  paypal_email?: string | null
  [key: string]: any
}): {
  account_number?: string | null
  bank_name?: string | null
  mobile_number?: string | null
  paypal_email?: string | null
  [key: string]: any
} {
  const decrypted: any = { ...account }

  try {
    if (account.account_number) {
      // Only attempt decryption if it appears to be encrypted
      if (isEncrypted(account.account_number)) {
        decrypted.account_number = decryptPayoutData(account.account_number)
      }
      // Otherwise keep as-is (might be plain text for existing data)
    }
    if (account.bank_name) {
      if (isEncrypted(account.bank_name)) {
        decrypted.bank_name = decryptPayoutData(account.bank_name)
      }
    }
    if (account.mobile_number) {
      if (isEncrypted(account.mobile_number)) {
        decrypted.mobile_number = decryptPayoutData(account.mobile_number)
      }
    }
    if (account.paypal_email) {
      if (isEncrypted(account.paypal_email)) {
        decrypted.paypal_email = decryptPayoutData(account.paypal_email)
      }
    }
  } catch (error) {
    // If decryption fails, return original (might be plain text or corrupted)
    return account
  }

  return decrypted
}
