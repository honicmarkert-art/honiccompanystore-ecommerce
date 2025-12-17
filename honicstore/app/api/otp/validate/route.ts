import { NextRequest, NextResponse } from 'next/server'
import { otpManager } from '@/lib/otp'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, purpose, code } = body

    if (!userId || !purpose || !code) {
      return NextResponse.json(
        { error: 'userId, purpose, and code are required' },
        { status: 400 }
      )
    }

    // Validate the OTP
    const result = otpManager.validateOTP(userId, purpose, code)

    if (result.valid) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          purpose,
          validated: true,
          timestamp: new Date().toISOString()
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        message: result.message,
        data: {
          purpose,
          validated: false,
          remainingAttempts: result.remainingAttempts
        }
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error validating OTP:', error)
    return NextResponse.json(
      { error: 'Failed to validate OTP' },
      { status: 500 }
    )
  }
} 
 
 
 
 
