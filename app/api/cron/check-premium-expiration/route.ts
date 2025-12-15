import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'
import { notifyAllAdmins, createNotification } from '@/lib/notification-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/cron/check-premium-expiration - Background job to downgrade expired Premium plans to Free
// This should be called by a cron job daily
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminSupabaseClient()

    // Get current date
    const now = new Date().toISOString()

    // Get Premium plan ID first
    const { data: premiumPlan } = await supabase
      .from('supplier_plans')
      .select('id')
      .eq('slug', 'premium')
      .eq('is_active', true)
      .single()

    if (!premiumPlan) {
      logger.log('✅ Premium plan not found, nothing to check')
      return NextResponse.json({
        success: true,
        message: 'Premium plan not found',
        downgradedCount: 0
      })
    }

    // Find all Premium plan suppliers with expired payments
    const { data: expiredPremiumSuppliers, error: fetchError } = await supabase
      .from('profiles')
      .select('id, supplier_plan_id, payment_expires_at')
      .eq('supplier_plan_id', premiumPlan.id)
      .eq('is_supplier', true)
      .not('payment_expires_at', 'is', null)
      .lt('payment_expires_at', now)

    if (fetchError) {
      logger.error('Error fetching expired Premium plans:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch expired plans' }, { status: 500 })
    }

    if (!expiredPremiumSuppliers || expiredPremiumSuppliers.length === 0) {
      logger.log('✅ No expired Premium plans found')
      return NextResponse.json({
        success: true,
        message: 'No expired Premium plans found',
        downgradedCount: 0
      })
    }

    // Get Free plan ID
    const { data: freePlan } = await supabase
      .from('supplier_plans')
      .select('id')
      .eq('slug', 'free')
      .eq('is_active', true)
      .single()

    if (!freePlan) {
      logger.error('Free plan not found')
      return NextResponse.json({ error: 'Free plan not found' }, { status: 500 })
    }

    // Downgrade all expired Premium plans to Free
    const supplierIds = expiredPremiumSuppliers.map((s: any) => s.id)
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        supplier_plan_id: freePlan.id,
        payment_status: null, // Free plan uses null to differentiate from premium (which uses 'pending')
        updated_at: new Date().toISOString()
      })
      .in('id', supplierIds)

    if (updateError) {
      logger.error('Error downgrading expired Premium plans:', updateError)
      return NextResponse.json({ error: 'Failed to downgrade plans' }, { status: 500 })
    }

    logger.log(`✅ Downgraded ${supplierIds.length} expired Premium plans to Free`)

    // Notify admins and suppliers about expired plans
    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase
        .from('profiles')
        .select('id, company_name, email')
        .in('id', supplierIds)

      for (const supplier of suppliers || []) {
        // Notify supplier
        try {
          await createNotification(
            supplier.id,
            'plan_expired',
            'Premium Plan Expired',
            `Your Premium plan has expired and your account has been automatically downgraded to the Free plan. You can upgrade again anytime.`,
            {
              plan_slug: 'premium',
              action_url: '/supplier/upgrade'
            }
          )
        } catch (error) {
          console.error(`Error notifying supplier ${supplier.id}:`, error)
        }

        // Notify admins (batch notification at end)
      }

      // Notify all admins about expired plans
      try {
        const companyNames = (suppliers || []).map(s => s.company_name || s.email || 'Unknown').join(', ')
        await notifyAllAdmins(
          'plan_expired',
          'Premium Plans Expired',
          `${supplierIds.length} Premium plan(s) have expired and been downgraded to Free: ${companyNames}`,
          {
            expired_count: supplierIds.length,
            supplier_ids: supplierIds
          }
        )
      } catch (error) {
        console.error('Error notifying admins of expired plans:', error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully downgraded ${supplierIds.length} expired Premium plans to Free`,
      downgradedCount: supplierIds.length
    })

  } catch (error: any) {
    logger.error('Error in check-premium-expiration cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}



