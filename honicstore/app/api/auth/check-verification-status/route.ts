import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Email validation schema
const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address').max(255, 'Email address is too long')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    let validatedData
    try {
      validatedData = emailSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            success: false,
            error: error.errors[0]?.message || 'Invalid email address',
            isVerified: false
          },
          { status: 400 }
        )
      }
      throw error
    }

    const { email } = validatedData
    const sanitizedEmail = email.toLowerCase().trim()

    // Check if email is verified
    try {
      const adminSupabase = getSupabaseClient()
      
      // Check auth users list
      const { data: authUsers, error: listError } = await adminSupabase.auth.admin.listUsers()
      
      if (!listError && authUsers?.users) {
        const authUser = authUsers.users.find(u => u.email?.toLowerCase() === sanitizedEmail)
        
        if (authUser) {
          const isVerified = !!authUser.email_confirmed_at
          
          return NextResponse.json({
            success: true,
            isVerified: isVerified,
            email: sanitizedEmail,
            userId: authUser.id,
            emailConfirmedAt: authUser.email_confirmed_at
          })
        }
      }
      
      // User not found
      return NextResponse.json({
        success: true,
        isVerified: false,
        email: sanitizedEmail,
        message: 'User not found'
      })
    } catch (checkError: any) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to check verification status',
          isVerified: false
        },
        { status: 500 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
        isVerified: false
      },
      { status: 500 }
    )
  }
}


