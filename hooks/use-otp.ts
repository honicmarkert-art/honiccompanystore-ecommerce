"use client"

import { useState, useCallback, useEffect } from 'react'

interface OTPConfig {
  length?: number
  expiresIn?: number
  maxAttempts?: number
  type?: 'numeric' | 'alphanumeric'
}

interface OTPResponse {
  success: boolean
  message: string
  data?: {
    purpose: string
    expiresAt?: Date
    maxAttempts?: number
    otp?: string
    validated?: boolean
    remainingAttempts?: number
  }
}

interface UseOTPReturn {
  // State
  isLoading: boolean
  error: string | null
  otpCode: string
  countdown: number | null
  attempts: number
  
  // Actions
  generateOTP: (userId: string, purpose: string, config?: OTPConfig) => Promise<void>
  validateOTP: (userId: string, purpose: string, code: string) => Promise<boolean>
  resendOTP: (userId: string, purpose: string) => Promise<void>
  clearOTP: () => void
  setOTPCode: (code: string) => void
}

export function useOTP(): UseOTPReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [otpCode, setOTPCode] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)

  // Countdown timer effect
  useEffect(() => {
    if (!expiresAt || countdown === null) return

    const timer = setInterval(() => {
      const now = new Date().getTime()
      const expiry = new Date(expiresAt).getTime()
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000))

      if (remaining <= 0) {
        setCountdown(null)
        setExpiresAt(null)
      } else {
        setCountdown(remaining)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [expiresAt, countdown])

  const generateOTP = useCallback(async (
    userId: string, 
    purpose: string, 
    config?: OTPConfig
  ) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/otp/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          purpose,
          ...config
        }),
      })

      const data: OTPResponse = await response.json()

      if (data.success && data.data) {
        setExpiresAt(data.data.expiresAt ? new Date(data.data.expiresAt) : null)
        if (data.data.otp) {
          setOTPCode(data.data.otp)
        }
        setAttempts(0)
        
        // Start countdown if expiresAt is available
        if (data.data.expiresAt) {
          const now = new Date().getTime()
          const expiry = new Date(data.data.expiresAt).getTime()
          const remaining = Math.max(0, Math.floor((expiry - now) / 1000))
          setCountdown(remaining)
        }
      } else {
        setError(data.message || 'Failed to generate OTP')
      }
    } catch (err) {
      setError('Network error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const validateOTP = useCallback(async (
    userId: string, 
    purpose: string, 
    code: string
  ): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/otp/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          purpose,
          code,
        }),
      })

      const data: OTPResponse = await response.json()

      if (data.success) {
        setOTPCode('')
        setCountdown(null)
        setExpiresAt(null)
        return true
      } else {
        setError(data.message || 'Invalid OTP')
        if (data.data?.remainingAttempts !== undefined) {
          setAttempts(data.data.maxAttempts! - data.data.remainingAttempts)
        }
        return false
      }
    } catch (err) {
      setError('Network error occurred')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const resendOTP = useCallback(async (userId: string, purpose: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/otp/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          purpose,
        }),
      })

      const data: OTPResponse = await response.json()

      if (data.success && data.data) {
        setExpiresAt(data.data.expiresAt ? new Date(data.data.expiresAt) : null)
        if (data.data.otp) {
          setOTPCode(data.data.otp)
        }
        setAttempts(0)
        
        // Start countdown if expiresAt is available
        if (data.data.expiresAt) {
          const now = new Date().getTime()
          const expiry = new Date(data.data.expiresAt).getTime()
          const remaining = Math.max(0, Math.floor((expiry - now) / 1000))
          setCountdown(remaining)
        }
      } else {
        setError(data.message || 'Failed to resend OTP')
      }
    } catch (err) {
      setError('Network error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearOTP = useCallback(() => {
    setOTPCode('')
    setError(null)
    setCountdown(null)
    setExpiresAt(null)
    setAttempts(0)
  }, [])

  return {
    isLoading,
    error,
    otpCode,
    countdown,
    attempts,
    generateOTP,
    validateOTP,
    resendOTP,
    clearOTP,
    setOTPCode,
  }
} 
 
 
 
 