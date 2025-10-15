import { NextRequest, NextResponse } from 'next/server'
import { supabaseAuth } from '@/lib/supabase-auth'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, confirmPassword, phone } = body

    if (!name || !email || !password || !confirmPassword) {
      return NextResponse.json(
        { 
          success: false,
          error: 'All fields are required',
          type: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }

    const result = await supabaseAuth.signUp(name, email, password, confirmPassword, phone)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message || 'Account created successfully!',
        data: result.data
      }, { status: 201 })
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: result.error,
          type: result.type
        },
        { status: 400 }
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
