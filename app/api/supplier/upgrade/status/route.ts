import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

// GET /api/supplier/upgrade/status - Get upgrade transaction status
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

    const { searchParams } = new URL(request.url)
    const referenceId = searchParams.get('referenceId')

    if (!referenceId) {
      return NextResponse.json(
        { success: false, error: 'Missing referenceId' },
        { status: 400 }
      )
    }

    // Get payment transaction from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        payment_reference_id,
        payment_amount,
        payment_currency,
        payment_status,
        payment_method,
        clickpesa_transaction_id,
        payment_timestamp,
        payment_failure_reason,
        pending_plan_id
      `)
      .eq('id', user.id)
      .eq('payment_reference_id', referenceId)
      .single()

    if (profileError || !profile || !profile.payment_reference_id) {
      return NextResponse.json(
        { success: false, error: 'Payment transaction not found' },
        { status: 404 }
      )
    }

    // Get plan details
    let plan = null
    if (profile.pending_plan_id) {
      const { data: planData } = await supabase
        .from('supplier_plans')
        .select('id, name, slug')
        .eq('id', profile.pending_plan_id)
        .single()
      plan = planData
    }

    return NextResponse.json({
      success: true,
      payment: {
        reference_id: profile.payment_reference_id,
        amount: profile.payment_amount,
        currency: profile.payment_currency,
        payment_status: profile.payment_status,
        payment_method: profile.payment_method,
        clickpesa_transaction_id: profile.clickpesa_transaction_id,
        payment_timestamp: profile.payment_timestamp,
        failure_reason: profile.payment_failure_reason,
        plan: plan
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

