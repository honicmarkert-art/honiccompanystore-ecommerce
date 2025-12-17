import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendWelcomeUserEmail, sendWelcomeSupplierEmail } from '@/lib/user-email-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/auth/send-welcome-email - Send welcome email to user
// SECURED: Requires authentication and verifies user identity to prevent tampering
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {},
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please log in to continue.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { email, name, isSupplier } = body

    // SECURITY: Verify email matches authenticated user's email
    if (!email || email.toLowerCase().trim() !== user.email?.toLowerCase().trim()) {
      return NextResponse.json(
        { success: false, error: 'Email mismatch. You can only send welcome emails to your own account.' },
        { status: 403 }
      )
    }

    // SECURITY: If sending supplier email, verify user is actually a supplier
    if (isSupplier) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_supplier, company_name')
        .eq('id', user.id)
        .single()
      
      if (!profile?.is_supplier) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized. You must be a supplier to send supplier welcome emails.' },
          { status: 403 }
        )
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                   process.env.NEXT_PUBLIC_APP_URL ||
                   (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined)
    
    if (!appUrl) {
      console.error('❌ NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_APP_URL not configured')
      throw new Error('Base URL not configured. Please set NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL environment variable.')
    }

    if (isSupplier) {
      // Send supplier welcome email
      const result = await sendWelcomeSupplierEmail(email, {
        name: name || email.split('@')[0],
        companyName: name || 'Your Company',
        dashboardUrl: `${appUrl}/supplier/dashboard`,
        commissionRate: '5%'
      })

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Welcome email sent to supplier'
        })
      } else {
        return NextResponse.json(
          { error: result.error || 'Failed to send welcome email' },
          { status: 500 }
        )
      }
    } else {
      // Send regular user welcome email
      const result = await sendWelcomeUserEmail(email, {
        name: name || email.split('@')[0],
        accountUrl: `${appUrl}/account`
      })

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Welcome email sent'
        })
      } else {
        return NextResponse.json(
          { error: result.error || 'Failed to send welcome email' },
          { status: 500 }
        )
      }
    }
  } catch (error: any) {
    console.error('Error sending welcome email:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




