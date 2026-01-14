import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'
import { notifyAllAdmins } from '@/lib/notification-helpers'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/supplier/upgrade/initiate - Create upgrade transaction and return reference ID
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/supplier/upgrade/initiate',
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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_supplier, email, full_name, phone')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.is_supplier) {
      return NextResponse.json(
        { success: false, error: 'User is not a supplier' },
        { status: 403, headers }
      )
    }

    // Use admin client for the update to bypass RLS
    const adminSupabase = createAdminSupabaseClient()

    const body = await request.json()
    // Force currency to TZS for supplier plans (default)
    const { planId, amount, registrationNumber } = body
    const currency = 'TZS' // Always use TZS for supplier plan payments

    if (!planId || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: planId and amount' },
        { status: 400 }
      )
    }

    // Get current supplier plan
    const { data: currentProfile } = await adminSupabase
      .from('profiles')
      .select('supplier_plan_id')
      .eq('id', user.id)
      .single()

    let currentPlanSlug = null
    if (currentProfile?.supplier_plan_id) {
      const { data: currentPlan } = await adminSupabase
        .from('supplier_plans')
        .select('slug')
        .eq('id', currentProfile.supplier_plan_id)
        .single()
      currentPlanSlug = currentPlan?.slug || null
    }

    // Verify plan exists and get full plan details
    const { data: plan, error: planError } = await adminSupabase
      .from('supplier_plans')
      .select('id, name, slug, price, currency')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan selected' },
        { status: 400 }
      )
    }

    const targetPlanSlug = plan.slug

    // Validate plan transitions
    // Plan transition rules:
    // - Winga → Free: ✅
    // - Winga → Premium: ✅ (requires registration number)
    // - Free → Premium: ✅
    // - Free → Winga: ❌
    // - Premium → Free: ✅ (automatic when payment ends)
    // - Premium → Winga: ❌

    if (currentPlanSlug === 'free' && targetPlanSlug === 'winga') {
      return NextResponse.json(
        { success: false, error: 'Cannot upgrade from Free plan to Winga plan. Winga plan is only available during initial registration.' },
        { status: 400 }
      )
    }

    if (currentPlanSlug === 'premium' && targetPlanSlug === 'winga') {
      return NextResponse.json(
        { success: false, error: 'Cannot downgrade from Premium plan to Winga plan. Premium plan can only downgrade to Free plan.' },
        { status: 400 }
      )
    }

    // Winga → Premium requires registration number
    if (currentPlanSlug === 'winga' && targetPlanSlug === 'premium') {
      if (!registrationNumber || !registrationNumber.trim()) {
        return NextResponse.json(
          { success: false, error: 'Registration number (TIN No or NIDA No) is required to upgrade from Winga Plan to Premium Plan.' },
          { status: 400 }
        )
      }
      // Update profile with registration number if provided
      await adminSupabase
        .from('profiles')
        .update({ 
          tin_or_nida: registrationNumber.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
    }

    // Generate unique reference ID (32 characters, no hyphens for ClickPesa)
    const referenceId = uuidv4().replace(/-/g, '').substring(0, 32)

    // Calculate payment expiration date for Premium plan (1 month from now)
    let paymentExpiresAt = null
    if (plan.slug === 'premium') {
      const expirationDate = new Date()
      expirationDate.setMonth(expirationDate.getMonth() + 1)
      paymentExpiresAt = expirationDate.toISOString()
    }

    // Update profile with payment transaction details
    // Works for both: initial plan selection and plan upgrades
    // Store the plan_id in pending_plan_id temporarily, supplier_plan_id will be updated after successful payment
    // Use admin client to bypass RLS for payment transaction updates
    const { data: updatedProfile, error: updateError } = await adminSupabase
      .from('profiles')
      .update({
        payment_reference_id: referenceId,
        pending_plan_id: planId, // Store plan being paid for (will become supplier_plan_id after payment)
        payment_amount: parseFloat(amount),
        payment_currency: currency,
        payment_status: 'pending',
        payment_method: 'clickpesa',
        payment_created_at: new Date().toISOString(),
        payment_updated_at: new Date().toISOString(),
        payment_expires_at: paymentExpiresAt // Store expiration date for Premium plan
        // Note: supplier_plan_id will be updated by trigger after successful payment
      })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      logger.error('Error creating upgrade transaction:', updateError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create upgrade transaction',
          details: updateError.message || 'Unknown database error'
        },
        { status: 500 }
      )
    }

    logger.log('Supplier upgrade transaction created:', {
      referenceId: referenceId,
      supplierId: user.id,
      planId: planId,
      amount: amount
    })

    // Notify admins about plan upgrade request
    try {
      const { data: supplierProfile } = await adminSupabase
        .from('profiles')
        .select('company_name, email')
        .eq('id', user.id)
        .single()

      const companyName = supplierProfile?.company_name || supplierProfile?.email || 'Unknown'

      await notifyAllAdmins(
        'plan_upgrade_request',
        'Supplier Plan Upgrade Request 📈',
        `${companyName} has initiated an upgrade to ${plan.name} plan. Payment pending. Amount: ${currency} ${amount}`,
        {
          supplier_id: user.id,
          company_name: companyName,
          email: supplierProfile?.email || '',
          plan_slug: plan.slug,
          plan_name: plan.name,
          amount: parseFloat(amount),
          currency: currency,
          reference_id: referenceId,
          action_url: `/siem-dashboard/suppliers?highlight=${user.id}`
        }
      )
    } catch (notifError) {
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      upgrade: {
        referenceId: referenceId,
        amount: parseFloat(amount),
        currency: currency,
        plan: {
          id: plan.id,
          name: plan.name,
          slug: plan.slug
        }
      }
    })
  } catch (error: any) {
    logger.error('Error initiating supplier upgrade:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}



