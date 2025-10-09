// Secure payment tokenization system for card payments
// This implements PCI-compliant tokenization to avoid storing sensitive card data

import crypto from 'crypto'

export interface PaymentToken {
  token: string
  last4: string
  brand: string
  expiryMonth: number
  expiryYear: number
  fingerprint: string
  createdAt: string
  expiresAt: string
}

export interface CardDetails {
  number: string
  expiryMonth: number
  expiryYear: number
  cvv: string
  holderName: string
}

export interface TokenizedCard {
  token: string
  last4: string
  brand: string
  expiryMonth: number
  expiryYear: number
  holderName: string
}

// Payment token storage (in production, use a secure tokenization service like Stripe, Square, etc.)
class PaymentTokenStore {
  private tokens: Map<string, PaymentToken> = new Map()
  private readonly TOKEN_EXPIRY_HOURS = 24 // Tokens expire after 24 hours

  generateToken(cardDetails: CardDetails): PaymentToken {
    // Create a secure token
    const tokenId = crypto.randomUUID()
    const fingerprint = this.generateFingerprint(cardDetails)
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

    const token: PaymentToken = {
      token: tokenId,
      last4: cardDetails.number.slice(-4),
      brand: this.detectCardBrand(cardDetails.number),
      expiryMonth: cardDetails.expiryMonth,
      expiryYear: cardDetails.expiryYear,
      fingerprint,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    }

    this.tokens.set(tokenId, token)
    return token
  }

  getToken(tokenId: string): PaymentToken | null {
    const token = this.tokens.get(tokenId)
    
    if (!token) {
      return null
    }

    // Check if token is expired
    if (new Date(token.expiresAt) < new Date()) {
      this.tokens.delete(tokenId)
      return null
    }

    return token
  }

  deleteToken(tokenId: string): boolean {
    return this.tokens.delete(tokenId)
  }

  private generateFingerprint(cardDetails: CardDetails): string {
    // Create a fingerprint based on card details (excluding CVV)
    const fingerprintData = `${cardDetails.number.slice(0, 6)}${cardDetails.number.slice(-4)}${cardDetails.expiryMonth}${cardDetails.expiryYear}${cardDetails.holderName.toLowerCase()}`
    return crypto.createHash('sha256').update(fingerprintData).digest('hex')
  }

  private detectCardBrand(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\s/g, '')
    
    if (/^4/.test(cleaned)) return 'visa'
    if (/^5[1-5]/.test(cleaned) || /^2[2-7][2-9][0-9]/.test(cleaned)) return 'mastercard'
    if (/^3[47]/.test(cleaned)) return 'amex'
    if (/^6(?:011|5|4[4-9]|22(?:1(?:2[6-9]|[3-9]\d)|[2-8]\d\d|9(?:[01]\d|2[0-5])))/.test(cleaned)) return 'discover'
    if (/^(?:2131|1800|35)/.test(cleaned)) return 'jcb'
    if (/^3(?:0[0-5]|[68]|9)/.test(cleaned)) return 'diners'
    if (/^62/.test(cleaned)) return 'unionpay'
    
    return 'unknown'
  }

  // Clean up expired tokens periodically
  cleanupExpiredTokens(): void {
    const now = new Date()
    for (const [tokenId, token] of this.tokens.entries()) {
      if (new Date(token.expiresAt) < now) {
        this.tokens.delete(tokenId)
      }
    }
  }
}

// Singleton instance
const tokenStore = new PaymentTokenStore()

// Clean up expired tokens every hour
setInterval(() => {
  tokenStore.cleanupExpiredTokens()
}, 60 * 60 * 1000)

// Tokenize card details
export function tokenizeCard(cardDetails: CardDetails): PaymentToken {
  // Validate card details before tokenization
  if (!validateCardDetails(cardDetails)) {
    throw new Error('Invalid card details')
  }

  return tokenStore.generateToken(cardDetails)
}

// Retrieve tokenized card (without sensitive data)
export function getTokenizedCard(tokenId: string): TokenizedCard | null {
  const token = tokenStore.getToken(tokenId)
  
  if (!token) {
    return null
  }

  return {
    token: token.token,
    last4: token.last4,
    brand: token.brand,
    expiryMonth: token.expiryMonth,
    expiryYear: token.expiryYear,
    holderName: '' // Don't return holder name for security
  }
}

// Validate card details
export function validateCardDetails(cardDetails: CardDetails): boolean {
  // Validate card number using Luhn algorithm
  if (!validateCardNumber(cardDetails.number)) {
    return false
  }

  // Validate expiry date
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1

  if (cardDetails.expiryYear < currentYear) {
    return false
  }

  if (cardDetails.expiryYear === currentYear && cardDetails.expiryMonth < currentMonth) {
    return false
  }

  // Validate CVV
  if (!/^\d{3,4}$/.test(cardDetails.cvv)) {
    return false
  }

  // Validate holder name
  if (!cardDetails.holderName || cardDetails.holderName.trim().length < 2) {
    return false
  }

  return true
}

// Validate card number using Luhn algorithm
function validateCardNumber(cardNumber: string): boolean {
  const cleaned = cardNumber.replace(/\s/g, '')
  if (!/^\d{13,19}$/.test(cleaned)) return false
  
  let sum = 0
  let isEven = false
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i))
    
    if (isEven) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    
    sum += digit
    isEven = !isEven
  }
  
  return sum % 10 === 0
}

// Process payment with token (this would integrate with a real payment processor)
export async function processPaymentWithToken(
  tokenId: string,
  amount: number,
  currency: string = 'TZS',
  orderId: string
): Promise<{
  success: boolean
  transactionId?: string
  error?: string
}> {
  try {
    const token = tokenStore.getToken(tokenId)
    
    if (!token) {
      return {
        success: false,
        error: 'Invalid or expired payment token'
      }
    }

    // In a real implementation, this would call a payment processor API
    // For now, we'll simulate a payment processing
    const transactionId = `txn_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Simulate 95% success rate
    const isSuccessful = Math.random() > 0.05
    
    if (isSuccessful) {
      // Delete token after successful use (one-time use)
      tokenStore.deleteToken(tokenId)
      
      return {
        success: true,
        transactionId
      }
    } else {
      return {
        success: false,
        error: 'Payment was declined by the bank'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment processing failed'
    }
  }
}

// Delete payment token
export function deletePaymentToken(tokenId: string): boolean {
  return tokenStore.deleteToken(tokenId)
}

// Get token statistics (for monitoring)
export function getTokenStats(): {
  activeTokens: number
  totalTokens: number
} {
  return {
    activeTokens: tokenStore['tokens'].size,
    totalTokens: tokenStore['tokens'].size
  }
}







