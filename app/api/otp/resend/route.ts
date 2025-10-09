import { NextRequest, NextResponse } from 'next/server'
import { otpManager, OTPUtils } from '@/lib/otp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, purpose, email, phone, transactionId } = body

    if (!userId || !purpose) {
      return NextResponse.json(
        { error: 'userId and purpose are required' },
        { status: 400 }
      )
    }

    let otp: string

    // Use utility functions for common purposes
    switch (purpose) {
      case 'email-verification':
        if (!email) {
          return NextResponse.json(
            { error: 'email is required for email verification' },
            { status: 400 }
          )
        }
        otp = otpManager.resendOTP(email, purpose, {
          length: 6,
          expiresIn: 15,
          maxAttempts: 3,
          type: 'numeric'
        })
        break

      case 'password-reset':
        if (!email) {
          return NextResponse.json(
            { error: 'email is required for password reset' },
            { status: 400 }
          )
        }
        otp = otpManager.resendOTP(email, purpose, {
          length: 6,
          expiresIn: 30,
          maxAttempts: 5,
          type: 'numeric'
        })
        break

      case 'phone-verification':
        if (!phone) {
          return NextResponse.json(
            { error: 'phone is required for phone verification' },
            { status: 400 }
          )
        }
        otp = otpManager.resendOTP(phone, purpose, {
          length: 6,
          expiresIn: 10,
          maxAttempts: 3,
          type: 'numeric'
        })
        break

      case 'transaction-verification':
        if (!transactionId) {
          return NextResponse.json(
            { error: 'transactionId is required for transaction verification' },
            { status: 400 }
          )
        }
        otp = otpManager.resendOTP(userId, `transaction-${transactionId}`, {
          length: 6,
          expiresIn: 5,
          maxAttempts: 2,
          type: 'numeric'
        })
        break

      case 'admin-access':
        otp = otpManager.resendOTP(userId, purpose, {
          length: 8,
          expiresIn: 5,
          maxAttempts: 1,
          type: 'alphanumeric'
        })
        break

      default:
        // Resend custom OTP
        otp = otpManager.resendOTP(userId, purpose)
    }

    // Get OTP status for response
    const status = otpManager.getOTPStatus(userId, purpose)

    return NextResponse.json({
      success: true,
      message: 'OTP resent successfully',
      data: {
        purpose,
        expiresAt: status.expiresAt,
        maxAttempts: status.maxAttempts,
        // Note: In production, you would send the OTP via email/SMS
        // For development, we're returning it in the response
        otp: process.env.NODE_ENV === 'development' ? otp : undefined
      }
    })

  } catch (error) {
    console.error('Error resending OTP:', error)
    return NextResponse.json(
      { error: 'Failed to resend OTP' },
      { status: 500 }
    )
  }
} 
 
 
 
 