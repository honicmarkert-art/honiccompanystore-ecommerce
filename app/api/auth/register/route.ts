import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateToken, hashPassword, validatePassword } from '@/lib/auth'
import { findUserByEmail, createUser, validateUserData } from '@/lib/users'

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

    // Check if user already exists
    const existingUser = findUserByEmail(validatedData.email)
    if (existingUser) {
      return NextResponse.json(
        { 
          success: false,
          error: 'An account with this email address already exists. Please use a different email or try logging in.',
          type: 'USER_ALREADY_EXISTS'
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
 
 
 
 



