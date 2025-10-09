import { NextRequest, NextResponse } from 'next/server'
import { otpManager, OTPUtils } from '@/lib/otp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, purpose, type, email, phone, transactionId } = body

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
        otp = OTPUtils.generateEmailVerificationOTP(email)
        break

      case 'password-reset':
        if (!email) {
          return NextResponse.json(
            { error: 'email is required for password reset' },
            { status: 400 }
          )
        }
        otp = OTPUtils.generatePasswordResetOTP(email)
        break

      case 'phone-verification':
        if (!phone) {
          return NextResponse.json(
            { error: 'phone is required for phone verification' },
            { status: 400 }
          )
        }
        otp = OTPUtils.generatePhoneVerificationOTP(phone)
        break

      case 'transaction-verification':
        if (!transactionId) {
          return NextResponse.json(
            { error: 'transactionId is required for transaction verification' },
            { status: 400 }
          )
        }
        otp = OTPUtils.generateTransactionOTP(userId, transactionId)
        break

      case 'admin-access':
        otp = OTPUtils.generateAdminOTP(userId)
        break

      default:
        // Custom OTP with type specification
        const config = {
          length: type === 'alphanumeric' ? 8 : 6,
          expiresIn: 10,
          maxAttempts: 3,
          type: type || 'numeric'
        }
        otp = otpManager.generateOTP(userId, purpose, config)
    }

    // Get OTP status for response
    const status = otpManager.getOTPStatus(userId, purpose)

    return NextResponse.json({
      success: true,
      message: 'OTP generated successfully',
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
    console.error('Error generating OTP:', error)
    return NextResponse.json(
      { error: 'Failed to generate OTP' },
      { status: 500 }
    )
  }
} 
 
 
 
 