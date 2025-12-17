import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { 
  createCheckoutLink, 
  formatAmountForClickPesa,
  formatPhoneForClickPesa,
  isClickPesaConfigured,
  getConfigStatus,
  type CheckoutLinkRequest 
} from "@/lib/clickpesa-api"
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

// POST /api/supplier/upgrade/payment - Create ClickPesa checkout link for upgrade
export async function POST(request: NextRequest) {
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

    // Check if ClickPesa is configured
    if (!isClickPesaConfigured()) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Payment gateway is not properly configured. Please contact support.",
          debug: process.env.NODE_ENV === "development" ? getConfigStatus() : undefined
        },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                   process.env.NEXT_PUBLIC_APP_URL ||
                   (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined)
    
    if (!baseUrl) {
      console.error('❌ NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_APP_URL not configured')
      return NextResponse.json(
        { error: 'Server configuration error: Base URL not configured. Please set NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL environment variable.' },
        { status: 500 }
      )
    }
    
    const webhookUrl = `${baseUrl}/api/webhooks/supplier-upgrade`
    // Return directly to supplier dashboard after payment (user is already authenticated)
    const returnUrl = `${baseUrl}/supplier/dashboard?payment=success&referenceId=${referenceId}`
    const cancelUrl = `${baseUrl}/supplier/dashboard?payment=cancelled&referenceId=${referenceId}`

    // Get supplier profile for customer details
    const { data: supplierProfile } = await supabase
      .from('profiles')
      .select('email, full_name, phone')
      .eq('id', user.id)
      .single()

    logger.log('Creating ClickPesa checkout link for plan payment:', {
      referenceId,
      amount: payment.amount,
      currency: payment.currency
    })

    // Ensure currency is TZS (default for supplier plans)
    const paymentCurrency = (payment.currency === 'TZS' || !payment.currency) ? 'TZS' : payment.currency as 'TZS' | 'USD'
    
    // Prepare ClickPesa checkout link request
    const checkoutRequest: CheckoutLinkRequest = {
      totalPrice: formatAmountForClickPesa(parseFloat(payment.amount.toString())),
      orderReference: referenceId,
      orderCurrency: paymentCurrency,
      customerName: customerDetails?.fullName || supplierProfile?.full_name || 'Supplier',
      customerEmail: customerDetails?.email || supplierProfile?.email || '',
      customerPhone: customerDetails?.phone ? formatPhoneForClickPesa(customerDetails.phone) : (supplierProfile?.phone ? formatPhoneForClickPesa(supplierProfile.phone) : undefined),
      returnUrl: returnUrl,
      cancelUrl: cancelUrl,
      webhookUrl: webhookUrl
    }

    // Create checkout link using supplier credentials
    const checkoutResult = await createCheckoutLink(checkoutRequest, true)

    if (!checkoutResult.checkoutLink) {
      return NextResponse.json(
        { success: false, error: 'Failed to create checkout link' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: checkoutResult.checkoutLink,
      referenceId: referenceId
    })
  } catch (error: any) {
    logger.error('Error creating payment link for supplier upgrade:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create payment link', details: error.message },
      { status: 500 }
    )
  }
}

