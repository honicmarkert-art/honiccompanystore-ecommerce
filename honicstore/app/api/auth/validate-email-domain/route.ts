import { NextRequest, NextResponse } from 'next/server'
import { validateEmailDomainWithTimeout } from '@/lib/email-domain-validator'
import { validateEmailFormat } from '@/lib/email-validation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * API endpoint for client-side email domain validation
 * Validates email format and checks DNS/SMTP records
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        {
          isValid: false,
          error: 'Email is required'
        },
        { status: 400 }
      )
    }

    // Step 1: Basic format validation
    const formatValidation = validateEmailFormat(email.trim())
    if (!formatValidation.isValid) {
      return NextResponse.json({
        isValid: false,
        error: formatValidation.error || 'Invalid email format',
        hasMxRecords: false,
        hasARecords: false
      })
    }

    // Step 2: DNS/SMTP validation (with timeout)
    try {
      const domainValidation = await validateEmailDomainWithTimeout(email.trim(), 3000)
      
      return NextResponse.json({
        isValid: domainValidation.isValid,
        error: domainValidation.error,
        hasMxRecords: domainValidation.hasMxRecords,
        hasARecords: domainValidation.hasARecords
      })
    } catch (error: any) {
      // If DNS check fails, return format validation result
      return NextResponse.json({
        isValid: formatValidation.isValid,
        error: formatValidation.error || 'Unable to verify email domain',
        hasMxRecords: false,
        hasARecords: false
      })
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        isValid: false,
        error: 'Invalid request',
        hasMxRecords: false,
        hasARecords: false
      },
      { status: 400 }
    )
  }
}




