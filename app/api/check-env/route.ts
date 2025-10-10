import { NextResponse } from 'next/server'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() {
  try {
    const envInfo = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      // Add any other environment variables you want to check
    }

    return NextResponse.json(envInfo)
  } catch (error) {
    console.error("Environment check error:", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 
