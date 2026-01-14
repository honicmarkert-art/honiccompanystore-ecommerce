import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseClient } from '@/lib/supabase-server'
import { decryptPayoutAccount } from '@/lib/payout-encryption'
import { cookies } from 'next/headers'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { clearCache } from '@/lib/database-optimization'
import { createErrorResponse, logError } from '@/lib/error-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/supplier/payout-accounts/[id]/set-default - Set a payout account as default
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return performanceMonitor.measure('supplier_payout_accounts_set_default', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/payout-accounts/[id]/set-default',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { error: rateLimitResult.reason },
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
        )
      }
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const adminSupabase = getSupabaseClient()

    // Verify account belongs to user
    const { data: account, error: accountError } = await adminSupabase
      .from('supplier_payout_accounts')
      .select('*')
      .eq('id', id)
      .eq('supplier_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    // Unset all other default accounts
    await adminSupabase
      .from('supplier_payout_accounts')
      .update({ is_default: false })
      .eq('supplier_id', user.id)
      .eq('is_default', true)

    // Set this account as default
    const { data: updatedAccount, error: updateError } = await adminSupabase
      .from('supplier_payout_accounts')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

      if (updateError) {
        logError(updateError, {
          context: 'supplier_payout_accounts_set_default',
          userId: user.id,
          accountId: id
        })
        return createErrorResponse(updateError, 'Failed to set default account', 500)
      }

      // Clear cache
      clearCache()

      // Decrypt sensitive fields before returning to client
      const decryptedAccount = decryptPayoutAccount(updatedAccount)

      logSecurityEvent('SUPPLIER_PAYOUT_ACCOUNT_SET_DEFAULT', user.id, {
        accountId: id,
        endpoint: '/api/supplier/payout-accounts/[id]/set-default'
      })

      return NextResponse.json({
        success: true,
        account: decryptedAccount
      })
    } catch (error: any) {
      logError(error, {
        context: 'supplier_payout_accounts_set_default'
      })
      return createErrorResponse(error, 'Internal server error', 500)
    }
  })
}

