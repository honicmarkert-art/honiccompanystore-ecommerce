import { NextRequest, NextResponse } from 'next/server'
import { createNotification } from '@/lib/notification-helpers'
import { validateAuth } from '@/lib/auth-server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/notifications/welcome-supplier - Create welcome notification for supplier
export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const { user, error: authError } = await validateAuth(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { supplierId, companyName, planSlug } = body

    const userId = supplierId || user.id

    // Get supplier plan name
    const supabase = createAdminSupabaseClient()
    let planName = 'supplier'
    if (planSlug) {
      const { data: plan } = await supabase
        .from('supplier_plans')
        .select('name')
        .eq('slug', planSlug)
        .single()
      planName = plan?.name || planSlug
    }

    const welcomeMessage = planSlug === 'winga'
      ? `Welcome to the platform! You've successfully registered as a Winga supplier. As a broker/connector, you can start listing products and earning commissions. Please complete your business information to get started.`
      : `Welcome to the platform! You've successfully registered as a ${planName} supplier. Please complete your company information to activate your account and start listing products.`

    // Create welcome notification
    const result = await createNotification(
      userId,
      'welcome',
      'Welcome to the Platform! 🎉',
      welcomeMessage,
      {
        company_name: companyName,
        plan_slug: planSlug
      }
    )

    if (!result.success) {
      console.error('Failed to create welcome notification:', result.error)
      return NextResponse.json(
        { error: 'Failed to create notification' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Welcome notification created'
    })

  } catch (error: any) {
    console.error('Error creating welcome notification:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

