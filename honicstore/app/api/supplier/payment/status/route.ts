import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// GET /api/supplier/payment/status - Check payment status by reference ID
export async function GET(request: NextRequest) {
  try {
    // Use regular client for authentication check
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

    const searchParams = request.nextUrl.searchParams
    const referenceId = searchParams.get('referenceId')

    if (!referenceId) {
      return NextResponse.json(
        { success: false, error: 'Reference ID is required' },
        { status: 400 }
      )
    }

    // Get payment information from profile
    const adminSupabase = getSupabaseClient()
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select(`
        id,
        payment_reference_id,
        payment_status,
        payment_amount,
        payment_currency,
        payment_failure_reason,
        pending_plan_id,
        supplier_plan_id
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

    return NextResponse.json({
      success: true,
      payment: {
        reference_id: profile.payment_reference_id,
        payment_status: profile.payment_status, // Use payment_status to match frontend expectations
        status: profile.payment_status, // Also include status for backward compatibility
        amount: profile.payment_amount,
        currency: profile.payment_currency,
        payment_failure_reason: profile.payment_failure_reason, // Use payment_failure_reason to match frontend
        failure_reason: profile.payment_failure_reason, // Also include failure_reason for backward compatibility
        pending_plan_id: profile.pending_plan_id,
        current_plan_id: profile.supplier_plan_id
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to check payment status', details: error.message },
      { status: 500 }
    )
  }
}


