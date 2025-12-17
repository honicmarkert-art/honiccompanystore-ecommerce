import { NextResponse } from 'next/server'



// Force dynamic rendering - don't pre-render during build

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export async function GET() {
  try {
    // Security: Only show safe/non-sensitive environment info
    // Never expose keys, secrets, or URLs in production
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    if (!isDevelopment) {
      // In production, only return minimal safe info
      return NextResponse.json({
        environment: 'production',
        status: 'operational'
      })
    }

    // In development, show more detailed info
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
      // Never expose actual values of environment variables
      supabaseUrlPreview: process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...` : 'Not set',
      appUrl: process.env.NEXT_PUBLIC_APP_URL
    }

    return NextResponse.json(envInfo)
  } catch (error) {
    console.error("Environment check error:", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 
