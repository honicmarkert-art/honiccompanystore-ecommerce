import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { buildUrl } from '@/lib/url-utils'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { createErrorResponse, logError } from '@/lib/error-handler'
import { createSnippeCheckout, isSnippeConfigured, tzsAmount } from "@/lib/snippe-api"
import { getSupabaseClient } from "@/lib/supabase-server"
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

// POST /api/supplier/upgrade/payment - Create a Snippe checkout for a plan upgrade
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('supplier_upgrade_payment_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = await enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/upgrade/payment',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { success: false, error: rateLimitResult.reason },
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
        )
      }

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

    const body = await request.json()
    const { referenceId, customerDetails } = body

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

    // Get plan details from pending_plan_id
    const { data: plan } = await supabase
      .from('supplier_plans')
      .select('id, name, slug')
      .eq('id', profile.pending_plan_id)
      .single()

    const payment = {
      reference_id: profile.payment_reference_id,
      amount: profile.payment_amount,
      currency: profile.payment_currency,
      payment_status: profile.payment_status,
      plan: plan
    }

    if (tzsAmount(profile.payment_amount) == null) {
      return NextResponse.json({ success: false, error: "The saved plan amount cannot be charged." }, { status: 400 })
    }
    if (profile.payment_status === "paid") {
      return NextResponse.json({ success: false, error: "This plan is already paid." }, { status: 400 })
    }
    if (String(profile.payment_currency || "TZS").toUpperCase() !== "TZS") {
      return NextResponse.json({ success: false, error: "Snippe accepts Tanzanian shillings only." }, { status: 400 })
    }

    if (!isSnippeConfigured()) {
      return NextResponse.json(
        { success: false, error: "Payment gateway is not configured. Add SNIPPE_API_KEY on the server." },
        { status: 500 }
      )
    }

    const webhookUrl = buildUrl('/api/webhooks/snippe')
    const returnUrl = buildUrl('/supplier/dashboard', { payment: 'success', referenceId })

    // Get supplier profile for customer details
    const { data: supplierProfile } = await supabase
      .from('profiles')
      .select('email, full_name, phone')
      .eq('id', user.id)
      .single()

    logger.log('Creating Snippe checkout for plan payment:', {
      referenceId,
      amount: payment.amount,
      currency: payment.currency
    })

    const checkoutResult = await createSnippeCheckout({
      amount: parseFloat(payment.amount.toString()),
      orderReference: referenceId,
      customerName: customerDetails?.fullName || supplierProfile?.full_name || 'Supplier',
      customerEmail: customerDetails?.email || supplierProfile?.email || '',
      customerPhone: customerDetails?.phone || supplierProfile?.phone || undefined,
      redirectUrl: returnUrl,
      webhookUrl,
      description: `Supplier plan ${referenceId}`,
    })

    if (!checkoutResult.checkoutLink) {
      return NextResponse.json(
        { success: false, error: 'Failed' },
        { status: 500 }
      )
    }

    if (checkoutResult.reference) {
      await getSupabaseClient()
        .from("profiles")
        .update({
          clickpesa_transaction_id: checkoutResult.reference,
          payment_method: "snippe",
          payment_status: "pending",
          payment_failure_reason: null,
          payment_updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .in("payment_status", ["pending", "failed"])
    }

      logSecurityEvent('SUPPLIER_UPGRADE_PAYMENT_INITIATED', user.id, {
        referenceId,
        amount: payment.amount,
        currency: payment.currency,
        endpoint: '/api/supplier/upgrade/payment'
      })

      return NextResponse.json({
        success: true,
        checkoutUrl: checkoutResult.checkoutLink,
        referenceId: referenceId
      })
    } catch (error: any) {
      logError(error, {
        context: 'supplier_upgrade_payment_post',
        userId: user?.id,
        referenceId: body?.referenceId
      })
      return createErrorResponse(error, 500)
    }
  })
}

