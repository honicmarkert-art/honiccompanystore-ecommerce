import { NextRequest, NextResponse } from 'next/server'
import { supabaseAuth } from '@/lib/supabase-auth'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { notifyAllAdmins } from '@/lib/notification-helpers'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { validateEmailDomain, EMAIL_DOMAIN_TYPOS } from '@/lib/email-validation'
import { validateEmailDomainWithTimeout } from '@/lib/email-domain-validator'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Email validation utilities imported from shared module

// Registration input validation schema
const registerRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long').trim(),
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email is too long')
    .toLowerCase()
    .trim()
    .refine((email) => {
      const domainValidation = validateEmailDomain(email)
      return domainValidation.isValid
    }, (email) => {
      const domainValidation = validateEmailDomain(email)
      return {
        message: domainValidation.error || 'Invalid email domain',
        path: ['email']
      }
    }),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
  phone: z.string().max(20, 'Phone number is too long').optional(),
  isSupplier: z.boolean().optional(),
  planId: z.string().uuid().optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

export async function POST(request: NextRequest) {
  try {
    // Enhanced rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/auth/supabase-register',
        reason: rateLimitResult.reason
      }, request)
      
      return NextResponse.json(
        { 
          success: false,
          error: rateLimitResult.reason || 'Too many requests. Please try again later.',
          type: 'RATE_LIMIT_ERROR'
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
          }
        }
      )
    }

    // Handle empty or incomplete request body (timeout protection)
    let body
    try {
      const bodyText = await request.text()
      if (!bodyText || bodyText.trim() === '') {
        return NextResponse.json(
          { 
            success: false,
            error: 'Request body is empty. Please try again.',
            type: 'EMPTY_REQUEST_ERROR'
          },
          { status: 400 }
        )
      }
      body = JSON.parse(bodyText)
    } catch (parseError: any) {
      // Handle JSON parse errors (including timeout/incomplete data)
      if (parseError instanceof SyntaxError || parseError.message?.includes('JSON')) {
        logger.error('JSON parse error in registration:', {
          error: parseError.message,
          errorType: parseError.name,
          possibleCause: 'Request timeout or incomplete data'
        })
        return NextResponse.json(
          { 
            success: false,
            error: 'Invalid request data. Please check your connection and try again.',
            type: 'PARSE_ERROR',
            details: process.env.NODE_ENV === 'development' ? parseError.message : undefined
          },
          { status: 400 }
        )
      }
      throw parseError
    }
    
    // Pre-validate email domain before full schema validation (catch typos early)
    if (body.email) {
      const emailValidation = validateEmailDomain(String(body.email).toLowerCase().trim())
      if (!emailValidation.isValid) {
        logger.log('🚨 Email domain validation failed:', {
          email: body.email,
          error: emailValidation.error,
          suggestion: emailValidation.suggestion
        })
        return NextResponse.json(
          { 
            success: false,
            error: emailValidation.error || 'Invalid email domain',
            suggestion: emailValidation.suggestion,
            type: 'EMAIL_DOMAIN_ERROR'
          },
          { status: 400 }
        )
      }
    }

    // Validate and sanitize input
    let validatedData
    try {
      validatedData = registerRequestSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Check if it's an email domain error and provide suggestion
        const emailError = error.errors.find(e => e.path.includes('email'))
        if (emailError && body.email) {
          const domainValidation = validateEmailDomain(String(body.email).toLowerCase().trim())
          return NextResponse.json(
            { 
              success: false,
              error: emailError.message || 'Invalid email address',
              suggestion: domainValidation.suggestion,
              type: 'VALIDATION_ERROR',
              details: process.env.NODE_ENV === 'development' ? error.errors : undefined
            },
            { status: 400 }
          )
        }
        
        return NextResponse.json(
          { 
            success: false,
            error: error.errors[0]?.message || 'Invalid input data',
            type: 'VALIDATION_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.errors : undefined
          },
          { status: 400 }
        )
      }
      throw error
    }

    const { name, email, password, confirmPassword, phone, isSupplier, planId } = validatedData

    logger.log('Registration request:', { email, isSupplier: !!isSupplier, hasPlanId: !!planId })

    // Additional SMTP/DNS validation - verify domain actually exists and can receive emails
    try {
      logger.log('🔍 Validating email domain DNS/SMTP records for:', email)
      const domainValidation = await validateEmailDomainWithTimeout(email, 5000)
      
      if (!domainValidation.isValid) {
        logger.log('❌ Email domain validation failed:', {
          email,
          error: domainValidation.error,
          hasMxRecords: domainValidation.hasMxRecords,
          hasARecords: domainValidation.hasARecords
        })
        
        return NextResponse.json(
          {
            success: false,
            error: domainValidation.error || 'Email domain validation failed. Please check your email address.',
            type: 'EMAIL_DOMAIN_VALIDATION_ERROR'
          },
          { status: 400 }
        )
      }
      
      logger.log('✅ Email domain validation passed:', {
        email,
        hasMxRecords: domainValidation.hasMxRecords,
        hasARecords: domainValidation.hasARecords,
        mxRecords: domainValidation.mxRecords?.slice(0, 3) // Log first 3 MX records
      })
    } catch (domainError: any) {
      // Log error but don't block registration if DNS check fails (could be network issue)
      logger.log('⚠️ Email domain validation error (non-blocking):', {
        email,
        error: domainError?.message || domainError
      })
      // Continue with registration - DNS check failure shouldn't block legitimate users
    }

    // CRITICAL SECURITY: Check if email already exists using multiple methods
    // Method 1: Profiles table (primary - most reliable)
    // Method 2: Auth users list (fallback if profiles check fails)
    let emailExists = false
    try {
      const adminSupabase = createAdminSupabaseClient()
      console.log('🔍 Checking if email exists (Method 1 - Profiles table):', email)
      
      // Method 1: Check profiles table (primary method - most reliable)
      const { data: profile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('id, email, created_at')
        .eq('email', email.toLowerCase())
        .limit(1)
        .maybeSingle()
      
      console.log('🔍 Profiles table check result:', {
        hasError: !!profileError,
        errorMessage: profileError?.message,
        hasProfile: !!profile,
        profileId: profile?.id,
        createdAt: profile?.created_at
      })
      
      // If profile exists, email is already registered
      if (!profileError && profile) {
        emailExists = true
        logger.log('🚨 Registration blocked - email already exists in profiles:', { 
          email, 
          profileId: profile.id,
          createdAt: profile.created_at 
        })
        console.error('🚨 BLOCKING REGISTRATION - Email already exists in profiles:', email)
        return NextResponse.json(
          {
            success: false,
            error: 'An account with this email address already exists. Please use a different email or try logging in.',
            type: 'EMAIL_ALREADY_EXISTS'
          },
          { status: 409 }
        )
      }
      
      // Method 2: Skip listUsers() check to prevent timeout
      // NOTE: listUsers() fetches ALL users and can be VERY slow (causes timeout with many users)
      // Supabase signUp() will catch duplicate emails as the final security layer
      // This is safe because Supabase Auth enforces unique emails at the database level
      console.log('🔍 Skipping listUsers() check (prevents timeout) - Supabase signUp will validate email uniqueness')
      logger.log('⚠️ Skipping listUsers() check to prevent timeout - Supabase signUp will validate email uniqueness')
      
      // Email not found in profiles or auth - available for registration
      if (!emailExists) {
        logger.log('✅ Email available for registration:', email)
        console.log('✅ Email is available - proceeding with registration')
      }
    } catch (checkError: any) {
      // If all checks fail, log but continue
      // Supabase signUp will catch duplicates as final security layer
      logger.error('⚠️ Error during email pre-check (proceeding - Supabase will validate):', {
        error: checkError?.message || checkError,
        email: email
      })
      console.error('⚠️ Exception during email pre-check:', checkError)
    }
    
    // If we determined email exists, don't proceed
    if (emailExists) {
      console.error('🚨 Email exists check failed - blocking registration')
      return NextResponse.json(
        {
          success: false,
          error: 'An account with this email address already exists. Please use a different email or try logging in.',
          type: 'EMAIL_ALREADY_EXISTS'
        },
        { status: 409 }
      )
    }

    const result = await supabaseAuth.signUp(name, email, password, confirmPassword, phone, isSupplier)
    
    console.log('📝 signUp result:', {
      success: result.success,
      hasError: !!result.error,
      error: result.error,
      errorType: result.type,
      hasUser: !!(result.data as any)?.user,
      userId: (result.data as any)?.user?.id
    })

    // CRITICAL: Double-check after signUp - verify user was actually created
    if (result.success && (result.data as any)?.user) {
      try {
        const adminSupabase = createAdminSupabaseClient()
        const createdUserId = (result.data as any).user.id
        const { data: verifyUser, error: verifyError } = await adminSupabase.auth.admin.getUserById(createdUserId)
        
        if (!verifyError && verifyUser?.user) {
          const userCreatedAt = verifyUser.user.created_at ? new Date(verifyUser.user.created_at) : null
          const now = new Date()
          const secondsSinceCreation = userCreatedAt ? (now.getTime() - userCreatedAt.getTime()) / 1000 : null
          
          console.log('🔍 Post-signUp verification:', {
            userId: verifyUser.user.id,
            email: verifyUser.user.email,
            createdAt: userCreatedAt,
            secondsSinceCreation: secondsSinceCreation
          })
          
          // If user was created more than 10 seconds ago, this is an existing user
          if (secondsSinceCreation !== null && secondsSinceCreation > 10) {
            console.error('🚨 SECURITY ALERT: User already existed - registration blocked!', {
              email,
              userId: verifyUser.user.id,
              secondsSinceCreation: secondsSinceCreation.toFixed(2)
            })
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
      } catch (verifyErr) {
        console.error('⚠️ Error during post-signUp verification:', verifyErr)
        // Continue - this is just a safety check
      }
    }

    if (result.success) {
      // If Supabase returned a session (even if email not verified), include it for auto-login
      const hasSession = !!(result.data?.session)
      const userData = result.data?.user
      
      const response = NextResponse.json({
        success: true,
        message: result.message || 'Account created successfully!',
        data: result.data,
        // Include session if available (for auto-login)
        session: result.data?.session,
        // Include user data with verification status
        user: userData ? {
          id: userData.id,
          email: userData.email,
          email_confirmed_at: userData.email_confirmed_at,
          isVerified: !!userData.email_confirmed_at
        } : null
      }, { status: 201 })

      // If session exists, set cookies for auto-login
      const session = result.data?.session || result.session
      if (session) {
        console.log('✅ Session available, setting cookies for auto-login')
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          {
            cookies: {
              get(name: string) {
                return request.cookies.get(name)?.value
              },
              set(name: string, value: string, options: any) {
                response.cookies.set(name, value, options)
              },
              remove(name: string, options: any) {
                response.cookies.set(name, '', { ...options, maxAge: 0 })
              },
            },
          }
        )

        // Set the session using Supabase's method (this sets proper cookies)
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
        
        if (sessionError) {
          console.error('⚠️ Error setting session cookies:', sessionError)
        } else {
          console.log('✅ Session cookies set successfully')
        }
      } else {
        console.log('⚠️ No session returned - user will need to verify email first')
      }

      // Ensure user_id/supplier_id are generated (safety check if trigger failed)
      if (userData) {
        try {
          const adminSupabase = createAdminSupabaseClient()
          const { data: profile, error: profileCheckError } = await adminSupabase
            .from('profiles')
            .select('user_id, supplier_id, is_supplier')
            .eq('id', userData.id)
            .single()

          if (!profileCheckError && profile) {
            // If IDs are missing, generate them using database RPC functions
            if (isSupplier && !profile.supplier_id) {
              const { data: newSupplierId, error: idError } = await adminSupabase.rpc('generate_next_supplier_id')
              if (!idError && newSupplierId) {
                const { error: updateError } = await adminSupabase
                  .from('profiles')
                  .update({ supplier_id: newSupplierId })
                  .eq('id', userData.id)
                if (!updateError) {
                  logger.log('Generated supplier_id via fallback:', { userId: userData.id, supplierId: newSupplierId })
                }
              }
            } else if (!isSupplier && !profile.user_id) {
              const { data: newUserId, error: idError } = await adminSupabase.rpc('generate_next_user_id')
              if (!idError && newUserId) {
                const { error: updateError } = await adminSupabase
                  .from('profiles')
                  .update({ user_id: newUserId })
                  .eq('id', userData.id)
                if (!updateError) {
                  logger.log('Generated user_id via fallback:', { userId: userData.id, userReadableId: newUserId })
                }
              }
            }
          }
        } catch (idGenError) {
          logger.error('Error ensuring IDs are generated:', idGenError)
          // Don't fail registration if ID generation check fails
        }
      }

      // Assign plan immediately if supplier registration with planId
      if (isSupplier && planId && userData) {
        try {
          const adminSupabase = createAdminSupabaseClient()
          
          // Verify plan exists and is active
          const { data: plan, error: planError } = await adminSupabase
            .from('supplier_plans')
            .select('id, name, slug, price')
            .eq('id', planId)
            .eq('is_active', true)
            .single()

          if (planError || !plan) {
            logger.error('Invalid plan selected during registration:', planError)
          } else {
            const isPremiumPlan = plan.slug === 'premium' || plan.price > 0
            
            if (isPremiumPlan) {
              // Premium plan selected - store as pending and assign free plan first
              // Get free plan ID
              const { data: freePlan, error: freePlanError } = await adminSupabase
                .from('supplier_plans')
                .select('id')
                .eq('slug', 'free')
                .eq('is_active', true)
                .single()
              
              if (freePlanError || !freePlan) {
                logger.error('Failed to find free plan during premium registration:', freePlanError)
                // Still assign the premium plan as fallback, but log warning
                const { error: updateError } = await adminSupabase
                  .from('profiles')
                  .update({
                    supplier_plan_id: planId,
                    is_supplier: true,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', userData.id)
                if (updateError) {
                  logger.error('Failed to assign premium plan as fallback:', updateError)
                }
              } else {
                // Store premium plan as pending and assign free plan
                // Set payment_status to null since free plan is active (premium payment will set it to 'pending' when initiated)
                const { error: updateError } = await adminSupabase
                  .from('profiles')
                  .update({
                    supplier_plan_id: freePlan.id,
                    pending_plan_id: planId, // Use pending_plan_id (same as upgrade flow)
                    is_supplier: true,
                    payment_status: null, // Free plan uses null, premium will set to 'pending' when payment is initiated
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', userData.id)

                if (updateError) {
                  logger.error('Failed to assign free plan and store pending premium:', updateError)
                } else {
                  logger.log('Premium plan stored as pending, free plan assigned:', {
                    userId: userData.id,
                    email: email,
                    freePlanId: freePlan.id,
                    pendingPremiumPlanId: planId,
                    planName: plan.name,
                    planSlug: plan.slug,
                    planPrice: plan.price
                  })
                }
              }
            } else {
              // Free or Winga plan - assign immediately
              // Set payment_status to null to differentiate from premium (which uses 'pending')
              const { error: updateError } = await adminSupabase
                .from('profiles')
                .update({
                  supplier_plan_id: planId,
                  is_supplier: true,
                  payment_status: null, // Free/Winga plans use null, Premium uses 'pending'
                  updated_at: new Date().toISOString()
                })
                .eq('id', userData.id)

              if (updateError) {
                logger.error('Failed to assign plan during registration:', updateError)
              } else {
                logger.log('Plan assigned during registration:', {
                  userId: userData.id,
                  email: email,
                  planId: planId,
                  planName: plan.name,
                  planSlug: plan.slug
                })
              }
            }
          }
        } catch (planAssignError) {
          logger.error('Error assigning plan during registration:', planAssignError)
          // Don't fail registration if plan assignment fails
        }
      }

      // Notify admins when a supplier registers
      if (isSupplier && userData) {
        try {
          const adminSupabase = createAdminSupabaseClient()
          const { data: profile } = await adminSupabase
            .from('profiles')
            .select('company_name, email, supplier_plan_id')
            .eq('id', userData.id)
            .single()

          const companyName = profile?.company_name || profile?.email || validatedData.email
          
          // Get plan name if exists
          let planName = 'Supplier'
          if (profile?.supplier_plan_id) {
            const { data: plan } = await adminSupabase
              .from('supplier_plans')
              .select('name')
              .eq('id', profile.supplier_plan_id)
              .single()
            planName = plan?.name || 'Supplier'
          }

          await notifyAllAdmins(
            'supplier_registered',
            'New Supplier Registered 📝',
            `New supplier registered: ${companyName} (${validatedData.email}). Plan: ${planName}`,
            {
              supplier_id: userData.id,
              company_name: companyName,
              email: validatedData.email,
              plan_name: planName,
              action_url: `/siem-dashboard/suppliers?highlight=${userData.id}`
            }
          )
        } catch (notifError) {
          logger.error('Error notifying admins of supplier registration:', notifError)
          // Don't fail registration if notification fails
        }
      }

      return response
    } else {
      // Handle specific error types with appropriate status codes
      const statusCode = result.type === 'EMAIL_ALREADY_EXISTS' ? 409 : 
                        result.type === 'RATE_LIMIT_ERROR' ? 429 : 
                        result.type === 'VALIDATION_ERROR' ? 400 : 400
      
      return NextResponse.json(
        { 
          success: false,
          error: result.error,
          type: result.type
        },
        { status: statusCode }
      )
    }

  } catch (error) {
    console.error('Supabase registration error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'An unexpected error occurred. Please try again later.',
        type: 'SERVER_ERROR'
      },
      { status: 500 }
    )
  }
} 
