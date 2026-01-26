import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/supplier/billing - Get billing history and invoices
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = enhancedRateLimit(request)
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        endpoint: '/api/supplier/billing',
        reason: rateLimitResult.reason
      }, request)
      return NextResponse.json(
        { success: false, error: rateLimitResult.reason },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60', 'Content-Type': 'application/json' } }
      )
    }

    // Ensure we always return JSON
    const headers = {
      'Content-Type': 'application/json',
    }
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
    const adminSupabase = getSupabaseClient()
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, is_supplier')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.is_supplier) {
      return NextResponse.json(
        { success: false, error: 'User is not a supplier' },
        { status: 403, headers }
      )
    }

    // Get all payment transactions for this supplier
    // Check both current payment and payment_statuses array for history
    const { data: currentProfile, error: currentError } = await adminSupabase
      .from('profiles')
      .select(`
        id,
        payment_reference_id,
        payment_status,
        payment_amount,
        payment_currency,
        payment_timestamp,
        payment_created_at,
        payment_updated_at,
        payment_expires_at,
        payment_failure_reason,
        clickpesa_transaction_id,
        supplier_plan_id,
        pending_plan_id,
        payment_statuses
      `)
      .eq('id', user.id)
      .single()

    if (currentError) {
      logger.error('Error fetching billing data:', currentError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch billing data' },
        { status: 500, headers }
      )
    }

    // Get plan details
    let planDetails = null
    if (currentProfile.supplier_plan_id) {
      const { data: plan } = await adminSupabase
        .from('supplier_plans')
        .select('id, name, slug, price, currency, term')
        .eq('id', currentProfile.supplier_plan_id)
        .single()
      planDetails = plan
    }

    // Build invoice/billing records
    const invoices: any[] = []
    const invoiceMap = new Map<string, any>() // Use Map to avoid duplicates

    // Add payment history from payment_statuses array if available
    if (currentProfile.payment_statuses && Array.isArray(currentProfile.payment_statuses)) {
      currentProfile.payment_statuses.forEach((payment: any) => {
        if (payment.order_number && payment.payment_status) {
          const invoiceId = payment.id || payment.order_number
          invoiceMap.set(invoiceId, {
            id: invoiceId,
            invoice_number: `INV-${payment.order_number.substring(0, 8).toUpperCase()}`,
            reference_id: payment.order_number,
            transaction_id: payment.transaction_id || payment.order_number,
            plan_name: 'Premium Plan', // Default, will be updated if we have plan info
            plan_slug: 'premium',
            amount: parseFloat(payment.amount?.toString() || '0'),
            currency: 'TZS',
            status: payment.payment_status,
            payment_date: payment.created_at || payment.updated_at,
            created_at: payment.created_at,
            updated_at: payment.updated_at,
            expires_at: null,
            failure_reason: null,
            payment_method: payment.payment_method || 'clickpesa'
          })
        }
      })
    }

    // Add current payment as an invoice if it exists (will override if already in map)
    if (currentProfile.payment_reference_id && currentProfile.payment_status) {
      const invoiceId = currentProfile.payment_reference_id
      const paymentStatus = currentProfile.payment_status?.toLowerCase() || ''
      // Only include failure_reason if payment is actually failed or cancelled
      const failureReason = (paymentStatus === 'failed' || paymentStatus === 'cancelled') 
        ? currentProfile.payment_failure_reason 
        : null
      
      invoiceMap.set(invoiceId, {
        id: invoiceId,
        invoice_number: `INV-${currentProfile.payment_reference_id.substring(0, 8).toUpperCase()}`,
        reference_id: currentProfile.payment_reference_id,
        transaction_id: currentProfile.clickpesa_transaction_id || currentProfile.payment_reference_id,
        plan_name: planDetails?.name || 'Premium Plan',
        plan_slug: planDetails?.slug || 'premium',
        amount: parseFloat(currentProfile.payment_amount?.toString() || '0'),
        currency: currentProfile.payment_currency || 'TZS',
        status: currentProfile.payment_status,
        payment_date: currentProfile.payment_timestamp || currentProfile.payment_created_at,
        created_at: currentProfile.payment_created_at,
        updated_at: currentProfile.payment_updated_at,
        expires_at: currentProfile.payment_expires_at,
        failure_reason: failureReason,
        payment_method: 'clickpesa'
      })
    }

    // Convert map to array
    invoices.push(...Array.from(invoiceMap.values()))

    // Calculate totals
    const totalPaid = invoices
      .filter(inv => inv.status === 'paid' || inv.status === 'success')
      .reduce((sum, inv) => sum + inv.amount, 0)
    
    const totalFailed = invoices
      .filter(inv => inv.status === 'failed' || inv.status === 'cancelled')
      .reduce((sum, inv) => sum + inv.amount, 0)

    const totalFailedInvoices = invoices
      .filter(inv => inv.status === 'failed' || inv.status === 'cancelled')
      .length

    return NextResponse.json({
      success: true,
      invoices: invoices.sort((a, b) => {
        const dateA = new Date(a.created_at || a.payment_date || 0).getTime()
        const dateB = new Date(b.created_at || b.payment_date || 0).getTime()
        return dateB - dateA // Most recent first
      }),
      summary: {
        total_invoices: invoices.length,
        total_paid: totalPaid,
        total_failed: totalFailed,
        total_failed_invoices: totalFailedInvoices,
        currency: currentProfile.payment_currency || 'TZS'
      },
      current_plan: planDetails
    }, { headers })
  } catch (error: any) {
    logger.error('Error fetching supplier billing data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch billing data' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

