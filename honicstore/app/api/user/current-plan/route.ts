import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET - Get current user's supplier plan
export async function GET(request: NextRequest) {
  try {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile to check if they're a supplier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_supplier, supplier_plan_id, pending_plan_id, payment_status, payment_expires_at')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    // If not a supplier, return null plan
    if (!profile?.is_supplier) {
      return NextResponse.json({
        success: true,
        plan: null,
        isSupplier: false
      })
    }

    // If supplier_plan_id exists, fetch the plan details
    if (profile.supplier_plan_id) {
      const { data: plan, error: planError } = await supabase
        .from('supplier_plans')
        .select('*')
        .eq('id', profile.supplier_plan_id)
        .single()

      if (!planError && plan) {
        // SECURITY: For Premium plans, verify payment status
        // Premium plans require valid payment to access features
        let effectivePlan = plan
        if (plan.slug === 'premium' || plan.price > 0) {
          const paymentStatus = profile.payment_status?.toLowerCase()
          const paymentExpiresAt = profile.payment_expires_at ? new Date(profile.payment_expires_at) : null
          const now = new Date()
          
          // Check if payment is valid
          const hasValidPayment = 
            paymentStatus === 'paid' || 
            paymentStatus === 'completed' ||
            (paymentExpiresAt && paymentExpiresAt > now)
          
          if (!hasValidPayment) {
            // Premium plan without valid payment - return free plan instead
            const { data: freePlan } = await supabase
              .from('supplier_plans')
              .select('*')
              .eq('slug', 'free')
              .eq('is_active', true)
              .single()
            
            effectivePlan = freePlan || plan
          }
        }

        return NextResponse.json({
          success: true,
          plan: {
            id: effectivePlan.id,
            name: effectivePlan.name,
            slug: effectivePlan.slug,
            price: effectivePlan.price,
            currency: effectivePlan.currency,
            term: effectivePlan.term
          },
          isSupplier: true,
          pendingPlanId: profile.pending_plan_id || null, // Include pending plan info
          paymentStatus: profile.payment_status || null, // Include payment status to determine button text
          hasValidPremiumPayment: (plan.slug === 'premium' || plan.price > 0) && 
            (profile.payment_status === 'paid' || profile.payment_status === 'completed' ||
             (profile.payment_expires_at && new Date(profile.payment_expires_at) > new Date()))
        })
      }
    }

    // Default to Free plan if supplier but no plan assigned
    const { data: freePlan, error: freePlanError } = await supabase
      .from('supplier_plans')
      .select('*')
      .eq('slug', 'free')
      .eq('is_active', true)
      .single()

    if (!freePlanError && freePlan) {
      return NextResponse.json({
        success: true,
        plan: {
          id: freePlan.id,
          name: freePlan.name,
          slug: freePlan.slug,
          price: freePlan.price,
          currency: freePlan.currency,
          term: freePlan.term
        },
        isSupplier: true,
        paymentStatus: profile?.payment_status || null // Include payment status
      })
    }

    return NextResponse.json({
      success: true,
      plan: null,
      isSupplier: true
    })

  } catch (error) {
    console.error('Error fetching current plan:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

