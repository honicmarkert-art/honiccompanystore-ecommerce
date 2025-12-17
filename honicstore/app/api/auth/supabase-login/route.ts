import { NextRequest, NextResponse } from 'next/server'
import { supabaseAuth } from '@/lib/supabase-auth'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Email and password are required',
          type: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }

    const result = await supabaseAuth.signIn(email, password)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Login successful!',
        data: result.data
      })
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: result.error,
          type: result.type
        },
        { status: 401 }
      )
    }

  } catch (error) {
    console.error('Supabase login error:', error)
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
