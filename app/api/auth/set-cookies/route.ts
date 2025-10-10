import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const setCookiesSchema = z.object({
  access_token: z.string().min(1, 'Access token is required'),
  refresh_token: z.string().min(1, 'Refresh token is required')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = setCookiesSchema.parse(body)
    
    const isProd = process.env.NODE_ENV === 'production'
    
    const response = NextResponse.json({
      success: true,
      message: 'Auth cookies set successfully'
    }, { status: 200 })
    
    // Set the official Supabase auth token cookies
    response.cookies.set('sb-access-token', validatedData.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 // 1 hour
    })
    
    response.cookies.set('sb-refresh-token', validatedData.refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
    
    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid token data' },
        { status: 400 }
      )
    }
    
    console.error('Set cookies error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to set auth cookies' },
      { status: 500 }
    )
  }
}
