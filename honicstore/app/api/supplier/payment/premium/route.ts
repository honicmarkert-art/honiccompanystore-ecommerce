import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { buildUrl } from '@/lib/url-utils'
import { performanceMonitor } from '@/lib/performance-monitor'
import { getCachedData, setCachedData, CACHE_TTL, clearCache } from '@/lib/database-optimization'
import { createErrorResponse, logError } from '@/lib/error-handler'
import { 
  createCheckoutLink, 
  formatAmountForClickPesa,
  formatPhoneForClickPesa,
  isClickPesaConfigured,
  getConfigStatus,
  type CheckoutLinkRequest 
} from '@/lib/clickpesa-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/supplier/payment/premium - Create payment for premium plan upgrade
export async function POST(request: NextRequest) {
  return performanceMonitor.measure('supplier_payment_premium_post', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/payment/premium',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { success: false, error: rateLimitResult.reason },
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60', 'Content-Type': 'application/json' } }
        )
      }

    const headers = { 'Content-Type': 'application/json' }
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
        { status: 401, headers }
      )
    }

    // Check if user is a supplier
    const adminSupabase = createAdminSupabaseClient()
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, is_supplier, email, full_name, phone, pending_plan_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.is_supplier) {
      return NextResponse.json(
        { success: false, error: 'User is not a supplier' },
        { status: 403, headers }
      )
    }

    const body = await request.json()
    const { planId, billingCycle } = body
    const currency = 'TZS' // Always use TZS for supplier plan payments

    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: planId' },
        { status: 400 }
      )
    }

    // Verify plan exists and is premium/paid plan
    const { data: plan, error: planError } = await adminSupabase
      .from('supplier_plans')
      .select('id, name, slug, price, currency, yearly_price')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan selected' },
        { status: 400 }
      )
    }

    // Ensure it's a premium/paid plan
    const isPremiumPlan = plan.slug === 'premium' || plan.price > 0
    if (!isPremiumPlan) {
      return NextResponse.json(
        { success: false, error: 'This endpoint is only for premium plan payments' },
        { status: 400 }
      )
    }

    // Verify plan matches pending premium plan
    if (profile.pending_plan_id && profile.pending_plan_id !== planId) {
      return NextResponse.json(
        { success: false, error: 'Plan ID does not match your pending premium plan' },
        { status: 400 }
      )
    }

    // Determine expected amount based on billing cycle
    const normalizedBillingCycle = billingCycle === 'yearly' ? 'yearly' : 'monthly'
    const basePrice = parseFloat(plan.price.toString())
    const yearlyPriceFromDb = (plan as any).yearly_price != null
      ? parseFloat((plan as any).yearly_price.toString())
      : null

    if (normalizedBillingCycle === 'yearly') {
      if (yearlyPriceFromDb == null || Number.isNaN(yearlyPriceFromDb)) {
        return NextResponse.json(
          { success: false, error: 'Yearly price is not configured for this plan. Please contact support.' },
          { status: 400 }
        )
      }
    }

    const expectedAmount =
      normalizedBillingCycle === 'yearly'
        ? yearlyPriceFromDb!
        : basePrice

    // Generate unique reference ID for this payment
    // ClickPesa requires alphanumeric characters only (no hyphens) and max 32 characters
    // Use same format as upgrade route: UUID without hyphens, limited to 32 characters
    const referenceId = uuidv4().replace(/-/g, '').substring(0, 32)

    // Store payment information in profile (similar to upgrade flow)
    // Ensure pending_plan_id is set if not already set
    const updateData: any = {
      payment_reference_id: referenceId,
      payment_amount: expectedAmount.toString(),
      payment_currency: currency,
      payment_status: 'pending',
      payment_method: 'clickpesa',
      payment_created_at: new Date().toISOString(),
      payment_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Set pending_plan_id if not already set
    if (!profile.pending_plan_id) {
      updateData.pending_plan_id = planId
    }
    
    // Calculate payment expiration date for Premium plan
    if (plan.slug === 'premium') {
      const expirationDate = new Date()
      if (normalizedBillingCycle === 'yearly') {
        expirationDate.setFullYear(expirationDate.getFullYear() + 1)
      } else {
        expirationDate.setMonth(expirationDate.getMonth() + 1)
      }
      updateData.payment_expires_at = expirationDate.toISOString()
    }

    const { error: updateError } = await adminSupabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (updateError) {
      logger.error('Failed to store payment information:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to initialize payment' },
        { status: 500 }
      )
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

    const webhookUrl = buildUrl('/api/webhooks/supplier-upgrade')
    const returnUrl = buildUrl('/supplier/dashboard', { payment: 'success', referenceId })
    const cancelUrl = buildUrl('/supplier/dashboard', { payment: 'cancelled', referenceId })

    logger.log('Creating ClickPesa checkout link for premium plan payment:', {
      referenceId,
      planId,
      billingCycle: normalizedBillingCycle,
      expectedAmount,
      currency,
      userId: user.id
    })

    // Prepare ClickPesa checkout link request
    const checkoutRequest: CheckoutLinkRequest = {
      totalPrice: formatAmountForClickPesa(expectedAmount),
      orderReference: referenceId,
      orderCurrency: currency as 'TZS' | 'USD',
      customerName: profile.full_name || 'Supplier',
      customerEmail: profile.email || '',
      customerPhone: profile.phone ? formatPhoneForClickPesa(profile.phone) : undefined,
      returnUrl: returnUrl,
      cancelUrl: cancelUrl,
      webhookUrl: webhookUrl
    }

    // Create checkout link
    // Create checkout link using supplier credentials
    const checkoutResult = await createCheckoutLink(checkoutRequest, true)

    if (!checkoutResult.checkoutLink) {
      return NextResponse.json(
        { success: false, error: 'Failed to create checkout link' },
        { status: 500 }
      )
    }

      logSecurityEvent('SUPPLIER_PREMIUM_PAYMENT_INITIATED', user.id, {
        planId,
        referenceId,
        amount: expectedAmount,
        currency,
        endpoint: '/api/supplier/payment/premium'
      })

      return NextResponse.json({
        success: true,
        checkoutUrl: checkoutResult.checkoutLink,
        referenceId: referenceId
      })
    } catch (error: any) {
      logError(error, {
        context: 'supplier_payment_premium_post',
        userId: user?.id,
        planId: body?.planId
      })
      return createErrorResponse(error, 'Failed to create payment link', 500)
    }
  })
}

