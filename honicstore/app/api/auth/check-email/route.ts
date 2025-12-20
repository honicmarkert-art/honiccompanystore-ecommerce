import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// Email validation schema
const emailCheckSchema = z.object({
  email: z.string().email('Please enter a valid email address').max(255, 'Email address is too long').toLowerCase().trim()
})

// GET /api/auth/check-email?email=... - Check if email already exists
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { 
          exists: false,
          error: 'Email parameter is required'
        },
        { status: 400 }
      )
    }

    // Validate email format
    let validatedEmail
    try {
      validatedEmail = emailCheckSchema.parse({ email }).email
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            exists: false,
            error: error.errors[0]?.message || 'Invalid email address'
          },
          { status: 400 }
        )
      }
      throw error
    }

    const adminSupabase = createAdminSupabaseClient()

    // Method 1: Check profiles table (primary method)
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, email, created_at')
      .eq('email', validatedEmail)
      .limit(1)
      .maybeSingle()

    if (!profileError && profile) {
      logger.log('🔍 Email found in profiles table:', { email: validatedEmail, profileId: profile.id })
      return NextResponse.json({
        exists: true,
        message: 'An account with this email address already exists. Please use a different email or try logging in.',
        accountId: profile.id,
        createdAt: profile.created_at
      })
    }

    // Method 2: ALWAYS check auth users (critical - email might exist in auth but not in profiles yet)
    try {
      // Use listUsers (getUserByEmail doesn't exist in Supabase admin API)
      const { data: authUsers, error: listError } = await adminSupabase.auth.admin.listUsers()
      
      if (!listError && authUsers?.users) {
        const existingAuthUser = authUsers.users.find(u => u.email?.toLowerCase() === validatedEmail.toLowerCase())
        if (existingAuthUser) {
          logger.log('🔍 Email found in auth.users (via listUsers):', { email: validatedEmail, userId: existingAuthUser.id })
          return NextResponse.json({
            exists: true,
            message: 'An account with this email address already exists. Please use a different email or try logging in.',
            accountId: existingAuthUser.id,
            createdAt: existingAuthUser.created_at
          })
        }
      }
    } catch (authError: any) {
      // If listUsers fails, log but continue (email check will return false)
      logger.warn('⚠️ Error checking auth users with listUsers:', authError)
    }

    // Email not found in either profiles or auth.users
    logger.log('✅ Email available for registration:', validatedEmail)
    return NextResponse.json({
      exists: false,
      message: 'This email address is available'
    })

  } catch (error: any) {
    logger.error('Error checking email existence:', error)
    return NextResponse.json(
      { 
        exists: false,
        error: 'Failed to check email. Please try again.'
      },
      { status: 500 }
    )
  }
}

