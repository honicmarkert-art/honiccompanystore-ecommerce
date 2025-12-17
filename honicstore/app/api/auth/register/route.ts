import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateToken, hashPassword, validatePassword } from '@/lib/auth'
import { findUserByEmail, createUser, validateUserData } from '@/lib/users'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
// Validation schema
const registerSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters long')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  email: z.string()
    .email('Please enter a valid email address')
    .min(5, 'Email must be at least 5 characters')
    .max(100, 'Email must be less than 100 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must be less than 128 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match. Please make sure both passwords are identical.",
  path: ["confirmPassword"]
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = registerSchema.parse(body)
    
    // Additional password validation
    const passwordValidation = validatePassword(validatedData.password)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Password does not meet security requirements.',
          type: 'PASSWORD_VALIDATION_ERROR',
          details: passwordValidation.errors
        },
        { status: 400 }
      )
    }

    // CRITICAL SECURITY: Check if email already exists using multiple methods
    // Method 1: Profiles table (primary - most reliable)
    // Method 2: Auth users list (fallback if profiles check fails)
    // Method 3: Local user store (legacy)
    const email = validatedData.email.toLowerCase().trim()
    let emailExists = false
    
    try {
      const adminSupabase = createAdminSupabaseClient()
      console.log('🔍 [Register API] Checking if email exists (Method 1 - Profiles table):', email)
      
      // Method 1: Check profiles table (primary method - most reliable)
      const { data: profile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('id, email, created_at')
        .eq('email', email)
        .limit(1)
        .maybeSingle()
      
      console.log('🔍 [Register API] Profiles table check result:', {
        hasError: !!profileError,
        errorMessage: profileError?.message,
        hasProfile: !!profile,
        profileId: profile?.id,
        createdAt: profile?.created_at
      })
      
      // If profile exists, email is already registered
      if (!profileError && profile) {
        emailExists = true
        logger.log('🚨 [Register API] Registration blocked - email already exists in profiles:', { 
          email, 
          profileId: profile.id,
          createdAt: profile.created_at 
        })
        console.error('🚨 [Register API] BLOCKING REGISTRATION - Email already exists in profiles:', email)
        return NextResponse.json(
          {
            success: false,
            error: 'An account with this email address already exists. Please use a different email or try logging in.',
            type: 'EMAIL_ALREADY_EXISTS'
          },
          { status: 409 }
        )
      }
      
      // Method 2: Try to check auth users using listUsers (fallback)
      if (profileError && profileError.code !== 'PGRST116') {
        // PGRST116 is "not found" which is expected, other errors might indicate issues
        console.log('🔍 [Register API] Checking Auth users (Method 2 - fallback):', email)
        try {
          // List users and filter by email
          const { data: authUsers, error: listError } = await adminSupabase.auth.admin.listUsers()
          
          if (!listError && authUsers?.users) {
            const existingAuthUser = authUsers.users.find(u => u.email?.toLowerCase() === email)
            if (existingAuthUser) {
              emailExists = true
              logger.log('🚨 [Register API] Registration blocked - email already exists in Auth:', { 
                email, 
                userId: existingAuthUser.id,
                createdAt: existingAuthUser.created_at 
              })
              console.error('🚨 [Register API] BLOCKING REGISTRATION - Email already exists in Auth:', email)
              return NextResponse.json(
                {
                  success: false,
                  error: 'An account with this email address already exists. Please use a different email or try logging in.',
                  type: 'EMAIL_ALREADY_EXISTS'
                },
                { status: 409 }
              )
            }
          }
        } catch (authCheckError: any) {
          logger.warn('⚠️ [Register API] Auth users check failed (proceeding - local check as fallback):', {
            error: authCheckError?.message || authCheckError
          })
          console.warn('⚠️ [Register API] Auth users check error:', authCheckError)
        }
      } else {
        // Profile not found - email is available
        logger.log('✅ [Register API] Email available for registration:', email)
        console.log('✅ [Register API] Email is available - proceeding with registration')
      }
    } catch (checkError: any) {
      // If all checks fail, log but continue - local check will catch as fallback
      logger.error('⚠️ [Register API] Error during email pre-check (proceeding - local check as fallback):', {
        error: checkError?.message || checkError,
        email: email
      })
      console.error('⚠️ [Register API] Exception during email pre-check:', checkError)
    }
    
    // Method 3: Legacy local user store check (fallback)
    const existingLocalUser = findUserByEmail(email)
    if (existingLocalUser) {
      console.error('🚨 [Register API] BLOCKING REGISTRATION - Email exists in local store:', email)
      return NextResponse.json(
        { 
          success: false,
          error: 'An account with this email address already exists. Please use a different email or try logging in.',
          type: 'EMAIL_ALREADY_EXISTS'
        },
        { status: 409 }
      )
    }
    
    // If we determined email exists, don't proceed
    if (emailExists) {
      console.error('🚨 [Register API] Email exists check failed - blocking registration')
      return NextResponse.json(
        {
          success: false,
          error: 'An account with this email address already exists. Please use a different email or try logging in.',
          type: 'EMAIL_ALREADY_EXISTS'
        },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = hashPassword(validatedData.password)
    
    // Create user
    const newUser = createUser({
      email: validatedData.email.toLowerCase(),
      password: hashedPassword,
      name: validatedData.name.trim(),
      role: 'user',
      isVerified: true, // Set to true for demo purposes
      isActive: true,
      profile: {
        avatar: '/placeholder-user.jpg',
        bio: `Welcome ${validatedData.name}!`
      }
    })

    // Generate verification token (for future email verification)
    const verificationToken = generateToken({
      userId: newUser.id,
      email: newUser.email,
      type: 'email_verification',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    })

    // In a real application, send verification email here
    // await sendVerificationEmail(newUser.email, verificationToken)

    return NextResponse.json({
      success: true,
      message: 'Account created successfully! You can now log in.',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        isVerified: newUser.isVerified,
        profile: newUser.profile
      }
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return NextResponse.json(
        { 
          success: false,
          error: firstError.message,
          type: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      )
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'An unexpected error occurred while creating your account. Please try again.',
        type: 'SERVER_ERROR'
      },
      { status: 500 }
    )
  }
} 
 
 
 
 



