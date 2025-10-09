import crypto from 'crypto'

export interface OTPConfig {
  length?: number
  expiresIn?: number // in minutes
  maxAttempts?: number
  type?: 'numeric' | 'alphanumeric'
}

export interface OTPData {
  code: string
  expiresAt: Date
  attempts: number
  maxAttempts: number
  used: boolean
  purpose: string
  userId?: string
}

export class OTPManager {
  private static instance: OTPManager
  private otpStore: Map<string, OTPData> = new Map()
  private readonly defaultConfig: Required<OTPConfig> = {
    length: 6,
    expiresIn: 10, // 10 minutes
    maxAttempts: 3,
    type: 'numeric'
  }

  private constructor() {}

  static getInstance(): OTPManager {
    if (!OTPManager.instance) {
      OTPManager.instance = new OTPManager()
    }
    return OTPManager.instance
  }

  /**
   * Generate a new OTP
   */
  generateOTP(userId: string, purpose: string, config?: OTPConfig): string {
    const finalConfig = { ...this.defaultConfig, ...config }
    
    // Generate OTP based on type
    let code: string
    if (finalConfig.type === 'alphanumeric') {
      code = this.generateAlphanumericOTP(finalConfig.length)
    } else {
      code = this.generateNumericOTP(finalConfig.length)
    }

    // Create OTP data
    const otpData: OTPData = {
      code,
      expiresAt: new Date(Date.now() + finalConfig.expiresIn * 60 * 1000),
      attempts: 0,
      maxAttempts: finalConfig.maxAttempts,
      used: false,
      purpose,
      userId
    }

    // Store OTP with unique key
    const key = this.generateKey(userId, purpose)
    this.otpStore.set(key, otpData)

    // Clean up expired OTPs
    this.cleanupExpiredOTPs()

    return code
  }

  /**
   * Validate an OTP
   */
  validateOTP(userId: string, purpose: string, code: string): {
    valid: boolean
    message: string
    remainingAttempts?: number
  } {
    const key = this.generateKey(userId, purpose)
    const otpData = this.otpStore.get(key)

    if (!otpData) {
      return {
        valid: false,
        message: 'OTP not found or expired'
      }
    }

    // Check if OTP is expired
    if (new Date() > otpData.expiresAt) {
      this.otpStore.delete(key)
      return {
        valid: false,
        message: 'OTP has expired'
      }
    }

    // Check if OTP is already used
    if (otpData.used) {
      return {
        valid: false,
        message: 'OTP has already been used'
      }
    }

    // Check if max attempts exceeded
    if (otpData.attempts >= otpData.maxAttempts) {
      this.otpStore.delete(key)
      return {
        valid: false,
        message: 'Maximum attempts exceeded. Please request a new OTP'
      }
    }

    // Increment attempts
    otpData.attempts++

    // Validate code
    if (otpData.code === code) {
      otpData.used = true
      this.otpStore.delete(key) // Remove after successful use
      return {
        valid: true,
        message: 'OTP validated successfully'
      }
    }

    const remainingAttempts = otpData.maxAttempts - otpData.attempts
    return {
      valid: false,
      message: `Invalid OTP. ${remainingAttempts} attempts remaining`,
      remainingAttempts
    }
  }

  /**
   * Resend OTP (generates new OTP for same user and purpose)
   */
  resendOTP(userId: string, purpose: string, config?: OTPConfig): string {
    const key = this.generateKey(userId, purpose)
    this.otpStore.delete(key) // Remove existing OTP
    return this.generateOTP(userId, purpose, config)
  }

  /**
   * Get OTP status
   */
  getOTPStatus(userId: string, purpose: string): {
    exists: boolean
    expiresAt?: Date
    attempts?: number
    maxAttempts?: number
    used?: boolean
  } {
    const key = this.generateKey(userId, purpose)
    const otpData = this.otpStore.get(key)

    if (!otpData) {
      return { exists: false }
    }

    return {
      exists: true,
      expiresAt: otpData.expiresAt,
      attempts: otpData.attempts,
      maxAttempts: otpData.maxAttempts,
      used: otpData.used
    }
  }

  /**
   * Revoke OTP
   */
  revokeOTP(userId: string, purpose: string): boolean {
    const key = this.generateKey(userId, purpose)
    return this.otpStore.delete(key)
  }

  /**
   * Generate numeric OTP
   */
  private generateNumericOTP(length: number): string {
    const min = Math.pow(10, length - 1)
    const max = Math.pow(10, length) - 1
    return Math.floor(Math.random() * (max - min + 1) + min).toString()
  }

  /**
   * Generate alphanumeric OTP
   */
  private generateAlphanumericOTP(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  /**
   * Generate unique key for OTP storage
   */
  private generateKey(userId: string, purpose: string): string {
    return `${userId}:${purpose}`
  }

  /**
   * Clean up expired OTPs
   */
  private cleanupExpiredOTPs(): void {
    const now = new Date()
    for (const [key, otpData] of this.otpStore.entries()) {
      if (now > otpData.expiresAt) {
        this.otpStore.delete(key)
      }
    }
  }

  /**
   * Get all active OTPs (for debugging/admin purposes)
   */
  getAllActiveOTPs(): Array<{ key: string; data: OTPData }> {
    this.cleanupExpiredOTPs()
    return Array.from(this.otpStore.entries()).map(([key, data]) => ({
      key,
      data
    }))
  }
}

// Export singleton instance
export const otpManager = OTPManager.getInstance()

// Utility functions for common OTP operations
export const OTPUtils = {
  /**
   * Generate OTP for email verification
   */
  generateEmailVerificationOTP: (email: string) => {
    return otpManager.generateOTP(email, 'email-verification', {
      length: 6,
      expiresIn: 15,
      maxAttempts: 3,
      type: 'numeric'
    })
  },

  /**
   * Generate OTP for password reset
   */
  generatePasswordResetOTP: (email: string) => {
    return otpManager.generateOTP(email, 'password-reset', {
      length: 6,
      expiresIn: 30,
      maxAttempts: 5,
      type: 'numeric'
    })
  },

  /**
   * Generate OTP for phone verification
   */
  generatePhoneVerificationOTP: (phone: string) => {
    return otpManager.generateOTP(phone, 'phone-verification', {
      length: 6,
      expiresIn: 10,
      maxAttempts: 3,
      type: 'numeric'
    })
  },

  /**
   * Generate OTP for transaction verification
   */
  generateTransactionOTP: (userId: string, transactionId: string) => {
    return otpManager.generateOTP(userId, `transaction-${transactionId}`, {
      length: 6,
      expiresIn: 5,
      maxAttempts: 2,
      type: 'numeric'
    })
  },

  /**
   * Generate OTP for admin access
   */
  generateAdminOTP: (userId: string) => {
    return otpManager.generateOTP(userId, 'admin-access', {
      length: 8,
      expiresIn: 5,
      maxAttempts: 1,
      type: 'alphanumeric'
    })
  }
} 
 
 
 
 