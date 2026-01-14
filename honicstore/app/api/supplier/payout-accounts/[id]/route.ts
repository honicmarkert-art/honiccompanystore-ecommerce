import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseClient } from '@/lib/supabase-server'
import { encryptPayoutAccount, decryptPayoutAccount } from '@/lib/payout-encryption'
import { cookies } from 'next/headers'
import { enhancedRateLimit, logSecurityEvent } from '@/lib/enhanced-rate-limit'
import { performanceMonitor } from '@/lib/performance-monitor'
import { clearCache } from '@/lib/database-optimization'
import { createErrorResponse, logError } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PUT /api/supplier/payout-accounts/[id] - Update a payout account
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return performanceMonitor.measure('supplier_payout_accounts_put', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/payout-accounts/[id]',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { success: false, error: rateLimitResult.reason },
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60', 'Content-Type': 'application/json' } }
        )
      }

    const headers = { 'Content-Type': 'application/json' }
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
        { success: false, error: 'Unauthorized' },
        { status: 401, headers }
      )
    }

    const { id } = await params
    const body = await request.json()
    const {
      account_name,
      account_number,
      bank_name,
      mobile_provider,
      mobile_number,
      paypal_email,
      is_default
    } = body

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

    // If setting as default, unset other default accounts
    if (is_default && !account.is_default) {
      await adminSupabase
        .from('supplier_payout_accounts')
        .update({ is_default: false })
        .eq('supplier_id', user.id)
        .eq('is_default', true)
    }

    // Update the account - encrypt sensitive data before storing
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (account_name) updateData.account_name = account_name.trim()
    if (is_default !== undefined) updateData.is_default = is_default

    if (account.account_type === 'bank') {
      if (account_number) updateData.account_number = account_number.trim()
      if (bank_name) updateData.bank_name = bank_name.trim()
    } else if (account.account_type === 'mobile_money') {
      if (mobile_provider) updateData.mobile_provider = mobile_provider.trim()
      if (mobile_number) updateData.mobile_number = mobile_number.trim()
    } else if (account.account_type === 'paypal') {
      if (paypal_email) updateData.paypal_email = paypal_email.trim()
    }

    // Encrypt sensitive fields before storing
    const encryptedUpdateData = encryptPayoutAccount(updateData)

    const { data: updatedAccount, error: updateError } = await adminSupabase
      .from('supplier_payout_accounts')
      .update(encryptedUpdateData)
      .eq('id', id)
      .select()
      .single()

      if (updateError) {
        logError(updateError, {
          context: 'supplier_payout_accounts_put',
          userId: user.id,
          accountId: id
        })
        return createErrorResponse(updateError, 'Failed to update payout account', 500)
      }

      // Clear cache
      clearCache()

      // Decrypt sensitive fields before returning to client
      const decryptedAccount = decryptPayoutAccount(updatedAccount)

      logSecurityEvent('SUPPLIER_PAYOUT_ACCOUNT_UPDATED', user.id, {
        accountId: id,
        endpoint: '/api/supplier/payout-accounts/[id]'
      })

      return NextResponse.json({
        success: true,
        account: decryptedAccount
      })
    } catch (error: any) {
      logError(error, {
        context: 'supplier_payout_accounts_put'
      })
      return createErrorResponse(error, 'Internal server error', 500)
    }
  })
}

// DELETE /api/supplier/payout-accounts/[id] - Delete a payout account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return performanceMonitor.measure('supplier_payout_accounts_delete', async () => {
    try {
      // Rate limiting
      const rateLimitResult = enhancedRateLimit(request)
      if (!rateLimitResult.allowed) {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          endpoint: '/api/supplier/payout-accounts/[id]',
          reason: rateLimitResult.reason
        }, request)
        return NextResponse.json(
          { success: false, error: rateLimitResult.reason },
          { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60', 'Content-Type': 'application/json' } }
        )
      }

    const headers = { 'Content-Type': 'application/json' }
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
        { success: false, error: 'Unauthorized' },
        { status: 401, headers }
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

    // Delete the account
    const { error: deleteError } = await adminSupabase
      .from('supplier_payout_accounts')
      .delete()
      .eq('id', id)

      if (deleteError) {
        logError(deleteError, {
          context: 'supplier_payout_accounts_delete',
          userId: user.id,
          accountId: id
        })
        return createErrorResponse(deleteError, 'Failed to delete payout account', 500)
      }

      // Clear cache
      clearCache()

      logSecurityEvent('SUPPLIER_PAYOUT_ACCOUNT_DELETED', user.id, {
        accountId: id,
        endpoint: '/api/supplier/payout-accounts/[id]'
      })

      return NextResponse.json({
        success: true,
        message: 'Account deleted successfully'
      })
    } catch (error: any) {
      logError(error, {
        context: 'supplier_payout_accounts_delete'
      })
      return createErrorResponse(error, 'Internal server error', 500)
    }
  })
}

